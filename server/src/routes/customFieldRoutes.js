import { Router } from 'express';
import { listCustomFields, createCustomField, updateCustomField, deleteCustomField } from '../controllers/customFieldController.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();
const admin = requireRole('owner', 'admin');

router.get('/', listCustomFields);
router.post('/', admin, createCustomField);
router.patch('/:id', admin, updateCustomField);
router.delete('/:id', admin, deleteCustomField);

export default router;
