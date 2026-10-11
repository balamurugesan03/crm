import * as z from 'zod/v4';
import Organization from '../models/Organization.js';
import { AppError } from '../utils/AppError.js';
import { catchAsync } from '../utils/catchAsync.js';

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const opt = (s) => s.optional().or(z.literal(''));

const updateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  settings: z
    .object({
      rottingDays: z.number().int().min(1).max(90).optional(),
      recordVisibility: z.enum(['all', 'own']).optional(),
      dailyDigest: z.boolean().optional(),
      autoReminders: z.boolean().optional(),
      reminderBeforeDays: z.number().int().min(0).max(30).optional(),
      reminderAfterDays: z.array(z.number().int().min(1).max(120)).max(6).optional(),
    })
    .optional(),
  billingProfile: z
    .object({
      legalName: opt(z.string().max(200)),
      gstin: opt(z.string().trim().toUpperCase().regex(GSTIN_RE, 'Invalid GSTIN format')),
      pan: opt(z.string().trim().toUpperCase().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Invalid PAN format')),
      stateCode: opt(z.string().regex(/^\d{2}$/, 'State code must be 2 digits')),
      address: opt(z.string().max(400)),
      city: opt(z.string().max(100)),
      pincode: opt(z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits')),
      phone: opt(z.string().max(30)),
      email: opt(z.string().email()),
      upiId: opt(z.string().regex(/^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/, 'Invalid UPI ID')),
      bankName: opt(z.string().max(100)),
      bankAccount: opt(z.string().max(30)),
      ifsc: opt(z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC')),
      invoiceTerms: opt(z.string().max(1000)),
    })
    .optional(),
  integrations: z
    .object({
      smtp: z
        .object({
          host: opt(z.string().max(200)),
          port: z.number().int().min(1).max(65535).optional(),
          secure: z.boolean().optional(),
          user: opt(z.string().max(200)),
          pass: z.string().max(500).optional(), // empty string = keep existing
          fromName: opt(z.string().max(100)),
          fromEmail: opt(z.string().email()),
        })
        .optional(),
      whatsapp: z
        .object({
          phoneNumberId: opt(z.string().max(64)),
          accessToken: z.string().max(1000).optional(), // empty string = keep existing
          displayNumber: opt(z.string().max(30)),
        })
        .optional(),
    })
    .optional(),
});

// Flattens nested input into dotted $set paths so a partial update never wipes sibling fields.
function toSetPaths(obj, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) toSetPaths(value, path, out);
    else out[path] = value;
  }
  return out;
}

export const updateOrganization = catchAsync(async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError('Validation failed', 422, parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
  }
  const set = toSetPaths(parsed.data);
  // Blank secret fields mean "unchanged".
  if (set['integrations.smtp.pass'] === '') delete set['integrations.smtp.pass'];
  if (set['integrations.whatsapp.accessToken'] === '') delete set['integrations.whatsapp.accessToken'];

  const organization = await Organization.findByIdAndUpdate(req.tenantId, { $set: set }, { new: true, runValidators: true });
  if (!organization) throw new AppError('Organization not found', 404);
  res.json(organization);
});
