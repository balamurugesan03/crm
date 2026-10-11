import mongoose from 'mongoose';
import Deal from '../models/Deal.js';
import Contact from '../models/Contact.js';
import Company from '../models/Company.js';
import Lead from '../models/Lead.js';
import Activity from '../models/Activity.js';
import Task from '../models/Task.js';
import Event from '../models/Event.js';
import Quote from '../models/Quote.js';
import Ticket from '../models/Ticket.js';
import { AppError } from '../utils/AppError.js';

const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : 'n/a');
const inr = (n) => `INR ${Number(n || 0).toLocaleString('en-IN')}`;
const daysSince = (d) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / 864e5) : null);

function activityLines(items) {
  if (!items.length) return '  (none)';
  return items
    .map((a) => `  - ${fmtDate(a.createdAt)} [${a.type}] ${a.createdBy?.name || 'System'}: ${a.body}`)
    .join('\n');
}

function taskLines(items) {
  if (!items.length) return '  (none)';
  return items
    .map((t) => `  - ${t.status === 'done' ? '[done]' : '[open]'} ${t.title} (due ${fmtDate(t.dueDate)}, ${t.priority})`)
    .join('\n');
}

function eventLines(items) {
  if (!items.length) return '  (none)';
  return items.map((e) => `  - ${fmtDate(e.start)} ${e.type} "${e.title}" (${e.status})`).join('\n');
}

async function related(org, model, id, extraEventFilter) {
  const [activity, tasks, events] = await Promise.all([
    Activity.find({ organization: org, entityType: model, entityId: id }).sort({ createdAt: -1 }).limit(25).populate('createdBy', 'name'),
    Task.find({ organization: org, relatedToModel: model, relatedToId: id }).sort({ dueDate: 1 }).limit(15),
    Event.find({ organization: org, ...extraEventFilter }).sort({ start: -1 }).limit(10),
  ]);
  return { activity, tasks, events };
}

// Builds a compact plain-text dossier of one CRM record for the model to reason over.
// Everything here is tenant-scoped; record text is user-entered data, not instructions.
export async function buildRecordContext(org, entityType, entityId, { restrictToUser = null } = {}) {
  const ctx = await buildUnscoped(org, entityType, entityId);
  // Under 'own' visibility a rep may only analyse records they own.
  if (restrictToUser && String(ctx.ownerId) !== String(restrictToUser)) throw new AppError(`${entityType} not found`, 404);
  return ctx;
}

