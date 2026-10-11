import { Router } from 'express';
import {
  listQuotes,
  getQuote,
  createQuote,
  updateQuote,
  deleteQuote,
  convertToInvoice,
} from '../controllers/quoteController.js';

const router = Router();

router.get('/', listQuotes);
router.post('/', createQuote);
router.get('/:id', getQuote);
router.patch('/:id', updateQuote);
router.delete('/:id', deleteQuote);
router.post('/:id/convert-to-invoice', convertToInvoice);

export default router;
