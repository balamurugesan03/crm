import AuditLog from '../models/AuditLog.js';
import { catchAsync } from '../utils/catchAsync.js';
import { paginationParams } from '../utils/queryHelpers.js';

export const listAuditLogs = catchAsync(async (req, res) => {
  const { page, limit, skip } = paginationParams(req.query);
  const filter = { organization: req.tenantId };
  if (req.query.action) filter.action = req.query.action;
  if (req.query.resource) filter.resource = req.query.resource;
  if (req.query.user) filter.user = req.query.user;

  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('user', 'name email avatarColor'),
    AuditLog.countDocuments(filter),
  ]);

  res.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
});
