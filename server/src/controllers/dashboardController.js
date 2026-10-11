import mongoose from 'mongoose';
import Deal from '../models/Deal.js';
import Lead from '../models/Lead.js';
import Task from '../models/Task.js';
import Contact from '../models/Contact.js';
import Activity from '../models/Activity.js';
import Event from '../models/Event.js';
import Ticket from '../models/Ticket.js';
import { catchAsync } from '../utils/catchAsync.js';
import { computeDealHealth } from '../services/dealHealth.js';
import { ownerScope } from '../utils/visibility.js';

function monthsBack(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export const getSummary = catchAsync(async (req, res) => {
  const orgId = new mongoose.Types.ObjectId(req.tenantId);
  const startOfMonth = monthsBack(0);
  const startOfLastMonth = monthsBack(1);
  const sixMonthsAgo = monthsBack(5);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 864e5);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const [
    openDealsAgg,
    leadsThisMonth,
    leadsLastMonth,
    tasksDueToday,
    overdueTasks,
    contactsTotal,
    pipelineByStage,
    recentActivity,
    myTasks,
    wonThisMonthAgg,
    wonLastMonthAgg,
    closedOutcomes,
    revenueTrendRaw,
    leaderboard,
    hotLeads,
    upcomingEvents,
    openTickets,
  ] = await Promise.all([
    Deal.aggregate([
      { $match: { organization: orgId, status: 'open' } },
      { $lookup: { from: 'pipelinestages', localField: 'stage', foreignField: '_id', as: 'stage' } },
      { $unwind: { path: '$stage', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          value: { $sum: '$amount' },
          weighted: { $sum: { $multiply: ['$amount', { $divide: [{ $ifNull: ['$stage.probability', 0] }, 100] }] } },
        },
      },
    ]),
    Lead.countDocuments({ organization: orgId, createdAt: { $gte: startOfMonth } }),
    Lead.countDocuments({ organization: orgId, createdAt: { $gte: startOfLastMonth, $lt: startOfMonth } }),
    Task.countDocuments({ organization: orgId, status: 'pending', dueDate: { $gte: startOfToday, $lte: endOfToday } }),
    Task.countDocuments({ organization: orgId, status: 'pending', dueDate: { $lt: startOfToday } }),
    Contact.countDocuments({ organization: orgId }),
    Deal.aggregate([
      { $match: { organization: orgId, status: 'open' } },
      { $group: { _id: '$stage', count: { $sum: 1 }, value: { $sum: '$amount' } } },
      { $lookup: { from: 'pipelinestages', localField: '_id', foreignField: '_id', as: 'stage' } },
      { $unwind: '$stage' },
      { $sort: { 'stage.order': 1 } },
      { $project: { _id: 0, stage: '$stage.name', count: 1, value: 1 } },
    ]),
    Activity.find({ organization: orgId }).sort({ createdAt: -1 }).limit(8).populate('createdBy', 'name avatarColor'),
    Task.find({ organization: orgId, status: 'pending', assignedTo: req.user._id }).sort({ dueDate: 1 }).limit(6),
    Deal.aggregate([
      { $match: { organization: orgId, status: 'won', closedAt: { $gte: startOfMonth } } },
      { $group: { _id: null, value: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Deal.aggregate([
      { $match: { organization: orgId, status: 'won', closedAt: { $gte: startOfLastMonth, $lt: startOfMonth } } },
      { $group: { _id: null, value: { $sum: '$amount' } } },
    ]),
    Deal.aggregate([
      { $match: { organization: orgId, status: { $in: ['won', 'lost'] }, closedAt: { $gte: ninetyDaysAgo } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Deal.aggregate([
      { $match: { organization: orgId, status: 'won', closedAt: { $gte: sixMonthsAgo } } },
      { $group: { _id: { y: { $year: '$closedAt' }, m: { $month: '$closedAt' } }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Deal.aggregate([
      { $match: { organization: orgId, status: 'won', closedAt: { $gte: monthsBack(2) } } },
      { $group: { _id: '$ownerUser', value: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { value: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: { _id: 0, userId: '$user._id', name: '$user.name', avatarColor: '$user.avatarColor', value: 1, count: 1 } },
    ]),
    Lead.find({ organization: orgId, status: { $in: ['new', 'contacted', 'qualified'] } })
      .sort({ score: -1, createdAt: -1 })
      .limit(5)
      .select('name email source status score estimatedValue'),
    Event.find({
      organization: orgId,
      status: 'scheduled',
      start: { $gte: new Date() },
      $or: [{ ownerUser: req.user._id }, { attendees: req.user._id }],
    })
      .sort({ start: 1 })
      .limit(5)
      .populate('contact', 'firstName lastName')
      .select('title type start end location contact'),
    Ticket.countDocuments({ organization: orgId, status: { $in: ['open', 'in_progress', 'waiting'] } }),
  ]);

  const rottingDays = req.orgSettings?.rottingDays || 7;
  const openDealDocs = await Deal.find({ organization: orgId, status: 'open', ...ownerScope(req, 'ownerUser') })
    .select('title amount createdAt lastActivityAt stageChangedAt expectedCloseDate status ownerUser company')
    .populate('ownerUser', 'name avatarColor')
    .populate('company', 'name')
    .limit(500);
  const SEVERITY = { rotting: 2, warning: 1 };
  const atRiskDeals = openDealDocs
    .map((d) => ({ _id: d._id, title: d.title, amount: d.amount, company: d.company?.name, owner: d.ownerUser, health: computeDealHealth(d, rottingDays) }))
    .filter((d) => SEVERITY[d.health.status])
    .sort((a, b) => SEVERITY[b.health.status] - SEVERITY[a.health.status] || b.amount - a.amount);

  const won = closedOutcomes.find((o) => o._id === 'won')?.count || 0;
  const lost = closedOutcomes.find((o) => o._id === 'lost')?.count || 0;

  const trendByKey = Object.fromEntries(revenueTrendRaw.map((r) => [`${r._id.y}-${r._id.m}`, r]));
  const revenueTrend = [];
  const cursor = new Date(sixMonthsAgo);
  for (let i = 0; i < 6; i += 1) {
    const hit = trendByKey[`${cursor.getFullYear()}-${cursor.getMonth() + 1}`];
    revenueTrend.push({ month: cursor.toLocaleString('en-US', { month: 'short' }), revenue: hit?.total || 0, deals: hit?.count || 0 });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  res.json({
    openDeals: openDealsAgg[0]?.count || 0,
    pipelineValue: openDealsAgg[0]?.value || 0,
    weightedPipeline: Math.round(openDealsAgg[0]?.weighted || 0),
    wonThisMonth: wonThisMonthAgg[0]?.value || 0,
    wonDealsThisMonth: wonThisMonthAgg[0]?.count || 0,
    wonLastMonth: wonLastMonthAgg[0]?.value || 0,
    winRate: won + lost ? Math.round((won / (won + lost)) * 100) : 0,
    leadsThisMonth,
    leadsLastMonth,
    tasksDueToday,
    overdueTasks,
    contactsTotal,
    openTickets,
    pipelineByStage,
    revenueTrend,
    leaderboard,
    hotLeads,
    upcomingEvents,
    recentActivity,
    myTasks,
    atRiskDeals: atRiskDeals.slice(0, 6),
    rottingCount: atRiskDeals.filter((d) => d.health.status === 'rotting').length,
    atRiskValue: atRiskDeals.reduce((s, d) => s + (d.amount || 0), 0),
  });
});
