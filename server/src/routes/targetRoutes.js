import { Router } from 'express';
import { getTargets, setTargets } from '../controllers/targetController.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

router.get('/', getTargets);
router.put('/', requireRole('owner', 'admin', 'manager'), setTargets);

export default router;
