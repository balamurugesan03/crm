import mongoose from 'mongoose';

// Billing cycles a plan can be sold on. 'one_time' = pay once, never expires (lifetime settlement).
export const BILLING_CYCLES = ['free', 'monthly', 'quarterly', 'yearly', 'one_time'];
const CYCLE_MONTHS = { monthly: 1, quarterly: 3, yearly: 12 };

const planSchema = new mongoose.Schema(
  {
    // Stable identifier stored on Organization.plan (e.g. 'starter'). Cannot change after creation.
    key: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[a-z0-9_-]+$/ },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    billingCycle: { type: String, enum: BILLING_CYCLES, default: 'monthly' },
    price: { type: Number, default: 0, min: 0 }, // INR
    // 0 = unlimited.
    maxUsers: { type: Number, default: 0, min: 0 },
    features: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// End of the paid period that starts at `from` for this cycle; null means it never expires.
export function periodEndFor(billingCycle, from = new Date()) {
  const months = CYCLE_MONTHS[billingCycle];
  if (!months) return null;
  const end = new Date(from);
  end.setMonth(end.getMonth() + months);
  return end;
}

export function priceLabel(plan) {
  if (plan.billingCycle === 'free') return 'Free';
  if (!plan.price) return 'Contact us';
  const amount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(plan.price);
  const suffix = { monthly: '/mo', quarterly: '/quarter', yearly: '/yr', one_time: ' one-time' }[plan.billingCycle] || '';
  return `${amount}${suffix}`;
}

export const DEFAULT_PLANS = [
  { key: 'trial', name: 'Trial', billingCycle: 'free', price: 0, maxUsers: 3, features: ['Up to 3 team members', 'All core features'], sortOrder: 0 },
  { key: 'starter', name: 'Starter', billingCycle: 'monthly', price: 1999, maxUsers: 5, features: ['Up to 5 team members', 'Core CRM + Sales tools'], sortOrder: 1 },
  { key: 'pro', name: 'Pro', billingCycle: 'monthly', price: 4999, maxUsers: 20, features: ['Up to 20 team members', 'Everything in Starter', 'Reports & Support desk'], sortOrder: 2 },
  { key: 'enterprise', name: 'Enterprise', billingCycle: 'one_time', price: 0, maxUsers: 0, features: ['Unlimited team members', 'Everything in Pro', 'Priority support'], sortOrder: 3 },
];

export default mongoose.model('Plan', planSchema);
