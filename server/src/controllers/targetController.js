import * as z from 'zod/v4';
import mongoose from 'mongoose';
import Target from '../models/Target.js';
import Deal from '../models/Deal.js';
import User from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { catchAsync } from '../utils/catchAsync.js';

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function periodRange(period) {
  const [y, m] = period.split('-').map(Number);
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
}

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Target vs achieved for every active teammate in a month, plus team totals and a
// straight-line forecast (achieved so far extrapolated to month end) and the open pipeline
// expected to close this month.
export async function targetSummary(orgId, period) {
  const org = new mongoose.Types.ObjectId(String(orgId));
  const { start, end } = periodRange(period);
  const [users, targets, won, closingPipeline] = await Promise.all([
    User.find({ organization: org, isActive: true }).select('name avatarColor role').sort({ name: 1 }),
    Target.find({ organization: org, period }),
    Deal.aggregate([
      { $match: { organization: org, status: 'won', closedAt: { $gte: start, $lt: end } } },
      { $group: { _id: '$ownerUser', value: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Deal.aggregate([
      { $match: { organization: org, status: 'open', expectedCloseDate: { $gte: start, $lt: end } } },
      { $lookup: { from: 'pipelinestages', localField: 'stage', foreignField: '_id', as: 's' } },
      { $unwind: { path: '$s', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$ownerUser', weighted: { $sum: { $multiply: ['$amount', { $divide: [{ $ifNull: ['$s.probability', 0] }, 100] }] } } } },
    ]),
  ]);

  const now = Date.now();
  const elapsed = Math.min(1, Math.max(0, (now - start.getTime()) / (end.getTime() - start.getTime())));
  const byUser = (arr) => Object.fromEntries(arr.map((r) => [String(r._id), r]));
  const wonBy = byUser(won);
  const pipeBy = byUser(closingPipeline);
  const targetBy = Object.fromEntries(targets.map((t) => [String(t.user), t]));

  const reps = users.map((u) => {
    const id = String(u._id);
    const target = targetBy[id]?.amount || 0;
    const achieved = wonBy[id]?.value || 0;
    return {
      userId: u._id,
      name: u.name,
      avatarColor: u.avatarColor,
      role: u.role,
      target,
      dealsTarget: targetBy[id]?.dealsTarget || 0,
      achieved,
      dealsWon: wonBy[id]?.count || 0,
      weightedPipeline: Math.round(pipeBy[id]?.weighted || 0),
      attainment: target ? Math.round((achieved / target) * 100) : null,
      // Pace: where they'd land if the rest of the month goes like the part already elapsed.
      projected: elapsed > 0.05 ? Math.round(achieved / elapsed) : null,
    };
  });

  const teamTarget = targetBy.null?.amount || reps.reduce((s, r) => s + r.target, 0);
  const teamAchieved = reps.reduce((s, r) => s + r.achieved, 0);
  return {
    period,
    elapsedPct: Math.round(elapsed * 100),
    team: {
      target: teamTarget,
      achieved: teamAchieved,
      attainment: teamTarget ? Math.round((teamAchieved / teamTarget) * 100) : null,
      weightedPipeline: reps.reduce((s, r) => s + r.weightedPipeline, 0),
      projected: elapsed > 0.05 ? Math.round(teamAchieved / elapsed) : null,
      explicitTeamTarget: Boolean(targetBy.null),
    },
    reps,
  };
}

export const getTargets = catchAsync(async (req, res) => {
  const period = req.query.period || currentPeriod();
  if (!PERIOD_RE.test(period)) throw new AppError('period must be YYYY-MM', 400);
  res.json(await targetSummary(req.tenantId, period));
});

const setSchema = z.object({
  period: z.string().regex(PERIOD_RE),
  targets: z
    .array(
      z.object({
        user: z.string().nullable(),
        amount: z.number().min(0).max(1e12),
        dealsTarget: z.number().int().min(0).max(100000).optional(),
      }),
    )
    .max(500),
});

export const setTargets = catchAsync(async (req, res) => {
  const parsed = setSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError('Invalid targets', 422, parsed.error.issues);
  const { period, targets } = parsed.data;

  const userIds = targets.map((t) => t.user).filter(Boolean);
  const valid = await User.countDocuments({ _id: { $in: userIds }, organization: req.tenantId });
  if (valid !== new Set(userIds).size) throw new AppError('Unknown user in targets', 400);

  await Target.bulkWrite(
    targets.map((t) => ({
      updateOne: {
        filter: { organization: req.tenantId, period, user: t.user || null },
        update: { $set: { amount: t.amount, dealsTarget: t.dealsTarget || 0 } },
        upsert: true,
      },
    })),
  );
  res.json(await targetSummary(req.tenantId, period));
});
