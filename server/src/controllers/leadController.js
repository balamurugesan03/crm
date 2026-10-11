import Lead from '../models/Lead.js';
import Contact from '../models/Contact.js';
import Deal from '../models/Deal.js';
import PipelineStage from '../models/PipelineStage.js';
import { AppError } from '../utils/AppError.js';
import { catchAsync } from '../utils/catchAsync.js';
import { paginationParams, buildSearchFilter } from '../utils/queryHelpers.js';
import { logActivity } from '../services/activityService.js';
import { emitDomainEvent } from '../services/eventBus.js';
import { ownerScope } from '../utils/visibility.js';

export const listLeads = catchAsync(async (req, res) => {
  const { page, limit, skip } = paginationParams(req.query);
  const filter = {
    organization: req.tenantId,
    ...ownerScope(req, 'ownerUser'),
    ...buildSearchFilter(req.query.search, ['name', 'email', 'phone']),
  };
  if (req.query.status) filter.status = req.query.status;
  const sort = req.query.sort === 'score' ? { score: -1, createdAt: -1 } : { createdAt: -1 };

  const [items, total] = await Promise.all([
    Lead.find(filter).sort(sort).skip(skip).limit(limit).populate('ownerUser', 'name avatarColor'),
    Lead.countDocuments(filter),
  ]);

  res.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
});

export const getLead = catchAsync(async (req, res) => {
  const lead = await Lead.findOne({ _id: req.params.id, organization: req.tenantId, ...ownerScope(req, 'ownerUser') }).populate('ownerUser', 'name avatarColor');
  if (!lead) throw new AppError('Lead not found', 404);
  res.json(lead);
});

export const createLead = catchAsync(async (req, res) => {
  const lead = await Lead.create({ ...req.body, organization: req.tenantId, ownerUser: req.body.ownerUser || req.user._id });
  emitDomainEvent('lead.created', { organization: req.tenantId, record: lead, actor: req.user });
  res.status(201).json(lead);
});

export const updateLead = catchAsync(async (req, res) => {
  // Load + save (rather than findOneAndUpdate) so the score pre-save hook runs.
  const lead = await Lead.findOne({ _id: req.params.id, organization: req.tenantId, ...ownerScope(req, 'ownerUser') });
  if (!lead) throw new AppError('Lead not found', 404);
  const statusChanged = req.body.status && req.body.status !== lead.status;
  const { organization, score, ...updates } = req.body;
  Object.assign(lead, updates);
  await lead.save();
  if (statusChanged) {
    emitDomainEvent('lead.status_changed', { organization: req.tenantId, record: lead, actor: req.user });
  }
  res.json(lead);
});

export const deleteLead = catchAsync(async (req, res) => {
  const lead = await Lead.findOneAndDelete({ _id: req.params.id, organization: req.tenantId, ...ownerScope(req, 'ownerUser') });
  if (!lead) throw new AppError('Lead not found', 404);
  res.status(204).send();
});

export const convertLead = catchAsync(async (req, res) => {
  const lead = await Lead.findOne({ _id: req.params.id, organization: req.tenantId, ...ownerScope(req, 'ownerUser') });
  if (!lead) throw new AppError('Lead not found', 404);
  if (lead.status === 'converted') throw new AppError('This lead has already been converted', 400);

  let contact;
  if (lead.contact) {
    contact = await Contact.findOne({ _id: lead.contact, organization: req.tenantId });
  }

  if (!contact) {
    const [firstName, ...rest] = (lead.name || 'Unknown').trim().split(' ');
    contact = await Contact.create({
      organization: req.tenantId,
      firstName: firstName || lead.name,
      lastName: rest.join(' '),
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      ownerUser: lead.ownerUser || req.user._id,
    });
    await logActivity({
      organization: req.tenantId,
      entityType: 'Contact',
      entityId: contact._id,
      type: 'created',
      body: `Converted from lead "${lead.name}"`,
      createdBy: req.user._id,
    });
  }

  const firstStage = await PipelineStage.findOne({ organization: req.tenantId }).sort({ order: 1 });
  if (!firstStage) throw new AppError('No pipeline stages configured for this organization', 400);

  const deal = await Deal.create({
    organization: req.tenantId,
    title: `${lead.name} - Deal`,
    amount: lead.estimatedValue || 0,
    stage: firstStage._id,
    contact: contact._id,
    company: lead.company,
    ownerUser: lead.ownerUser || req.user._id,
  });
  await logActivity({
    organization: req.tenantId,
    entityType: 'Deal',
    entityId: deal._id,
    type: 'created',
    body: `Converted from lead "${lead.name}"`,
    createdBy: req.user._id,
  });

  lead.status = 'converted';
  lead.contact = contact._id;
  await lead.save();

  res.json({ lead, contact, deal });
});