async function buildUnscoped(org, entityType, entityId) {
  if (!mongoose.isValidObjectId(entityId)) throw new AppError('Invalid record id', 400);

  if (entityType === 'Deal') {
    const deal = await Deal.findOne({ _id: entityId, organization: org })
      .populate('stage', 'name probability')
      .populate('contact', 'firstName lastName jobTitle email')
      .populate('company', 'name industry')
      .populate('ownerUser', 'name');
    if (!deal) throw new AppError('Deal not found', 404);
    const { activity, tasks, events } = await related(org, 'Deal', deal._id, { deal: deal._id });
    const quotes = await Quote.find({ organization: org, deal: deal._id }).select('quoteNumber status total createdAt');
    const lastTouch = activity[0]?.createdAt;
    return {
      label: deal.title,
      ownerId: deal.ownerUser?._id,
      text: [
        `DEAL: ${deal.title}`,
        `Amount: ${inr(deal.amount)} | Stage: ${deal.stage?.name} (${deal.stage?.probability ?? 0}% probability) | Status: ${deal.status}`,
        `Expected close: ${fmtDate(deal.expectedCloseDate)} | Created: ${fmtDate(deal.createdAt)} | Last activity: ${fmtDate(lastTouch)} (${daysSince(lastTouch) ?? 'n/a'} days ago)`,
        `Company: ${deal.company ? `${deal.company.name} (${deal.company.industry || 'industry n/a'})` : 'n/a'}`,
        `Contact: ${deal.contact ? `${deal.contact.firstName} ${deal.contact.lastName || ''}, ${deal.contact.jobTitle || ''} <${deal.contact.email || 'no email'}>` : 'n/a'}`,
        `Owner: ${deal.ownerUser?.name || 'n/a'}`,
        `Quotes:\n${quotes.length ? quotes.map((q) => `  - ${q.quoteNumber} ${q.status} ${inr(q.total)} (${fmtDate(q.createdAt)})`).join('\n') : '  (none)'}`,
        `Tasks:\n${taskLines(tasks)}`,
        `Meetings:\n${eventLines(events)}`,
        `Timeline (newest first):\n${activityLines(activity)}`,
      ].join('\n'),
    };
  }

  if (entityType === 'Contact') {
    const contact = await Contact.findOne({ _id: entityId, organization: org })
      .populate('company', 'name industry')
      .populate('ownerUser', 'name');
    if (!contact) throw new AppError('Contact not found', 404);
    const { activity, tasks, events } = await related(org, 'Contact', contact._id, { contact: contact._id });
    const [deals, tickets] = await Promise.all([
      Deal.find({ organization: org, contact: contact._id }).populate('stage', 'name').select('title amount status stage'),
      Ticket.find({ organization: org, contact: contact._id }).select('ticketNumber subject status priority'),
    ]);
    return {
      label: `${contact.firstName} ${contact.lastName || ''}`.trim(),
      ownerId: contact.ownerUser?._id,
      text: [
        `CONTACT: ${contact.firstName} ${contact.lastName || ''}`,
        `Title: ${contact.jobTitle || 'n/a'} | Company: ${contact.company?.name || 'n/a'} (${contact.company?.industry || ''})`,
        `Email: ${contact.email || 'n/a'} | Phone: ${contact.phone || 'n/a'} | Tags: ${(contact.tags || []).join(', ') || 'none'}`,
        `Owner: ${contact.ownerUser?.name || 'n/a'} | Since: ${fmtDate(contact.createdAt)}`,
        `Deals:\n${deals.length ? deals.map((d) => `  - ${d.title} ${inr(d.amount)} [${d.status}, ${d.stage?.name}]`).join('\n') : '  (none)'}`,
        `Support tickets:\n${tickets.length ? tickets.map((t) => `  - ${t.ticketNumber} ${t.subject} [${t.status}, ${t.priority}]`).join('\n') : '  (none)'}`,
        `Tasks:\n${taskLines(tasks)}`,
        `Meetings:\n${eventLines(events)}`,
        `Timeline (newest first):\n${activityLines(activity)}`,
      ].join('\n'),
    };
  }

  if (entityType === 'Company') {
    const company = await Company.findOne({ _id: entityId, organization: org }).populate('ownerUser', 'name');
    if (!company) throw new AppError('Company not found', 404);
    const { activity, tasks, events } = await related(org, 'Company', company._id, { company: company._id });
    const [deals, contacts, tickets] = await Promise.all([
      Deal.find({ organization: org, company: company._id }).populate('stage', 'name').select('title amount status stage'),
      Contact.find({ organization: org, company: company._id }).select('firstName lastName jobTitle'),
      Ticket.find({ organization: org, company: company._id }).select('ticketNumber subject status priority'),
    ]);
    return {
      label: company.name,
      ownerId: company.ownerUser?._id,
      text: [
        `COMPANY: ${company.name} | Industry: ${company.industry || 'n/a'} | Location: ${company.address || 'n/a'}`,
        `Owner: ${company.ownerUser?.name || 'n/a'} | Since: ${fmtDate(company.createdAt)}`,
        `Contacts: ${contacts.map((c) => `${c.firstName} ${c.lastName || ''} (${c.jobTitle || 'n/a'})`).join('; ') || 'none'}`,
        `Deals:\n${deals.length ? deals.map((d) => `  - ${d.title} ${inr(d.amount)} [${d.status}, ${d.stage?.name}]`).join('\n') : '  (none)'}`,
        `Support tickets:\n${tickets.length ? tickets.map((t) => `  - ${t.ticketNumber} ${t.subject} [${t.status}, ${t.priority}]`).join('\n') : '  (none)'}`,
        `Tasks:\n${taskLines(tasks)}`,
        `Meetings:\n${eventLines(events)}`,
        `Timeline (newest first):\n${activityLines(activity)}`,
      ].join('\n'),
    };
  }

  if (entityType === 'Lead') {
    const lead = await Lead.findOne({ _id: entityId, organization: org })
      .populate('company', 'name industry')
      .populate('campaign', 'name')
      .populate('ownerUser', 'name');
    if (!lead) throw new AppError('Lead not found', 404);
    const tasks = await Task.find({ organization: org, relatedToModel: 'Lead', relatedToId: lead._id }).limit(15);
    return {
      label: lead.name,
      ownerId: lead.ownerUser?._id,
      text: [
        `LEAD: ${lead.name} | Status: ${lead.status} | Score: ${lead.score}/100 | Source: ${lead.source}`,
        `Estimated value: ${inr(lead.estimatedValue)} | Company: ${lead.company?.name || 'n/a'} | Campaign: ${lead.campaign?.name || 'n/a'}`,
        `Email: ${lead.email || 'n/a'} | Phone: ${lead.phone || 'n/a'} | Owner: ${lead.ownerUser?.name || 'n/a'}`,
        `Created: ${fmtDate(lead.createdAt)} (${daysSince(lead.createdAt)} days ago) | Last updated: ${fmtDate(lead.updatedAt)}`,
        `Notes: ${lead.notes || 'none'}`,
        `Tasks:\n${taskLines(tasks)}`,
      ].join('\n'),
    };
  }

  throw new AppError('Unsupported record type', 400);
}
