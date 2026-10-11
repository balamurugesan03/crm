import PipelineStage from '../models/PipelineStage.js';
import Deal from '../models/Deal.js';
import { AppError } from '../utils/AppError.js';
import { catchAsync } from '../utils/catchAsync.js';

export const listStages = catchAsync(async (req, res) => {
  const stages = await PipelineStage.find({ organization: req.tenantId }).sort({ order: 1 });
  res.json(stages);
});

export const createStage = catchAsync(async (req, res) => {
  const stage = await PipelineStage.create({ ...req.body, organization: req.tenantId });
  res.status(201).json(stage);
});

export const updateStage = catchAsync(async (req, res) => {
  const stage = await PipelineStage.findOneAndUpdate(
    { _id: req.params.id, organization: req.tenantId },
    req.body,
    { new: true, runValidators: true },
  );
  if (!stage) throw new AppError('Stage not found', 404);
  res.json(stage);
});

export const deleteStage = catchAsync(async (req, res) => {
  const stage = await PipelineStage.findOne({ _id: req.params.id, organization: req.tenantId });
  if (!stage) throw new AppError('Stage not found', 404);
  if (stage.isWon || stage.isLost) throw new AppError('Won and Lost stages cannot be deleted', 400);
  const dealCount = await Deal.countDocuments({ organization: req.tenantId, stage: stage._id });
  if (dealCount) throw new AppError(`Move the ${dealCount} deal(s) in this stage before deleting it`, 400);
  await stage.deleteOne();
  res.status(204).send();
});
