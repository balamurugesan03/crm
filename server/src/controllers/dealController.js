import Deal from '../models/Deal.js';
import PipelineStage from '../models/PipelineStage.js';
import { AppError } from '../utils/AppError.js';
import { catchAsync } from '../utils/catchAsync.js';
import { logActivity } from '../services/activityService.js';
import { emitDomainEvent } from '../services/eventBus.js';
import Activity from '../models/Activity.js';
import { ownerScope } from '../utils/visibility.js';
import { computeDealHealth } from '../services/dealHealth.js';

const PROTECTED = ['_id', '__v', 'organization', 'createdAt', 'updatedAt', 'status', 'stageChangedAt', 'lastActivityAt', 'closedAt'];
function editable(body) {
  const out = { ...body };
  PROTECTED.forEach((k) => delete out[k]);
  return out;
}

async function assertStage(req, stageId) {
  const stage = await PipelineStage.findOne({ _id: stageId, organization: req.tenantId });
  if (!stage) throw new AppError('Invalid pipeline stage', 400);
  return stage;
}

export const listDeals = catchAsync(async (req, res) => {
  const filter = { organization: req.tenantId, ...ownerScope(req, 'ownerUser'), status: 'open' };
  const deals = await Deal.find(filter)
    .sort({ createdAt: -1 })
    .populate('contact', 'firstName lastName')
    .populate('company', 'name')
    .populate('ownerUser', 'name avatarColor')
    .populate('stage', 'name order probability isWon isLost');
  const rottingDays = req.orgSettings?.rottingDays || 7;
  res.json(deals.map((d) => ({ ...d.toObject(), health: computeDealHealth(d, rottingDays) })));
});

export const getDeal = catchAsync(async (req, res) => {
  const deal = await Deal.findOne({ _id: req.params.id, organization: req.tenantId, ...ownerScope(req, 'ownerUser') })
    .populate('contact', 'firstName lastName')
    .populate('company', 'name')
    .populate('ownerUser', 'name avatarColor')
    .populate('stage', 'name order probability isWon isLost');
  if (!deal) throw new AppError('Deal not found', 404);

  const activity = await Activity.find({ organization: req.tenantId, entityType: 'Deal', entityId: deal._id })
    .sort({ createdAt: -1 })
    .populate('createdBy', 'name avatarColor');

  res.json({ ...deal.toObject(), activity, health: computeDealHealth(deal, req.orgSettings?.rottingDays || 7) });
});

export const createDeal = catchAsync(async (req, res) => {
  let { stage } = req.body;
  if (!stage) {
    const firstStage = await PipelineStage.findOne({ organization: req.tenantId }).sort({ order: 1 });
    if (!firstStage) throw new AppError('No pipeline stages configured for this organization', 400);
    stage = firstStage._id;
  } else {
    await assertStage(req, stage);
  }
  const now = new Date();
  const deal = await Deal.create({ ...editable(req.body), stage, stageChangedAt: now, lastActivityAt: now, organization: req.tenantId, ownerUser: req.body.ownerUser || req.user._id });
  await logActivity({
    organization: req.tenantId,
    entityType: 'Deal',
    entityId: deal._id,
    type: 'created',
    body: `${req.user.name} created this deal`,
    createdBy: req.user._id,
  });
  emitDomainEvent('deal.created', { organization: req.tenantId, record: deal, actor: req.user });
  res.status(201).json(deal);
});

export const updateDeal = catchAsync(async (req, res) => {
  const existing = await Deal.findOne({ _id: req.params.id, organization: req.tenantId, ...ownerScope(req, 'ownerUser') });
  if (!existing) throw new AppError('Deal not found', 404);

  const stageChanged = req.body.stage && String(req.body.stage) !== String(existing.stage);

  const newStage = stageChanged ? await assertStage(req, req.body.stage) : null;
  Object.assign(existing, editable(req.body));

  if (stageChanged) {
    existing.stageChangedAt = new Date();
    if (newStage.isWon) existing.status = 'won';
    else if (newStage.isLost) existing.status = 'lost';
    else existing.status = 'open';
    existing.closedAt = existing.status === 'open' ? undefined : new Date();
  }
  await existing.save();

  if (stageChanged) {

    await logActivity({
      organization: req.tenantId,
      entityType: 'Deal',
      entityId: existing._id,
      type: 'stage_change',
      body: `${req.user.name} moved this deal to "${newStage?.name}"`,
      createdBy: req.user._id,
    });

    const record = { ...existing.toObject(), stageName: newStage?.name };
    emitDomainEvent('deal.stage_changed', { organization: req.tenantId, record, actor: req.user });
    if (existing.status === 'won') emitDomainEvent('deal.won', { organization: req.tenantId, record, actor: req.user });
    if (existing.status === 'lost') emitDomainEvent('deal.lost', { organization: req.tenantId, record, actor: req.user });
  }

  res.json(existing);
});

export const deleteDeal = catchAsync(async (req, res) => {
  const deal = await Deal.findOneAndDelete({ _id: req.params.id, organization: req.tenantId, ...ownerScope(req, 'ownerUser') });
  if (!deal) throw new AppError('Deal not found', 404);
  res.status(204).send();
});

export const addDealNote = catchAsync(async (req, res) => {
  const deal = await Deal.findOne({ _id: req.params.id, organization: req.tenantId, ...ownerScope(req, 'ownerUser') });
  if (!deal) throw new AppError('Deal not found', 404);
  const activity = await logActivity({
    organization: req.tenantId,
    entityType: 'Deal',
    entityId: deal._id,
    type: 'note',
    body: req.body.body,
    createdBy: req.user._id,
  });
  res.status(201).json(activity);
});
