import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    title: { type: String, required: true, trim: true },
    type: { type: String, enum: ['meeting', 'call', 'demo', 'follow_up', 'other'], default: 'meeting' },
    start: { type: Date, required: true },
    end: { type: Date },
    allDay: { type: Boolean, default: false },
    location: { type: String, trim: true },
    description: { type: String, trim: true },
    attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    contact: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    deal: { type: mongoose.Schema.Types.ObjectId, ref: 'Deal' },
    ownerUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['scheduled', 'completed', 'cancelled'], default: 'scheduled' },
  },
  { timestamps: true },
);

eventSchema.index({ organization: 1, start: 1 });

eventSchema.pre('validate', function ensureEnd(next) {
  if (this.start && (!this.end || this.end < this.start)) {
    this.end = new Date(this.start.getTime() + 30 * 60 * 1000);
  }
  next();
});

export default mongoose.model('Event', eventSchema);
