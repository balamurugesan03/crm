import mongoose from 'mongoose';

const pipelineStageSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    order: { type: Number, required: true },
    probability: { type: Number, default: 0 },
    isWon: { type: Boolean, default: false },
    isLost: { type: Boolean, default: false },
  },
  { timestamps: true },
);

pipelineStageSchema.index({ organization: 1, order: 1 });

export const DEFAULT_STAGES = [
  { name: 'New', order: 1, probability: 10 },
  { name: 'Qualified', order: 2, probability: 25 },
  { name: 'Proposal', order: 3, probability: 50 },
  { name: 'Negotiation', order: 4, probability: 75 },
  { name: 'Won', order: 5, probability: 100, isWon: true },
  { name: 'Lost', order: 6, probability: 0, isLost: true },
];

export default mongoose.model('PipelineStage', pipelineStageSchema);
