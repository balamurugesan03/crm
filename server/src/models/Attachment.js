import mongoose from 'mongoose';

export const ATTACHMENT_ENTITY_TYPES = ['Contact', 'Company', 'Deal', 'Ticket', 'Lead'];

const attachmentSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    entityType: { type: String, enum: ATTACHMENT_ENTITY_TYPES, required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
    originalName: { type: String, required: true },
    storedName: { type: String, required: true },
    mimeType: { type: String },
    size: { type: Number, default: 0 },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

attachmentSchema.index({ organization: 1, entityType: 1, entityId: 1, createdAt: -1 });

export default mongoose.model('Attachment', attachmentSchema);
