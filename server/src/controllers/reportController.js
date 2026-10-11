import mongoose from 'mongoose';
import Deal from '../models/Deal.js';
import Lead from '../models/Lead.js';
import Invoice from '../models/Invoice.js';
import { catchAsync } from '../utils/catchAsync.js';

const LEAD_STATUS_ORDER = ['new', 'contacted', 'qualified', 'unqualified', 'converted'];

export const getReports = catchAsync(async (req, res) => {
  const orgId = new mongoose.Types.ObjectId(req.tenantId);
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const [revenueTrendRaw, leadsBySourceRaw, leadFunnelRaw, invoiceStatsRaw] = await Promise.all([
    Deal.aggregate([
      { $match: { organization: orgId, status: 'won', closedAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { year: { $year: '$closedAt' }, month: { $month: '$closedAt' } },
          total: { $sum: '$amount' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),
    Lead.aggregate([
      { $match: { organization: orgId } },
      { $group: { _id: '$source', count: { $sum: 1 } } },
    ]),
    Lead.aggregate([
      { $match: { organization: orgId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Invoice.aggregate([
      { $match: { organization: orgId } },
      { $group: { _id: '$status', total: { $sum: '$total' }, count: { $sum: 1 } } },
    ]),
  ]);

  const monthLabels = [];
  const revenueByKey = Object.fromEntries(
    revenueTrendRaw.map((r) => [`${r._id.year}-${r._id.month}`, r.total]),
  );
  const cursor = new Date(sixMonthsAgo);
  const revenueTrend = [];
  for (let i = 0; i < 6; i += 1) {
    const key = `${cursor.getFullYear()}-${cursor.getMonth() + 1}`;
    const label = cursor.toLocaleString('en-US', { month: 'short' });
    revenueTrend.push({ month: label, revenue: revenueByKey[key] || 0 });
    monthLabels.push(label);
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const leadsBySource = leadsBySourceRaw.map((r) => ({ source: r._id, count: r.count }));

  const funnelMap = Object.fromEntries(leadFunnelRaw.map((r) => [r._id, r.count]));
  const leadFunnel = LEAD_STATUS_ORDER.map((status) => ({ status, count: funnelMap[status] || 0 }));

  const invoiceStats = invoiceStatsRaw.reduce(
    (acc, r) => {
      acc[r._id] = { total: r.total, count: r.count };
      return acc;
    },
    { draft: { total: 0, count: 0 }, sent: { total: 0, count: 0 }, paid: { total: 0, count: 0 }, overdue: { total: 0, count: 0 }, void: { total: 0, count: 0 } },
  );

  res.json({ revenueTrend, leadsBySource, leadFunnel, invoiceStats });
});
