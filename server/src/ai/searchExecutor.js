import * as z from 'zod/v4';
import Deal from '../models/Deal.js';
import Lead from '../models/Lead.js';
import Contact from '../models/Contact.js';
import Company from '../models/Company.js';
import Task from '../models/Task.js';
import Ticket from '../models/Ticket.js';
import User from '../models/User.js';
import PipelineStage from '../models/PipelineStage.js';

// The structured query the model produces from a natural-language request.
// Every field is required-but-nullable so the schema stays strict; null means "no filter".
export const SearchQuerySchema = z.object({
  entity: z.enum(['deals', 'leads', 'contacts', 'companies', 'tasks', 'tickets']),
  text: z.string().nullable().describe('Free-text match on the record name/title/subject'),
  status: z.string().nullable().describe('deals: open|won|lost; leads: new|contacted|qualified|unqualified|converted; tasks: pending|done; tickets: open|in_progress|waiting|resolved|closed'),
  stageName: z.string().nullable().describe('Deal pipeline stage name, e.g. Proposal, Negotiation'),
  source: z.string().nullable().describe('Lead source: website|referral|social|event|cold_call|advertisement|other'),
  priority: z.string().nullable().describe('tasks: low|medium|high; tickets: low|medium|high|urgent'),
  minAmount: z.number().nullable().describe('Minimum deal amount or lead estimated value, in INR (1 lakh = 100000, 1 crore = 10000000)'),
  maxAmount: z.number().nullable(),
  minScore: z.number().nullable().describe('Minimum lead score 0-100'),
  dateField: z.enum(['created', 'close', 'due']).nullable().describe('Which date the range applies to: created date, deal expected close date, or task due date'),
  dateFrom: z.string().nullable().describe('ISO date YYYY-MM-DD, inclusive'),
  dateTo: z.string().nullable().describe('ISO date YYYY-MM-DD, inclusive'),
  overdueOnly: z.boolean().nullable().describe('Tasks past due and still pending'),
  companyName: z.string().nullable(),
  ownerName: z.string().nullable().describe('Owner / assignee name; use "me" for the current user'),
  location: z.string().nullable().describe('City or place, matched against company address'),
  sort: z.enum(['newest', 'oldest', 'amount_desc', 'amount_asc', 'score_desc', 'date_asc']).nullable(),
  limit: z.number().nullable().describe('Max results, default 20, max 50'),
  explanation: z.string().describe('One short sentence describing how the request was interpreted'),
});

const esc = (s) => s.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const rx = (s) => new RegExp(esc(s), 'i');

function dateRange(from, to) {
  const range = {};
  if (from && !Number.isNaN(Date.parse(from))) range.$gte = new Date(`${from.slice(0, 10)}T00:00:00`);
  if (to && !Number.isNaN(Date.parse(to))) range.$lte = new Date(`${to.slice(0, 10)}T23:59:59.999`);
  return Object.keys(range).length ? range : null;
}

async function idsByName(Model, org, field, value) {
  const docs = await Model.find({ organization: org, [field]: rx(value) }).select('_id');
  return docs.map((d) => d._id);
}

async function ownerIds(org, ownerName, me) {
  if (!ownerName) return null;
  if (/^(me|my|myself|mine)$/i.test(ownerName.trim())) return [me];
  return idsByName(User, org, 'name', ownerName);
}

const SORTS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
};

