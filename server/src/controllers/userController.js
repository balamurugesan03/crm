import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { catchAsync } from '../utils/catchAsync.js';

export const listUsers = catchAsync(async (req, res) => {
  const users = await User.find({ organization: req.tenantId }).sort({ createdAt: 1 });
  res.json(users.map((u) => u.toSafeJSON()));
});

export const addTeamMember = catchAsync(async (req, res) => {
  const { name, email, password, role } = req.body;

  const existing = await User.findOne({ organization: req.tenantId, email });
  if (existing) {
    throw new AppError('A team member with this email already exists', 409);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ organization: req.tenantId, name, email, passwordHash, role });

  res.status(201).json(user.toSafeJSON());
});

export const updateTeamMember = catchAsync(async (req, res) => {
  if (String(req.params.id) === String(req.user._id)) {
    throw new AppError('Use your profile settings to update your own account', 400);
  }

  const target = await User.findOne({ _id: req.params.id, organization: req.tenantId });
  if (!target) throw new AppError('Team member not found', 404);

  if (target.role === 'owner') {
    throw new AppError('The workspace owner cannot be modified here', 400);
  }

  Object.assign(target, req.body);
  await target.save();

  res.json(target.toSafeJSON());
});

export const updateMe = catchAsync(async (req, res) => {
  Object.assign(req.user, req.body);
  await req.user.save();
  res.json(req.user.toSafeJSON());
});

export const changeMyPassword = catchAsync(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const valid = await req.user.comparePassword(currentPassword);
  if (!valid) throw new AppError('Current password is incorrect', 401);

  req.user.passwordHash = await bcrypt.hash(newPassword, 12);
  await req.user.save();

  res.status(204).send();
});
