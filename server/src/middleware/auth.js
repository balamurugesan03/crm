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

  // Core super admins have no workspace: they may only use the platform admin and auth APIs.
  if (!user.organization && !(user.isSuperAdmin && ['/api/admin', '/api/auth'].includes(req.baseUrl))) {
    throw new AppError('This account has no workspace. Use the platform admin panel.', 403);
  }

  const organization = user.organization
    ? await Organization.findById(user.organization).select('isSuspended subscriptionStatus settings')
    : null;
  if (!user.isSuperAdmin && organization?.isSuspended) {
    throw new AppError('This workspace has been suspended. Contact support for assistance.', 403);
  }
  // Expired subscriptions lock the workspace; /api/auth stays open so the app can show the reason.
  if (!user.isSuperAdmin && organization?.subscriptionStatus === 'expired' && req.baseUrl !== '/api/auth') {
    throw new AppError('This workspace subscription has expired. Contact your provider to renew.', 402);
  }
  req.orgSettings = organization?.settings || {};

  req.user = user;
  req.tenantId = user.organization;
  next();
});