// Translates the structured query into a tenant-scoped, whitelisted Mongo query. Never passes
// model output straight into a query operator.
export async function executeSearch(org, q, me, { restrictToUser = null } = {}) {
  const limit = Math.min(Math.max(Number(q.limit) || 20, 1), 50);
  const filter = { organization: org };
  // Under 'own' record visibility, the owner filter is forced to the current user.
  const owners = restrictToUser ? [restrictToUser] : await ownerIds(org, q.ownerName, me);
  const amountRange = {};
  if (typeof q.minAmount === 'number') amountRange.$gte = q.minAmount;
  if (typeof q.maxAmount === 'number') amountRange.$lte = q.maxAmount;
  const dates = dateRange(q.dateFrom, q.dateTo);

  switch (q.entity) {
    case 'deals': {
      if (q.text) filter.title = rx(q.text);
      if (q.status) filter.status = q.status;
      if (Object.keys(amountRange).length) filter.amount = amountRange;
      if (q.stageName) filter.stage = { $in: await idsByName(PipelineStage, org, 'name', q.stageName) };
      if (q.companyName || q.location) {
        const cf = { organization: org };
        if (q.companyName) cf.name = rx(q.companyName);
        if (q.location) cf.address = rx(q.location);
        filter.company = { $in: (await Company.find(cf).select('_id')).map((c) => c._id) };
      }
      if (owners) filter.ownerUser = { $in: owners };
      if (dates) filter[q.dateField === 'created' ? 'createdAt' : 'expectedCloseDate'] = dates;
      const sort = { amount_desc: { amount: -1 }, amount_asc: { amount: 1 }, date_asc: { expectedCloseDate: 1 } }[q.sort] || SORTS[q.sort] || { amount: -1 };
      const items = await Deal.find(filter).sort(sort).limit(limit)
        .populate('stage', 'name').populate('company', 'name').populate('ownerUser', 'name');
      return items.map((d) => ({
        _id: d._id, type: 'deal', title: d.title, link: '/deals',
        meta: [d.stage?.name, d.company?.name, d.ownerUser?.name].filter(Boolean).join(' · '),
        amount: d.amount, date: d.expectedCloseDate, status: d.status,
      }));
    }
    case 'leads': {
      if (q.text) filter.$or = [{ name: rx(q.text) }, { email: rx(q.text) }];
      if (q.status) filter.status = q.status;
      if (q.source) filter.source = q.source;
      if (Object.keys(amountRange).length) filter.estimatedValue = amountRange;
      if (typeof q.minScore === 'number') filter.score = { $gte: q.minScore };
      if (owners) filter.ownerUser = { $in: owners };
      if (dates) filter.createdAt = dates;
      const sort = { amount_desc: { estimatedValue: -1 }, amount_asc: { estimatedValue: 1 }, score_desc: { score: -1 } }[q.sort] || SORTS[q.sort] || { score: -1 };
      const items = await Lead.find(filter).sort(sort).limit(limit).populate('ownerUser', 'name');
      return items.map((l) => ({
        _id: l._id, type: 'lead', title: l.name, link: '/leads',
        meta: [l.source?.replace('_', ' '), l.status, l.ownerUser?.name].filter(Boolean).join(' · '),
        amount: l.estimatedValue, score: l.score, status: l.status, date: l.createdAt,
      }));
    }
    case 'contacts': {
      if (q.text) filter.$or = [{ firstName: rx(q.text) }, { lastName: rx(q.text) }, { email: rx(q.text) }, { jobTitle: rx(q.text) }];
      if (q.companyName || q.location) {
        const cf = { organization: org };
        if (q.companyName) cf.name = rx(q.companyName);
        if (q.location) cf.address = rx(q.location);
        filter.company = { $in: (await Company.find(cf).select('_id')).map((c) => c._id) };
      }
      if (owners) filter.ownerUser = { $in: owners };
      if (dates) filter.createdAt = dates;
      const items = await Contact.find(filter).sort(SORTS[q.sort] || { createdAt: -1 }).limit(limit).populate('company', 'name');
      return items.map((c) => ({
        _id: c._id, type: 'contact', title: `${c.firstName} ${c.lastName || ''}`.trim(), link: `/contacts/${c._id}`,
        meta: [c.jobTitle, c.company?.name, c.email].filter(Boolean).join(' · '), date: c.createdAt,
      }));
    }
    case 'companies': {
      if (q.text) filter.$or = [{ name: rx(q.text) }, { industry: rx(q.text) }];
      if (q.companyName) filter.name = rx(q.companyName);
      if (q.location) filter.address = rx(q.location);
      if (owners) filter.ownerUser = { $in: owners };
      if (dates) filter.createdAt = dates;
      const items = await Company.find(filter).sort(SORTS[q.sort] || { name: 1 }).limit(limit);
      return items.map((c) => ({
        _id: c._id, type: 'company', title: c.name, link: `/companies/${c._id}`,
        meta: [c.industry, c.address].filter(Boolean).join(' · '), date: c.createdAt,
      }));
    }
    case 'tasks': {
      if (q.text) filter.title = rx(q.text);
      if (q.status) filter.status = q.status;
      if (q.priority) filter.priority = q.priority;
      if (owners) filter.assignedTo = { $in: owners };
      if (q.overdueOnly) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        filter.status = 'pending';
        filter.dueDate = { $lt: today };
      } else if (dates) {
        filter[q.dateField === 'created' ? 'createdAt' : 'dueDate'] = dates;
      }
      const items = await Task.find(filter).sort(SORTS[q.sort] || { dueDate: 1 }).limit(limit).populate('assignedTo', 'name');
      return items.map((t) => ({
        _id: t._id, type: 'task', title: t.title, link: '/tasks',
        meta: [t.priority, t.assignedTo?.name].filter(Boolean).join(' · '), date: t.dueDate, status: t.status,
      }));
    }
    case 'tickets': {
      if (q.text) filter.$or = [{ subject: rx(q.text) }, { ticketNumber: rx(q.text) }];
      if (q.status) filter.status = q.status;
      if (q.priority) filter.priority = q.priority;
      if (owners) filter.assignedTo = { $in: owners };
      if (dates) filter.createdAt = dates;
      const items = await Ticket.find(filter).sort(SORTS[q.sort] || { createdAt: -1 }).limit(limit).populate('assignedTo', 'name').populate('company', 'name');
      return items.map((t) => ({
        _id: t._id, type: 'ticket', title: `${t.ticketNumber} ${t.subject}`, link: '/tickets',
        meta: [t.priority, t.company?.name, t.assignedTo?.name].filter(Boolean).join(' · '), date: t.createdAt, status: t.status,
      }));
    }
    default:
      return [];
  }
}
