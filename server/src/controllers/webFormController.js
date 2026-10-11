import * as z from 'zod/v4';
import WebForm, { WEBFORM_FIELD_KEYS } from '../models/WebForm.js';
import Lead from '../models/Lead.js';
import Company from '../models/Company.js';
import Organization from '../models/Organization.js';
import User from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { catchAsync } from '../utils/catchAsync.js';
import { emitDomainEvent } from '../services/eventBus.js';
import { notifyUser } from '../services/notificationService.js';

const formSchema = z.object({
  name: z.string().trim().min(1).max(100),
  title: z.string().trim().max(120).optional(),
  description: z.string().trim().max(500).optional(),
  submitLabel: z.string().trim().max(40).optional(),
  successMessage: z.string().trim().max(300).optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  fields: z
    .array(z.object({ key: z.enum(WEBFORM_FIELD_KEYS), label: z.string().trim().min(1).max(80), required: z.boolean().default(false) }))
    .min(1)
    .max(WEBFORM_FIELD_KEYS.length)
    .refine((f) => f.some((x) => x.key === 'name'), 'The form must include a name field')
    .refine((f) => new Set(f.map((x) => x.key)).size === f.length, 'Duplicate fields')
    .optional(),
  source: z.enum(['website', 'referral', 'social', 'event', 'cold_call', 'advertisement', 'other']).optional(),
  campaign: z.string().nullable().optional(),
  assignees: z.array(z.string()).max(50).optional(),
  isActive: z.boolean().optional(),
});

function parseForm(body, partial = false) {
  const r = (partial ? formSchema.partial() : formSchema).safeParse(body);
  if (!r.success) throw new AppError('Validation failed', 422, r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
  return r.data;
}

async function assertAssignees(org, ids = []) {
  if (!ids.length) return;
  const n = await User.countDocuments({ _id: { $in: ids }, organization: org, isActive: true });
  if (n !== new Set(ids).size) throw new AppError('Invalid assignee', 400);
}

// ---------- Authenticated management ----------

export const listForms = catchAsync(async (req, res) => {
  const items = await WebForm.find({ organization: req.tenantId }).sort({ createdAt: -1 }).populate('assignees', 'name avatarColor');
  res.json(items);
});

export const createForm = catchAsync(async (req, res) => {
  const data = parseForm(req.body);
  await assertAssignees(req.tenantId, data.assignees);
  const form = await WebForm.create({ ...data, organization: req.tenantId, createdBy: req.user._id });
  res.status(201).json(form);
});

export const updateForm = catchAsync(async (req, res) => {
  const data = parseForm(req.body, true);
  await assertAssignees(req.tenantId, data.assignees);
  const form = await WebForm.findOneAndUpdate({ _id: req.params.id, organization: req.tenantId }, { $set: data }, { new: true, runValidators: true });
  if (!form) throw new AppError('Form not found', 404);
  res.json(form);
});

export const deleteForm = catchAsync(async (req, res) => {
  const form = await WebForm.findOneAndDelete({ _id: req.params.id, organization: req.tenantId });
  if (!form) throw new AppError('Form not found', 404);
  res.status(204).send();
});

// ---------- Public (no auth) ----------

export const getPublicForm = catchAsync(async (req, res) => {
  const form = await WebForm.findOne({ publicKey: req.params.key, isActive: true });
  if (!form) throw new AppError('This form is not available', 404);
  const org = await Organization.findById(form.organization).select('name isSuspended');
  if (!org || org.isSuspended) throw new AppError('This form is not available', 404);
  res.json({
    organizationName: org.name,
    title: form.title,
    description: form.description,
    submitLabel: form.submitLabel,
    accentColor: form.accentColor,
    fields: form.fields,
  });
});

const str = (max) => z.string().trim().max(max).optional().default('');

const submissionSchema = z.object({
  name: str(120),
  email: z.union([z.literal(''), z.string().trim().email().max(200)]).optional().default(''),
  phone: z.union([z.literal(''), z.string().trim().regex(/^[+\d][\d\s\-()]{6,19}$/, 'Invalid phone')]).optional().default(''),
  company: str(150),
  jobTitle: str(100),
  city: str(80),
  budget: str(40),
  message: str(2000),
  // Honeypot: real users never see or fill this field.
  website: z.string().optional(),
  pageUrl: z.string().max(500).optional(),
});

export const submitPublicForm = catchAsync(async (req, res) => {
  const form = await WebForm.findOne({ publicKey: req.params.key, isActive: true });
  if (!form) throw new AppError('This form is not available', 404);
  const org = await Organization.findById(form.organization).select('isSuspended');
  if (!org || org.isSuspended) throw new AppError('This form is not available', 404);

  const parsed = submissionSchema.safeParse(req.body || {});
  if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message || 'Invalid submission', 422);
  const data = parsed.data;

  // Bots that fill the hidden field get a fake success and nothing is stored.
  if (data.website) return res.status(201).json({ ok: true, message: form.successMessage });

  for (const f of form.fields) {
    if (f.required && !String(data[f.key] || '').trim()) throw new AppError(`${f.label} is required`, 422);
  }
  if (!data.name) throw new AppError('Name is required', 422);

  // Round-robin assignment across configured assignees.
  let owner = form.createdBy;
  if (form.assignees.length) {
    const updated = await WebForm.findOneAndUpdate({ _id: form._id }, { $inc: { rrIndex: 1 } }, { new: false });
    owner = form.assignees[(updated?.rrIndex || 0) % form.assignees.length];
  }

  let companyId;
  if (data.company) {
    const esc = data.company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existing = await Company.findOne({ organization: form.organization, name: new RegExp(`^${esc}$`, 'i') });
    companyId = existing?._id || (await Company.create({ organization: form.organization, name: data.company, address: data.city || undefined, ownerUser: owner }))._id;
  }

  const budget = Number(String(data.budget).replace(/[^0-9.]/g, '')) || 0;
  const notes = [
    `Submitted via web form "${form.name}"`,
    data.jobTitle && `Job title: ${data.jobTitle}`,
    data.city && `City: ${data.city}`,
    data.budget && `Budget: ${data.budget}`,
    data.message && `Message: ${data.message}`,
    data.pageUrl && `Page: ${data.pageUrl}`,
  ].filter(Boolean).join('\n');

  const lead = new Lead({
    organization: form.organization,
    name: data.name,
    email: data.email || undefined,
    phone: data.phone || undefined,
    source: form.source,
    campaign: form.campaign || undefined,
    company: companyId,
    estimatedValue: budget,
    ownerUser: owner,
    notes,
  });
  await lead.save();

  await WebForm.updateOne({ _id: form._id }, { $inc: { submissions: 1 }, $set: { lastSubmissionAt: new Date() } });

  if (owner) {
    await notifyUser({
      organization: form.organization,
      user: owner,
      type: 'system',
      title: `New lead from "${form.name}"`,
      body: `${lead.name}${data.company ? ` · ${data.company}` : ''} — score ${lead.score}`,
      link: '/leads',
    });
  }
  emitDomainEvent('lead.created', { organization: form.organization, record: lead, actor: { _id: owner, name: 'Web form' } });

  res.status(201).json({ ok: true, message: form.successMessage });
});
