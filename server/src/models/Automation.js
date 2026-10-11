import mongoose from 'mongoose';

export const AUTOMATION_TRIGGERS = [
  'lead.created',
  'lead.status_changed',
  'deal.created',
  'deal.stage_changed',
  'deal.won',
  'deal.lost',
  'ticket.created',
  'ticket.status_changed',
  'contact.created',
];

export const AUTOMATION_ACTIONS = ['create_task', 'notify_user', 'update_field', 'add_note'];

const conditionSchema = new mongoose.Schema(
  {
    field: { type: String, required: true, trim: true },
    operator: { type: String, enum: ['equals', 'not_equals', 'greater_than', 'less_than', 'contains'], default: 'equals' },
    value: { type: String, default: '' },
  },
  { _id: false },
);

const actionSchema = new mongoose.Schema(
  {
    type: { type: String, enum: AUTOMATION_ACTIONS, required: true },
    // create_task
    taskTitle: { type: String, trim: true },
    taskDueInDays: { type: Number, default: 1 },
    taskPriority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    // create_task / notify_user recipient: 'owner' (the record's owner/assignee) or a user id
    assignTo: { type: String, default: 'owner' },
    message: { type: String, trim: true },
    // update_field
    field: { type: String, trim: true },
    value: { type: String },
  },
  { _id: false },
);

const automationSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    trigger: { type: String, enum: AUTOMATION_TRIGGERS, required: true },
    conditions: [conditionSchema],
    actions: { type: [actionSchema], validate: [(v) => v.length > 0, 'At least one action is required'] },
    isActive: { type: Boolean, default: true },
    runCount: { type: Number, default: 0 },
    lastRunAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

automationSchema.index({ organization: 1, trigger: 1, isActive: 1 });

export default mongoose.model('Automation', automationSchema);
