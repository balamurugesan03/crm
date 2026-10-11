import { Router } from 'express';
import {
  listContacts,
  getContact,
  createContact,
  updateContact,
  deleteContact,
  addContactNote,
} from '../controllers/contactController.js';

import { validateCustomFields } from '../middleware/customFields.js';

import { createPortalLink } from '../controllers/portalController.js';

const router = Router();
const customFields = validateCustomFields('Contact');

router.get('/', listContacts);
router.post('/', customFields, createContact);
router.get('/:id', getContact);
router.patch('/:id', customFields, updateContact);
router.delete('/:id', deleteContact);
router.post('/:id/notes', addContactNote);
router.post('/:id/portal-link', createPortalLink);

export default router;
