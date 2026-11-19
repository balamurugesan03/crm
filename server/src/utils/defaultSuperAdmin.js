import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { env } from '../config/env.js';

// Default login for the separate Super Admin console (superadmin/ app). Override with SUPER_ADMIN_EMAIL /
// SUPER_ADMIN_PASSWORD in server/.env. Change the password after the first sign-in.
export const DEFAULT_SUPER_ADMIN = {
  email: 'superadmin@nexuscrm.io',
  password: 'SuperAdmin@123',
  name: 'Super Admin',
};

// Creates the first core super admin when the platform has none. Never touches existing accounts.
export async function ensureDefaultSuperAdmin() {
  if (await User.exists({ isSuperAdmin: true })) return;

  const email = (process.env.SUPER_ADMIN_EMAIL || DEFAULT_SUPER_ADMIN.email).toLowerCase().trim();
  let password = process.env.SUPER_ADMIN_PASSWORD;
  if (!password) {
    // A publicly known password must never guard a live server.
    if (env.nodeEnv === 'production') {
      console.warn('[super-admin] No super admin exists. Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD in .env and restart, or run: npm run create-super-admin -- <email> <password>');
      return;
    }
    password = DEFAULT_SUPER_ADMIN.password;
  }
  if (password.length < 8) {
    console.warn('[super-admin] SUPER_ADMIN_PASSWORD must be at least 8 characters — default super admin not created');
    return;
  }

  const existing = await User.findOne({ email, organization: null });
  if (existing) {
    existing.isSuperAdmin = true;
    existing.isActive = true;
    existing.passwordHash = await bcrypt.hash(password, 12);
    await existing.save();
  } else {
    await User.create({
      name: process.env.SUPER_ADMIN_NAME || DEFAULT_SUPER_ADMIN.name,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: 'owner',
      isSuperAdmin: true,
    });
  }
  console.log(`[super-admin] created default super admin ${email} — sign in to the Super Admin console and change the password`);
}
