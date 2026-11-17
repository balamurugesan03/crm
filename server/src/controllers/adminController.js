import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import Organization from '../models/Organization.js';
import User from '../models/User.js';
import Plan, { BILLING_CYCLES, periodEndFor, priceLabel } from '../models/Plan.js';
import Settlement from '../models/Settlement.js';
import PlatformSettings, { ASSET_KINDS } from '../models/PlatformSettings.js';
import PipelineStage, { DEFAULT_STAGES } from '../models/PipelineStage.js';
import { uniqueSlug } from './authController.js';
import { userLimitFor } from '../services/planService.js';
import { AppError } from '../utils/AppError.js';
import { catchAsync } from '../utils/catchAsync.js';
import { paginationParams, buildSearchFilter } from '../utils/queryHelpers.js';

const PAYMENT_MODES = ['upi', 'bank_transfer', 'cash', 'cheque', 'card', 'other'];
const isEmail = (v) => typeof v === 'string' && /^\S+@\S+\.\S+$/.test(v);
const pick = (obj, keys) => Object.fromEntries(Object.entries(obj || {}).filter(([k]) => keys.includes(k)));

// ---------------------------------------------------------------- stats

export const getStats = catchAsync(async (req, res) => {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const soon = new Date(Date.now() + 14 * 86400000);

  const [totalOrganizations, totalUsers, orgsThisMonth, revenueAgg, revenueMonthAgg, signupTrendRaw, planBreakdownRaw, expiringSoon] =
    await Promise.all([
      Organization.countDocuments(),
      User.countDocuments({ organization: { $ne: null } }),
      Organization.countDocuments({ createdAt: { $gte: startOfMonth } }),
      Settlement.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]),
      Settlement.aggregate([{ $match: { paidAt: { $gte: startOfMonth } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Organization.aggregate([
        { $match: { createdAt: { $gte: sixMonthsAgo } } },
        { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
      Organization.aggregate([{ $group: { _id: '$plan', count: { $sum: 1 } } }]),
      Organization.find({ currentPeriodEnd: { $ne: null, $lte: soon }, subscriptionStatus: { $in: ['active', 'past_due', 'expired'] } })
        .select('name plan subscriptionStatus currentPeriodEnd')
        .sort({ currentPeriodEnd: 1 })
        .limit(10),
    ]);

  const signupsByKey = Object.fromEntries(signupTrendRaw.map((r) => [`${r._id.year}-${r._id.month}`, r.count]));
  const cursor = new Date(sixMonthsAgo);
  const signupTrend = [];
  for (let i = 0; i < 6; i += 1) {
    const key = `${cursor.getFullYear()}-${cursor.getMonth() + 1}`;
    signupTrend.push({ month: cursor.toLocaleString('en-US', { month: 'short' }), signups: signupsByKey[key] || 0 });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  res.json({
    totalOrganizations,
    totalUsers,
    orgsThisMonth,
    totalRevenue: revenueAgg[0]?.total || 0,
    revenueThisMonth: revenueMonthAgg[0]?.total || 0,
    signupTrend,
    planBreakdown: planBreakdownRaw.map((p) => ({ plan: p._id || 'none', count: p.count })),
    expiringSoon,
  });
});

// ---------------------------------------------------------------- organizations

export const listOrganizations = catchAsync(async (req, res) => {
  const { page, limit, skip } = paginationParams(req.query);
  const filter = buildSearchFilter(req.query.search, ['name', 'slug']);

  const [organizations, total] = await Promise.all([
    Organization.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Organization.countDocuments(filter),
  ]);

  const userCounts = await User.aggregate([
    { $match: { organization: { $in: organizations.map((o) => o._id) } } },
    { $group: { _id: '$organization', count: { $sum: 1 } } },
  ]);
  const countsById = Object.fromEntries(userCounts.map((c) => [String(c._id), c.count]));

  const items = organizations.map((o) => ({ ...o.toJSON(), userCount: countsById[String(o._id)] || 0 }));

  res.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
});

export const getOrganization = catchAsync(async (req, res) => {
  const organization = await Organization.findById(req.params.id);
  if (!organization) throw new AppError('Organization not found', 404);

  const [users, revenueAgg, settlements, userLimit] = await Promise.all([
    User.find({ organization: organization._id }).sort({ createdAt: 1 }),
    Settlement.aggregate([{ $match: { organization: organization._id } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Settlement.find({ organization: organization._id }).sort({ paidAt: -1 }).populate('recordedBy', 'name'),
    userLimitFor(organization),
  ]);

  res.json({
    ...organization.toJSON(),
    users: users.map((u) => u.toSafeJSON()),
    revenue: revenueAgg[0]?.total || 0,
    settlements,
    userLimit,
  });
});

function toDate(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new AppError('Invalid date', 400);
  return d;
}

// Records a payment and moves the organization onto that plan's paid period.
async function recordSettlementFor(organization, input, adminUser) {
  const plan = await Plan.findOne({ key: input.plan || organization.plan });
  if (!plan) throw new AppError('Unknown plan', 400);

  const amount = Number(input.amount ?? plan.price);
  if (!Number.isFinite(amount) || amount < 0) throw new AppError('Amount must be zero or more', 400);
  if (input.paymentMode && !PAYMENT_MODES.includes(input.paymentMode)) throw new AppError('Invalid payment mode', 400);

  const paidAt = toDate(input.paidAt) || new Date();
  // A renewal on the same plan continues from the current period end while that is still ahead.
  const continueFrom =
    organization.plan === plan.key && organization.currentPeriodEnd && organization.currentPeriodEnd > paidAt
      ? organization.currentPeriodEnd
      : paidAt;
  const periodStart = toDate(input.periodStart) || continueFrom;
  const lifetime = plan.billingCycle === 'one_time' || plan.billingCycle === 'free';
  // Explicit end date wins; otherwise lifetime plans never end and recurring ones get one cycle.
  const periodEnd = toDate(input.periodEnd) || (lifetime ? null : periodEndFor(plan.billingCycle, periodStart));

  const settlement = await Settlement.create({
    organization: organization._id,
    plan: plan.key,
    planName: plan.name,
    billingCycle: plan.billingCycle,
    amount,
    paymentMode: input.paymentMode || 'bank_transfer',
    reference: input.reference,
    paidAt,
    periodStart,
    periodEnd,
    notes: input.notes,
    recordedBy: adminUser._id,
  });

  organization.plan = plan.key;
  organization.subscriptionStatus = 'active';
  organization.currentPeriodEnd = periodEnd || undefined;
  await organization.save();

  return settlement;
}

export const createOrganization = catchAsync(async (req, res) => {
  const { name, ownerName, ownerEmail, ownerPassword, plan: planKey = 'trial', settlement } = req.body || {};
  if (!name || String(name).trim().length < 2) throw new AppError('Organization name is required', 400);
  if (!ownerName || String(ownerName).trim().length < 2) throw new AppError('Owner name is required', 400);
  if (!isEmail(ownerEmail)) throw new AppError('A valid owner email is required', 400);
  if (!ownerPassword || String(ownerPassword).length < 8) throw new AppError('Owner password must be at least 8 characters', 400);

  const email = ownerEmail.toLowerCase().trim();
  if (await User.exists({ email })) throw new AppError('An account with this email already exists', 409);
  const plan = await Plan.findOne({ key: planKey });
  if (!plan) throw new AppError('Unknown plan', 400);

  const organization = await Organization.create({
    name: String(name).trim(),
    slug: await uniqueSlug(name),
    plan: plan.key,
    subscriptionStatus: plan.billingCycle === 'free' ? 'trialing' : 'active',
    createdByAdmin: req.user._id,
  });

  try {
    await User.create({
      organization: organization._id,
      name: String(ownerName).trim(),
      email,
      passwordHash: await bcrypt.hash(String(ownerPassword), 12),
      role: 'owner',
    });
    await PipelineStage.insertMany(DEFAULT_STAGES.map((stage) => ({ ...stage, organization: organization._id })));
    if (settlement) await recordSettlementFor(organization, { ...settlement, plan: plan.key }, req.user);
  } catch (err) {
    // Don't leave a half-created workspace behind.
    await Promise.all([
      Organization.deleteOne({ _id: organization._id }),
      User.deleteMany({ organization: organization._id }),
      PipelineStage.deleteMany({ organization: organization._id }),
      Settlement.deleteMany({ organization: organization._id }),
    ]);
    throw err;
  }

  res.status(201).json(organization);
});

export const updateOrganization = catchAsync(async (req, res) => {
  const updates = pick(req.body, ['name', 'plan', 'subscriptionStatus', 'isSuspended', 'currentPeriodEnd', 'maxUsersOverride']);
  if (updates.plan && !(await Plan.exists({ key: updates.plan }))) throw new AppError('Unknown plan', 400);
  if ('currentPeriodEnd' in updates && !updates.currentPeriodEnd) {
    delete updates.currentPeriodEnd;
    updates.$unset = { currentPeriodEnd: 1 };
  }
  // Extending (or removing) the end date of an expired workspace unlocks it, unless a status was chosen explicitly.
  if ('currentPeriodEnd' in req.body && !updates.subscriptionStatus) {
    const extended = !req.body.currentPeriodEnd || new Date(req.body.currentPeriodEnd) > new Date();
    const current = await Organization.findById(req.params.id).select('subscriptionStatus');
    if (extended && current?.subscriptionStatus === 'expired') updates.subscriptionStatus = 'active';
  }

  const organization = await Organization.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!organization) throw new AppError('Organization not found', 404);
  res.json(organization);
});

export const resetUserPassword = catchAsync(async (req, res) => {
  const { userId, password } = req.body || {};
  if (!password || String(password).length < 8) throw new AppError('Password must be at least 8 characters', 400);
  if (!mongoose.isValidObjectId(userId)) throw new AppError('Invalid user', 400);
  const user = await User.findOne({ _id: userId, organization: req.params.id });
  if (!user) throw new AppError('User not found in this organization', 404);
  user.passwordHash = await bcrypt.hash(String(password), 12);
  await user.save();
  res.status(204).send();
});

// ---------------------------------------------------------------- settlements

export const recordSettlement = catchAsync(async (req, res) => {
  const organization = await Organization.findById(req.params.id);
  if (!organization) throw new AppError('Organization not found', 404);
  const settlement = await recordSettlementFor(organization, req.body || {}, req.user);
  res.status(201).json({ settlement, organization });
});

export const deleteSettlement = catchAsync(async (req, res) => {
  const settlement = await Settlement.findOneAndDelete({ _id: req.params.settlementId, organization: req.params.id });
  if (!settlement) throw new AppError('Settlement not found', 404);
  res.status(204).send();
});

export const listSettlements = catchAsync(async (req, res) => {
  const { page, limit, skip } = paginationParams(req.query);
  let filter = {};
  if (req.query.search) {
    const orgs = await Organization.find(buildSearchFilter(req.query.search, ['name', 'slug'])).select('_id');
    filter = { $or: [{ organization: { $in: orgs.map((o) => o._id) } }, ...buildSearchFilter(req.query.search, ['reference', 'planName']).$or] };
  }
  const [items, total, sumAgg] = await Promise.all([
    Settlement.find(filter).sort({ paidAt: -1 }).skip(skip).limit(limit).populate('organization', 'name slug').populate('recordedBy', 'name'),
    Settlement.countDocuments(filter),
    Settlement.aggregate([{ $match: filter }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
  ]);
  res.json({ items, total, page, limit, pages: Math.ceil(total / limit), totalAmount: sumAgg[0]?.total || 0 });
});

// ---------------------------------------------------------------- plans

function planInput(body, { creating }) {
  const keys = ['name', 'description', 'billingCycle', 'price', 'maxUsers', 'features', 'isActive', 'sortOrder'];
  const data = pick(body, creating ? [...keys, 'key'] : keys);
  if (creating) {
    data.key = String(data.key || '').toLowerCase().trim();
    if (!/^[a-z0-9_-]{2,30}$/.test(data.key)) throw new AppError('Plan key must be 2-30 lowercase letters, numbers, - or _', 400);
  }
  if (data.billingCycle && !BILLING_CYCLES.includes(data.billingCycle)) throw new AppError('Invalid billing cycle', 400);
  if (data.features !== undefined) {
    if (!Array.isArray(data.features)) throw new AppError('Features must be a list', 400);
    data.features = data.features.map((f) => String(f).trim()).filter(Boolean);
  }
  return data;
}

export const listPlans = catchAsync(async (req, res) => {
  const [plans, counts] = await Promise.all([
    Plan.find().sort({ sortOrder: 1, createdAt: 1 }),
    Organization.aggregate([{ $group: { _id: '$plan', count: { $sum: 1 } } }]),
  ]);
  const byKey = Object.fromEntries(counts.map((c) => [c._id, c.count]));
  res.json(plans.map((p) => ({ ...p.toObject(), priceLabel: priceLabel(p), organizationCount: byKey[p.key] || 0 })));
});

export const createPlan = catchAsync(async (req, res) => {
  const data = planInput(req.body, { creating: true });
  if (await Plan.exists({ key: data.key })) throw new AppError('A plan with this key already exists', 409);
  const plan = await Plan.create(data);
  res.status(201).json(plan);
});

export const updatePlan = catchAsync(async (req, res) => {
  const plan = await Plan.findByIdAndUpdate(req.params.id, planInput(req.body, { creating: false }), { new: true, runValidators: true });
  if (!plan) throw new AppError('Plan not found', 404);
  res.json(plan);
});

export const deletePlan = catchAsync(async (req, res) => {
  const plan = await Plan.findById(req.params.id);
  if (!plan) throw new AppError('Plan not found', 404);
  if (await Organization.exists({ plan: plan.key })) {
    throw new AppError('Organizations are on this plan. Move them first, or mark the plan inactive.', 400);
  }
  await plan.deleteOne();
  res.status(204).send();
});

// ---------------------------------------------------------------- branding / platform settings

const MAX_ASSET_BYTES = 1024 * 1024;
// No SVG: it is served from our own origin and could carry script.
const ASSET_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon']);

function parseDataUrl(value) {
  const match = /^data:([\w/.+-]+);base64,(.+)$/.exec(value || '');
  if (!match || !ASSET_TYPES.has(match[1])) throw new AppError('Images must be PNG, JPEG, WebP or ICO', 400);
  const data = Buffer.from(match[2], 'base64');
  if (data.length > MAX_ASSET_BYTES) throw new AppError('Images must be 1 MB or smaller', 400);
  return { data, contentType: match[1] };
}

export const getPlatformSettings = catchAsync(async (req, res) => {
  const settings = await PlatformSettings.get();
  res.json(settings.toPublic());
});

export const updatePlatformSettings = catchAsync(async (req, res) => {
  const settings = await PlatformSettings.get();
  const body = req.body || {};
  const fields = pick(body, ['appName', 'companyName', 'tagline', 'primaryColor', 'supportEmail', 'supportPhone', 'allowPublicSignup']);
  if (fields.primaryColor && !/^#[0-9a-f]{6}$/i.test(fields.primaryColor)) throw new AppError('Primary color must be a hex value like #4f46e5', 400);
  if ('appName' in fields && !String(fields.appName || '').trim()) throw new AppError('App name is required', 400);
  if (fields.supportEmail && !isEmail(fields.supportEmail)) throw new AppError('Support email is not valid', 400);
  Object.assign(settings, fields);

  // Each asset: data URL = replace, null = back to the built-in default, absent = keep.
  for (const kind of ASSET_KINDS) {
    if (body[kind] === null) settings[kind] = undefined;
    else if (typeof body[kind] === 'string') settings[kind] = parseDataUrl(body[kind]);
  }
  settings.markModified('updatedAt');
  await settings.save();
  res.json(settings.toPublic());
});

// ---------------------------------------------------------------- core super admins

export const listSuperAdmins = catchAsync(async (req, res) => {
  const admins = await User.find({ isSuperAdmin: true }).sort({ createdAt: 1 }).populate('organization', 'name');
  res.json(
    admins.map((u) => ({
      ...u.toSafeJSON(),
      organization: u.organization?._id || null,
      organizationName: u.organization?.name || null,
      lastLoginAt: u.lastLoginAt,
    })),
  );
});

export const createSuperAdmin = catchAsync(async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || String(name).trim().length < 2) throw new AppError('Name is required', 400);
  if (!isEmail(email)) throw new AppError('A valid email is required', 400);
  if (!password || String(password).length < 8) throw new AppError('Password must be at least 8 characters', 400);
  const normalized = email.toLowerCase().trim();
  if (await User.exists({ email: normalized })) throw new AppError('An account with this email already exists', 409);

  const user = await User.create({
    name: String(name).trim(),
    email: normalized,
    passwordHash: await bcrypt.hash(String(password), 12),
    role: 'owner',
    isSuperAdmin: true,
  });
  res.status(201).json(user.toSafeJSON());
});

export const updateSuperAdmin = catchAsync(async (req, res) => {
  if (String(req.params.id) === String(req.user._id)) throw new AppError('You cannot change your own super admin account here', 400);
  const user = await User.findOne({ _id: req.params.id, isSuperAdmin: true });
  if (!user) throw new AppError('Super admin not found', 404);

  const { isActive, password } = req.body || {};
  if (typeof isActive === 'boolean') user.isActive = isActive;
  if (password !== undefined) {
    if (String(password).length < 8) throw new AppError('Password must be at least 8 characters', 400);
    user.passwordHash = await bcrypt.hash(String(password), 12);
  }
  await user.save();
  res.json(user.toSafeJSON());
});
