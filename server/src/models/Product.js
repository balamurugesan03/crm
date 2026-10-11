import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    sku: { type: String, trim: true },
    description: { type: String, trim: true },
    price: { type: Number, required: true, default: 0 },
    hsn: { type: String, trim: true },
    gstRate: { type: Number, default: 18, enum: [0, 0.25, 3, 5, 12, 18, 28] },
    currency: { type: String, default: 'INR' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

productSchema.index({ organization: 1, name: 1 });

export default mongoose.model('Product', productSchema);
