import Ticket from '../models/Ticket.js';
import Activity from '../models/Activity.js';
import { AppError } from '../utils/AppError.js';
import { catchAsync } from '../utils/catchAsync.js';
import { paginationParams, buildSearchFilter } from '../utils/queryHelpers.js';
import { logActivity } from '../services/activityService.js';
import { emitDomainEvent } from '../services/eventBus.js';
import { notifyUser } from '../services/notificationService.js';
import { nextNumber } from '../utils/numbering.js';
import { ownerScope } from '../utils/visibility.js';

function populateFields(query) {
  return query
    .populate('contact', 'firstName lastName')
    .populate('company', 'name')
    .populate('assignedTo', 'name avatarColor');
}

export const listTickets = catchAsync(async (req, res) => {
  const { page, limit, skip } = paginationParams(req.query);
  const filter = {
    organization: req.tenantId,
    ...ownerScope(req, 'assignedTo'),
    ...buildSearchFilter(req.query.search, ['subject', 'ticketNumber']),
  };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.priority) filter.priority = req.query.priority;

  const [items, total] = await Promise.all([
    populateFields(Ticket.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)),
    Ticket.countDocuments(filter),
  ]);

  res.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
});

export const getTicket = catchAsync(async (req, res) => {
  const ticket = await populateFields(Ticket.findOne({ _id: req.params.id, organization: req.tenantId, ...ownerScope(req, 'assignedTo') }));
  if (!ticket) throw new AppError('Ticket not found', 404);

  const activity = await Activity.find({ organization: req.tenantId, entityType: 'Ticket', entityId: ticket._id })
    .sort({ createdAt: -1 })
    .populate('createdBy', 'name avatarColor');

  res.json({ ...ticket.toObject(), activity });
});

export const createTicket = catchAsync(async (req, res) => {
  const ticketNumber = await nextNumber(Ticket, req.tenantId, 'T');
  const assignedTo = req.body.assignedTo || req.user._id;
  const ticket = await Ticket.create({
    ...req.body,
    organization: req.tenantId,
    ticketNumber,
    assignedTo,
  });
  await logActivity({
    organization: req.tenantId,
    entityType: 'Ticket',
    entityId: ticket._id,
    type: 'created',
    body: `${req.user.name} opened this ticket`,
    createdBy: req.user._id,
  });

  if (String(assignedTo) !== String(req.user._id)) {
    await notifyUser({
      organization: req.tenantId,
      user: assignedTo,
      type: 'ticket_assigned',
      title: 'New ticket assigned to you',
      body: ticket.subject,
      link: '/tickets',
    });
  }

  emitDomainEvent('ticket.created', { organization: req.tenantId, record: ticket, actor: req.user });
  res.status(201).json(ticket);
});

export const updateTicket = catchAsync(async (req, res) => {
  const existing = await Ticket.findOne({ _id: req.params.id, organization: req.tenantId, ...ownerScope(req, 'assignedTo') });
  if (!existing) throw new AppError('Ticket not found', 404);

  const statusChanged = req.body.status && req.body.status !== existing.status;
  const reassigned = req.body.assignedTo && String(req.body.assignedTo) !== String(existing.assignedTo);

  Object.assign(existing, req.body);
  if (statusChanged && ['resolved', 'closed'].includes(req.body.status)) {
    existing.resolvedAt = new Date();
  }
  await existing.save();

  if (reassigned && String(existing.assignedTo) !== String(req.user._id)) {
    await notifyUser({
      organization: req.tenantId,
      user: existing.assignedTo,
      type: 'ticket_assigned',
      title: 'A ticket was assigned to you',
      body: existing.subject,
      link: '/tickets',
    });
  }

  if (statusChanged) {
    await logActivity({
      organization: req.tenantId,
      entityType: 'Ticket',
      entityId: existing._id,
      type: 'status_change',
      body: `${req.user.name} changed status to "${req.body.status.replace('_', ' ')}"`,
      createdBy: req.user._id,
    });
    emitDomainEvent('ticket.status_changed', { organization: req.tenantId, record: existing, actor: req.user });
  }

  res.json(existing);
});

export const deleteTicket = catchAsync(async (req, res) => {
  const ticket = await Ticket.findOneAndDelete({ _id: req.params.id, organization: req.tenantId, ...ownerScope(req, 'assignedTo') });
  if (!ticket) throw new AppError('Ticket not found', 404);
  res.status(204).send();
});

export const addTicketNote = catchAsync(async (req, res) => {
  const ticket = await Ticket.findOne({ _id: req.params.id, organization: req.tenantId, ...ownerScope(req, 'assignedTo') });
  if (!ticket) throw new AppError('Ticket not found', 404);
  const activity = await logActivity({
    organization: req.tenantId,
    entityType: 'Ticket',
    entityId: ticket._id,
    type: 'note',
    body: req.body.body,
    createdBy: req.user._id,
  });
  res.status(201).json(activity);
});
