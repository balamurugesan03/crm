import { Router } from 'express';
import {
  listCompanies,
  getCompany,
  createCompany,
  updateCompany,
  deleteCompany,
  addCompanyNote,
} from '../controllers/companyController.js';

import { validateCustomFields } from '../middleware/customFields.js';

const router = Router();
const customFields = validateCustomFields('Company');

router.get('/', listCompanies);
router.post('/', customFields, createCompany);
router.get('/:id', getCompany);
router.patch('/:id', customFields, updateCompany);
router.delete('/:id', deleteCompany);
router.post('/:id/notes', addCompanyNote);

export default router;
