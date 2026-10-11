import Contact from '../models/Contact.js';
import Company from '../models/Company.js';
import Lead from '../models/Lead.js';
import Deal from '../models/Deal.js';
import Ticket from '../models/Ticket.js';
import AuditLog from '../models/AuditLog.js';
import { AppError } from '../utils/AppError.js';
import { catchAsync } from '../utils/catchAsync.js';
import { parseCsv, toCsv } from '../utils/csv.js';
import { computeLeadScore } from '../services/leadScoring.js';
import { ownerScope } from '../utils/visibility.js';

const MAX_IMPORT_ROWS = 5000;
const LEAD_SOURCES = ['website', 'referral', 'social', 'event', 'cold_call', 'advertisement', 'other'];
const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'unqualified', 'converted'];

const EXPORTERS = {
  contacts: {
    headers: ['firstName', 'lastName', 'email', 'phone', 'jobTitle', 'company', 'tags', 'owner', 'createdAt'],
    load: (org, scope) => Contact.find({ organization: org, ...scope.owner }).sort({ createdAt: -1 }).populate('company', 'name').populate('ownerUser', 'name'),
    map: (c) => ({ ...c.toObject(), company: c.company?.name, tags: (c.tags || []).join('; '), owner: c.ownerUser?.name }),
  },
  companies: {
    headers: ['name', 'domain', 'industry', 'phone', 'address', 'owner', 'createdAt'],
    load: (org, scope) => Company.find({ organization: org, ...scope.owner }).sort({ createdAt: -1 }).populate('ownerUser', 'name'),
    map: (c) => ({ ...c.toObject(), owner: c.ownerUser?.name }),
  },
  leads: {
    headers: ['name', 'email', 'phone', 'source', 'status', 'estimatedValue', 'score', 'owner', 'createdAt'],
    load: (org, scope) => Lead.find({ organization: org, ...scope.owner }).sort({ createdAt: -1 }).populate('ownerUser', 'name'),
    map: (l) => ({ ...l.toObject(), owner: l.ownerUser?.name }),
  },
  deals: {
    headers: ['title', 'amount', 'currency', 'stage', 'status', 'contact', 'company', 'expectedCloseDate', 'owner', 'createdAt'],
    load: (org, scope) =>
      Deal.find({ organization: org, ...scope.owner })
        .sort({ createdAt: -1 })
        .populate('stage', 'name')
        .populate('contact', 'firstName lastName')
        .populate('company', 'name')
        .populate('ownerUser', 'name'),
    map: (d) => ({
      ...d.toObject(),
      stage: d.stage?.name,
      contact: d.contact ? `${d.contact.firstName} ${d.contact.lastName || ''}`.trim() : '',
      company: d.company?.name,
      owner: d.ownerUser?.name,
    }),
  },
  tickets: {
    headers: ['ticketNumber', 'subject', 'status', 'priority', 'company', 'assignedTo', 'createdAt', 'resolvedAt'],
    load: (org, scope) =>
      Ticket.find({ organization: org, ...scope.assignee }).sort({ createdAt: -1 }).populate('company', 'name').populate('assignedTo', 'name'),
    map: (t) => ({ ...t.toObject(), company: t.company?.name, assignedTo: t.assignedTo?.name }),
  },
};

export const IMPORT_TEMPLATES = {
  contacts: ['firstName', 'lastName', 'email', 'phone', 'jobTitle', 'company', 'tags'],
  companies: ['name', 'domain', 'industry', 'phone', 'address'],
  leads: ['name', 'email', 'phone', 'source', 'status', 'estimatedValue'],
};

// Accepts loose header spellings ("First Name", "first_name", "E-mail") and maps them to field keys.
function normalizeRecord(record, fields) {
  const lookup = Object.fromEntries(fields.map((f) => [f.toLowerCase(), f]));
  const aliases = { mail: 'email', emailaddress: 'email', mobile: 'phone', phonenumber: 'phone', title: 'jobTitle', companyname: 'company', value: 'estimatedValue', fullname: 'name' };
  const out = {};
  for (const [rawKey, value] of Object.entries(record)) {
    const key = rawKey.toLowerCase().replace(/[^a-z]/g, '');
    const field = lookup[key] || aliases[key];
    if (field && fields.includes(field)) out[field] = value;
  }
  return out;
}

async function companyResolver(org, userId) {
  const cache = new Map();
  const existing = await Company.find({ organization: org }).select('name');
  existing.forEach((c) => cache.set(c.name.toLowerCase(), c._id));
  return async (name) => {
    if (!name) return undefined;
    const key = name.toLowerCase();
    if (!cache.has(key)) {
      const created = await Company.create({ organization: org, name, ownerUser: userId });
      cache.set(key, created._id);
    }
    return cache.get(key);
  };
}

