import { Router } from 'express';
import { exportCsv, importCsv, importTemplate } from '../controllers/dataTransferController.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

router.get('/:entity/export', exportCsv);
router.get('/:entity/template', importTemplate);
router.post('/:entity/import', requireRole('owner', 'admin', 'manager'), importCsv);

export default router;
