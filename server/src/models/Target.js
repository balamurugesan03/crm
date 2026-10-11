import mongoose from 'mongoose';

// Monthly revenue target. user = null is the team-wide target.
const targetSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // 'YYYY-MM'
    period: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
    amount: { type: Number, required: true, min: 0 },
    dealsTarget: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

targetSchema.index({ organization: 1, period: 1, user: 1 }, { unique: true });

export default mongoose.model('Target', targetSchema);
