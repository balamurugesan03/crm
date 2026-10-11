import { Router } from 'express';
import { getReports } from '../controllers/reportController.js';

const router = Router();

router.get('/', getReports);

export default router;
