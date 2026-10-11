import mongoose from 'mongoose';

// Outbound email / WhatsApp messages sent from the CRM, kept for the record's history.
const messageSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    channel: { type: String, enum: ['email', 'whatsapp'], required: true },
    // 'api' = sent by the provider; 'link' = opened in the user's own WhatsApp/mail app and logged.
    via: { type: String, enum: ['api', 'link'], default: 'api' },
    to: { type: String, required: true, trim: true },
    subject: { type: String, trim: true },
    body: { type: String, required: true },
    status: { type: String, enum: ['sent', 'failed', 'logged'], default: 'sent' },
    error: { type: String },
    providerId: { type: String },
    entityType: { type: String, enum: ['Contact', 'Company', 'Lead', 'Deal', 'Ticket'] },
    entityId: { type: mongoose.Schema.Types.ObjectId },
    template: { type: mongoose.Schema.Types.ObjectId, ref: 'MessageTemplate' },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

messageSchema.index({ organization: 1, entityType: 1, entityId: 1, createdAt: -1 });

export default mongoose.model('Message', messageSchema);
