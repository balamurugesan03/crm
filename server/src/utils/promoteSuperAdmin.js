import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node src/utils/promoteSuperAdmin.js <email>');
    process.exit(1);
  }

  await connectDB();

  const user = await User.findOneAndUpdate({ email: email.toLowerCase() }, { isSuperAdmin: true }, { new: true });
  if (!user) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }

  console.log(`${user.name} (${user.email}) is now a platform super admin.`);
  await mongoose.disconnect();
}

main();
