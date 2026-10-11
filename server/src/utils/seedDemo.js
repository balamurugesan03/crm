/* eslint-disable no-await-in-loop, no-continue */
// Story-driven demo workspace. Every record is part of a connected customer journey:
//   web form / campaign lead -> qualified -> converted to contact + deal -> discovery call -> demo
//   -> proposal (quote + PDF + email) -> negotiation (WhatsApp) -> won/lost -> GST invoice
//   -> payments (full / partial with TDS / overdue + reminders) -> onboarding -> support tickets
//   with customer conversations, plus repeat-business upsells, targets, automations and audit trail.
// 12 months of history up to today, plus upcoming meetings and tasks. Deterministic (fixed RNG seed),
// so every run produces the same story relative to today's date.
//
//   npm run seed            Login: demo@nexuscrm.io / Demo@1234 (every teammate uses the same password)
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from '../config/db.js';
import { env } from '../config/env.js';
import Organization from '../models/Organization.js';
import User from '../models/User.js';
import PipelineStage, { DEFAULT_STAGES } from '../models/PipelineStage.js';
import Company from '../models/Company.js';
import Contact from '../models/Contact.js';
import Lead from '../models/Lead.js';
import Deal from '../models/Deal.js';
import Task from '../models/Task.js';
import Event from '../models/Event.js';
import Ticket from '../models/Ticket.js';
import Product from '../models/Product.js';
import Quote from '../models/Quote.js';
import Invoice from '../models/Invoice.js';
import Campaign from '../models/Campaign.js';
import Activity from '../models/Activity.js';
import Notification from '../models/Notification.js';
import Automation from '../models/Automation.js';
import Attachment from '../models/Attachment.js';
import AuditLog from '../models/AuditLog.js';
import Target from '../models/Target.js';
import WebForm from '../models/WebForm.js';
import CustomField from '../models/CustomField.js';
import MessageTemplate from '../models/MessageTemplate.js';
import Message from '../models/Message.js';
import Payment from '../models/Payment.js';
import { computeLeadScore } from '../services/leadScoring.js';
import { computeTotals } from './lineItems.js';

const DEMO_SLUG = 'nexus-demo';
const DEMO_PASSWORD = 'Demo@1234';
const SELLER_STATE = '33';
const DAY = 864e5;

// ---------- deterministic helpers ----------

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261011);
const chance = (p) => rand() < p;
const between = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const oid = () => new mongoose.Types.ObjectId();

const NOW = new Date();
const TODAY = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());
// A date `daysAgo` days before today at a working hour (negative = future).
function at(daysAgo, hour = between(9, 18), minute = pick([0, 15, 30, 45])) {
  const d = new Date(TODAY.getTime() - daysAgo * DAY);
  d.setHours(hour, minute, 0, 0);
  return d;
}
const addDays = (date, n, hour) => {
  const d = new Date(date.getTime() + n * DAY);
  if (hour !== undefined) d.setHours(hour, pick([0, 30]), 0, 0);
  return d;
};
const isPast = (d) => d.getTime() <= NOW.getTime();
const pad = (n, w = 4) => String(n).padStart(w, '0');

// ---------- reference data ----------

const TEAM = [
  { key: 'arun', name: 'Arun Prakash', email: 'demo@nexuscrm.io', role: 'owner', avatarColor: 'indigo' },
  { key: 'priya', name: 'Priya Raman', email: 'priya@nexuscrm.io', role: 'manager', avatarColor: 'grape' },
  { key: 'karthik', name: 'Karthik Selvam', email: 'karthik@nexuscrm.io', role: 'sales_rep', avatarColor: 'teal' },
  { key: 'divya', name: 'Divya Anand', email: 'divya@nexuscrm.io', role: 'sales_rep', avatarColor: 'orange' },
  { key: 'rahul', name: 'Rahul Menon', email: 'rahul@nexuscrm.io', role: 'sales_rep', avatarColor: 'cyan' },
  { key: 'meena', name: 'Meena Sundar', email: 'meena@nexuscrm.io', role: 'admin', avatarColor: 'pink' },
];
const SELLERS = ['arun', 'priya', 'karthik', 'divya', 'rahul'];
const SELLER_WEIGHTS = [0.12, 0.2, 0.24, 0.24, 0.2];

const PRODUCTS = [
  { key: 'pro', name: 'Nexus CRM Pro — annual seat', sku: 'NX-PRO-Y', price: 24000, hsn: '998314', description: 'Per user, per year' },
  { key: 'starter', name: 'Nexus CRM Starter — annual seat', sku: 'NX-ST-Y', price: 12000, hsn: '998314', description: 'Per user, per year' },
  { key: 'impl', name: 'Implementation & onboarding', sku: 'NX-IMP', price: 150000, hsn: '998313', description: 'Setup, configuration and go-live' },
  { key: 'migration', name: 'Data migration', sku: 'NX-MIG', price: 60000, hsn: '998313', description: 'Import from Excel / Tally / legacy CRM' },
  { key: 'support', name: 'Premium support (annual)', sku: 'NX-SUP', price: 45000, hsn: '998316', description: '24x7 support with 4-hour SLA' },
  { key: 'integration', name: 'Custom integration', sku: 'NX-INT', price: 85000, hsn: '998313', description: 'ERP / website / telephony integration' },
  { key: 'training', name: 'Team training workshop', sku: 'NX-TRN', price: 35000, hsn: '999293', description: 'Full-day on-site workshop' },
  { key: 'whatsapp', name: 'WhatsApp Business add-on (annual)', sku: 'NX-WA', price: 18000, hsn: '998314', description: 'Messaging integration, per year' },
];

// [name, domain, industry, city, stateCode, employees]
const COMPANIES = [
  ['Infosys Digital Labs', 'infosyslabs.example', 'IT Services', 'Chennai', '33', '1000+'],
  ['Tata Motors Fleet', 'tatafleet.example', 'Automotive', 'Pune', '27', '1000+'],
  ['Zenith Healthcare', 'zenithhealth.example', 'Healthcare', 'Chennai', '33', '201-1000'],
  ['Bluewave Logistics', 'bluewave.example', 'Logistics', 'Mumbai', '27', '201-1000'],
  ['Kaveri Textiles', 'kaveritex.example', 'Manufacturing', 'Coimbatore', '33', '51-200'],
  ['Pinnacle Finserv', 'pinnaclefs.example', 'Financial Services', 'Bengaluru', '29', '201-1000'],
  ['Greenleaf Organics', 'greenleaf.example', 'Retail', 'Hyderabad', '36', '51-200'],
  ['Skyline Realty', 'skylinerealty.example', 'Real Estate', 'Chennai', '33', '11-50'],
  ['Nova EdTech', 'novaedtech.example', 'Education', 'Bengaluru', '29', '51-200'],
  ['Orbit Telecom', 'orbittel.example', 'Telecom', 'Hyderabad', '36', '1000+'],
  ['Sunrise Hotels', 'sunrisehotels.example', 'Hospitality', 'Madurai', '33', '201-1000'],
  ['Vertex Pharma', 'vertexpharma.example', 'Pharmaceuticals', 'Ahmedabad', '24', '201-1000'],
  ['Annapurna Foods', 'annapurnafoods.example', 'FMCG', 'Coimbatore', '33', '51-200'],
  ['Meridian Insurance', 'meridianins.example', 'Insurance', 'Mumbai', '27', '1000+'],
  ['Coastal Exports', 'coastalexports.example', 'Export', 'Tuticorin', '33', '11-50'],
  ['Brightpath Academy', 'brightpath.example', 'Education', 'Kochi', '32', '11-50'],
  ['Ironclad Engineering', 'ironclad.example', 'Engineering', 'Hosur', '33', '201-1000'],
  ['Saffron Retail', 'saffronretail.example', 'Retail', 'Delhi', '07', '201-1000'],
  ['Prism Diagnostics', 'prismdx.example', 'Healthcare', 'Bengaluru', '29', '51-200'],
  ['Velocity Motors', 'velocitymotors.example', 'Automotive', 'Chennai', '33', '51-200'],
  ['Harbour Shipping', 'harbourship.example', 'Logistics', 'Visakhapatnam', '37', '201-1000'],
  ['Lotus Wellness', 'lotuswellness.example', 'Healthcare', 'Puducherry', '34', '11-50'],
  ['Granite Builders', 'granitebuild.example', 'Construction', 'Trichy', '33', '51-200'],
  ['Quantum Analytics', 'quantumanalytics.example', 'IT Services', 'Hyderabad', '36', '11-50'],
  ['Silverline Jewellers', 'silverline.example', 'Retail', 'Chennai', '33', '11-50'],
  ['Evergreen Agro', 'evergreenagro.example', 'Agriculture', 'Erode', '33', '51-200'],
];

