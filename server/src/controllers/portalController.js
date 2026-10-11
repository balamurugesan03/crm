import jwt from 'jsonwebtoken';
import * as z from 'zod/v4';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import Contact from '../models/Contact.js';
import Organization from '../models/Organization.js';
import Ticket from '../models/Ticket.js';
import Invoice from '../models/Invoice.js';
import Quote from '../models/Quote.js';
import { AppError } from '../utils/AppError.js';
import { catchAsync } from '../utils/catchAsync.js';
import { nextNumber } from '../utils/numbering.js';
import { ownerScope } from '../utils/visibility.js';
import { logActivity } from '../services/activityService.js';
import { notifyUser } from '../services/notificationService.js';
import { emitDomainEvent } from '../services/eventBus.js';
import { sendEmail, isSmtpReady } from '../services/messagingService.js';

const PORTAL_TTL = '30d';

function signPortalToken(contact) {
  return jwt.sign(
    { sub: String(contact._id), org: String(contact.organization), v: contact.portalTokenVersion || 0, typ: 'portal' },
    env.portalSecret,
    { expiresIn: PORTAL_TTL },
  );
}

function portalUrl(token) {
  return `${env.clientUrl.replace(/\/$/, '')}/portal#${token}`;
}

// ---------- Agent side (authenticated) ----------

export const createPortalLink = catchAsync(async (req, res) => {
  const contact = await Contact.findOne({ _id: req.params.id, organization: req.tenantId, ...ownerScope(req) });
  if (!contact) throw new AppError('Contact not found', 404);
  if (req.body?.revokePrevious) {
    contact.portalTokenVersion = (contact.portalTokenVersion || 0) + 1;
    await contact.save();
  }
  const token = signPortalToken(contact);
  const url = portalUrl(token);
  const expiresAt = new Date(Date.now() + 30 * 864e5);

  let emailed = false;
  if (req.body?.sendEmail) {
    if (!contact.email) throw new AppError('This contact has no email address', 400);
    const org = await Organization.findById(req.tenantId).select('name integrations');
    if (!isSmtpReady(org.integrations?.smtp)) throw new AppError('Set up SMTP in Settings → Integrations to email portal links', 400);
    await sendEmail(req.tenantId, {
      to: contact.email,
      subject: `Your ${org.name} customer portal`,
      body: `Hi ${contact.firstName},\n\nUse this secure link to view your invoices and quotes and raise or track support requests with ${org.name}:\n\n${url}\n\nThe link is personal and valid for 30 days.\n\nRegards,\n${req.user.name}`,
      replyTo: req.user.email,
    });
    emailed = true;
  }

  await logActivity({
    organization: req.tenantId,
    entityType: 'Contact',
    entityId: contact._id,
    type: 'note',
    body: `${req.user.name} ${emailed ? 'emailed' : 'generated'} a customer portal link${req.body?.revokePrevious ? ' (previous links revoked)' : ''}`,
    createdBy: req.user._id,
  });
  res.json({ url, expiresAt, emailed });
});

const replySchema = z.object({ body: z.string().trim().min(1).max(5000) });

export const agentReply = catchAsync(async (req, res) => {
  const { body } = replySchema.parse(req.body);
  const ticket = await Ticket.findOne({ _id: req.params.id, organization: req.tenantId, ...ownerScope(req, 'assignedTo') }).populate('contact', 'firstName email');
  if (!ticket) throw new AppError('Ticket not found', 404);
  ticket.replies.push({ author: 'agent', name: req.user.name, user: req.user._id, body });
  if (ticket.status === 'open') ticket.status = 'in_progress';
  await ticket.save();

  // Best-effort email to the customer when SMTP is configured.
  if (ticket.contact?.email) {
    const org = await Organization.findById(req.tenantId).select('integrations name');
    if (isSmtpReady(org.integrations?.smtp)) {
      sendEmail(req.tenantId, {
        to: ticket.contact.email,
        subject: `Re: [${ticket.ticketNumber}] ${ticket.subject}`,
        body: `Hi ${ticket.contact.firstName},\n\n${body}\n\n— ${req.user.name}, ${org.name}`,
        replyTo: req.user.email,
      }).catch((err) => console.error('[portal] reply email failed', err.message));
    }
  }
  await logActivity({ organization: req.tenantId, entityType: 'Ticket', entityId: ticket._id, type: 'email', body: `${req.user.name} replied to the customer`, createdBy: req.user._id });
  res.status(201).json(ticket.replies[ticket.replies.length - 1]);
});

// ---------- Customer side (portal token) ----------

export const requirePortal = catchAsync(async (req, res, next) => {
  const header = req.headers['x-portal-token'] || '';
  let payload;
  try {
    payload = jwt.verify(header, env.portalSecret);
  } catch {
    throw new AppError('Your portal link has expired. Please ask for a new one.', 401);
  }
  if (payload.typ !== 'portal') throw new AppError('Invalid portal link', 401);
  const contact = await Contact.findOne({ _id: payload.sub, organization: payload.org }).populate('company', 'name');
  if (!contact || (contact.portalTokenVersion || 0) !== payload.v) throw new AppError('This portal link is no longer valid.', 401);
  const org = await Organization.findById(contact.organization).select('name isSuspended billingProfile');
  if (!org || org.isSuspended) throw new AppError('Portal unavailable', 403);
  req.portal = { contact, org };
  // Seen-at is informative only; don't block the request on it.
  Contact.updateOne({ _id: contact._id }, { $set: { portalLastSeenAt: new Date() } }).catch(() => {});
  next();
});

// Customers see documents addressed to them or to their company.
function customerFilter(req) {
  const { contact } = req.portal;
  const or = [{ contact: contact._id }];
  if (contact.company) or.push({ company: contact.company._id || contact.company });
  return { organization: contact.organization, $or: or };
}

