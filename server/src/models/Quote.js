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

const quoteSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    quoteNumber: { type: String, required: true },
    contact: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    deal: { type: mongoose.Schema.Types.ObjectId, ref: 'Deal' },
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
    status: { type: String, enum: ['draft', 'sent', 'accepted', 'rejected'], default: 'draft' },
    validUntil: { type: Date },
    notes: { type: String },
    ownerUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

quoteSchema.index({ organization: 1, createdAt: -1 });

export default mongoose.model('Quote', quoteSchema);
