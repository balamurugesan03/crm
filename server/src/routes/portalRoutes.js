import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  requirePortal, portalMe, portalListTickets, portalGetTicket, portalCreateTicket, portalReply,
  portalListDocs, portalGetDoc, portalRespondQuote, Invoice, Quote,
} from '../controllers/portalController.js';

// Customer-facing API, authenticated by a signed portal token (x-portal-token header).
const router = Router();

router.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));
router.use(requirePortal);

router.get('/me', portalMe);
router.get('/tickets', portalListTickets);
router.post('/tickets', rateLimit({ windowMs: 60 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false }), portalCreateTicket);
router.get('/tickets/:id', portalGetTicket);
router.post('/tickets/:id/replies', portalReply);
router.get('/invoices', portalListDocs(Invoice, 'invoiceNumber'));
router.get('/invoices/:id', portalGetDoc(Invoice, 'invoiceNumber'));
router.get('/quotes', portalListDocs(Quote, 'quoteNumber'));
router.get('/quotes/:id', portalGetDoc(Quote, 'quoteNumber'));
router.post('/quotes/:id/respond', portalRespondQuote);

export default router;
