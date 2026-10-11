import bcrypt from 'bcryptjs';
import Organization from '../models/Organization.js';
import User from '../models/User.js';
import PipelineStage, { DEFAULT_STAGES } from '../models/PipelineStage.js';
import { AppError } from '../utils/AppError.js';
import { catchAsync } from '../utils/catchAsync.js';
import { slugify } from '../utils/slug.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  REFRESH_COOKIE_NAME,
  refreshCookieOptions,
} from '../utils/token.js';

async function uniqueSlug(base) {
  const root = slugify(base) || 'org';
  let slug = root;
  let counter = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await Organization.exists({ slug })) {
    slug = `${root}-${counter}`;
    counter += 1;
  }
  return slug;
}

export const signup = catchAsync(async (req, res) => {
  const { organizationName, name, email, password } = req.body;

  const existing = await User.findOne({ email });
  if (existing) {
    throw new AppError('An account with this email already exists', 409);
  }

  const slug = await uniqueSlug(organizationName);
  const organization = await Organization.create({ name: organizationName, slug });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    organization: organization._id,
    name,
    email,
    passwordHash,
    role: 'owner',
  });

  await PipelineStage.insertMany(
    DEFAULT_STAGES.map((stage) => ({ ...stage, organization: organization._id })),
  );

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());

  res.status(201).json({ user: user.toSafeJSON(), organization, accessToken });
});

export const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Invalid email or password', 401);
  }
  if (!user.isActive) {
    throw new AppError('This account has been deactivated', 403);
  }

  const organization = await Organization.findById(user.organization);
  if (organization?.isSuspended && !user.isSuperAdmin) {
    throw new AppError('This workspace has been suspended. Contact support for assistance.', 403);
  }

  user.lastLoginAt = new Date();
  await user.save();

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());

  res.json({ user: user.toSafeJSON(), organization, accessToken });
});

export const refresh = catchAsync(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!token) throw new AppError('Not authenticated', 401);

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new AppError('Session expired, please log in again', 401);
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) throw new AppError('Not authenticated', 401);

  const accessToken = signAccessToken(user);
  res.json({ accessToken });
});

export const logout = catchAsync(async (req, res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());
  res.status(204).send();
});

export const me = catchAsync(async (req, res) => {
  const organization = await Organization.findById(req.user.organization);
  res.json({ user: req.user.toSafeJSON(), organization });
});
