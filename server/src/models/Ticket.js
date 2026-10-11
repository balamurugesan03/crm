import mongoose from 'mongoose';

// Customer-visible conversation (separate from internal activity notes).
const replySchema = new mongoose.Schema(
  {
    author: { type: String, enum: ['customer', 'agent'], required: true },
    name: { type: String, trim: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    body: { type: String, required: true, trim: true, maxlength: 5000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const ticketSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    ticketNumber: { type: String, required: true },
    subject: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    status: { type: String, enum: ['open', 'in_progress', 'waiting', 'resolved', 'closed'], default: 'open' },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
    contact: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: { type: Date },
    channel: { type: String, enum: ['internal', 'portal', 'email', 'phone', 'whatsapp'], default: 'internal' },
    replies: [replySchema],
  },
  { timestamps: true },
);

ticketSchema.index({ organization: 1, status: 1, createdAt: -1 });

export default mongoose.model('Ticket', ticketSchema);
