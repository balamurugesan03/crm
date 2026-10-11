import * as z from 'zod/v4';
import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import Payment, { PAYMENT_MODES } from '../models/Payment.js';
import Organization from '../models/Organization.js';
import Message from '../models/Message.js';
import '../models/Contact.js'; // registered for populate() when used outside the full app (scheduler)
import { AppError } from '../utils/AppError.js';
import { catchAsync } from '../utils/catchAsync.js';
import { nextNumber } from '../utils/numbering.js';
import { ownerScope } from '../utils/visibility.js';
import { toCsv } from '../utils/csv.js';
import { GST_STATES } from '../utils/gstStates.js';
import { recomputeInvoice, startOfToday } from '../services/invoiceService.js';
import { sendEmail, sendWhatsapp, isSmtpReady, isWhatsappReady, toWhatsappNumber } from '../services/messagingService.js';

const DAY = 864e5;
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const OPEN_STATUSES = ['sent', 'partially_paid', 'overdue'];

async function findInvoice(req, id) {
  if (!mongoose.isValidObjectId(id)) throw new AppError('Invoice not found', 404);
  const invoice = await Invoice.findOne({ _id: id, organization: req.tenantId, ...ownerScope(req, 'ownerUser') });
  if (!invoice) throw new AppError('Invoice not found', 404);
  return invoice;
}

// ---------- Payments ----------

const paymentSchema = z.object({
  amount: z.number().positive().max(1e11),
  tds: z.number().min(0).max(1e10).default(0),
  date: z.coerce.date().optional(),
  mode: z.enum(PAYMENT_MODES).default('bank_transfer'),
  reference: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const recordPayment = catchAsync(async (req, res) => {
  const invoice = await findInvoice(req, req.params.id);
  if (invoice.status === 'void') throw new AppError('Cannot record a payment on a void invoice', 400);
  const data = paymentSchema.parse(req.body);
  const balance = r2(invoice.total - (invoice.amountPaid || 0));
  if (r2(data.amount + data.tds) > balance + 0.5) {
    throw new AppError(`Payment exceeds the balance due (${inr(balance)})`, 400);
  }
  if (data.date && data.date > new Date(Date.now() + DAY)) throw new AppError('Payment date cannot be in the future', 400);

  const payment = await Payment.create({
    ...data,
    date: data.date || new Date(),
    organization: req.tenantId,
    receiptNumber: await nextNumber(Payment, req.tenantId, 'RCPT'),
    invoice: invoice._id,
    company: invoice.company,
    contact: invoice.contact,
    recordedBy: req.user._id,
  });
  const updated = await recomputeInvoice(invoice._id);
  res.status(201).json({ payment, invoice: updated });
});

export const listInvoicePayments = catchAsync(async (req, res) => {
  const invoice = await findInvoice(req, req.params.id);
  const payments = await Payment.find({ organization: req.tenantId, invoice: invoice._id }).sort({ date: -1 }).populate('recordedBy', 'name');
  res.json(payments);
});

export const listPayments = catchAsync(async (req, res) => {
  const filter = { organization: req.tenantId };
  if (req.query.from || req.query.to) {
    filter.date = {};
    if (req.query.from) filter.date.$gte = new Date(req.query.from);
    if (req.query.to) filter.date.$lte = new Date(req.query.to);
  }
  if (req.query.mode && PAYMENT_MODES.includes(req.query.mode)) filter.mode = req.query.mode;
  const payments = await Payment.find(filter)
    .sort({ date: -1 })
    .limit(Math.min(Number(req.query.limit) || 200, 1000))
    .populate('invoice', 'invoiceNumber total')
    .populate('company', 'name')
    .populate('recordedBy', 'name');
  res.json(payments);
});

export const deletePayment = catchAsync(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.paymentId)) throw new AppError('Payment not found', 404);
  const payment = await Payment.findOneAndDelete({ _id: req.params.paymentId, organization: req.tenantId });
  if (!payment) throw new AppError('Payment not found', 404);
  await recomputeInvoice(payment.invoice);
  res.status(204).send();
});

// ---------- Receivables ----------

const BUCKETS = [
  { key: 'current', label: 'Not yet due', test: (d) => d <= 0 },
  { key: 'd1_30', label: '1–30 days', test: (d) => d >= 1 && d <= 30 },
  { key: 'd31_60', label: '31–60 days', test: (d) => d >= 31 && d <= 60 },
  { key: 'd61_90', label: '61–90 days', test: (d) => d >= 61 && d <= 90 },
  { key: 'd90_plus', label: '90+ days', test: (d) => d > 90 },
];

