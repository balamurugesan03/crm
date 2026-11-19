import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function signAccessToken(user) {
  return jwt.sign(
    // Core super admins have no organization.
    { sub: user._id.toString(), organization: user.organization ? user.organization.toString() : null, role: user.role },
    env.jwtAccessSecret,
    { expiresIn: env.jwtAccessExpires },
  );
}

export function signRefreshToken(user) {
  return jwt.sign({ sub: user._id.toString() }, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshExpires,
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtAccessSecret);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwtRefreshSecret);
}

export const REFRESH_COOKIE_NAME = 'crm_refresh';

export function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    path: `${env.basePath}/api/auth`,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

// The super admin console is a separate app with its own session, so it never shares a cookie with the workspace app.
export const ADMIN_REFRESH_COOKIE_NAME = 'crm_admin_refresh';

export function adminRefreshCookieOptions() {
  return { ...refreshCookieOptions(), path: `${env.basePath}/api/auth/admin` };
}
