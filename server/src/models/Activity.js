import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    entityType: { type: String, enum: ['Contact', 'Lead', 'Deal', 'Company', 'Ticket', 'Event'], required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
    type: { type: String, enum: ['note', 'stage_change', 'status_change', 'task', 'created', 'updated', 'attachment', 'automation', 'meeting', 'email', 'whatsapp'], default: 'note' },
    body: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

activitySchema.index({ organization: 1, entityType: 1, entityId: 1, createdAt: -1 });

export default mongoose.model('Activity', activitySchema);
