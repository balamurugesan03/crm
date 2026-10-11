import * as z from 'zod/v4';
import mongoose from 'mongoose';
import Message from '../models/Message.js';
import MessageTemplate from '../models/MessageTemplate.js';
import Organization from '../models/Organization.js';
import Contact from '../models/Contact.js';
import Company from '../models/Company.js';
import Lead from '../models/Lead.js';
import Deal from '../models/Deal.js';
import { AppError } from '../utils/AppError.js';
import { catchAsync } from '../utils/catchAsync.js';
import { logActivity } from '../services/activityService.js';
import { ownerScope } from '../utils/visibility.js';
import {
  sendEmail, sendWhatsapp, verifySmtp, verifyWhatsapp, isSmtpReady, isWhatsappReady,
} from '../services/messagingService.js';

const ENTITY_MODELS = { Contact, Company, Lead, Deal };
const TIMELINE_ENTITIES = ['Contact', 'Company', 'Deal', 'Ticket'];

// ---------- Template rendering ----------

async function templateContext(req, entityType, entityId) {
  const ctx = { user: { name: req.user.name, email: req.user.email }, org: {}, contact: {}, company: {}, deal: {}, lead: {} };
  const org = await Organization.findById(req.tenantId).select('name billingProfile');
  ctx.org = { name: org?.billingProfile?.legalName || org?.name, phone: org?.billingProfile?.phone };
  if (!entityType || !entityId || !mongoose.isValidObjectId(entityId)) return ctx;
  const Model = ENTITY_MODELS[entityType];
  if (!Model) return ctx;
  const record = await Model.findOne({ _id: entityId, organization: req.tenantId, ...ownerScope(req) }).populate(
    entityType === 'Deal' ? 'contact company' : entityType === 'Contact' ? 'company' : '',
  );
  if (!record) throw new AppError(`${entityType} not found`, 404);
  if (entityType === 'Contact') {
    ctx.contact = record.toObject();
    ctx.company = record.company?.toObject?.() || {};
  } else if (entityType === 'Company') ctx.company = record.toObject();
  else if (entityType === 'Lead') {
    ctx.lead = record.toObject();
    const [firstName, ...rest] = record.name.split(' ');
    ctx.contact = { firstName, lastName: rest.join(' '), email: record.email, phone: record.phone };
  } else if (entityType === 'Deal') {
    ctx.deal = record.toObject();
    ctx.contact = record.contact?.toObject?.() || {};
    ctx.company = record.company?.toObject?.() || {};
  }
  return ctx;
}

export function renderTemplate(text, ctx) {
  return String(text || '').replace(/\{\{\s*([a-zA-Z]+)\.([a-zA-Z]+)\s*\}\}/g, (m, scope, key) => {
    const v = ctx[scope]?.[key];
    return v === undefined || v === null ? '' : String(v);
  });
}

// ---------- Sending ----------

const sendSchema = z.object({
  channel: z.enum(['email', 'whatsapp']),
  to: z.string().trim().min(3).max(200),
  subject: z.string().trim().max(200).optional(),
  body: z.string().trim().min(1).max(5000),
  entityType: z.enum(['Contact', 'Company', 'Lead', 'Deal', 'Ticket']).optional(),
  entityId: z.string().optional(),
  templateId: z.string().optional(),
  // 'link' = user already sent it from their own app (wa.me / mailto); just log it.
  via: z.enum(['api', 'link']).default('api'),
});

