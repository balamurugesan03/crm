import { z } from 'zod';

export const addTeamMemberSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['admin', 'manager', 'sales_rep']),
});

export const updateTeamMemberSchema = z.object({
  role: z.enum(['owner', 'admin', 'manager', 'sales_rep']).optional(),
  isActive: z.boolean().optional(),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  avatarColor: z.string().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(2, 'Organization name is required'),
});
