import mongoose from 'mongoose';
import { computeLeadScore } from '../services/leadScoring.js';

const leadSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    source: {
      type: String,
      enum: ['website', 'referral', 'social', 'event', 'cold_call', 'advertisement', 'other'],
      default: 'other',
    },
    status: {
      type: String,
      enum: ['new', 'contacted', 'qualified', 'unqualified', 'converted'],
      default: 'new',
    },
    estimatedValue: { type: Number, default: 0 },
    score: { type: Number, default: 0, min: 0, max: 100 },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    contact: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' },
    ownerUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String },
    customFields: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true },
);

leadSchema.index({ organization: 1, status: 1 });
leadSchema.index({ organization: 1, score: -1 });

leadSchema.pre('save', function applyScore(next) {
  this.score = computeLeadScore(this);
  next();
});

export default mongoose.model('Lead', leadSchema);