const FIRST = ['Arjun', 'Lakshmi', 'Vikram', 'Meera', 'Suresh', 'Ananya', 'Ravi', 'Kavya', 'Aditya', 'Sneha', 'Manoj', 'Deepa', 'Naveen', 'Pooja', 'Ganesh', 'Shalini', 'Harish', 'Nithya', 'Sanjay', 'Revathi', 'Balaji', 'Swetha', 'Prakash', 'Janani', 'Vignesh', 'Aishwarya', 'Rohit', 'Keerthana', 'Senthil', 'Gayathri'];
const LAST = ['Kumar', 'Sharma', 'Iyer', 'Reddy', 'Nair', 'Menon', 'Rao', 'Patel', 'Pillai', 'Krishnan', 'Subramanian', 'Gupta', 'Natarajan', 'Venkatesh', 'Shah', 'Joshi'];
const TITLES = ['Managing Director', 'CEO', 'Head of Sales', 'IT Head', 'Operations Manager', 'Finance Controller', 'Procurement Manager', 'Marketing Head', 'COO'];
const LANGS = ['English', 'Tamil', 'English', 'Hindi', 'Tamil', 'Telugu', 'Kannada'];

const LOST_REASONS = [
  'Lost to Zoho — lower per-seat price.',
  'Budget frozen for this financial year.',
  'Went with in-house development.',
  'No response after 3 follow-ups; closing for now.',
  'Chose Salesforce due to existing global contract.',
];
const DEAL_NOTES = [
  'Customer wants WhatsApp integration as a must-have.',
  'Decision committee: MD, IT head and finance controller.',
  'Asked for Tamil-language training for the field team.',
  'Currently tracking leads in Excel; big pain is follow-up misses.',
  'Competitor demo scheduled next week — move fast.',
  'Wants GST invoicing and Tally export before go-live.',
  'Shared two customer references from the same industry.',
  'Requested 10% discount for a 2-year commitment.',
];
const TICKET_LIBRARY = [
  {
    subject: 'Unable to import contacts from Excel',
    description: 'The import shows "row 14: firstName is required" but the column is filled.',
    priority: 'medium',
    thread: [
      ['agent', 'Thanks for reporting! The first row of your sheet had "First name" with a trailing space. Could you try the template from Data → Download template?'],
      ['customer', 'That worked, all 340 contacts are in. Thank you!'],
      ['agent', 'Great to hear. Closing this ticket — reply anytime if you need help.'],
    ],
  },
  {
    subject: 'Invoice PDF shows wrong state code',
    description: 'Our GSTIN is 29 (Karnataka) but the invoice shows place of supply as Tamil Nadu.',
    priority: 'high',
    thread: [
      ['agent', 'The company record had no GSTIN saved, so it defaulted to our state. I have updated it — new invoices will show IGST correctly.'],
      ['customer', 'Can you also re-issue last month\'s invoice?'],
      ['agent', 'Done — the corrected invoice is now in your portal under Invoices.'],
    ],
  },
  {
    subject: 'Need 5 more user seats',
    description: 'We are onboarding a new sales team in Madurai. Please add 5 seats.',
    priority: 'low',
    thread: [
      ['agent', 'Happy to help! I have shared a quote for 5 additional seats, pro-rated to your renewal date.'],
      ['customer', 'Accepted the quote in the portal.'],
    ],
  },
  {
    subject: 'WhatsApp messages not sending',
    description: 'Messages from the Contacts page fail with "24-hour window closed".',
    priority: 'urgent',
    thread: [
      ['agent', 'WhatsApp only allows free-form messages within 24 hours of the customer\'s last message. For first-touch messages please use an approved template.'],
      ['customer', 'Understood. How do we get templates approved?'],
      ['agent', 'Submit them in Meta Business Manager → WhatsApp Manager → Message templates. Approval usually takes a few hours.'],
    ],
  },
  {
    subject: 'Dashboard loading slowly in the morning',
    description: 'Between 9 and 10 AM the dashboard takes 8-10 seconds to load.',
    priority: 'medium',
    thread: [['agent', 'We have identified a slow report query and deployed a fix. Could you check tomorrow morning and confirm?']],
  },
  {
    subject: 'Training session for new joiners',
    description: 'Can we schedule a 2-hour training in Tamil for 12 new field executives?',
    priority: 'low',
    thread: [
      ['agent', 'Absolutely. Would next Thursday 11 AM work? Our trainer Meena will conduct it in Tamil.'],
      ['customer', 'Thursday works. Please send the meeting link.'],
    ],
  },
  {
    subject: 'Request API access for website integration',
    description: 'We want to push website enquiries directly into the CRM.',
    priority: 'medium',
    thread: [['agent', 'You can use Web forms (Engage → Web forms) — it gives you an embed code with no API work. Shall I set one up for you?']],
  },
];

// ---------- tiny PDF writer (for realistic proposal attachments) ----------

function makePdf(lines) {
  const esc = (s) => s.replace(/[\\()]/g, '\\$&').replace(/[^\x20-\x7e]/g, '-');
  const content = ['BT', '/F1 20 Tf', '60 780 Td', `(${esc(lines[0])}) Tj`, '/F1 11 Tf']
    .concat(lines.slice(1).flatMap((l) => ['0 -22 Td', `(${esc(l)}) Tj`]))
    .concat(['ET'])
    .join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out);
}

// ---------- persistence helpers ----------

const ALL_MODELS = [User, PipelineStage, Company, Contact, Lead, Deal, Task, Event, Ticket, Product, Quote, Invoice, Campaign, Activity, Notification, Automation, Attachment, AuditLog, Target, WebForm, CustomField, MessageTemplate, Message, Payment];

async function wipeDemo() {
  const org = await Organization.findOne({ slug: DEMO_SLUG });
  if (!org) return;
  await Promise.all(ALL_MODELS.map((M) => M.deleteMany({ organization: org._id })));
  await Organization.deleteOne({ _id: org._id });
  fs.rmSync(path.join(env.uploadDir, String(org._id)), { recursive: true, force: true });
}

// Inserts docs, then pins createdAt/updatedAt to the story dates (`_at`, optional `_updated`).
async function insertDated(Model, docs) {
  if (!docs.length) return;
  const clean = docs.map(({ _at, _updated, ...d }) => d);
  await Model.insertMany(clean, { ordered: true });
  await Model.collection.bulkWrite(
    docs.map((d) => ({
      updateOne: { filter: { _id: d._id }, update: { $set: { createdAt: d._at, updatedAt: d._updated || d._at } } },
    })),
  );
}

// ---------- the story ----------

