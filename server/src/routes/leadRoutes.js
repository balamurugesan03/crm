import { Router } from 'express';
import { listLeads, getLead, createLead, updateLead, deleteLead, convertLead } from '../controllers/leadController.js';

import { validateCustomFields } from '../middleware/customFields.js';

const router = Router();
const customFields = validateCustomFields('Lead');

router.get('/', listLeads);
router.post('/', customFields, createLead);
router.get('/:id', getLead);
router.patch('/:id', customFields, updateLead);
router.delete('/:id', deleteLead);
router.post('/:id/convert', convertLead);

export default router;
