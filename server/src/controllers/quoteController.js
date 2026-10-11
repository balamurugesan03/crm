import Quote from '../models/Quote.js';
import Invoice from '../models/Invoice.js';
import { AppError } from '../utils/AppError.js';
import { catchAsync } from '../utils/catchAsync.js';
import { paginationParams, buildSearchFilter } from '../utils/queryHelpers.js';
import { computeTotals } from '../utils/lineItems.js';
import { resolveGstContext } from '../services/gstService.js';

const LOCKED = ['_id', '__v', 'organization', 'createdAt', 'updatedAt', 'subtotal', 'taxAmount', 'cgst', 'sgst', 'igst', 'total', 'supplyType'];
const strip = (body) => Object.fromEntries(Object.entries(body).filter(([k]) => !LOCKED.includes(k)));
import { nextNumber } from '../utils/numbering.js';
import { ownerScope } from '../utils/visibility.js';

function populateFields(query) {
  return query
    .populate('contact', 'firstName lastName email phone')
    .populate('company', 'name address phone domain gstin stateCode')
    .populate('ownerUser', 'name avatarColor');
}

export const listQuotes = catchAsync(async (req, res) => {
  const { page, limit, skip } = paginationParams(req.query);
  const filter = { organization: req.tenantId, ...ownerScope(req, 'ownerUser'), ...buildSearchFilter(req.query.search, ['quoteNumber']) };
  if (req.query.status) filter.status = req.query.status;

  const [items, total] = await Promise.all([
    populateFields(Quote.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)),
    Quote.countDocuments(filter),
  ]);

  res.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
});

export const getQuote = catchAsync(async (req, res) => {
  const quote = await populateFields(Quote.findOne({ _id: req.params.id, organization: req.tenantId, ...ownerScope(req, 'ownerUser') }));
  if (!quote) throw new AppError('Quote not found', 404);
  res.json(quote);
});

export const createQuote = catchAsync(async (req, res) => {
  const { items, taxRate, ...rest } = strip(req.body);
  const gst = await resolveGstContext(req.tenantId, rest);
  const totals = computeTotals(items, taxRate, gst);
  const quoteNumber = await nextNumber(Quote, req.tenantId, 'Q');

  const quote = await Quote.create({
    ...rest,
    organization: req.tenantId,
    quoteNumber,
    taxRate: taxRate || 0,
    customerGstin: gst.customerGstin,
    placeOfSupply: gst.placeOfSupply,
    ...totals,
    ownerUser: rest.ownerUser || req.user._id,
  });

  res.status(201).json(quote);
});

export const updateQuote = catchAsync(async (req, res) => {
  const existing = await Quote.findOne({ _id: req.params.id, organization: req.tenantId, ...ownerScope(req, 'ownerUser') });
  if (!existing) throw new AppError('Quote not found', 404);

  const { items, taxRate, ...rest } = strip(req.body);
  Object.assign(existing, rest);

  // Always recompute: company / GSTIN / place-of-supply changes alter the CGST-SGST vs IGST split.
  const gst = await resolveGstContext(req.tenantId, {
    company: existing.company,
    customerGstin: rest.customerGstin,
    placeOfSupply: rest.placeOfSupply,
  });
  const rate = taxRate !== undefined ? taxRate : existing.taxRate;
  const totals = computeTotals(items || existing.items.map((i) => i.toObject?.() || i), rate, gst);
  Object.assign(existing, { taxRate: rate, customerGstin: gst.customerGstin, placeOfSupply: gst.placeOfSupply, ...totals });

  await existing.save();
  res.json(existing);
});

export const deleteQuote = catchAsync(async (req, res) => {
  const quote = await Quote.findOneAndDelete({ _id: req.params.id, organization: req.tenantId, ...ownerScope(req, 'ownerUser') });
  if (!quote) throw new AppError('Quote not found', 404);
  res.status(204).send();
});

export const convertToInvoice = catchAsync(async (req, res) => {
  const quote = await Quote.findOne({ _id: req.params.id, organization: req.tenantId, ...ownerScope(req, 'ownerUser') });
  if (!quote) throw new AppError('Quote not found', 404);

  const invoiceNumber = await nextNumber(Invoice, req.tenantId, 'INV');

  const invoice = await Invoice.create({
    organization: req.tenantId,
    invoiceNumber,
    quote: quote._id,
    contact: quote.contact,
    company: quote.company,
    items: quote.items,
    taxRate: quote.taxRate,
    subtotal: quote.subtotal,
    taxAmount: quote.taxAmount,
    cgst: quote.cgst,
    sgst: quote.sgst,
    igst: quote.igst,
    supplyType: quote.supplyType,
    placeOfSupply: quote.placeOfSupply,
    customerGstin: quote.customerGstin,
    total: quote.total,
    ownerUser: quote.ownerUser,
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  });

  quote.status = 'accepted';
  await quote.save();

  res.status(201).json(invoice);
});
