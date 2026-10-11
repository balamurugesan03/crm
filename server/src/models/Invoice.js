import mongoose from 'mongoose';

const lineItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    description: { type: String, required: true, trim: true },
    hsn: { type: String, trim: true },
    quantity: { type: Number, required: true, default: 1 },
    unitPrice: { type: Number, required: true, default: 0 },
    taxRate: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    total: { type: Number, required: true, default: 0 },
  },
  { _id: false },
);

const invoiceSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    invoiceNumber: { type: String, required: true },
    quote: { type: mongoose.Schema.Types.ObjectId, ref: 'Quote' },
    contact: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    items: [lineItemSchema],
    taxRate: { type: Number, default: 0 },
    subtotal: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    supplyType: { type: String, enum: ['intra', 'inter'], default: 'intra' },
    placeOfSupply: { type: String, trim: true },
    customerGstin: { type: String, trim: true, uppercase: true },
    total: { type: Number, default: 0 },
    status: { type: String, enum: ['draft', 'sent', 'partially_paid', 'paid', 'overdue', 'void'], default: 'draft' },
    reminders: [
      {
        _id: false,
        sentAt: { type: Date, default: Date.now },
        channel: { type: String, enum: ['email', 'whatsapp'] },
        auto: { type: Boolean, default: false },
        stage: { type: String },
        to: { type: String },
      },
    ],
    issueDate: { type: Date, default: Date.now },
    dueDate: { type: Date },
    paidAt: { type: Date },
    amountPaid: { type: Number, default: 0 },
    paymentRef: { type: String, trim: true },
    notes: { type: String },
    ownerUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

invoiceSchema.index({ organization: 1, createdAt: -1 });
invoiceSchema.index({ organization: 1, status: 1, dueDate: 1 });

invoiceSchema.virtual('balance').get(function balance() {
  return Math.max(0, Math.round(((this.total || 0) - (this.amountPaid || 0)) * 100) / 100);
});
invoiceSchema.set('toJSON', { virtuals: true });
invoiceSchema.set('toObject', { virtuals: true });

export default mongoose.model('Invoice', invoiceSchema);
