import { verifyAccessToken } from '../utils/token.js';
import { AppError } from '../utils/AppError.js';
import { catchAsync } from '../utils/catchAsync.js';
import User from '../models/User.js';
import Organization from '../models/Organization.js';

export const requireAuth = catchAsync(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError('Not authenticated', 401);
  }
  const token = header.slice('Bearer '.length);
  const payload = verifyAccessToken(token);

  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) {
    throw new AppError('Not authenticated', 401);
  }

  const organization = await Organization.findById(user.organization).select('isSuspended settings');
  if (!user.isSuperAdmin && organization?.isSuspended) {
    throw new AppError('This workspace has been suspended. Contact support for assistance.', 403);
  }
  req.orgSettings = organization?.settings || {};

  req.user = user;
  req.tenantId = user.organization;
  next();
});
