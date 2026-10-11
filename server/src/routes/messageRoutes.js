import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  sendMessage, listMessages, previewMessage, channelStatus, testChannel,
  listTemplates, createTemplate, updateTemplate, deleteTemplate,
} from '../controllers/messageController.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();
const admin = requireRole('owner', 'admin');
const manager = requireRole('owner', 'admin', 'manager');

// Guard against accidental bulk sends / runaway scripts.
const sendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 200,
  keyGenerator: (req) => String(req.user._id),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Hourly sending limit reached.' },
});

router.get('/', listMessages);
router.get('/channels', channelStatus);
router.post('/send', sendLimiter, sendMessage);
router.post('/preview', previewMessage);
router.post('/test/:channel', admin, testChannel);

router.get('/templates', listTemplates);
router.post('/templates', manager, createTemplate);
router.patch('/templates/:id', manager, updateTemplate);
router.delete('/templates/:id', manager, deleteTemplate);

export default router;
