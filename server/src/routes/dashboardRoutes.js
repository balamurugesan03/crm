import { Router } from 'express';
import { getSummary } from '../controllers/dashboardController.js';

const router = Router();

router.get('/summary', getSummary);

export default router;
