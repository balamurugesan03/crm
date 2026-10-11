import Invoice from '../models/Invoice.js';
import { AppError } from '../utils/AppError.js';
import { catchAsync } from '../utils/catchAsync.js';
import { paginationParams, buildSearchFilter } from '../utils/queryHelpers.js';
import { computeTotals } from '../utils/lineItems.js';
import { resolveGstContext } from '../services/gstService.js';
import { deriveStatus, recomputeInvoice } from '../services/invoiceService.js';
import Payment from '../models/Payment.js';

const LOCKED = ['_id', '__v', 'organization', 'createdAt', 'updatedAt', 'subtotal', 'taxAmount', 'cgst', 'sgst', 'igst', 'total', 'supplyType', 'amountPaid', 'paidAt', 'balance', 'reminders', 'id'];
const strip = (body) => Object.fromEntries(Object.entries(body).filter(([k]) => !LOCKED.includes(k)));
import { nextNumber } from '../utils/numbering.js';
import { ownerScope } from '../utils/visibility.js';

function populateFields(query) {
  return query
    .populate('contact', 'firstName lastName email phone')
    .populate('company', 'name address phone domain gstin stateCode')
    .populate('ownerUser', 'name avatarColor');
}

export const listInvoices = catchAsync(async (req, res) => {
  const { page, limit, skip } = paginationParams(req.query);
  const filter = { organization: req.tenantId, ...ownerScope(req, 'ownerUser'), ...buildSearchFilter(req.query.search, ['invoiceNumber']) };
  if (req.query.status) filter.status = req.query.status;

  const [items, total] = await Promise.all([
    populateFields(Invoice.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)),
    Invoice.countDocuments(filter),
  ]);

  res.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
});

export const getInvoice = catchAsync(async (req, res) => {
  const invoice = await populateFields(Invoice.findOne({ _id: req.params.id, organization: req.tenantId, ...ownerScope(req, 'ownerUser') }));
  if (!invoice) throw new AppError('Invoice not found', 404);
  res.json(invoice);
});

export const createInvoice = catchAsync(async (req, res) => {
  const { items, taxRate, ...rest } = strip(req.body);
  const gst = await resolveGstContext(req.tenantId, rest);
  const totals = computeTotals(items, taxRate, gst);
  const invoiceNumber = await nextNumber(Invoice, req.tenantId, 'INV');

  const invoice = await Invoice.create({
    ...rest,
    organization: req.tenantId,
    invoiceNumber,
    taxRate: taxRate || 0,
    customerGstin: gst.customerGstin,
    placeOfSupply: gst.placeOfSupply,
    ...totals,
    ownerUser: rest.ownerUser || req.user._id,
  });
  invoice.status = deriveStatus(invoice);
  await invoice.save();

  res.status(201).json(invoice);
});

export const updateInvoice = catchAsync(async (req, res) => {
  const existing = await Invoice.findOne({ _id: req.params.id, organization: req.tenantId, ...ownerScope(req, 'ownerUser') });
  if (!existing) throw new AppError('Invoice not found', 404);

  const { items, taxRate, ...rest } = strip(req.body);
  if ((rest.status === 'void' || rest.status === 'draft') && (existing.amountPaid || 0) > 0) {
    throw new AppError('This invoice has payments recorded. Delete the payments before voiding it.', 400);
  }
  Object.assign(existing, rest);

  // Always recompute: company / GSTIN / place-of-supply changes alter the CGST-SGST vs IGST split.
  const gst = await resolveGstContext(req.tenantId, {
    company: existing.company,
    customerGstin: rest.customerGstin,
    placeOfSupply: rest.placeOfSupply,
  });
  const rate = taxRate !== undefined ? taxRate : existing.taxRate;
  const totals = computeTotals(items || existing.items.map((i) => i.toObject?.() || i), rate, gst);
  Object.assign(existing, { taxRate: rate, customerGstin: gst.customerGstin, placeOfSupply: gst.placeOfSupply, ...totals });

  existing.status = deriveStatus(existing);
  await existing.save();
  res.json(existing);
});

export const deleteInvoice = catchAsync(async (req, res) => {
  const invoice = await Invoice.findOneAndDelete({ _id: req.params.id, organization: req.tenantId, ...ownerScope(req, 'ownerUser') });
  if (!invoice) throw new AppError('Invoice not found', 404);
  res.status(204).send();
});

export const markPaid = catchAsync(async (req, res) => {
  const invoice = await Invoice.findOne({ _id: req.params.id, organization: req.tenantId, ...ownerScope(req, 'ownerUser') });
  if (!invoice) throw new AppError('Invoice not found', 404);
  if (invoice.status === 'void') throw new AppError('A void invoice cannot be paid', 400);
  const balance = Math.round(((invoice.total || 0) - (invoice.amountPaid || 0)) * 100) / 100;
  if (balance > 0) {
    await Payment.create({
      organization: req.tenantId,
      receiptNumber: await nextNumber(Payment, req.tenantId, 'RCPT'),
      invoice: invoice._id,
      company: invoice.company,
      contact: invoice.contact,
      amount: balance,
      mode: req.body?.mode || 'other',
      reference: req.body?.paymentRef ? String(req.body.paymentRef).slice(0, 100) : undefined,
      notes: 'Marked as paid in full',
      recordedBy: req.user._id,
    });
  }
  res.json(await recomputeInvoice(invoice._id));
});
