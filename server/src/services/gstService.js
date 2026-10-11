import Organization from '../models/Organization.js';
import Company from '../models/Company.js';

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function stateFromGstin(gstin) {
  const g = String(gstin || '').toUpperCase();
  return GSTIN_RE.test(g) ? g.slice(0, 2) : null;
}

// Works out the customer's GSTIN, place of supply and whether the sale is intra- or inter-state.
// Explicit values on the document win; otherwise they come from the linked company.
export async function resolveGstContext(organizationId, { company, customerGstin, placeOfSupply } = {}) {
  const [org, companyDoc] = await Promise.all([
    Organization.findById(organizationId).select('billingProfile'),
    company ? Company.findOne({ _id: company, organization: organizationId }).select('gstin stateCode') : null,
  ]);

  const sellerState = org?.billingProfile?.stateCode || stateFromGstin(org?.billingProfile?.gstin);
  const gstin = (customerGstin || companyDoc?.gstin || '').toUpperCase() || undefined;
  const pos = placeOfSupply || companyDoc?.stateCode || stateFromGstin(gstin) || sellerState || undefined;
  const supplyType = sellerState && pos && sellerState !== pos ? 'inter' : 'intra';

  return { customerGstin: gstin, placeOfSupply: pos, supplyType };
}
