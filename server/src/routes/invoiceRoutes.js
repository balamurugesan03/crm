import { Router } from 'express';
import {
  listInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  markPaid,
} from '../controllers/invoiceController.js';

const router = Router();

router.get('/', listInvoices);
router.post('/', createInvoice);
router.get('/:id', getInvoice);
router.patch('/:id', updateInvoice);
router.delete('/:id', deleteInvoice);
router.post('/:id/mark-paid', markPaid);

export default router;
