import { Router } from 'express';
import { listAuditLogs } from '../controllers/auditLogController.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

router.get('/', requireRole('owner', 'admin'), listAuditLogs);

export default router;
