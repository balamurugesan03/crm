import Campaign from '../models/Campaign.js';
import Lead from '../models/Lead.js';
import { AppError } from '../utils/AppError.js';
import { catchAsync } from '../utils/catchAsync.js';
import { paginationParams, buildSearchFilter } from '../utils/queryHelpers.js';

export const listCampaigns = catchAsync(async (req, res) => {
  const { page, limit, skip } = paginationParams(req.query);
  const filter = { organization: req.tenantId, ...buildSearchFilter(req.query.search, ['name']) };
  if (req.query.status) filter.status = req.query.status;

  const [campaigns, total] = await Promise.all([
    Campaign.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('ownerUser', 'name avatarColor'),
    Campaign.countDocuments(filter),
  ]);

  const leadCounts = await Lead.aggregate([
    { $match: { organization: req.tenantId, campaign: { $in: campaigns.map((c) => c._id) } } },
    { $group: { _id: '$campaign', count: { $sum: 1 } } },
  ]);
  const countsById = Object.fromEntries(leadCounts.map((c) => [String(c._id), c.count]));

  const items = campaigns.map((c) => ({ ...c.toObject(), leadCount: countsById[String(c._id)] || 0 }));

  res.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
});

export const getCampaign = catchAsync(async (req, res) => {
  const campaign = await Campaign.findOne({ _id: req.params.id, organization: req.tenantId }).populate('ownerUser', 'name avatarColor');
  if (!campaign) throw new AppError('Campaign not found', 404);

  const leads = await Lead.find({ organization: req.tenantId, campaign: campaign._id }).sort({ createdAt: -1 });

  res.json({ ...campaign.toObject(), leads });
});

export const createCampaign = catchAsync(async (req, res) => {
  const campaign = await Campaign.create({ ...req.body, organization: req.tenantId, ownerUser: req.body.ownerUser || req.user._id });
  res.status(201).json(campaign);
});

export const updateCampaign = catchAsync(async (req, res) => {
  const campaign = await Campaign.findOneAndUpdate(
    { _id: req.params.id, organization: req.tenantId },
    req.body,
    { new: true, runValidators: true },
  );
  if (!campaign) throw new AppError('Campaign not found', 404);
  res.json(campaign);
});

export const deleteCampaign = catchAsync(async (req, res) => {
  const campaign = await Campaign.findOneAndDelete({ _id: req.params.id, organization: req.tenantId });
  if (!campaign) throw new AppError('Campaign not found', 404);
  res.status(204).send();
});
