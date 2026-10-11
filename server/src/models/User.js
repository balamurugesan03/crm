import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['owner', 'admin', 'manager', 'sales_rep'], default: 'sales_rep' },
    avatarColor: { type: String, default: 'blue' },
    isActive: { type: Boolean, default: true },
    isSuperAdmin: { type: Boolean, default: false },
    lastLoginAt: { type: Date },
    lastDigestAt: { type: Date },
  },
  { timestamps: true },
);

userSchema.index({ organization: 1, email: 1 }, { unique: true });

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id,
    organization: this.organization,
    name: this.name,
    email: this.email,
    role: this.role,
    avatarColor: this.avatarColor,
    isActive: this.isActive,
    isSuperAdmin: this.isSuperAdmin,
  };
};

export default mongoose.model('User', userSchema);
