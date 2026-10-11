import AuditLog from '../models/AuditLog.js';

const METHOD_ACTIONS = { POST: 'create', PATCH: 'update', PUT: 'update', DELETE: 'delete' };
// Endpoints that change state but are noise in an audit trail.
const SKIP_RESOURCES = new Set(['auth', 'notifications', 'search', 'billing', 'socket.io', 'ai', 'public', 'portal']);

// Records every successful mutating API call made by an authenticated user.
// Runs on response 'finish', so req.user (set later by requireAuth) is available.
export function auditLog(req, res, next) {
  const action = METHOD_ACTIONS[req.method];
  if (!action) return next();

  res.on('finish', () => {
    if (!req.user || res.statusCode >= 400) return;
    const segments = req.originalUrl.split('?')[0].split('/').filter(Boolean); // ['api', 'contacts', ':id', ...]
    if (!segments[1] || SKIP_RESOURCES.has(segments[1])) return;

    // /api/data/:entity/import is logged against the entity being imported.
    const isImport = segments[1] === 'data' && segments[3] === 'import';
    const resource = isImport ? segments[2] : segments[1];
    const resolvedAction = isImport ? 'import' : action;

    AuditLog.create({
      organization: req.user.organization,
      user: req.user._id,
      action: resolvedAction,
      resource,
      resourceId: segments[2] && /^[a-f0-9]{24}$/i.test(segments[2]) ? segments[2] : undefined,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      statusCode: res.statusCode,
      ip: req.ip,
      userAgent: req.get('user-agent')?.slice(0, 200),
    }).catch((err) => console.error('[audit] failed to write', err.message));
  });

  next();
}