export const sendMessage = catchAsync(async (req, res) => {
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message || 'Invalid message', 422);
  const m = parsed.data;
  if (m.channel === 'email' && !/^\S+@\S+\.\S+$/.test(m.to)) throw new AppError('Enter a valid email address', 422);
  if (m.channel === 'email' && m.via === 'api' && !m.subject) throw new AppError('Subject is required', 422);

  // Render placeholders server-side so what is logged is exactly what was sent.
  const ctx = await templateContext(req, m.entityType, m.entityId);
  const subject = m.subject ? renderTemplate(m.subject, ctx) : undefined;
  const body = renderTemplate(m.body, ctx);

  const doc = {
    organization: req.tenantId,
    channel: m.channel,
    via: m.via,
    to: m.to,
    subject,
    body,
    entityType: m.entityType,
    entityId: m.entityId && mongoose.isValidObjectId(m.entityId) ? m.entityId : undefined,
    template: m.templateId && mongoose.isValidObjectId(m.templateId) ? m.templateId : undefined,
    sentBy: req.user._id,
  };

  if (m.via === 'link') {
    doc.status = 'logged';
  } else {
    try {
      const { providerId } = m.channel === 'email'
        ? await sendEmail(req.tenantId, { to: m.to, subject, body, replyTo: req.user.email })
        : await sendWhatsapp(req.tenantId, { to: m.to, body });
      doc.status = 'sent';
      doc.providerId = providerId;
    } catch (err) {
      const message = await Message.create({ ...doc, status: 'failed', error: err.message?.slice(0, 500) });
      throw new AppError(err.message || 'Sending failed', err.statusCode && err.statusCode < 500 ? err.statusCode : 502, { messageId: message._id });
    }
  }

  const message = await Message.create(doc);
  if (doc.entityType && doc.entityId && TIMELINE_ENTITIES.includes(doc.entityType)) {
    const label = m.channel === 'email' ? 'Email' : 'WhatsApp';
    await logActivity({
      organization: req.tenantId,
      entityType: doc.entityType,
      entityId: doc.entityId,
      type: m.channel,
      body: `${req.user.name} ${m.via === 'link' ? 'logged' : 'sent'} ${label} to ${m.to}${subject ? `: "${subject}"` : ''}\n${body.slice(0, 300)}${body.length > 300 ? '…' : ''}`,
      createdBy: req.user._id,
    });
  }
  res.status(201).json(message);
});

export const listMessages = catchAsync(async (req, res) => {
  const filter = { organization: req.tenantId };
  if (req.query.entityType && req.query.entityId && mongoose.isValidObjectId(req.query.entityId)) {
    filter.entityType = req.query.entityType;
    filter.entityId = req.query.entityId;
  } else {
    filter.sentBy = req.user._id;
  }
  const items = await Message.find(filter).sort({ createdAt: -1 }).limit(100).populate('sentBy', 'name avatarColor');
  res.json(items);
});

export const previewMessage = catchAsync(async (req, res) => {
  const ctx = await templateContext(req, req.body.entityType, req.body.entityId);
  res.json({ subject: renderTemplate(req.body.subject, ctx), body: renderTemplate(req.body.body, ctx) });
});

export const channelStatus = catchAsync(async (req, res) => {
  const org = await Organization.findById(req.tenantId).select('integrations');
  res.json({ email: isSmtpReady(org.integrations?.smtp), whatsapp: isWhatsappReady(org.integrations?.whatsapp) });
});

export const testChannel = catchAsync(async (req, res) => {
  if (req.params.channel === 'email') {
    await verifySmtp(req.tenantId);
    return res.json({ ok: true, message: 'SMTP connection verified' });
  }
  if (req.params.channel === 'whatsapp') {
    const info = await verifyWhatsapp(req.tenantId);
    return res.json({ ok: true, message: `Connected to ${info.verifiedName || 'WhatsApp'} (${info.displayNumber || 'number verified'})` });
  }
  throw new AppError('Unknown channel', 400);
});

// ---------- Templates ----------

const templateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  channel: z.enum(['email', 'whatsapp']),
  subject: z.string().trim().max(200).optional(),
  body: z.string().trim().min(1).max(5000),
});

export const listTemplates = catchAsync(async (req, res) => {
  const filter = { organization: req.tenantId };
  if (req.query.channel) filter.channel = req.query.channel;
  res.json(await MessageTemplate.find(filter).sort({ name: 1 }));
});

export const createTemplate = catchAsync(async (req, res) => {
  const r = templateSchema.safeParse(req.body);
  if (!r.success) throw new AppError(r.error.issues[0]?.message || 'Invalid template', 422);
  res.status(201).json(await MessageTemplate.create({ ...r.data, organization: req.tenantId, createdBy: req.user._id }));
});

export const updateTemplate = catchAsync(async (req, res) => {
  const r = templateSchema.partial().safeParse(req.body);
  if (!r.success) throw new AppError(r.error.issues[0]?.message || 'Invalid template', 422);
  const t = await MessageTemplate.findOneAndUpdate({ _id: req.params.id, organization: req.tenantId }, { $set: r.data }, { new: true, runValidators: true });
  if (!t) throw new AppError('Template not found', 404);
  res.json(t);
});

export const deleteTemplate = catchAsync(async (req, res) => {
  const t = await MessageTemplate.findOneAndDelete({ _id: req.params.id, organization: req.tenantId });
  if (!t) throw new AppError('Template not found', 404);
  res.status(204).send();
});
