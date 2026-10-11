import { Router } from 'express';
import { getStats, listOrganizations, getOrganization, updateOrganization } from '../controllers/adminController.js';
import { requireSuperAdmin } from '../middleware/rbac.js';

const router = Router();

router.use(requireSuperAdmin);

router.get('/stats', getStats);
router.get('/organizations', listOrganizations);
router.get('/organizations/:id', getOrganization);
router.patch('/organizations/:id', updateOrganization);

export default router;
