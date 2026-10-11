import { Router } from 'express';
import { updateOrganization } from '../controllers/organizationController.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

router.patch('/', requireRole('owner', 'admin'), updateOrganization);

export default router;
