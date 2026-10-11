import Contact from '../models/Contact.js';
import Company from '../models/Company.js';
import Lead from '../models/Lead.js';
import Deal from '../models/Deal.js';
import Ticket from '../models/Ticket.js';
import { catchAsync } from '../utils/catchAsync.js';
import { buildSearchFilter } from '../utils/queryHelpers.js';
import { ownerScope } from '../utils/visibility.js';

const LIMIT = 5;

export const globalSearch = catchAsync(async (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) {
    return res.json({ contacts: [], companies: [], leads: [], deals: [], tickets: [] });
  }

  const base = { organization: req.tenantId };

  const [contacts, companies, leads, deals, tickets] = await Promise.all([
    Contact.find({ ...base, ...ownerScope(req), ...buildSearchFilter(q, ['firstName', 'lastName', 'email']) })
      .limit(LIMIT)
      .select('firstName lastName email'),
    Company.find({ ...base, ...ownerScope(req), ...buildSearchFilter(q, ['name', 'domain']) })
      .limit(LIMIT)
      .select('name domain'),
    Lead.find({ ...base, ...ownerScope(req), ...buildSearchFilter(q, ['name', 'email']) })
      .limit(LIMIT)
      .select('name email status'),
    Deal.find({ ...base, ...ownerScope(req), ...buildSearchFilter(q, ['title']) })
      .limit(LIMIT)
      .select('title amount'),
    Ticket.find({ ...base, ...ownerScope(req, 'assignedTo'), ...buildSearchFilter(q, ['subject', 'ticketNumber']) })
      .limit(LIMIT)
      .select('subject ticketNumber status'),
  ]);

  res.json({ contacts, companies, leads, deals, tickets });
});