async function seed() {
  if (env.nodeEnv === 'production' && process.env.ALLOW_DEMO_SEED !== 'true') {
    console.error('[seed] Refusing to seed demo data into a production database. Set ALLOW_DEMO_SEED=true to override.');
    process.exitCode = 1;
    return;
  }
  await connectDB();
  await wipeDemo();

  // Organization & team
  const org = await Organization.create({
    name: 'Nexus Demo Co',
    slug: DEMO_SLUG,
    plan: 'pro',
    subscriptionStatus: 'active',
    settings: { rottingDays: 7, recordVisibility: 'all', dailyDigest: true, autoReminders: false },
    billingProfile: {
      legalName: 'Nexus Demo Co Private Limited',
      gstin: '33AABCN1234F1Z5',
      pan: 'AABCN1234F',
      stateCode: SELLER_STATE,
      address: '4th Floor, Olympia Tech Park, Guindy',
      city: 'Chennai',
      pincode: '600032',
      phone: '+91 44 4000 1234',
      email: 'accounts@nexusdemo.example',
      upiId: 'nexusdemo@okhdfcbank',
      bankName: 'HDFC Bank',
      bankAccount: '50200012345678',
      ifsc: 'HDFC0001234',
      invoiceTerms: 'Payment due within 15 days of invoice date. Interest @18% p.a. applies to delayed payments. Subject to Chennai jurisdiction.',
    },
  });
  const O = org._id;
  await Organization.collection.updateOne({ _id: O }, { $set: { createdAt: at(380), updatedAt: at(1) } });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const users = {};
  for (const u of TEAM) {
    users[u.key] = await User.create({ organization: O, name: u.name, email: u.email, passwordHash, role: u.role, avatarColor: u.avatarColor, lastLoginAt: at(between(0, 2)) });
  }
  const U = (k) => users[k]._id;
  const pickSeller = () => {
    let r = rand();
    for (let i = 0; i < SELLERS.length; i += 1) {
      r -= SELLER_WEIGHTS[i];
      if (r <= 0) return SELLERS[i];
    }
    return SELLERS[SELLERS.length - 1];
  };

  const stageDocs = await PipelineStage.insertMany(DEFAULT_STAGES.map((s) => ({ ...s, organization: O })));
  const ST = Object.fromEntries(stageDocs.map((s) => [s.name, s]));

  const productDocs = await Product.insertMany(PRODUCTS.map(({ key, ...p }) => ({ ...p, organization: O, gstRate: 18 })));
  const P = Object.fromEntries(PRODUCTS.map((p, i) => [p.key, productDocs[i]]));

  // Collections built in memory, inserted at the end with their story dates.
  const companies = [];
  const contacts = [];
  const leads = [];
  const deals = [];
  const quotes = [];
  const invoices = [];
  const payments = [];
  const tickets = [];
  const tasks = [];
  const events = [];
  const activities = [];
  const messages = [];
  const attachments = [];
  const notifications = [];
  const audit = [];
  const files = [];

  const act = (entityType, entityId, type, body, by, when) => {
    const a = { _id: oid(), organization: O, entityType, entityId, type, body, createdBy: by, _at: when };
    activities.push(a);
    return a;
  };
  const log = (action, resource, user, when, resourceId) => {
    if (TODAY.getTime() - when.getTime() < 21 * DAY) {
      audit.push({ _id: oid(), organization: O, user, action, resource, resourceId: resourceId && String(resourceId), method: { create: 'POST', update: 'PATCH', delete: 'DELETE' }[action] || 'POST', path: `/api/${resource}${resourceId && action !== 'create' ? `/${resourceId}` : ''}`, statusCode: action === 'create' ? 201 : 200, ip: pick(['103.48.12.7', '49.207.180.22', '122.164.33.91']), userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/130', _at: when });
    }
  };

  // Campaigns
  const campaignDefs = [
    { name: 'Chennai SMB Webinar — CRM for growing teams', type: 'webinar', start: 300, end: 298, budget: 80000, owner: 'priya' },
    { name: 'Google Ads — "CRM software India"', type: 'other', start: 240, end: -60, budget: 450000, owner: 'arun' },
    { name: 'TiE Chennai Founders Meet (booth)', type: 'event', start: 150, end: 149, budget: 250000, owner: 'karthik' },
    { name: 'Diwali offer — email campaign', type: 'email', start: 25, end: -5, budget: 40000, owner: 'divya' },
    { name: 'Coimbatore Manufacturers Summit', type: 'event', start: -20, end: -22, budget: 300000, owner: 'rahul' },
  ];
  const campaignDocs = await Campaign.insertMany(
    campaignDefs.map((c) => ({
      organization: O,
      name: c.name,
      type: c.type,
      budget: c.budget,
      ownerUser: U(c.owner),
      startDate: at(c.start, 10),
      endDate: at(c.end, 18),
      status: c.start < 0 ? 'planned' : c.end > 0 ? 'completed' : 'active',
      description: `${c.type === 'event' ? 'Booth + speaking slot' : c.type === 'webinar' ? '45-minute live demo' : 'Lead generation'} targeting SMBs in South India.`,
    })),
  );
  const campaignFor = (daysAgo, source) => {
    if (source === 'advertisement' && daysAgo <= 240 && daysAgo >= -60) return campaignDocs[1];
    if (source === 'event' && daysAgo <= 150 && daysAgo >= 140) return campaignDocs[2];
    if (source === 'social' && daysAgo <= 300 && daysAgo >= 290) return campaignDocs[0];
    if (daysAgo <= 25 && daysAgo >= 0 && chance(0.4)) return campaignDocs[3];
    return null;
  };

  // Web forms
  const demoForm = {
    _id: oid(),
    organization: O,
    name: 'Website — Book a demo',
    title: 'Book a free demo',
    description: 'Tell us a little about your team and we will set up a personalised walkthrough.',
    submitLabel: 'Request demo',
    fields: [
      { key: 'name', label: 'Full name', required: true },
      { key: 'email', label: 'Work email', required: true },
      { key: 'phone', label: 'Mobile number', required: true },
      { key: 'company', label: 'Company', required: false },
      { key: 'city', label: 'City', required: false },
      { key: 'budget', label: 'Approx. budget (₹)', required: false },
      { key: 'message', label: 'What would you like to see?', required: false },
    ],
    assignees: [U('karthik'), U('divya'), U('rahul')],
    createdBy: U('arun'),
    submissions: 0,
    _at: at(330),
  };
  const contactForm = {
    _id: oid(),
    organization: O,
    name: 'Website — Contact us',
    title: 'Talk to our team',
    submitLabel: 'Send',
    accentColor: '#0ca678',
    fields: [
      { key: 'name', label: 'Your name', required: true },
      { key: 'email', label: 'Email', required: true },
      { key: 'phone', label: 'Phone', required: false },
      { key: 'message', label: 'Message', required: true },
    ],
    assignees: [U('priya')],
    createdBy: U('arun'),
    submissions: 0,
    _at: at(330),
  };

  // Companies & contacts (created lazily the first time a company enters the story)
  const companyState = new Map();
  function ensureCompany(idx, when, ownerKey) {
    if (companyState.has(idx)) return companyState.get(idx);
    const [name, domain, industry, city, stateCode, employees] = COMPANIES[idx];
    const letters = name.replace(/[^A-Z]/gi, '').toUpperCase();
    const gstin = `${stateCode}AA${'CF'[idx % 2]}${letters[0]}${letters[1] || 'X'}${pad(1000 + idx * 137, 4).slice(-4)}${letters[2] || 'Q'}1Z${(idx % 9) + 1}`;
    const company = {
      _id: oid(),
      organization: O,
      name,
      domain,
      industry,
      phone: `+91 ${['44', '22', '80', '40', '422', '79', '11'][idx % 7]} ${between(2200, 2999)} ${between(1000, 9999)}`,
      address: `${between(2, 220)}, ${pick(['Anna Salai', 'MG Road', 'Industrial Estate', 'Tech Park', 'Main Road', 'Nehru Street'])}, ${city}`,
      gstin,
      stateCode,
      ownerUser: U(ownerKey),
      customFields: { employee_count: employees },
      _at: when,
    };
    companies.push(company);
    const people = [];
    for (let k = 0; k < between(2, 3); k += 1) {
      const first = FIRST[(idx * 3 + k * 7) % FIRST.length];
      const last = LAST[(idx * 5 + k * 3) % LAST.length];
      const person = {
        _id: oid(),
        organization: O,
        firstName: first,
        lastName: last,
        email: `${first}.${last}@${domain}`.toLowerCase(),
        phone: `+91 9${pad(between(100000000, 999999999), 9)}`,
        jobTitle: k === 0 ? pick(['Managing Director', 'CEO', 'COO', 'Head of Sales']) : pick(TITLES),
        company: company._id,
        tags: [k === 0 ? 'decision-maker' : pick(['champion', 'influencer', 'technical', 'finance']), employees === '1000+' || employees === '201-1000' ? 'enterprise' : employees === '51-200' ? 'mid-market' : 'smb'],
        ownerUser: U(ownerKey),
        customFields: { linkedin: `https://www.linkedin.com/in/${first}-${last}-${idx}${k}`.toLowerCase(), preferred_language: LANGS[(idx + k) % LANGS.length] },
        _at: addDays(when, k),
      };
      contacts.push(person);
      people.push(person);
      act('Contact', person._id, 'created', `${users[ownerKey].name} created this contact`, U(ownerKey), person._at);
    }
    const state = { company, people, idx, customer: false };
    companyState.set(idx, state);
    act('Company', company._id, 'created', `${users[ownerKey].name} created this company`, U(ownerKey), when);
    log('create', 'companies', U(ownerKey), when, company._id);
    return state;
  }

  // Quote / invoice line builder
  function buildLines(kind, size) {
    const seats = kind === 'upsell' ? between(5, 20) : size === 'large' ? between(40, 120) : size === 'mid' ? between(15, 40) : between(5, 15);
    const seatProduct = size === 'small' && chance(0.6) ? P.starter : P.pro;
    const lines = [{ product: seatProduct._id, description: seatProduct.name, hsn: seatProduct.hsn, quantity: seats, unitPrice: seatProduct.price, taxRate: 18 }];
    const add = (p, qty = 1) => lines.push({ product: p._id, description: p.name, hsn: p.hsn, quantity: qty, unitPrice: p.price, taxRate: 18 });
    if (kind === 'new') {
      add(P.impl);
      if (chance(0.55)) add(P.migration);
      if (size !== 'small' && chance(0.6)) add(P.support);
      if (chance(0.35)) add(P.integration, size === 'large' ? 2 : 1);
      if (chance(0.4)) add(P.training);
      if (chance(0.35)) add(P.whatsapp);
    } else {
      if (chance(0.5)) add(P.whatsapp);
      if (chance(0.4)) add(P.training);
    }
    return lines;
  }

  // ---------------- customer journeys ----------------
  const N_JOURNEYS = 96;
  // Skewed towards recent months: the business is growing, and recent journeys are still in flight.
  const startOffsets = Array.from({ length: N_JOURNEYS }, () => Math.round(360 * rand() ** 1.6)).sort((a, b) => b - a);
  let freshCompanyIdx = 0;
  const automationRuns = { hotLead: 0, onboarding: 0, urgent: 0 };
  const usedTitles = new Set();

  for (let j = 0; j < N_JOURNEYS; j += 1) {
    const startDaysAgo = startOffsets[j];
    const S = at(startDaysAgo);
    const sellerKey = pickSeller();
    const seller = users[sellerKey];

    // Repeat business from an existing customer, or a brand-new inbound/outbound opportunity.
    const existingCustomers = [...companyState.values()].filter((c) => c.customer && c.wonAt < S);
    const isUpsell = existingCustomers.length > 3 && chance(0.18);
    let cs;
    if (isUpsell) cs = pick(existingCustomers);
    else if (freshCompanyIdx < COMPANIES.length && chance(0.75)) cs = ensureCompany(freshCompanyIdx++, addDays(S, 0), sellerKey);
    else cs = ensureCompany(between(0, Math.min(freshCompanyIdx, COMPANIES.length) - 1), addDays(S, 0), sellerKey);
    const contact = cs.people[0];
    const sizeRoll = ['1000+', '201-1000'].includes(cs.company.customFields.employee_count) ? 'large' : cs.company.customFields.employee_count === '51-200' ? 'mid' : 'small';

    // 1) Lead (new business only)
    let convertAt = S;
    if (!isUpsell) {
      const source = pick(['website', 'website', 'website', 'referral', 'advertisement', 'event', 'social', 'cold_call']);
      const campaign = campaignFor(startDaysAgo, source);
      const lines = buildLines('new', sizeRoll);
      const estimate = Math.round(computeTotals(lines, 18).subtotal / 10000) * 10000;
      convertAt = addDays(S, between(2, 9));
      const lead = {
        _id: oid(),
        organization: O,
        name: `${contact.firstName} ${contact.lastName}`,
        email: contact.email,
        phone: contact.phone,
        source,
        status: 'converted',
        estimatedValue: estimate,
        company: cs.company._id,
        contact: contact._id,
        campaign: campaign?._id,
        ownerUser: U(sellerKey),
        notes: source === 'website' ? `Submitted via web form "${demoForm.name}"\nCity: ${cs.company.address.split(', ').pop()}\nMessage: ${pick(DEAL_NOTES)}` : `Source: ${source.replace('_', ' ')}${campaign ? ` — ${campaign.name}` : ''}`,
        customFields: { team_size: between(5, 150) },
        _at: S,
        _updated: isPast(convertAt) ? convertAt : S,
      };
      lead.score = computeLeadScore(lead);
      if (source === 'website') {
        demoForm.submissions += 1;
        demoForm.lastSubmissionAt = S;
      }
      if (estimate > 100000) automationRuns.hotLead += 1;
      if (!isPast(convertAt)) {
        // Still a qualified lead today.
        lead.status = chance(0.5) ? 'qualified' : 'contacted';
        lead.contact = undefined;
        lead.score = computeLeadScore(lead);
        leads.push(lead);
        tasks.push({ _id: oid(), organization: O, title: `Qualify ${lead.name} — discovery call`, type: 'call', priority: 'high', status: 'pending', dueDate: addDays(TODAY, between(0, 3), 11), assignedTo: U(sellerKey), _at: S });
        continue;
      }
      leads.push(lead);
      log('create', 'leads', U(sellerKey), S, lead._id);
    }

    // 2) Deal created at conversion
    const lines = buildLines(isUpsell ? 'upsell' : 'new', sizeRoll);
    const supplyType = cs.company.stateCode !== SELLER_STATE ? 'inter' : 'intra';
    const totals = computeTotals(lines, 18, { supplyType });
    let dealTitle = `${cs.company.name} — ${isUpsell ? pick(['Seat expansion', 'WhatsApp add-on', 'Renewal + upgrade', 'New branch rollout']) : pick(['CRM rollout', 'Sales automation', 'CRM + WhatsApp', 'CRM implementation'])}`;
    for (const suffix of ['Chennai branch', 'Field sales team', 'Phase 2', 'Service team', 'North region']) {
      if (!usedTitles.has(dealTitle)) break;
      dealTitle = `${dealTitle.split(' (')[0]} (${suffix})`;
    }
    usedTitles.add(dealTitle);
    const outcomeRoll = rand();
    const intended = outcomeRoll < 0.58 ? 'won' : outcomeRoll < 0.82 ? 'lost' : 'stall';
    const lostAfter = pick(['Qualified', 'Proposal', 'Negotiation']);
    const stallAt = pick(['Qualified', 'Proposal', 'Negotiation']);
    const deal = {
      _id: oid(),
      organization: O,
      title: dealTitle,
      amount: totals.subtotal,
      stage: ST.New._id,
      status: 'open',
      contact: contact._id,
      company: cs.company._id,
      ownerUser: U(sellerKey),
      customFields: { competitors: chance(0.6) ? [pick(['Zoho', 'Salesforce', 'HubSpot', 'Freshsales', 'In-house'])] : [] },
      _at: convertAt,
    };
    act('Deal', deal._id, 'created', isUpsell ? `${seller.name} created an expansion deal for an existing customer` : `Converted from lead "${contact.firstName} ${contact.lastName}"`, U(sellerKey), convertAt);
    if (!isUpsell) act('Contact', contact._id, 'note', `Lead converted — deal "${dealTitle}" opened`, U(sellerKey), convertAt);
    log('create', 'deals', U(sellerKey), convertAt, deal._id);
    act('Company', cs.company._id, 'note', `New opportunity: "${dealTitle}" (₹${totals.subtotal.toLocaleString('en-IN')})`, U(sellerKey), convertAt);

    // Planned timeline
    const plan = [];
    let cursor = convertAt;
    const step = (name, minD, maxD) => {
      cursor = addDays(cursor, between(minD, maxD), between(10, 17));
      plan.push({ name, date: cursor });
    };
    step('Qualified', 2, 6);
    step('Proposal', 4, 12);
    step('Negotiation', 4, 10);
    step('Close', 3, 14);

    let lastStage = 'New';
    let lastTouch = convertAt;
    let quote = null;
    let finished = false;
    const discovery = plan[0].date;

    // Discovery call (before Qualified)
    const callAt = addDays(discovery, -1, 11);
    if (isPast(callAt)) {
      events.push({ _id: oid(), organization: O, title: `Discovery call — ${cs.company.name}`, type: 'call', start: callAt, end: new Date(callAt.getTime() + 30 * 60000), location: 'Phone', attendees: [U(sellerKey)], contact: contact._id, company: cs.company._id, deal: deal._id, ownerUser: U(sellerKey), status: 'completed', description: 'Understand current process, team size, pain points.', _at: convertAt });
      act('Deal', deal._id, 'meeting', `${seller.name} completed "Discovery call — ${cs.company.name}"`, U(sellerKey), callAt);
      act('Deal', deal._id, 'note', pick(DEAL_NOTES), U(sellerKey), addDays(callAt, 0, 17));
      tasks.push({ _id: oid(), organization: O, title: `Discovery call with ${contact.firstName}`, type: 'call', priority: 'high', status: 'done', dueDate: callAt, assignedTo: U(sellerKey), relatedToModel: 'Deal', relatedToId: deal._id, _at: convertAt, _updated: callAt });
      lastTouch = callAt;
    }

    for (const { name, date } of plan) {
      if (finished) break;
      if (!isPast(date)) {
        // Next step is in the future: leave an upcoming meeting/task for it.
        const nextTitle = { Qualified: 'Discovery call', Proposal: 'Product demo', Negotiation: 'Pricing discussion', Close: 'Contract sign-off' }[name];
        const when = addDays(TODAY, between(0, 9), between(10, 17));
        if (intended !== 'stall' || chance(0.4)) {
          events.push({ _id: oid(), organization: O, title: `${nextTitle} — ${cs.company.name}`, type: name === 'Proposal' ? 'demo' : name === 'Close' ? 'meeting' : 'call', start: when, end: new Date(when.getTime() + (name === 'Proposal' ? 60 : 45) * 60000), location: pick(['Google Meet', 'Zoom', 'Client office', 'Our office, Guindy']), attendees: [U(sellerKey), ...(name === 'Proposal' ? [U('priya')] : [])], contact: contact._id, company: cs.company._id, deal: deal._id, ownerUser: U(sellerKey), status: 'scheduled', _at: lastTouch });
          tasks.push({ _id: oid(), organization: O, title: `${nextTitle}: ${cs.company.name}`, type: name === 'Close' ? 'meeting' : 'call', priority: name === 'Close' ? 'high' : 'medium', status: 'pending', dueDate: chance(0.15) ? addDays(TODAY, -between(1, 3), 12) : when, assignedTo: U(sellerKey), relatedToModel: 'Deal', relatedToId: deal._id, _at: lastTouch });
        }
        break;
      }

      if (intended === 'stall' && name === stallAt) {
        // Deal goes quiet: older ones are eventually marked lost, recent ones rot in the pipeline.
        if (TODAY.getTime() - date.getTime() > 60 * DAY) {
          const lostAt = addDays(date, between(25, 45), 16);
          deal.stage = ST.Lost._id;
          deal.status = 'lost';
          deal.closedAt = lostAt;
          act('Deal', deal._id, 'stage_change', `${seller.name} moved this deal to "Lost"`, U(sellerKey), lostAt);
          act('Deal', deal._id, 'note', 'No response after 3 follow-ups; closing for now.', U(sellerKey), lostAt);
          if (quote) quote.status = 'rejected';
          lastStage = 'Lost';
          lastTouch = lostAt;
        }
        finished = true;
        break;
      }

      if (name === 'Close') {
        if (intended === 'won') {
          deal.stage = ST.Won._id;
          deal.status = 'won';
          deal.closedAt = date;
          lastStage = 'Won';
          act('Deal', deal._id, 'stage_change', `${seller.name} moved this deal to "Won"`, U(sellerKey), date);
          act('Deal', deal._id, 'automation', 'Deal won — onboarding task created automatically.', U(sellerKey), date);
          automationRuns.onboarding += 1;
          if (quote) quote.status = 'accepted';
          if (quote && chance(0.4)) act('Deal', deal._id, 'status_change', `${contact.firstName} accepted the quote in the customer portal`, undefined, addDays(date, 0, 10));
          act('Company', cs.company._id, 'stage_change', `${cs.customer ? 'Expanded' : 'Became a customer'} — won "${dealTitle}" worth ₹${totals.subtotal.toLocaleString('en-IN')}`, U(sellerKey), date);
          cs.customer = true;
          cs.wonAt = date;
          // Onboarding
          const kickoff = addDays(date, between(3, 8), 11);
          tasks.push({ _id: oid(), organization: O, title: `Schedule onboarding for ${dealTitle}`, type: 'todo', priority: 'high', status: isPast(kickoff) ? 'done' : 'pending', dueDate: addDays(date, 2, 12), assignedTo: U(sellerKey), relatedToModel: 'Deal', relatedToId: deal._id, _at: date, _updated: isPast(kickoff) ? kickoff : date });
          events.push({ _id: oid(), organization: O, title: `Kick-off & onboarding — ${cs.company.name}`, type: 'meeting', start: kickoff, end: new Date(kickoff.getTime() + 90 * 60000), location: 'Client office', attendees: [U(sellerKey), U('meena')], contact: contact._id, company: cs.company._id, deal: deal._id, ownerUser: U('meena'), status: isPast(kickoff) ? 'completed' : 'scheduled', _at: date });

          // Invoice from the accepted quote
          const issue = addDays(date, 1, 12);
          if (isPast(issue)) {
            const termDays = sizeRoll === 'large' ? 30 : 15;
            const invoice = {
              _id: oid(),
              organization: O,
              quote: quote?._id,
              contact: contact._id,
              company: cs.company._id,
              ...totals,
              taxRate: 18,
              customerGstin: cs.company.gstin,
              placeOfSupply: cs.company.stateCode,
              issueDate: issue,
              dueDate: addDays(issue, termDays, 18),
              ownerUser: U(sellerKey),
              reminders: [],
              amountPaid: 0,
              _at: issue,
            };
            invoices.push(invoice);
            log('create', 'invoices', U(sellerKey), issue, invoice._id);
            invoice._companyAct = act('Company', cs.company._id, 'note', `Invoice raised for ₹${totals.total.toLocaleString('en-IN')} (incl. GST)`, U('meena'), issue);

            // Payment behaviour
            const due = invoice.dueDate;
            const daysPastDue = Math.floor((TODAY.getTime() - due.getTime()) / DAY);
            const r = rand();
            const payModes = ['bank_transfer', 'bank_transfer', 'upi', 'upi', 'cheque'];
            const addPayment = (amount, tds, when, note) => {
              payments.push({ _id: oid(), organization: O, invoice: invoice._id, company: cs.company._id, contact: contact._id, amount: Math.round(amount), tds: Math.round(tds), date: when, mode: pick(payModes), reference: `${pick(['NEFT', 'IMPS', 'UPI', 'RTGS'])} ${between(100000000, 999999999)}`, notes: note, recordedBy: U('meena'), _at: when });
              invoice.amountPaid += Math.round(amount) + Math.round(tds);
              act('Company', cs.company._id, 'note', `Payment received: ₹${Math.round(amount).toLocaleString('en-IN')}${tds ? ` + TDS ₹${Math.round(tds).toLocaleString('en-IN')}` : ''} via ${note?.includes('Advance') ? 'advance' : 'transfer'}`, U('meena'), when);
            };
            const tdsFull = Math.round(totals.subtotal * 0.02);
            const ageDays = Math.floor((TODAY.getTime() - issue.getTime()) / DAY);
            // Older invoices are almost always settled; recent ones show the full receivables mix.
            const paidShare = ageDays > 90 ? 0.92 : 0.45;
            if (daysPastDue > 0) {
              if (r < paidShare) {
                const when = addDays(due, between(-6, 9), 15);
                const paidAt = isPast(when) ? when : addDays(TODAY, -1, 15);
                if (sizeRoll !== 'small' && chance(0.5)) addPayment(totals.total - tdsFull, tdsFull, paidAt, 'TDS @2% u/s 194J deducted');
                else addPayment(totals.total, 0, paidAt);
              } else if (r < paidShare + (1 - paidShare) * 0.45) {
                const first = addDays(issue, between(3, 10), 15);
                addPayment(totals.total * 0.5 - tdsFull, tdsFull, first, 'Advance 50% (TDS deducted)');
                invoice.reminders.push({ sentAt: addDays(due, 1, 9), channel: 'email', auto: true, stage: 'after', to: contact.email });
              } else {
                invoice.reminders.push({ sentAt: addDays(due, -3, 9), channel: 'email', auto: true, stage: 'before', to: contact.email });
                invoice.reminders.push({ sentAt: addDays(due, 1, 9), channel: 'email', auto: true, stage: 'after', to: contact.email });
                if (daysPastDue >= 7) invoice.reminders.push({ sentAt: addDays(due, 7, 11), channel: 'whatsapp', auto: false, stage: 'after', to: contact.phone });
              }
            } else if (chance(0.25)) {
              addPayment(totals.total, 0, addDays(issue, between(1, Math.max(1, Math.floor((TODAY - issue) / DAY))), 14));
            } else if (chance(0.35) && TODAY - issue > 2 * DAY) {
              addPayment(totals.total * 0.4, 0, addDays(issue, 1, 15), 'Advance 40% as per PO terms');
            }
            // Derived status
            const paid = invoice.amountPaid >= invoice.total - 0.5;
            invoice.status = paid ? 'paid' : daysPastDue > 0 ? 'overdue' : invoice.amountPaid > 0 ? 'partially_paid' : 'sent';
            if (paid) invoice.paidAt = payments.filter((p) => p.invoice === invoice._id).reduce((m, p) => (p.date > m ? p.date : m), new Date(0));
            for (const rem of invoice.reminders) {
              messages.push({ _id: oid(), organization: O, channel: rem.channel, via: rem.channel === 'whatsapp' ? 'link' : 'api', to: rem.to, subject: rem.channel === 'email' ? `Payment reminder: invoice due` : undefined, body: `Hi ${contact.firstName}, a gentle reminder that our invoice is ${rem.stage === 'before' ? 'due soon' : 'past due'}. You can pay via UPI (nexusdemo@okhdfcbank) or bank transfer. Thank you!`, status: rem.channel === 'whatsapp' ? 'logged' : 'sent', entityType: 'Contact', entityId: contact._id, sentBy: rem.auto ? undefined : U('meena'), _at: rem.sentAt });
            }
          }

          // Support tickets after go-live
          const ticketCount = chance(0.55) ? between(1, 2) : 0;
          for (let t = 0; t < ticketCount; t += 1) {
            const opened = addDays(date, between(12, 90), between(9, 18));
            if (!isPast(opened)) continue;
            const tpl = pick(TICKET_LIBRARY);
            const age = Math.floor((TODAY - opened) / DAY);
            const viaPortal = chance(0.5);
            const replies = [];
            let tcur = opened;
            const visible = age > 10 ? tpl.thread.length : Math.max(1, Math.min(tpl.thread.length - 1, age));
            for (const [author, body] of tpl.thread.slice(0, visible)) {
              tcur = new Date(Math.min(tcur.getTime() + between(2, 26) * 3600e3, NOW.getTime() - 3600e3));
              if (tcur.getHours() < 9) tcur.setHours(9 + between(0, 2), between(0, 59));
              if (tcur.getHours() > 20) tcur.setHours(19, between(0, 59));
              replies.push({ _id: oid(), author, name: author === 'agent' ? 'Meena Sundar' : `${contact.firstName} ${contact.lastName}`, user: author === 'agent' ? U('meena') : undefined, body, createdAt: tcur });
            }
            const lastAuthor = replies[replies.length - 1]?.author;
            const status = age > 20 ? (chance(0.7) ? 'closed' : 'resolved') : age > 6 && visible === tpl.thread.length ? 'resolved' : lastAuthor === 'agent' ? 'waiting' : chance(0.5) ? 'in_progress' : 'open';
            const ticket = {
              _id: oid(),
              organization: O,
              subject: tpl.subject,
              description: tpl.description,
              priority: tpl.priority,
              status,
              channel: viaPortal ? 'portal' : pick(['email', 'phone', 'whatsapp']),
              contact: contact._id,
              company: cs.company._id,
              assignedTo: U('meena'),
              replies,
              resolvedAt: ['resolved', 'closed'].includes(status) ? tcur : undefined,
              _at: opened,
              _updated: tcur,
            };
            tickets.push(ticket);
            act('Company', cs.company._id, 'note', `Support ticket opened: "${tpl.subject}"${viaPortal ? ' (via customer portal)' : ''}`, U('meena'), opened);
            if (tpl.priority === 'urgent') automationRuns.urgent += 1;
          }
        } else {
          deal.stage = ST.Lost._id;
          deal.status = 'lost';
          deal.closedAt = date;
          lastStage = 'Lost';
          act('Deal', deal._id, 'stage_change', `${seller.name} moved this deal to "Lost"`, U(sellerKey), date);
          act('Deal', deal._id, 'note', pick(LOST_REASONS), U(sellerKey), addDays(date, 0, 17));
          act('Company', cs.company._id, 'stage_change', `Lost "${dealTitle}"`, U(sellerKey), date);
          if (quote) quote.status = 'rejected';
        }
        lastTouch = date;
        finished = true;
        break;
      }

      // Regular stage move
      if (intended === 'lost' && name === lostAfter) {
        deal.stage = ST.Lost._id;
        deal.status = 'lost';
        deal.closedAt = date;
        lastStage = 'Lost';
        act('Deal', deal._id, 'stage_change', `${seller.name} moved this deal to "Lost"`, U(sellerKey), date);
        act('Deal', deal._id, 'note', pick(LOST_REASONS), U(sellerKey), addDays(date, 0, 17));
        if (quote) quote.status = 'rejected';
        lastTouch = date;
        finished = true;
        break;
      }
      deal.stage = ST[name]._id;
      lastStage = name;
      act('Deal', deal._id, 'stage_change', `${seller.name} moved this deal to "${name}"`, U(sellerKey), date);
      lastTouch = date;

      if (name === 'Proposal') {
        const demoAt = addDays(date, -2, 15);
        events.push({ _id: oid(), organization: O, title: `Product demo — ${cs.company.name}`, type: 'demo', start: demoAt, end: new Date(demoAt.getTime() + 60 * 60000), location: pick(['Google Meet', 'Zoom', 'Client office']), attendees: [U(sellerKey), U('priya')], contact: contact._id, company: cs.company._id, deal: deal._id, ownerUser: U(sellerKey), status: 'completed', description: 'Pipeline, WhatsApp, GST invoicing and mobile app walkthrough.', _at: addDays(date, -6) });
        act('Deal', deal._id, 'meeting', `${seller.name} completed "Product demo — ${cs.company.name}"`, U(sellerKey), addDays(demoAt, 0, 16));
        quote = {
          _id: oid(),
          organization: O,
          contact: contact._id,
          company: cs.company._id,
          deal: deal._id,
          ...totals,
          taxRate: 18,
          customerGstin: cs.company.gstin,
          placeOfSupply: cs.company.stateCode,
          status: 'sent',
          validUntil: addDays(date, 30, 18),
          notes: 'Prices exclusive of GST. Annual licences billed in advance. Implementation billed on go-live.',
          ownerUser: U(sellerKey),
          _at: date,
        };
        quotes.push(quote);
        log('create', 'quotes', U(sellerKey), date, quote._id);
        // Proposal PDF + email
        const fileName = `Proposal - ${cs.company.name}.pdf`;
        const stored = `${quote._id}.pdf`;
        files.push({
          stored,
          buf: makePdf([
            `Proposal for ${cs.company.name}`,
            `Prepared by ${seller.name}, Nexus Demo Co`,
            `Date: ${date.toDateString()}`,
            '',
            ...lines.map((l) => `${l.description}  x${l.quantity}  @ Rs ${l.unitPrice.toLocaleString('en-IN')}`),
            '',
            `Subtotal: Rs ${totals.subtotal.toLocaleString('en-IN')}  +  GST 18%`,
            `Total: Rs ${totals.total.toLocaleString('en-IN')}`,
          ]),
        });
        attachments.push({ _id: oid(), organization: O, entityType: 'Deal', entityId: deal._id, originalName: fileName, storedName: stored, mimeType: 'application/pdf', size: 0, uploadedBy: U(sellerKey), _at: date });
        act('Deal', deal._id, 'attachment', `${seller.name} attached ${fileName}`, U(sellerKey), date);
        const emailAt = addDays(date, 0, 18);
        messages.push({ _id: oid(), organization: O, channel: 'email', via: 'api', to: contact.email, subject: `Your proposal from Nexus Demo Co`, body: `Hi ${contact.firstName},\n\nThank you for your time during the demo. Please find our proposal for ${cs.company.name} attached.\n\nHappy to walk you through it on a short call.\n\nRegards,\n${seller.name}`, status: 'sent', entityType: 'Deal', entityId: deal._id, sentBy: U(sellerKey), _at: emailAt });
        act('Deal', deal._id, 'email', `${seller.name} sent Email to ${contact.email}: "Your proposal from Nexus Demo Co"`, U(sellerKey), emailAt);
        tasks.push({ _id: oid(), organization: O, title: `Send proposal to ${cs.company.name}`, type: 'email', priority: 'high', status: 'done', dueDate: date, assignedTo: U(sellerKey), relatedToModel: 'Deal', relatedToId: deal._id, _at: addDays(date, -3), _updated: date });
        lastTouch = emailAt;
      }
      if (name === 'Negotiation') {
        const waAt = addDays(date, 1, 12);
        if (isPast(waAt)) {
          messages.push({ _id: oid(), organization: O, channel: 'whatsapp', via: 'link', to: contact.phone, body: `Hi ${contact.firstName} 👋 ${seller.name} here. Sharing the revised pricing with the 2-year discount we discussed. Shall we close this week?`, status: 'logged', entityType: 'Deal', entityId: deal._id, sentBy: U(sellerKey), _at: waAt });
          act('Deal', deal._id, 'whatsapp', `${seller.name} logged WhatsApp to ${contact.phone}`, U(sellerKey), waAt);
          lastTouch = waAt;
        }
        events.push({ _id: oid(), organization: O, title: `Pricing discussion — ${cs.company.name}`, type: 'meeting', start: date, end: new Date(date.getTime() + 45 * 60000), location: 'Client office', attendees: [U(sellerKey), U('arun')], contact: contact._id, company: cs.company._id, deal: deal._id, ownerUser: U(sellerKey), status: 'completed', _at: addDays(date, -4) });
      }
    }

    // Open deals keep a realistic idle clock (some fresh, some rotting).
    if (deal.status === 'open') {
      if (intended === 'stall') lastTouch = new Date(Math.min(lastTouch.getTime(), TODAY.getTime() - between(8, 25) * DAY));
      deal.expectedCloseDate = plan[plan.length - 1].date > TODAY ? plan[plan.length - 1].date : addDays(TODAY, between(5, 25), 18);
      deal.customFields.decision_date = deal.expectedCloseDate.toISOString();
    }
    deal.lastActivityAt = lastTouch;
    deal.stageChangedAt = [...activities].reverse().find((a) => String(a.entityId) === String(deal._id) && a.type === 'stage_change')?._at || convertAt;
    deal._updated = deal.closedAt || lastTouch;
    if (lastStage === 'New') deal.stageChangedAt = convertAt;
    deals.push(deal);
  }

  // ---------------- live support desk: recent, still-open tickets ----------------
  const customers = [...companyState.values()].filter((c) => c.customer);
  const recent = [
    { tpl: 3, daysAgo: 0, status: 'open', channel: 'portal' },
    { tpl: 1, daysAgo: 1, status: 'in_progress', channel: 'email' },
    { tpl: 5, daysAgo: 2, status: 'waiting', channel: 'whatsapp' },
    { tpl: 0, daysAgo: 4, status: 'in_progress', channel: 'portal' },
    { tpl: 6, daysAgo: 5, status: 'waiting', channel: 'phone' },
  ];
  for (const [i, r] of recent.entries()) {
    const cs = customers[(i * 3) % customers.length];
    if (!cs) break;
    const contact = cs.people[0];
    const tpl = TICKET_LIBRARY[r.tpl];
    const opened = at(r.daysAgo, r.daysAgo === 0 ? Math.max(9, Math.min(NOW.getHours() - 1, 12)) : between(9, 16));
    const thread = r.status === 'open' ? [] : tpl.thread.slice(0, r.status === 'waiting' ? 1 : 2);
    const replies = thread.map(([author, body], k) => ({
      _id: oid(),
      author,
      name: author === 'agent' ? 'Meena Sundar' : `${contact.firstName} ${contact.lastName}`,
      user: author === 'agent' ? U('meena') : undefined,
      body,
      createdAt: new Date(Math.min(opened.getTime() + (k + 1) * 3 * 3600e3, NOW.getTime() - 600e3)),
    }));
    tickets.push({ _id: oid(), organization: O, subject: tpl.subject, description: tpl.description, priority: tpl.priority, status: r.status, channel: r.channel, contact: contact._id, company: cs.company._id, assignedTo: U('meena'), replies, _at: opened, _updated: replies[replies.length - 1]?.createdAt || opened });
    if (tpl.priority === 'urgent') {
      automationRuns.urgent += 1;
      notifications.push({ _id: oid(), organization: O, user: U('arun'), type: 'automation', title: 'Escalate urgent tickets', body: `Urgent ticket: ${tpl.subject}`, link: '/tickets', isRead: false, _at: opened });
    }
  }

  // ---------------- extra top-of-funnel leads (not yet converted) ----------------
  for (let i = 0; i < 46; i += 1) {
    const daysAgo = Math.round(75 * rand() ** 1.3);
    const first = pick(FIRST);
    const last = pick(LAST);
    const source = pick(['website', 'website', 'advertisement', 'referral', 'social', 'event', 'cold_call']);
    const company = pick(['Sri Murugan Traders', 'Amman Steels', 'Kovai Pumps', 'Madras Spices', 'Royal Enfield Dealers', 'Pothys Retail', 'Chettinad Cements', 'Aavin Distributors', 'Nilgiris Tea Co', 'Salem Silks', 'Marina Travels', 'Vellore Medicals', null, null]);
    const status = daysAgo < 3 ? 'new' : pick(['new', 'contacted', 'contacted', 'qualified', 'unqualified']);
    const lead = {
      _id: oid(),
      organization: O,
      name: `${first} ${last}`,
      email: chance(0.85) ? `${first}.${last}${i}@${company ? `${company.split(' ')[0].toLowerCase()}.example` : 'gmail.example'}`.toLowerCase() : undefined,
      phone: chance(0.8) ? `+91 9${pad(between(100000000, 999999999), 9)}` : undefined,
      source,
      status,
      estimatedValue: pick([0, 50000, 120000, 250000, 400000, 750000, 1200000]),
      campaign: campaignFor(daysAgo, source)?._id,
      ownerUser: U(pickSeller()),
      notes: source === 'website' ? `Submitted via web form "${chance(0.7) ? demoForm.name : contactForm.name}"${company ? `\nCompany: ${company}` : ''}` : undefined,
      customFields: chance(0.6) ? { team_size: between(3, 60) } : {},
      _at: at(daysAgo),
    };
    lead.score = computeLeadScore(lead);
    if (source === 'website') {
      if (lead.notes.includes(contactForm.name)) {
        contactForm.submissions += 1;
        contactForm.lastSubmissionAt = lead._at;
      } else {
        demoForm.submissions += 1;
        demoForm.lastSubmissionAt = !demoForm.lastSubmissionAt || lead._at > demoForm.lastSubmissionAt ? lead._at : demoForm.lastSubmissionAt;
      }
    }
    if (lead.estimatedValue > 100000) {
      automationRuns.hotLead += 1;
      if (daysAgo <= 2) {
        tasks.push({ _id: oid(), organization: O, title: `Call ${lead.name} within 24h`, type: 'todo', priority: 'high', status: daysAgo === 0 ? 'pending' : chance(0.5) ? 'done' : 'pending', dueDate: addDays(lead._at, 1, 12), assignedTo: lead.ownerUser, relatedToModel: 'Lead', relatedToId: lead._id, _at: lead._at });
        notifications.push({ _id: oid(), organization: O, user: lead.ownerUser, type: 'automation', title: 'Follow up on hot inbound leads', body: `New high-value lead: ${lead.name}`, link: '/leads', isRead: daysAgo > 0, _at: lead._at });
      }
    }
    leads.push(lead);
    log('create', 'leads', lead.ownerUser, lead._at, lead._id);
  }

  // ---------------- numbering in chronological order ----------------
  const byDate = (a, b) => a._at - b._at;
  quotes.sort(byDate).forEach((q, i) => {
    q.quoteNumber = `Q-${pad(i + 1)}`;
  });
  invoices.sort(byDate).forEach((inv, i) => {
    inv.invoiceNumber = `INV-${pad(i + 1)}`;
    const q = quotes.find((x) => String(x._id) === String(inv.quote));
    if (q) inv.notes = `Against quotation ${q.quoteNumber}.`;
    const a = activities.find((x) => x === inv._companyAct);
    if (a) a.body = `${inv.invoiceNumber} raised for ₹${inv.total.toLocaleString('en-IN')} (incl. GST)`;
    delete inv._companyAct;
  });
  payments.sort(byDate).forEach((p, i) => {
    p.receiptNumber = `RCPT-${pad(i + 1)}`;
  });
  tickets.sort(byDate).forEach((t, i) => {
    t.ticketNumber = `T-${pad(i + 1)}`;
    act('Ticket', t._id, 'created', t.channel === 'portal' ? `${contacts.find((c) => String(c._id) === String(t.contact))?.firstName} opened this ticket from the customer portal` : `Meena Sundar logged this ticket (${t.channel})`, t.channel === 'portal' ? undefined : U('meena'), t._at);
    if (t.resolvedAt) act('Ticket', t._id, 'status_change', `Meena Sundar changed status to "${t.status}"`, U('meena'), t.resolvedAt);
  });
  for (const inv of invoices) {
    const q = quotes.find((x) => String(x._id) === String(inv.quote));
    for (const m of messages) {
      if (m.subject === 'Payment reminder: invoice due' && String(m.entityId) === String(inv.contact)) m.subject = `Payment reminder: ${inv.invoiceNumber}`;
    }
    if (q && inv.status === 'paid') {
      // Revenue landed: show it on the deal timeline.
      const deal = deals.find((d) => String(d._id) === String(q.deal));
      if (deal) act('Deal', deal._id, 'note', `${inv.invoiceNumber} paid in full — ₹${inv.total.toLocaleString('en-IN')} received`, U('meena'), inv.paidAt);
    }
  }

  // ---------------- today: make the dashboard feel alive ----------------
  const todayTasks = [
    ['Prepare QBR deck for Zenith Healthcare', 'todo', 'priya'],
    ['Call back Lakshmi re: renewal pricing', 'call', 'arun'],
    ['Share GST invoice copy with accounts team', 'email', 'meena'],
    ['Confirm demo slot with Coimbatore summit leads', 'call', 'rahul'],
    ['Follow up on pending PO — Bluewave Logistics', 'call', 'karthik'],
  ];
  for (const [title, type, who] of todayTasks) {
    tasks.push({ _id: oid(), organization: O, title, type, priority: 'high', status: 'pending', dueDate: at(0, between(11, 17)), assignedTo: U(who), _at: at(between(1, 4)) });
  }
  const overdueTasks = [
    ['Send revised quote to Skyline Realty', 'email', 'arun'],
    ['Update contact details after trade show', 'todo', 'divya'],
  ];
  for (const [title, type, who] of overdueTasks) {
    tasks.push({ _id: oid(), organization: O, title, type, priority: 'medium', status: 'pending', dueDate: at(between(2, 5), 12), assignedTo: U(who), _at: at(9) });
  }
  // Internal meetings
  for (let w = 0; w < 3; w += 1) {
    const monday = new Date(TODAY);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + w * 7);
    monday.setHours(10, 0, 0, 0);
    events.push({ _id: oid(), organization: O, title: 'Weekly pipeline review', type: 'meeting', start: monday, end: new Date(monday.getTime() + 45 * 60000), location: 'Conference room / Meet', attendees: TEAM.map((t) => U(t.key)), ownerUser: U('priya'), status: isPast(monday) ? 'completed' : 'scheduled', description: 'Rotting deals, this week\'s closes, forecast vs target.', _at: at(30) });
  }

  // Notifications for the team
  notifications.push(
    { _id: oid(), organization: O, user: U('arun'), type: 'system', title: 'Welcome to NexusCRM 👋', body: 'Your demo workspace is ready — try Ctrl+K or "Ask AI".', link: '/', isRead: false, _at: at(0, 8) },
    { _id: oid(), organization: O, user: U('arun'), type: 'event_invite', title: 'Priya Raman invited you to "Weekly pipeline review"', body: 'Monday, 10:00 AM', link: '/calendar', isRead: true, _at: at(3) },
    { _id: oid(), organization: O, user: U('arun'), type: 'task_assigned', title: 'New task assigned to you', body: todayTasks[1][0], link: '/tasks', isRead: false, _at: at(1, 16) },
  );
  for (const t of tickets.filter((x) => ['open', 'in_progress'].includes(x.status)).slice(-4)) {
    notifications.push({ _id: oid(), organization: O, user: U('meena'), type: 'ticket_assigned', title: t.channel === 'portal' ? 'New portal ticket' : 'A ticket was assigned to you', body: t.subject, link: '/tickets', isRead: false, _at: t._at });
  }

  // ---------------- insert everything ----------------
  await insertDated(Company, companies);
  await insertDated(Contact, contacts);
  await insertDated(Lead, leads);
  await insertDated(Deal, deals);
  await insertDated(Quote, quotes);
  await insertDated(Invoice, invoices);
  await insertDated(Payment, payments);
  await insertDated(Ticket, tickets);
  await insertDated(Task, tasks);
  await insertDated(Event, events);
  await insertDated(Activity, activities);
  await insertDated(Message, messages);
  await insertDated(Notification, notifications);
  await insertDated(AuditLog, audit);
  await insertDated(WebForm, [demoForm, contactForm]);

  // Attachment files on disk
  const dir = path.join(env.uploadDir, String(O));
  fs.mkdirSync(dir, { recursive: true });
  for (const f of files) fs.writeFileSync(path.join(dir, f.stored), f.buf);
  for (const a of attachments) a.size = files.find((f) => f.stored === a.storedName)?.buf.length || 0;
  await insertDated(Attachment, attachments);

  // ---------------- configuration records ----------------
  await Automation.insertMany([
    {
      organization: O,
      name: 'Follow up on hot inbound leads',
      description: 'High-value leads get a same-day call task and an alert.',
      trigger: 'lead.created',
      conditions: [{ field: 'estimatedValue', operator: 'greater_than', value: '100000' }],
      actions: [
        { type: 'create_task', taskTitle: 'Call {{name}} within 24h', taskDueInDays: 1, taskPriority: 'high', assignTo: 'owner' },
        { type: 'notify_user', assignTo: 'owner', message: 'New high-value lead: {{name}}' },
      ],
      runCount: automationRuns.hotLead,
      lastRunAt: at(0, 9),
      createdBy: U('arun'),
    },
    {
      organization: O,
      name: 'Kick off onboarding when a deal is won',
      trigger: 'deal.won',
      conditions: [],
      actions: [
        { type: 'create_task', taskTitle: 'Schedule onboarding for {{title}}', taskDueInDays: 2, taskPriority: 'high', assignTo: 'owner' },
        { type: 'add_note', message: 'Deal won — onboarding task created automatically.' },
      ],
      runCount: automationRuns.onboarding,
      lastRunAt: deals.filter((d) => d.status === 'won').map((d) => d.closedAt).sort((a, b) => b - a)[0],
      createdBy: U('arun'),
    },
    {
      organization: O,
      name: 'Escalate urgent tickets',
      trigger: 'ticket.created',
      conditions: [{ field: 'priority', operator: 'equals', value: 'urgent' }],
      actions: [{ type: 'notify_user', assignTo: String(U('arun')), message: 'Urgent ticket: {{subject}}' }],
      runCount: automationRuns.urgent,
      createdBy: U('meena'),
    },
    {
      organization: O,
      name: 'Mark unqualified leads as cold',
      trigger: 'lead.status_changed',
      conditions: [{ field: 'status', operator: 'equals', value: 'unqualified' }],
      actions: [{ type: 'add_note', message: 'Lead disqualified — moved to nurture list.' }],
      isActive: false,
      createdBy: U('priya'),
    },
  ]);

  // Monthly targets for the last 12 months + this month
  const ym = (offset) => {
    const d = new Date(TODAY.getFullYear(), TODAY.getMonth() + offset, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  const wonBy = (k) => deals.filter((d) => d.status === 'won' && String(d.ownerUser) === String(U(k))).reduce((s, d) => s + d.amount, 0);
  const repTarget = Object.fromEntries(SELLERS.map((k) => [k, Math.max(300000, wonBy(k) / 12)]));
  const targetDocs = [];
  for (let m = -12; m <= 0; m += 1) {
    const growth = 0.7 + (m + 12) * 0.05;
    let team = 0;
    for (const k of SELLERS) {
      const amount = Math.round((repTarget[k] * growth * (0.85 + rand() * 0.4)) / 50000) * 50000;
      team += amount;
      targetDocs.push({ organization: O, user: U(k), period: ym(m), amount, dealsTarget: k === 'arun' ? 1 : 2 });
    }
    targetDocs.push({ organization: O, user: null, period: ym(m), amount: team, dealsTarget: 9 });
  }
  await Target.insertMany(targetDocs);

  await CustomField.insertMany([
    { organization: O, entity: 'Contact', key: 'linkedin', label: 'LinkedIn', type: 'url', order: 0 },
    { organization: O, entity: 'Contact', key: 'preferred_language', label: 'Preferred language', type: 'select', options: ['English', 'Tamil', 'Hindi', 'Telugu', 'Kannada'], order: 1 },
    { organization: O, entity: 'Company', key: 'employee_count', label: 'Employees', type: 'select', options: ['1-10', '11-50', '51-200', '201-1000', '1000+'], order: 0, showInList: true },
    { organization: O, entity: 'Deal', key: 'decision_date', label: 'Decision date', type: 'date', order: 0 },
    { organization: O, entity: 'Deal', key: 'competitors', label: 'Competitors', type: 'multiselect', options: ['Zoho', 'Salesforce', 'HubSpot', 'Freshsales', 'In-house'], order: 1 },
    { organization: O, entity: 'Lead', key: 'team_size', label: 'Team size', type: 'number', order: 0 },
  ]);

  await MessageTemplate.insertMany([
    {
      organization: O,
      channel: 'email',
      name: 'Demo follow-up',
      subject: 'Great speaking with you, {{contact.firstName}}',
      body: ['Hi {{contact.firstName}},', '', 'Thank you for your time today. As discussed, I am sharing a quick summary and next steps for {{company.name}}.', '', 'Please let me know a convenient slot this week to continue the conversation.', '', 'Regards,', '{{user.name}}', '{{org.name}}'].join('\n'),
      createdBy: U('arun'),
    },
    {
      organization: O,
      channel: 'email',
      name: 'Proposal sent',
      subject: 'Your proposal from {{org.name}}',
      body: 'Hi {{contact.firstName}},\n\nPlease find our proposal for {{company.name}} attached. Happy to walk you through it on a short call.\n\nRegards,\n{{user.name}}',
      createdBy: U('arun'),
    },
    { organization: O, channel: 'whatsapp', name: 'Quick check-in', body: 'Hi {{contact.firstName}} 👋 {{user.name}} here from {{org.name}}. Just checking in — do you have 10 minutes this week to discuss next steps?', createdBy: U('arun') },
    { organization: O, channel: 'whatsapp', name: 'Payment reminder', body: 'Hi {{contact.firstName}}, a gentle reminder that the invoice from {{org.name}} is due. You can pay instantly via the UPI QR on the invoice. Thank you!', createdBy: U('meena') },
    { organization: O, channel: 'whatsapp', name: 'Meeting confirmation (Tamil)', body: 'வணக்கம் {{contact.firstName}}! நாளை நமது சந்திப்பை உறுதிப்படுத்துகிறோம். — {{user.name}}, {{org.name}}', createdBy: U('divya') },
  ]);

  // ---------------- summary ----------------
  const count = (arr, f) => arr.filter(f).length;
  const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
  const inr = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
  console.log('\n[seed] Demo workspace ready — full customer journeys over 12 months');
  console.log(`  Team: ${TEAM.length} users · Companies: ${companies.length} · Contacts: ${contacts.length}`);
  console.log(`  Leads: ${leads.length} (${count(leads, (l) => l.status === 'converted')} converted) · Deals: ${deals.length} (won ${count(deals, (d) => d.status === 'won')}, lost ${count(deals, (d) => d.status === 'lost')}, open ${count(deals, (d) => d.status === 'open')})`);
  console.log(`  Quotes: ${quotes.length} · Invoices: ${invoices.length} (${count(invoices, (i) => i.status === 'paid')} paid, ${count(invoices, (i) => i.status === 'overdue')} overdue, ${count(invoices, (i) => i.status === 'partially_paid')} part-paid) · Payments: ${payments.length}`);
  console.log(`  Revenue won: ${inr(sum(deals.filter((d) => d.status === 'won'), (d) => d.amount))} · Collected: ${inr(sum(payments, (p) => p.amount + p.tds))}`);
  console.log(`  Tickets: ${tickets.length} · Meetings: ${events.length} · Tasks: ${tasks.length} · Activities: ${activities.length} · Messages: ${messages.length} · Files: ${attachments.length}`);
  console.log('\n  Login:    demo@nexuscrm.io  (owner)');
  console.log('  Also:     priya@ (manager) · karthik@ / divya@ / rahul@ (sales reps) · meena@ (admin, accounts & support)');
  console.log(`  Password: ${DEMO_PASSWORD}\n`);
}

seed()
  .catch((err) => {
    console.error('[seed] failed', err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