export const portalMe = catchAsync(async (req, res) => {
  const { contact, org } = req.portal;
  const bp = org.billingProfile || {};
  res.json({
    contact: { firstName: contact.firstName, lastName: contact.lastName, email: contact.email, company: contact.company?.name },
    organization: { name: org.name, legalName: bp.legalName, email: bp.email, phone: bp.phone },
  });
});

export const portalListTickets = catchAsync(async (req, res) => {
  const items = await Ticket.find(customerFilter(req)).sort({ updatedAt: -1 }).select('ticketNumber subject status priority createdAt updatedAt replies resolvedAt');
  res.json(items.map((t) => ({ ...t.toObject(), replies: undefined, replyCount: t.replies.length })));
});

export const portalGetTicket = catchAsync(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError('Ticket not found', 404);
  const ticket = await Ticket.findOne({ _id: req.params.id, ...customerFilter(req) }).select('ticketNumber subject description status priority createdAt replies resolvedAt');
  if (!ticket) throw new AppError('Ticket not found', 404);
  res.json({ ...ticket.toObject(), replies: ticket.replies.map(({ author, name, body, createdAt }) => ({ author, name, body, createdAt })) });
});

const newTicketSchema = z.object({
  subject: z.string().trim().min(3).max(200),
  description: z.string().trim().min(1).max(5000),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
});

export const portalCreateTicket = catchAsync(async (req, res) => {
  const parsed = newTicketSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message || 'Invalid ticket', 422);
  const { contact } = req.portal;
  const org = contact.organization;
  const assignedTo = contact.ownerUser;
  const ticket = await Ticket.create({
    ...parsed.data,
    organization: org,
    ticketNumber: await nextNumber(Ticket, org, 'T'),
    contact: contact._id,
    company: contact.company?._id || contact.company,
    assignedTo,
    channel: 'portal',
  });
  await logActivity({ organization: org, entityType: 'Ticket', entityId: ticket._id, type: 'created', body: `${contact.firstName} opened this ticket from the customer portal` });
  if (assignedTo) {
    await notifyUser({ organization: org, user: assignedTo, type: 'ticket_assigned', title: `New portal ticket from ${contact.firstName}`, body: ticket.subject, link: '/tickets' });
  }
  emitDomainEvent('ticket.created', { organization: org, record: ticket, actor: { _id: assignedTo, name: 'Customer portal' } });
  res.status(201).json({ _id: ticket._id, ticketNumber: ticket.ticketNumber });
});

export const portalReply = catchAsync(async (req, res) => {
  const { body } = replySchema.parse(req.body);
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError('Ticket not found', 404);
  const ticket = await Ticket.findOne({ _id: req.params.id, ...customerFilter(req) });
  if (!ticket) throw new AppError('Ticket not found', 404);
  const { contact } = req.portal;
  ticket.replies.push({ author: 'customer', name: `${contact.firstName} ${contact.lastName || ''}`.trim(), body });
  if (['resolved', 'closed', 'waiting'].includes(ticket.status)) ticket.status = 'open';
  await ticket.save();
  if (ticket.assignedTo) {
    await notifyUser({ organization: ticket.organization, user: ticket.assignedTo, type: 'ticket_assigned', title: `${contact.firstName} replied on ${ticket.ticketNumber}`, body: body.slice(0, 120), link: '/tickets' });
  }
  res.status(201).json({ ok: true });
});

const DOC_FIELDS = 'items taxRate subtotal taxAmount cgst sgst igst supplyType placeOfSupply customerGstin total amountPaid status issueDate dueDate validUntil paidAt notes createdAt';

export const portalListDocs = (Model, numberKey) =>
  catchAsync(async (req, res) => {
    const items = await Model.find({ ...customerFilter(req), status: { $ne: 'draft' } }).sort({ createdAt: -1 }).select(`${numberKey} total amountPaid status issueDate dueDate validUntil createdAt`);
    res.json(items);
  });

export const portalGetDoc = (Model, numberKey) =>
  catchAsync(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new AppError('Not found', 404);
    const doc = await Model.findOne({ _id: req.params.id, ...customerFilter(req), status: { $ne: 'draft' } })
      .select(`${numberKey} ${DOC_FIELDS}`)
      .populate('contact', 'firstName lastName email phone')
      .populate('company', 'name address phone gstin stateCode');
    if (!doc) throw new AppError('Not found', 404);
    const { org } = req.portal;
    res.json({ doc, seller: { name: org.name, billingProfile: org.billingProfile || {} } });
  });

export const portalRespondQuote = catchAsync(async (req, res) => {
  const { decision } = z.object({ decision: z.enum(['accepted', 'rejected']) }).parse(req.body);
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError('Quote not found', 404);
  const quote = await Quote.findOne({ _id: req.params.id, ...customerFilter(req), status: 'sent' });
  if (!quote) throw new AppError('This quote can no longer be changed', 409);
  quote.status = decision;
  await quote.save();
  const { contact } = req.portal;
  if (quote.ownerUser) {
    await notifyUser({
      organization: quote.organization,
      user: quote.ownerUser,
      type: 'system',
      title: `${contact.firstName} ${decision} quote ${quote.quoteNumber}`,
      body: `Total ₹${quote.total.toLocaleString('en-IN')}`,
      link: '/quotes',
    });
  }
  if (quote.deal) {
    await logActivity({ organization: quote.organization, entityType: 'Deal', entityId: quote.deal, type: 'status_change', body: `${contact.firstName} ${decision} quote ${quote.quoteNumber} in the customer portal` });
  }
  res.json({ status: quote.status });
});

export { Invoice, Quote };
