import Contact from '../models/Contact.js';
import { AppError } from '../utils/AppError.js';
import { catchAsync } from '../utils/catchAsync.js';
import { paginationParams, buildSearchFilter } from '../utils/queryHelpers.js';
import { logActivity } from '../services/activityService.js';
import { emitDomainEvent } from '../services/eventBus.js';
import Activity from '../models/Activity.js';
import { ownerScope } from '../utils/visibility.js';

export const listContacts = catchAsync(async (req, res) => {
  const { page, limit, skip } = paginationParams(req.query);
  const filter = {
    organization: req.tenantId,
    ...ownerScope(req, 'ownerUser'),
    ...buildSearchFilter(req.query.search, ['firstName', 'lastName', 'email', 'phone']),
  };
  if (req.query.company) filter.company = req.query.company;

  const [items, total] = await Promise.all([
    Contact.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('company', 'name')
      .populate('ownerUser', 'name avatarColor'),
    Contact.countDocuments(filter),
  ]);

  res.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
});

export const getContact = catchAsync(async (req, res) => {
  const contact = await Contact.findOne({ _id: req.params.id, organization: req.tenantId, ...ownerScope(req, 'ownerUser') })
    .populate('company', 'name')
    .populate('ownerUser', 'name avatarColor');
  if (!contact) throw new AppError('Contact not found', 404);

  const activity = await Activity.find({ organization: req.tenantId, entityType: 'Contact', entityId: contact._id })
    .sort({ createdAt: -1 })
    .populate('createdBy', 'name avatarColor');

  res.json({ ...contact.toObject(), activity });
});

export const createContact = catchAsync(async (req, res) => {
  const contact = await Contact.create({ ...req.body, organization: req.tenantId, ownerUser: req.body.ownerUser || req.user._id });
  await logActivity({
    organization: req.tenantId,
    entityType: 'Contact',
    entityId: contact._id,
    type: 'created',
    body: `${req.user.name} created this contact`,
    createdBy: req.user._id,
  });
  emitDomainEvent('contact.created', { organization: req.tenantId, record: contact, actor: req.user });
  res.status(201).json(contact);
});

export const updateContact = catchAsync(async (req, res) => {
  const contact = await Contact.findOneAndUpdate(
    { _id: req.params.id, organization: req.tenantId, ...ownerScope(req, 'ownerUser') },
    req.body,
    { new: true, runValidators: true },
  );
  if (!contact) throw new AppError('Contact not found', 404);
  await logActivity({
    organization: req.tenantId,
    entityType: 'Contact',
    entityId: contact._id,
    type: 'updated',
    body: `${req.user.name} updated this contact`,
    createdBy: req.user._id,
  });
  res.json(contact);
});

export const deleteContact = catchAsync(async (req, res) => {
  const contact = await Contact.findOneAndDelete({ _id: req.params.id, organization: req.tenantId, ...ownerScope(req, 'ownerUser') });
  if (!contact) throw new AppError('Contact not found', 404);
  res.status(204).send();
});

export const addContactNote = catchAsync(async (req, res) => {
  const contact = await Contact.findOne({ _id: req.params.id, organization: req.tenantId, ...ownerScope(req, 'ownerUser') });
  if (!contact) throw new AppError('Contact not found', 404);
  const activity = await logActivity({
    organization: req.tenantId,
    entityType: 'Contact',
    entityId: contact._id,
    type: 'note',
    body: req.body.body,
    createdBy: req.user._id,
  });
  res.status(201).json(activity);
});
