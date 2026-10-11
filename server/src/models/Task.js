import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    title: { type: String, required: true, trim: true },
    type: { type: String, enum: ['call', 'email', 'meeting', 'todo'], default: 'todo' },
    dueDate: { type: Date },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    status: { type: String, enum: ['pending', 'done'], default: 'pending' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    relatedToModel: { type: String, enum: ['Contact', 'Lead', 'Deal', 'Company', null], default: null },
    relatedToId: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { timestamps: true },
);

taskSchema.index({ organization: 1, status: 1, dueDate: 1 });

export default mongoose.model('Task', taskSchema);
