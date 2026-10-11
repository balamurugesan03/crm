import { Router } from 'express';
import { listForms, createForm, updateForm, deleteForm } from '../controllers/webFormController.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();
const canManage = requireRole('owner', 'admin', 'manager');

router.get('/', listForms);
router.post('/', canManage, createForm);
router.patch('/:id', canManage, updateForm);
router.delete('/:id', canManage, deleteForm);

export default router;
