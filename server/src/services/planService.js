import Plan from '../models/Plan.js';
import User from '../models/User.js';
import { AppError } from '../utils/AppError.js';

// Effective user limit for an organization: super-admin override, else the plan's limit. 0 = unlimited.
export async function userLimitFor(organization) {
  if (organization.maxUsersOverride !== null && organization.maxUsersOverride !== undefined) {
    return organization.maxUsersOverride;
  }
  const plan = await Plan.findOne({ key: organization.plan }).select('maxUsers');
  return plan?.maxUsers || 0;
}

export async function assertSeatAvailable(organization) {
  const limit = await userLimitFor(organization);
  if (!limit) return;
  const used = await User.countDocuments({ organization: organization._id, isActive: true });
  if (used >= limit) {
    throw new AppError(`Your plan allows ${limit} active team members. Contact your provider to upgrade.`, 403);
  }
}

// Subscriptions recorded by hand (no Stripe) lapse a few days after their paid period ends.
export const EXPIRY_GRACE_DAYS = 3;
