import { Router } from 'express';
import {
  listAttachments,
  uploadAttachments,
  downloadAttachment,
  deleteAttachment,
  uploadMiddleware,
} from '../controllers/attachmentController.js';

const router = Router();

router.get('/', listAttachments);
router.post('/', uploadMiddleware, uploadAttachments);
router.get('/:id/download', downloadAttachment);
router.delete('/:id', deleteAttachment);

export default router;
