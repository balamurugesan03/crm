import Task from '../models/Task.js';
import { AppError } from '../utils/AppError.js';
import { catchAsync } from '../utils/catchAsync.js';
import { paginationParams } from '../utils/queryHelpers.js';
import { notifyUser } from '../services/notificationService.js';
import { ownerScope } from '../utils/visibility.js';

export const listTasks = catchAsync(async (req, res) => {
  const { page, limit, skip } = paginationParams(req.query);
  const filter = { organization: req.tenantId, ...ownerScope(req, 'assignedTo') };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.relatedToModel && req.query.relatedToId) {
    filter.relatedToModel = req.query.relatedToModel;
    filter.relatedToId = req.query.relatedToId;
  }

  const [items, total] = await Promise.all([
    Task.find(filter).sort({ dueDate: 1, createdAt: -1 }).skip(skip).limit(limit).populate('assignedTo', 'name avatarColor'),
    Task.countDocuments(filter),
  ]);

  res.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
});

export const createTask = catchAsync(async (req, res) => {
  const assignedTo = req.body.assignedTo || req.user._id;
  const task = await Task.create({ ...req.body, organization: req.tenantId, assignedTo });

  if (String(assignedTo) !== String(req.user._id)) {
    await notifyUser({
      organization: req.tenantId,
      user: assignedTo,
      type: 'task_assigned',
      title: 'New task assigned to you',
      body: task.title,
      link: '/tasks',
    });
  }

  res.status(201).json(task);
});

export const updateTask = catchAsync(async (req, res) => {
  const existing = await Task.findOne({ _id: req.params.id, organization: req.tenantId, ...ownerScope(req, 'assignedTo') });
  if (!existing) throw new AppError('Task not found', 404);

  const reassigned = req.body.assignedTo && String(req.body.assignedTo) !== String(existing.assignedTo);

  Object.assign(existing, req.body);
  await existing.save();

  if (reassigned && String(existing.assignedTo) !== String(req.user._id)) {
    await notifyUser({
      organization: req.tenantId,
      user: existing.assignedTo,
      type: 'task_assigned',
      title: 'A task was assigned to you',
      body: existing.title,
      link: '/tasks',
    });
  }

  res.json(existing);
});

export const deleteTask = catchAsync(async (req, res) => {
  const task = await Task.findOneAndDelete({ _id: req.params.id, organization: req.tenantId, ...ownerScope(req, 'assignedTo') });
  if (!task) throw new AppError('Task not found', 404);
  res.status(204).send();
});
