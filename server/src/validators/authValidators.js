import { z } from 'zod';

export const signupSchema = z.object({
  organizationName: z.string().min(2, 'Organization name is required'),
  name: z.string().min(2, 'Your name is required'),
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const loginSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(1, 'Password is required'),
});
