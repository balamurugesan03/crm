import mongoose from 'mongoose';

const contactSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    jobTitle: { type: String, trim: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    tags: [{ type: String, trim: true }],
    ownerUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // Bumping this invalidates every portal link issued to the contact.
    portalTokenVersion: { type: Number, default: 0 },
    portalLastSeenAt: { type: Date },
    customFields: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true },
);

contactSchema.index({ organization: 1, firstName: 1, lastName: 1 });

export default mongoose.model('Contact', contactSchema);