export const exportCsv = catchAsync(async (req, res) => {
  const exporter = EXPORTERS[req.params.entity];
  if (!exporter) throw new AppError('Unsupported export type', 400);
  const docs = await exporter.load(req.tenantId, { owner: ownerScope(req), assignee: ownerScope(req, 'assignedTo') });
  const csv = toCsv(exporter.headers, docs.map(exporter.map));

  AuditLog.create({
    organization: req.tenantId,
    user: req.user._id,
    action: 'export',
    resource: req.params.entity,
    method: req.method,
    path: req.originalUrl,
    statusCode: 200,
    ip: req.ip,
  }).catch(() => {});

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.entity}-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
});

export const importTemplate = catchAsync(async (req, res) => {
  const headers = IMPORT_TEMPLATES[req.params.entity];
  if (!headers) throw new AppError('Unsupported import type', 400);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.entity}-template.csv"`);
  res.send(toCsv(headers, []));
});

export const importCsv = catchAsync(async (req, res) => {
  const { entity } = req.params;
  const fields = IMPORT_TEMPLATES[entity];
  if (!fields) throw new AppError('Unsupported import type', 400);

  const { records } = parseCsv(req.body.csv);
  if (!records.length) throw new AppError('The file has no data rows', 400);
  if (records.length > MAX_IMPORT_ROWS) throw new AppError(`Import is limited to ${MAX_IMPORT_ROWS} rows per file`, 400);

  const org = req.tenantId;
  const errors = [];
  const docs = [];
  let skipped = 0;

  if (entity === 'contacts') {
    const resolveCompany = await companyResolver(org, req.user._id);
    const existingEmails = new Set((await Contact.find({ organization: org, email: { $ne: null } }).select('email')).map((c) => c.email));
    for (const [i, raw] of records.entries()) {
      const r = normalizeRecord(raw, fields);
      if (!r.firstName) { errors.push({ row: i + 2, message: 'firstName is required' }); continue; }
      const email = r.email?.toLowerCase();
      if (email && existingEmails.has(email)) { skipped += 1; continue; }
      if (email) existingEmails.add(email);
      docs.push({
        organization: org,
        firstName: r.firstName,
        lastName: r.lastName,
        email,
        phone: r.phone,
        jobTitle: r.jobTitle,
        // eslint-disable-next-line no-await-in-loop
        company: await resolveCompany(r.company),
        tags: r.tags ? r.tags.split(/[;|]/).map((t) => t.trim()).filter(Boolean) : [],
        ownerUser: req.user._id,
      });
    }
    if (docs.length) await Contact.insertMany(docs, { ordered: false });
  } else if (entity === 'companies') {
    const existingNames = new Set((await Company.find({ organization: org }).select('name')).map((c) => c.name.toLowerCase()));
    for (const [i, raw] of records.entries()) {
      const r = normalizeRecord(raw, fields);
      if (!r.name) { errors.push({ row: i + 2, message: 'name is required' }); continue; }
      if (existingNames.has(r.name.toLowerCase())) { skipped += 1; continue; }
      existingNames.add(r.name.toLowerCase());
      docs.push({ organization: org, ...r, ownerUser: req.user._id });
    }
    if (docs.length) await Company.insertMany(docs, { ordered: false });
  } else if (entity === 'leads') {
    for (const [i, raw] of records.entries()) {
      const r = normalizeRecord(raw, fields);
      if (!r.name) { errors.push({ row: i + 2, message: 'name is required' }); continue; }
      const source = (r.source || 'other').toLowerCase().replace(/\s+/g, '_');
      const status = (r.status || 'new').toLowerCase();
      const lead = {
        organization: org,
        name: r.name,
        email: r.email?.toLowerCase(),
        phone: r.phone,
        source: LEAD_SOURCES.includes(source) ? source : 'other',
        status: LEAD_STATUSES.includes(status) ? status : 'new',
        estimatedValue: Number(String(r.estimatedValue || '0').replace(/[^0-9.]/g, '')) || 0,
        ownerUser: req.user._id,
      };
      // insertMany skips save middleware, so score here.
      lead.score = computeLeadScore(lead);
      docs.push(lead);
    }
    if (docs.length) await Lead.insertMany(docs, { ordered: false });
  }

  res.status(201).json({ imported: docs.length, skipped, failed: errors.length, errors: errors.slice(0, 50) });
});
