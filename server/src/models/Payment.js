import mongoose from 'mongoose';

export const PAYMENT_MODES = ['upi', 'bank_transfer', 'cash', 'cheque', 'card', 'other'];

// Money received against an invoice. Partial payments are separate rows.
// `tds` is tax deducted at source by the customer: it settles the invoice like cash received.
const paymentSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    receiptNumber: { type: String, required: true },
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    contact: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
    amount: { type: Number, required: true, min: 0 },
    tds: { type: Number, default: 0, min: 0 },
    date: { type: Date, required: true, default: Date.now },
    mode: { type: String, enum: PAYMENT_MODES, default: 'bank_transfer' },
    reference: { type: String, trim: true, maxlength: 100 },
    notes: { type: String, trim: true, maxlength: 500 },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

paymentSchema.index({ organization: 1, date: -1 });

export default mongoose.model('Payment', paymentSchema);
