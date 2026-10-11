import mongoose from 'mongoose';

const billingProfileSchema = new mongoose.Schema(
  {
    legalName: { type: String, trim: true },
    gstin: { type: String, trim: true, uppercase: true },
    pan: { type: String, trim: true, uppercase: true },
    // Two-digit GST state code (e.g. "33" Tamil Nadu); drives CGST+SGST vs IGST.
    stateCode: { type: String, trim: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    pincode: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    upiId: { type: String, trim: true },
    bankName: { type: String, trim: true },
    bankAccount: { type: String, trim: true },
    ifsc: { type: String, trim: true, uppercase: true },
    invoiceTerms: { type: String, trim: true },
  },
  { _id: false },
);

const smtpSchema = new mongoose.Schema(
  {
    host: { type: String, trim: true },
    port: { type: Number, default: 587 },
    secure: { type: Boolean, default: false },
    user: { type: String, trim: true },
    pass: { type: String },
    fromName: { type: String, trim: true },
    fromEmail: { type: String, trim: true, lowercase: true },
  },
  { _id: false },
);

const whatsappSchema = new mongoose.Schema(
  {
    phoneNumberId: { type: String, trim: true },
    accessToken: { type: String },
    displayNumber: { type: String, trim: true },
  },
  { _id: false },
);

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    plan: { type: String, enum: ['trial', 'starter', 'pro', 'enterprise'], default: 'trial' },
    subscriptionStatus: { type: String, enum: ['trialing', 'active', 'past_due', 'canceled'], default: 'trialing' },
    isSuspended: { type: Boolean, default: false },
    stripeCustomerId: { type: String },
    stripeSubscriptionId: { type: String },
    currentPeriodEnd: { type: Date },
    settings: {
      // A deal with no activity for this many days is flagged as rotting.
      rottingDays: { type: Number, default: 7, min: 1, max: 90 },
      // 'own': sales reps only see records they own / are assigned. Managers+ always see all.
      recordVisibility: { type: String, enum: ['all', 'own'], default: 'all' },
      dailyDigest: { type: Boolean, default: true },
      // Automatic email reminders for unpaid invoices (needs SMTP).
      autoReminders: { type: Boolean, default: false },
      reminderBeforeDays: { type: Number, default: 3, min: 0, max: 30 },
      reminderAfterDays: { type: [Number], default: () => [1, 7, 15] },
    },
    billingProfile: { type: billingProfileSchema, default: () => ({}) },
    integrations: {
      smtp: { type: smtpSchema, default: () => ({}) },
      whatsapp: { type: whatsappSchema, default: () => ({}) },
    },
  },
  { timestamps: true },
);

// Never ship integration secrets to clients; expose only whether they are set.
organizationSchema.set('toJSON', {
  transform(doc, ret) {
    const smtp = ret.integrations?.smtp || {};
    const wa = ret.integrations?.whatsapp || {};
    ret.integrations = {
      smtp: { ...smtp, pass: undefined, hasPassword: Boolean(smtp.pass) },
      whatsapp: { ...wa, accessToken: undefined, hasAccessToken: Boolean(wa.accessToken) },
    };
    return ret;
  },
});

export default mongoose.model('Organization', organizationSchema);
