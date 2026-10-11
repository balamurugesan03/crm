import crypto from 'crypto';
import mongoose from 'mongoose';

export const WEBFORM_FIELD_KEYS = ['name', 'email', 'phone', 'company', 'jobTitle', 'city', 'budget', 'message'];

const fieldSchema = new mongoose.Schema(
  {
    key: { type: String, enum: WEBFORM_FIELD_KEYS, required: true },
    label: { type: String, required: true, trim: true, maxlength: 80 },
    required: { type: Boolean, default: false },
  },
  { _id: false },
);

const webFormSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    // Unguessable public id used in the hosted URL / embed code.
    publicKey: { type: String, unique: true, default: () => crypto.randomBytes(12).toString('base64url') },
    title: { type: String, trim: true, default: 'Get in touch' },
    description: { type: String, trim: true },
    submitLabel: { type: String, trim: true, default: 'Submit' },
    successMessage: { type: String, trim: true, default: 'Thanks! Our team will reach out shortly.' },
    accentColor: { type: String, default: '#4f4ff0', match: /^#[0-9a-fA-F]{6}$/ },
    fields: {
      type: [fieldSchema],
      default: () => [
        { key: 'name', label: 'Full name', required: true },
        { key: 'email', label: 'Work email', required: true },
        { key: 'phone', label: 'Phone', required: false },
        { key: 'company', label: 'Company', required: false },
        { key: 'message', label: 'How can we help?', required: false },
      ],
    },
    source: { type: String, enum: ['website', 'referral', 'social', 'event', 'cold_call', 'advertisement', 'other'], default: 'website' },
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' },
    // Users to assign new leads to, round-robin. Empty = the form creator.
    assignees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    rrIndex: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    submissions: { type: Number, default: 0 },
    lastSubmissionAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export default mongoose.model('WebForm', webFormSchema);
