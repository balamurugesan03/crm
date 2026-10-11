import mongoose from 'mongoose';

const dealSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    title: { type: String, required: true, trim: true },
    amount: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
    stage: { type: mongoose.Schema.Types.ObjectId, ref: 'PipelineStage', required: true },
    contact: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    ownerUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    expectedCloseDate: { type: Date },
    status: { type: String, enum: ['open', 'won', 'lost'], default: 'open' },
    stageChangedAt: { type: Date },
    lastActivityAt: { type: Date },
    closedAt: { type: Date },
    customFields: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true },
);

dealSchema.index({ organization: 1, stage: 1 });

export default mongoose.model('Deal', dealSchema);
