import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import Payment from '../models/Payment.js';

const EPS = 0.5; // rupee rounding tolerance

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Status derived from money received and the due date. Draft and void are manual states.
export function deriveStatus(invoice, today = startOfToday()) {
  if (invoice.status === 'void') return 'void';
  const paid = Number(invoice.amountPaid) || 0;
  const total = Number(invoice.total) || 0;
  if (total > 0 && paid >= total - EPS) return 'paid';
  if (invoice.status === 'draft' && paid <= 0) return 'draft';
  if (invoice.dueDate && new Date(invoice.dueDate) < today) return 'overdue';
  if (paid > 0) return 'partially_paid';
  return 'sent';
}

// Recalculates amountPaid / balance / status from the payments ledger.
export async function recomputeInvoice(invoiceId) {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) return null;
  const [agg] = await Payment.aggregate([
    { $match: { invoice: new mongoose.Types.ObjectId(String(invoiceId)) } },
    { $group: { _id: null, amount: { $sum: '$amount' }, tds: { $sum: '$tds' }, last: { $max: '$date' } } },
  ]);
  invoice.amountPaid = Math.round(((agg?.amount || 0) + (agg?.tds || 0)) * 100) / 100;
  invoice.status = deriveStatus(invoice);
  invoice.paidAt = invoice.status === 'paid' ? agg?.last || new Date() : undefined;
  await invoice.save();
  return invoice;
}

// Daily sweep: unpaid invoices past their due date become overdue.
export async function markOverdueInvoices() {
  const res = await Invoice.updateMany(
    { status: { $in: ['sent', 'partially_paid'] }, dueDate: { $lt: startOfToday() } },
    { $set: { status: 'overdue' } },
  );
  return res.modifiedCount;
}