export const receivables = catchAsync(async (req, res) => {
  const today = startOfToday();
  const scope = ownerScope(req, 'ownerUser');
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const ninetyAgo = new Date(today.getTime() - 90 * DAY);

  const [open, collectedMonth, sales90] = await Promise.all([
    Invoice.find({ organization: req.tenantId, ...scope, status: { $in: OPEN_STATUSES } })
      .populate('company', 'name')
      .populate('contact', 'firstName lastName email phone')
      .sort({ dueDate: 1 }),
    Payment.aggregate([
      { $match: { organization: new mongoose.Types.ObjectId(String(req.tenantId)), date: { $gte: monthStart } } },
      { $group: { _id: null, amount: { $sum: { $add: ['$amount', '$tds'] } }, count: { $sum: 1 } } },
    ]),
    Invoice.aggregate([
      { $match: { organization: new mongoose.Types.ObjectId(String(req.tenantId)), status: { $nin: ['draft', 'void'] }, issueDate: { $gte: ninetyAgo } } },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]),
  ]);

  const totals = Object.fromEntries(BUCKETS.map((b) => [b.key, 0]));
  const byCustomer = new Map();
  const invoices = open.map((inv) => {
    const balance = r2(inv.total - (inv.amountPaid || 0));
    const daysOverdue = inv.dueDate ? Math.floor((today - new Date(inv.dueDate)) / DAY) : 0;
    const bucket = BUCKETS.find((b) => b.test(daysOverdue)).key;
    totals[bucket] = r2(totals[bucket] + balance);

    const customerKey = String(inv.company?._id || inv.contact?._id || 'unknown');
    const name = inv.company?.name || (inv.contact ? `${inv.contact.firstName} ${inv.contact.lastName || ''}`.trim() : 'Unassigned');
    const c = byCustomer.get(customerKey) || { key: customerKey, name, invoices: 0, total: 0, ...Object.fromEntries(BUCKETS.map((b) => [b.key, 0])) };
    c.invoices += 1;
    c.total = r2(c.total + balance);
    c[bucket] = r2(c[bucket] + balance);
    byCustomer.set(customerKey, c);

    return {
      _id: inv._id,
      invoiceNumber: inv.invoiceNumber,
      customer: name,
      contact: inv.contact,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      total: inv.total,
      amountPaid: inv.amountPaid || 0,
      balance,
      daysOverdue: Math.max(0, daysOverdue),
      bucket,
      status: inv.status,
      lastReminderAt: inv.reminders?.length ? inv.reminders[inv.reminders.length - 1].sentAt : null,
      reminderCount: inv.reminders?.length || 0,
    };
  });

  const outstanding = r2(Object.values(totals).reduce((s, v) => s + v, 0));
  const overdue = r2(outstanding - totals.current);
  // DSO ≈ receivables / (credit sales over 90 days) × 90
  const dso = sales90[0]?.total ? Math.round((outstanding / sales90[0].total) * 90) : 0;

  res.json({
    summary: {
      outstanding,
      overdue,
      overdueCount: invoices.filter((i) => i.daysOverdue > 0).length,
      collectedThisMonth: r2(collectedMonth[0]?.amount || 0),
      paymentsThisMonth: collectedMonth[0]?.count || 0,
      dso,
    },
    buckets: BUCKETS.map((b) => ({ key: b.key, label: b.label, amount: totals[b.key] })),
    customers: [...byCustomer.values()].sort((a, b) => b.total - a.total),
    invoices,
  });
});

// ---------- Payment reminders ----------

function reminderText({ invoice, org, contactName, stage }) {
  const bp = org.billingProfile || {};
  const due = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : null;
  const balance = r2(invoice.total - (invoice.amountPaid || 0));
  const opener = stage === 'before'
    ? `This is a friendly reminder that invoice ${invoice.invoiceNumber} is due on ${due}.`
    : stage === 'due'
      ? `Invoice ${invoice.invoiceNumber} is due today.`
      : `Our records show invoice ${invoice.invoiceNumber}${due ? `, due on ${due},` : ''} is still unpaid.`;
  const pay = [
    bp.upiId && `UPI: ${bp.upiId}`,
    bp.bankAccount && `Bank: ${bp.bankName || ''} A/c ${bp.bankAccount}${bp.ifsc ? ` · IFSC ${bp.ifsc}` : ''}`,
  ].filter(Boolean);
  return {
    subject: `Payment reminder: ${invoice.invoiceNumber} · ${inr(balance)} due`,
    body: [
      `Hi ${contactName || 'there'},`,
      '',
      opener,
      `Amount due: ${inr(balance)}`,
      ...(pay.length ? ['', 'You can pay via:', ...pay] : []),
      '',
      'If you have already paid, please ignore this message or share the payment reference so we can update our records.',
      '',
      `Thank you,`,
      bp.legalName || org.name,
    ].join('\n'),
  };
}

