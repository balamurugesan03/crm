import mongoose from 'mongoose';

// A payment an organization made to the platform owner for a plan (recorded by a super admin).
const settlementSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    plan: { type: String, required: true },
    planName: { type: String },
    billingCycle: { type: String },
    amount: { type: Number, required: true, min: 0 },
    paymentMode: { type: String, enum: ['upi', 'bank_transfer', 'cash', 'cheque', 'card', 'other'], default: 'bank_transfer' },
    reference: { type: String, trim: true },
    paidAt: { type: Date, default: Date.now },
    periodStart: { type: Date },
    // null = lifetime (one-time settlement).
    periodEnd: { type: Date },
    notes: { type: String, trim: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export default mongoose.model('Settlement', settlementSchema);
