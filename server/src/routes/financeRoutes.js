import { Router } from 'express';
import {
  recordPayment, listInvoicePayments, listPayments, deletePayment, receivables, remindInvoice, gstr1,
} from '../controllers/financeController.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();
const finance = requireRole('owner', 'admin', 'manager');

router.get('/receivables', receivables);
router.get('/payments', listPayments);
router.delete('/payments/:paymentId', finance, deletePayment);
router.get('/invoices/:id/payments', listInvoicePayments);
router.post('/invoices/:id/payments', recordPayment);
router.post('/invoices/:id/remind', remindInvoice);
router.get('/gstr1', finance, gstr1);

export default router;
