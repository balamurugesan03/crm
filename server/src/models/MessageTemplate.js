import mongoose from 'mongoose';

// Reusable email / WhatsApp copy with {{placeholders}} such as {{contact.firstName}}.
const messageTemplateSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    channel: { type: String, enum: ['email', 'whatsapp'], required: true },
    subject: { type: String, trim: true, maxlength: 200 },
    body: { type: String, required: true, maxlength: 5000 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export default mongoose.model('MessageTemplate', messageTemplateSchema);
