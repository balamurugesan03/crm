import { Router } from 'express';
import { listNotifications, markRead, markAllRead } from '../controllers/notificationController.js';

const router = Router();

router.get('/', listNotifications);
router.post('/:id/read', markRead);
router.post('/read-all', markAllRead);

export default router;
