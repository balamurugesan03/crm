import Organization from '../models/Organization.js';
import User from '../models/User.js';
import Invoice from '../models/Invoice.js';
import { AppError } from '../utils/AppError.js';
import { catchAsync } from '../utils/catchAsync.js';
import { paginationParams, buildSearchFilter } from '../utils/queryHelpers.js';

export const getStats = catchAsync(async (req, res) => {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const [totalOrganizations, totalUsers, orgsThisMonth, revenueAgg, signupTrendRaw, planBreakdownRaw] = await Promise.all([
    Organization.countDocuments(),
    User.countDocuments(),
    Organization.countDocuments({ createdAt: { $gte: startOfMonth } }),
    Invoice.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
    Organization.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),
    Organization.aggregate([{ $group: { _id: '$plan', count: { $sum: 1 } } }]),
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
    signupTrend,
    planBreakdown: planBreakdownRaw.map((p) => ({ plan: p._id, count: p.count })),
  });
});

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

  const items = organizations.map((o) => ({ ...o.toObject(), userCount: countsById[String(o._id)] || 0 }));

  res.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
});

export const getOrganization = catchAsync(async (req, res) => {
  const organization = await Organization.findById(req.params.id);
  if (!organization) throw new AppError('Organization not found', 404);

  const [users, revenueAgg] = await Promise.all([
    User.find({ organization: organization._id }).sort({ createdAt: 1 }),
    Invoice.aggregate([
      { $match: { organization: organization._id, status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]),
  ]);

  res.json({
    ...organization.toObject(),
    users: users.map((u) => u.toSafeJSON()),
    revenue: revenueAgg[0]?.total || 0,
  });
});

export const updateOrganization = catchAsync(async (req, res) => {
  const allowed = ['plan', 'subscriptionStatus', 'isSuspended'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));

  const organization = await Organization.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!organization) throw new AppError('Organization not found', 404);
  res.json(organization);
});
