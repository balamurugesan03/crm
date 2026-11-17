// Creates a core platform super admin: an account with no workspace that can only use /admin.
// Usage: node src/utils/createSuperAdmin.js <email> <password> [name]
// If the email already exists, the password is reset and the account is made super admin.
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';

async function main() {
  const [email, password, ...nameParts] = process.argv.slice(2);
  if (!email || !password) {
    console.error('Usage: npm run create-super-admin -- <email> <password> [name]');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  await connectDB();
  const normalized = email.toLowerCase().trim();
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await User.findOne({ email: normalized });

  if (existing) {
    existing.isSuperAdmin = true;
    existing.isActive = true;
    existing.passwordHash = passwordHash;
    await existing.save();
    console.log(`${existing.email} is now a platform super admin (password reset).`);
  } else {
    const user = await User.create({
      name: nameParts.join(' ') || 'Super Admin',
      email: normalized,
      passwordHash,
      role: 'owner',
      isSuperAdmin: true,
    });
    console.log(`Created core super admin ${user.email}. Log in and you will land on /admin.`);
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