export async function sendInvoiceReminder({ organization, invoiceId, channel, auto = false, stage = 'after', user = null }) {
  const invoice = await Invoice.findOne({ _id: invoiceId, organization }).populate('contact', 'firstName email phone');
  if (!invoice) throw new AppError('Invoice not found', 404);
  if (!OPEN_STATUSES.includes(invoice.status)) throw new AppError('Only unpaid invoices can be reminded', 400);
  const org = await Organization.findById(organization).select('name billingProfile integrations');
  const { subject, body } = reminderText({ invoice, org, contactName: invoice.contact?.firstName, stage });

  let to;
  let via = 'api';
  let waUrl;
  if (channel === 'email') {
    to = invoice.contact?.email;
    if (!to) throw new AppError('The invoice contact has no email address', 400);
    if (!isSmtpReady(org.integrations?.smtp)) throw new AppError('Set up SMTP in Settings → Integrations to email reminders', 400);
    await sendEmail(organization, { to, subject, body, replyTo: user?.email || org.billingProfile?.email });
  } else {
    to = invoice.contact?.phone;
    if (!to) throw new AppError('The invoice contact has no phone number', 400);
    if (isWhatsappReady(org.integrations?.whatsapp)) {
      await sendWhatsapp(organization, { to, body });
    } else {
      via = 'link';
      waUrl = `https://wa.me/${toWhatsappNumber(to)}?text=${encodeURIComponent(body)}`;
    }
  }

  invoice.reminders.push({ channel, auto, stage, to });
  await invoice.save();
  await Message.create({
    organization,
    channel,
    via,
    to,
    subject: channel === 'email' ? subject : undefined,
    body,
    status: via === 'link' ? 'logged' : 'sent',
    entityType: invoice.contact ? 'Contact' : undefined,
    entityId: invoice.contact?._id,
    sentBy: user?._id,
  });
  return { ok: true, via, waUrl };
}

export const remindInvoice = catchAsync(async (req, res) => {
  const { channel } = z.object({ channel: z.enum(['email', 'whatsapp']) }).parse(req.body);
  await findInvoice(req, req.params.id);
  res.json(await sendInvoiceReminder({ organization: req.tenantId, invoiceId: req.params.id, channel, user: req.user }));
});

// ---------- GSTR-1 ----------

