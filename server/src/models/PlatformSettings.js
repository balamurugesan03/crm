import mongoose from 'mongoose';

// Single document holding platform-wide branding and policy, editable only by super admins.
const assetSchema = new mongoose.Schema(
  { data: Buffer, contentType: String },
  { _id: false },
);

const platformSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'platform', unique: true },
    appName: { type: String, trim: true, default: 'Unizova CRM' },
    companyName: { type: String, trim: true, default: 'Unizova Technologies' },
    tagline: { type: String, trim: true, default: 'Sales, support and marketing — one fast, beautiful workspace.' },
    primaryColor: { type: String, trim: true, default: '' }, // hex, '' = built-in indigo
    supportEmail: { type: String, trim: true, lowercase: true },
    supportPhone: { type: String, trim: true },
    // When false, only super admins can create organizations.
    allowPublicSignup: { type: Boolean, default: false },
    logo: { type: assetSchema },
    logoDark: { type: assetSchema },
    favicon: { type: assetSchema },
  },
  { timestamps: true },
);

platformSettingsSchema.statics.get = async function get() {
  // Upsert so concurrent first requests can't race to create two documents.
  return this.findOneAndUpdate(
    { key: 'platform' },
    { $setOnInsert: { key: 'platform' } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
};

export const ASSET_KINDS = ['logo', 'logoDark', 'favicon'];

// Public shape: assets become versioned URLs (served by /api/public/branding/:kind).
platformSettingsSchema.methods.toPublic = function toPublic() {
  const v = this.updatedAt ? this.updatedAt.getTime() : 0;
  const assets = Object.fromEntries(
    ASSET_KINDS.map((k) => [`${k}Url`, this[k]?.data?.length ? `/public/branding/${k}?v=${v}` : null]),
  );
  return {
    appName: this.appName,
    companyName: this.companyName,
    tagline: this.tagline,
    primaryColor: this.primaryColor,
    supportEmail: this.supportEmail,
    supportPhone: this.supportPhone,
    allowPublicSignup: this.allowPublicSignup,
    ...assets,
  };
};

export default mongoose.model('PlatformSettings', platformSettingsSchema);
