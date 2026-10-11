import mongoose from 'mongoose';

const campaignSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['email', 'social', 'event', 'webinar', 'other'], default: 'other' },
    status: { type: String, enum: ['planned', 'active', 'paused', 'completed'], default: 'planned' },
    startDate: { type: Date },
    endDate: { type: Date },
    budget: { type: Number, default: 0 },
    description: { type: String, trim: true },
    ownerUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

campaignSchema.index({ organization: 1, createdAt: -1 });

export default mongoose.model('Campaign', campaignSchema);
