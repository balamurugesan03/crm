import Automation, { AUTOMATION_TRIGGERS, AUTOMATION_ACTIONS } from '../models/Automation.js';
import { AppError } from '../utils/AppError.js';
import { catchAsync } from '../utils/catchAsync.js';

export const getAutomationMeta = (req, res) => {
  res.json({ triggers: AUTOMATION_TRIGGERS, actions: AUTOMATION_ACTIONS });
};

export const listAutomations = catchAsync(async (req, res) => {
  const items = await Automation.find({ organization: req.tenantId })
    .sort({ createdAt: -1 })
    .populate('createdBy', 'name avatarColor');
  res.json(items);
});

export const createAutomation = catchAsync(async (req, res) => {
  const { organization, runCount, lastRunAt, ...body } = req.body;
  const automation = await Automation.create({ ...body, organization: req.tenantId, createdBy: req.user._id });
  res.status(201).json(automation);
});

export const updateAutomation = catchAsync(async (req, res) => {
  const { _id, __v, createdAt, updatedAt, organization, runCount, lastRunAt, createdBy, ...body } = req.body;
  const automation = await Automation.findOneAndUpdate({ _id: req.params.id, organization: req.tenantId }, body, {
    new: true,
    runValidators: true,
  });
  if (!automation) throw new AppError('Automation not found', 404);
  res.json(automation);
});

export const deleteAutomation = catchAsync(async (req, res) => {
  const automation = await Automation.findOneAndDelete({ _id: req.params.id, organization: req.tenantId });
  if (!automation) throw new AppError('Automation not found', 404);
  res.status(204).send();
});
