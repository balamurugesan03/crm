// Record-level visibility. When an org sets settings.recordVisibility = 'own', sales reps only
// see records they own (or are assigned to). Owners, admins and managers always see everything.
const FULL_ACCESS_ROLES = new Set(['owner', 'admin', 'manager']);

export function isRestricted(req) {
  return req.orgSettings?.recordVisibility === 'own' && !FULL_ACCESS_ROLES.has(req.user?.role);
}

// Mongo filter fragment to merge into a tenant-scoped query.
export function ownerScope(req, field = 'ownerUser') {
  return isRestricted(req) ? { [field]: req.user._id } : {};
}

// For events: visible if you own it or are an attendee.
export function eventScope(req) {
  return isRestricted(req) ? { $or: [{ ownerUser: req.user._id }, { attendees: req.user._id }] } : {};
}
