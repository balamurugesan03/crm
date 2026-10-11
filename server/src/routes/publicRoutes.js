import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getPublicForm, submitPublicForm } from '../controllers/webFormController.js';

// Unauthenticated endpoints. Keep this surface small and rate limited.
const router = Router();

const submitLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many submissions. Please try again later.' },
});

router.get('/forms/:key', getPublicForm);
router.post('/forms/:key/submit', submitLimiter, submitPublicForm);

export default router;
