import { Router } from 'express';
import {
  getAutomationMeta,
  listAutomations,
  createAutomation,
  updateAutomation,
  deleteAutomation,
} from '../controllers/automationController.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();
const canManage = requireRole('owner', 'admin', 'manager');

router.get('/meta', getAutomationMeta);
router.get('/', listAutomations);
router.post('/', canManage, createAutomation);
router.patch('/:id', canManage, updateAutomation);
router.delete('/:id', canManage, deleteAutomation);

export default router;
