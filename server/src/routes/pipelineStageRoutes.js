import { Router } from 'express';
import { listStages, createStage, updateStage, deleteStage } from '../controllers/pipelineStageController.js';

const router = Router();

router.get('/', listStages);
router.post('/', createStage);
router.patch('/:id', updateStage);
router.delete('/:id', deleteStage);

export default router;
