import { Router } from 'express';
import { getPlans, createCheckoutSession, createPortalSession } from '../controllers/billingController.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

router.get('/plans', getPlans);
router.post('/checkout-session', requireRole('owner', 'admin'), createCheckoutSession);
router.post('/portal-session', requireRole('owner', 'admin'), createPortalSession);

export default router;
