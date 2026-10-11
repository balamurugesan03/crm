import { Router } from 'express';
import { listDeals, getDeal, createDeal, updateDeal, deleteDeal, addDealNote } from '../controllers/dealController.js';

import { validateCustomFields } from '../middleware/customFields.js';

const router = Router();
const customFields = validateCustomFields('Deal');

router.get('/', listDeals);
router.post('/', customFields, createDeal);
router.get('/:id', getDeal);
router.patch('/:id', customFields, updateDeal);
router.delete('/:id', deleteDeal);
router.post('/:id/notes', addDealNote);

export default router;