// Inter-state supplies to unregistered buyers above this invoice value go in B2CL (₹1 lakh from Aug 2024).
const B2CL_THRESHOLD = 100000;
const stateLabel = (code) => {
  const name = GST_STATES.find(([c]) => c === code)?.[1];
  return code ? `${code}-${name || ''}` : '';
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// GST offline tool format: dd-Mmm-yyyy
const gstDate = (d) => {
  const x = new Date(d);
  return `${String(x.getDate()).padStart(2, '0')}-${MONTHS[x.getMonth()]}-${x.getFullYear()}`;
};

export const gstr1 = catchAsync(async (req, res) => {
  const period = req.query.period;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period || '')) throw new AppError('period must be YYYY-MM', 400);
  const [y, m] = period.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);

  const [org, invoices] = await Promise.all([
    Organization.findById(req.tenantId).select('billingProfile'),
    Invoice.find({ organization: req.tenantId, status: { $nin: ['draft', 'void'] }, issueDate: { $gte: start, $lt: end } })
      .populate('company', 'name gstin stateCode')
      .sort({ issueDate: 1 }),
  ]);
  const sellerState = org?.billingProfile?.stateCode;

  const b2b = [];
  const b2cl = [];
  const b2csMap = new Map();
  const hsnMap = new Map();
  let totalTaxable = 0;
  let totalIgst = 0;
  let totalCgst = 0;
  let totalSgst = 0;

  for (const inv of invoices) {
    const gstin = inv.customerGstin || inv.company?.gstin;
    const pos = inv.placeOfSupply || inv.company?.stateCode || sellerState;
    const inter = inv.supplyType === 'inter';
    const byRate = new Map();
    for (const item of inv.items) {
      const rate = item.taxRate ?? inv.taxRate ?? 0;
      const tax = item.taxAmount ?? r2((item.total * rate) / 100);
      const igst = inter ? tax : 0;
      const cgst = inter ? 0 : r2(tax / 2);
      const sgst = inter ? 0 : r2(tax - cgst);
      const agg = byRate.get(rate) || { taxable: 0 };
      agg.taxable = r2(agg.taxable + item.total);
      byRate.set(rate, agg);

      const hsnKey = `${item.hsn || 'NA'}|${rate}`;
      const h = hsnMap.get(hsnKey) || { HSN: item.hsn || '', Description: item.description, UQC: 'NOS-NUMBERS', 'Total Quantity': 0, 'Total Value': 0, Rate: rate, 'Taxable Value': 0, 'Integrated Tax Amount': 0, 'Central Tax Amount': 0, 'State/UT Tax Amount': 0, 'Cess Amount': 0 };
      h['Total Quantity'] = r2(h['Total Quantity'] + item.quantity);
      h['Taxable Value'] = r2(h['Taxable Value'] + item.total);
      h['Total Value'] = r2(h['Total Value'] + item.total + tax);
      h['Integrated Tax Amount'] = r2(h['Integrated Tax Amount'] + igst);
      h['Central Tax Amount'] = r2(h['Central Tax Amount'] + cgst);
      h['State/UT Tax Amount'] = r2(h['State/UT Tax Amount'] + sgst);
      hsnMap.set(hsnKey, h);

      totalTaxable += item.total;
      totalIgst += igst;
      totalCgst += cgst;
      totalSgst += sgst;
    }

    for (const [rate, { taxable }] of byRate) {
      const common = { 'Invoice Number': inv.invoiceNumber, 'Invoice date': gstDate(inv.issueDate), 'Invoice Value': inv.total, 'Place Of Supply': stateLabel(pos), 'Applicable % of Tax Rate': '', Rate: rate, 'Taxable Value': taxable, 'Cess Amount': 0, 'E-Commerce GSTIN': '' };
      if (gstin) {
        b2b.push({ 'GSTIN/UIN of Recipient': gstin, 'Receiver Name': inv.company?.name || '', ...common, 'Reverse Charge': 'N', 'Invoice Type': 'Regular B2B' });
      } else if (inter && inv.total > B2CL_THRESHOLD) {
        b2cl.push(common);
      } else {
        const key = `${pos}|${rate}`;
        const row = b2csMap.get(key) || { Type: 'OE', 'Place Of Supply': stateLabel(pos), 'Applicable % of Tax Rate': '', Rate: rate, 'Taxable Value': 0, 'Cess Amount': 0, 'E-Commerce GSTIN': '' };
        row['Taxable Value'] = r2(row['Taxable Value'] + taxable);
        b2csMap.set(key, row);
      }
    }
  }

  const sections = {
    b2b: {
      headers: ['GSTIN/UIN of Recipient', 'Receiver Name', 'Invoice Number', 'Invoice date', 'Invoice Value', 'Place Of Supply', 'Reverse Charge', 'Applicable % of Tax Rate', 'Invoice Type', 'E-Commerce GSTIN', 'Rate', 'Taxable Value', 'Cess Amount'],
      rows: b2b,
    },
    b2cl: {
      headers: ['Invoice Number', 'Invoice date', 'Invoice Value', 'Place Of Supply', 'Applicable % of Tax Rate', 'Rate', 'Taxable Value', 'Cess Amount', 'E-Commerce GSTIN'],
      rows: b2cl,
    },
    b2cs: {
      headers: ['Type', 'Place Of Supply', 'Applicable % of Tax Rate', 'Rate', 'Taxable Value', 'Cess Amount', 'E-Commerce GSTIN'],
      rows: [...b2csMap.values()],
    },
    hsn: {
      headers: ['HSN', 'Description', 'UQC', 'Total Quantity', 'Total Value', 'Rate', 'Taxable Value', 'Integrated Tax Amount', 'Central Tax Amount', 'State/UT Tax Amount', 'Cess Amount'],
      rows: [...hsnMap.values()],
    },
  };

  if (req.query.format === 'csv') {
    const section = sections[req.query.section];
    if (!section) throw new AppError('section must be one of b2b, b2cl, b2cs, hsn', 400);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="GSTR1-${period}-${req.query.section}.csv"`);
    return res.send(toCsv(section.headers, section.rows));
  }

  res.json({
    period,
    sellerGstin: org?.billingProfile?.gstin || null,
    summary: {
      invoices: invoices.length,
      taxable: r2(totalTaxable),
      igst: r2(totalIgst),
      cgst: r2(totalCgst),
      sgst: r2(totalSgst),
      totalTax: r2(totalIgst + totalCgst + totalSgst),
      missingHsn: invoices.reduce((n, inv) => n + inv.items.filter((i) => !i.hsn).length, 0),
    },
    sections,
  });
});
