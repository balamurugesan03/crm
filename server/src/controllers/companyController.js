import Company from '../models/Company.js';
import Contact from '../models/Contact.js';
import Deal from '../models/Deal.js';
import Activity from '../models/Activity.js';
import { AppError } from '../utils/AppError.js';
import { catchAsync } from '../utils/catchAsync.js';
import { paginationParams, buildSearchFilter } from '../utils/queryHelpers.js';
import { logActivity } from '../services/activityService.js';
import { ownerScope } from '../utils/visibility.js';

export const listCompanies = catchAsync(async (req, res) => {
  const { page, limit, skip } = paginationParams(req.query);
  const filter = { organization: req.tenantId, ...ownerScope(req, 'ownerUser'), ...buildSearchFilter(req.query.search, ['name', 'domain', 'industry']) };

  const [items, total] = await Promise.all([
    Company.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('ownerUser', 'name avatarColor'),
    Company.countDocuments(filter),
  ]);

  res.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
});

export const getCompany = catchAsync(async (req, res) => {
  const company = await Company.findOne({ _id: req.params.id, organization: req.tenantId, ...ownerScope(req, 'ownerUser') }).populate('ownerUser', 'name avatarColor');
  if (!company) throw new AppError('Company not found', 404);

  const [contacts, deals, activity] = await Promise.all([
    Contact.find({ organization: req.tenantId, company: company._id }).sort({ createdAt: -1 }),
    Deal.find({ organization: req.tenantId, company: company._id })
      .sort({ createdAt: -1 })
      .populate('stage', 'name isWon isLost'),
    Activity.find({ organization: req.tenantId, entityType: 'Company', entityId: company._id })
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name avatarColor'),
  ]);

  res.json({ ...company.toObject(), contacts, deals, activity });
});

export const createCompany = catchAsync(async (req, res) => {
  const company = await Company.create({ ...req.body, organization: req.tenantId, ownerUser: req.body.ownerUser || req.user._id });
  await logActivity({
    organization: req.tenantId,
    entityType: 'Company',
    entityId: company._id,
    type: 'created',
    body: `${req.user.name} created this company`,
    createdBy: req.user._id,
  });
  res.status(201).json(company);
});

export const updateCompany = catchAsync(async (req, res) => {
  const company = await Company.findOneAndUpdate(
    { _id: req.params.id, organization: req.tenantId, ...ownerScope(req, 'ownerUser') },
    req.body,
    { new: true, runValidators: true },
  );
  if (!company) throw new AppError('Company not found', 404);
  await logActivity({
    organization: req.tenantId,
    entityType: 'Company',
    entityId: company._id,
    type: 'updated',
    body: `${req.user.name} updated this company`,
    createdBy: req.user._id,
  });
  res.json(company);
});

export const deleteCompany = catchAsync(async (req, res) => {
  const company = await Company.findOneAndDelete({ _id: req.params.id, organization: req.tenantId, ...ownerScope(req, 'ownerUser') });
  if (!company) throw new AppError('Company not found', 404);
  res.status(204).send();
});

export const addCompanyNote = catchAsync(async (req, res) => {
  const company = await Company.findOne({ _id: req.params.id, organization: req.tenantId, ...ownerScope(req, 'ownerUser') });
  if (!company) throw new AppError('Company not found', 404);
  const activity = await logActivity({
    organization: req.tenantId,
    entityType: 'Company',
    entityId: company._id,
    type: 'note',
    body: req.body.body,
    createdBy: req.user._id,
  });
  res.status(201).json(activity);
});
