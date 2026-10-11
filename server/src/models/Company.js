import mongoose from 'mongoose';

const companySchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    domain: { type: String, trim: true },
    industry: { type: String, trim: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    gstin: { type: String, trim: true, uppercase: true },
    stateCode: { type: String, trim: true },
    ownerUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String },
    customFields: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true },
);

companySchema.index({ organization: 1, name: 1 });

export default mongoose.model('Company', companySchema);
