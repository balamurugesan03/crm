import mongoose from 'mongoose';

export const CUSTOM_FIELD_ENTITIES = ['Contact', 'Company', 'Lead', 'Deal'];
export const CUSTOM_FIELD_TYPES = ['text', 'textarea', 'number', 'currency', 'date', 'select', 'multiselect', 'checkbox', 'url', 'email', 'phone'];

const customFieldSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    entity: { type: String, enum: CUSTOM_FIELD_ENTITIES, required: true },
    // Stable machine key used in record.customFields; never changes after creation.
    key: { type: String, required: true, match: /^[a-z][a-z0-9_]{0,39}$/ },
    label: { type: String, required: true, trim: true, maxlength: 60 },
    type: { type: String, enum: CUSTOM_FIELD_TYPES, default: 'text' },
    options: [{ type: String, trim: true, maxlength: 60 }],
    required: { type: Boolean, default: false },
    helpText: { type: String, trim: true, maxlength: 200 },
    order: { type: Number, default: 0 },
    showInList: { type: Boolean, default: false },
  },
  { timestamps: true },
);

customFieldSchema.index({ organization: 1, entity: 1, key: 1 }, { unique: true });

export default mongoose.model('CustomField', customFieldSchema);
