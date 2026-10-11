import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getAiStatus, getInsights, getDraft, search, chat } from '../controllers/aiController.js';

const router = Router();

// Per-user budget on model calls so one user can't run up the bill.
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user._id),
  message: { message: 'Hourly AI limit reached. Please try again later.' },
});

router.get('/status', getAiStatus);
router.post('/insights', aiLimiter, getInsights);
router.post('/draft', aiLimiter, getDraft);
router.post('/search', aiLimiter, search);
router.post('/chat', aiLimiter, chat);

export default router;
