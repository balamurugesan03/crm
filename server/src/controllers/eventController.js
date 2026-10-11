import Event from '../models/Event.js';
import Task from '../models/Task.js';
import { AppError } from '../utils/AppError.js';
import { catchAsync } from '../utils/catchAsync.js';
import { notifyUser } from '../services/notificationService.js';
import { logActivity } from '../services/activityService.js';
import { eventScope, isRestricted } from '../utils/visibility.js';

function populateFields(query) {
  return query
    .populate('attendees', 'name avatarColor')
    .populate('ownerUser', 'name avatarColor')
    .populate('contact', 'firstName lastName')
    .populate('company', 'name')
    .populate('deal', 'title');
}

async function notifyAttendees(event, req, previousAttendees = []) {
  const previous = new Set(previousAttendees.map(String));
  const fresh = (event.attendees || []).map(String).filter((id) => !previous.has(id) && id !== String(req.user._id));
  await Promise.all(
    fresh.map((user) =>
      notifyUser({
        organization: req.tenantId,
        user,
        type: 'event_invite',
        title: `${req.user.name} invited you to "${event.title}"`,
        body: new Date(event.start).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
        link: '/calendar',
      }),
    ),
  );
}

async function logOnRelated(event, req, body) {
  const targets = [
    ['Contact', event.contact],
    ['Company', event.company],
    ['Deal', event.deal],
  ].filter(([, id]) => id);
  await Promise.all(
    targets.map(([entityType, entityId]) =>
      logActivity({ organization: req.tenantId, entityType, entityId, type: 'meeting', body, createdBy: req.user._id }),
    ),
  );
}

// Returns events in a date window plus pending tasks with due dates in that window,
// so the calendar shows the full agenda in one request.
export const listEvents = catchAsync(async (req, res) => {
  const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 31 * 864e5);
  const to = req.query.to ? new Date(req.query.to) : new Date(Date.now() + 62 * 864e5);
  const filter = { organization: req.tenantId, start: { $gte: from, $lte: to } };
  if (req.query.mine === 'true' || isRestricted(req)) filter.$or = [{ ownerUser: req.user._id }, { attendees: req.user._id }];

  const taskFilter = { organization: req.tenantId, dueDate: { $gte: from, $lte: to } };
  if (req.query.mine === 'true' || isRestricted(req)) taskFilter.assignedTo = req.user._id;

  const [events, tasks] = await Promise.all([
    populateFields(Event.find(filter).sort({ start: 1 })),
    Task.find(taskFilter).sort({ dueDate: 1 }).populate('assignedTo', 'name avatarColor'),
  ]);

  res.json({ events, tasks });
});

export const upcomingEvents = catchAsync(async (req, res) => {
  const events = await populateFields(
    Event.find({
      organization: req.tenantId,
      status: 'scheduled',
      start: { $gte: new Date() },
      $or: [{ ownerUser: req.user._id }, { attendees: req.user._id }],
    })
      .sort({ start: 1 })
      .limit(Number(req.query.limit) || 5),
  );
  res.json(events);
});

export const getEvent = catchAsync(async (req, res) => {
  const event = await populateFields(Event.findOne({ _id: req.params.id, organization: req.tenantId, ...eventScope(req) }));
  if (!event) throw new AppError('Event not found', 404);
  res.json(event);
});

function pickEditable(body) {
  const { _id, __v, organization, createdAt, updatedAt, ...rest } = body;
  return rest;
}

export const createEvent = catchAsync(async (req, res) => {
  const event = await Event.create({ ...pickEditable(req.body), organization: req.tenantId, ownerUser: req.body.ownerUser || req.user._id });
  await notifyAttendees(event, req);
  await logOnRelated(event, req, `${req.user.name} scheduled ${event.type.replace('_', ' ')} "${event.title}"`);
  res.status(201).json(event);
});

export const updateEvent = catchAsync(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.id, organization: req.tenantId, ...eventScope(req) });
  if (!event) throw new AppError('Event not found', 404);
  const previousAttendees = [...(event.attendees || [])];
  const completedNow = req.body.status === 'completed' && event.status !== 'completed';

  Object.assign(event, pickEditable(req.body));
  await event.save();
  await notifyAttendees(event, req, previousAttendees);
  if (completedNow) await logOnRelated(event, req, `${req.user.name} completed "${event.title}"`);

  res.json(event);
});

export const deleteEvent = catchAsync(async (req, res) => {
  const event = await Event.findOneAndDelete({ _id: req.params.id, organization: req.tenantId, ...eventScope(req) });
  if (!event) throw new AppError('Event not found', 404);
  res.status(204).send();
});
