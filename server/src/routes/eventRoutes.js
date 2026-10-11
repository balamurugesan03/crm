import { Router } from 'express';
import { listEvents, upcomingEvents, getEvent, createEvent, updateEvent, deleteEvent } from '../controllers/eventController.js';

const router = Router();

router.get('/', listEvents);
router.get('/upcoming', upcomingEvents);
router.post('/', createEvent);
router.get('/:id', getEvent);
router.patch('/:id', updateEvent);
router.delete('/:id', deleteEvent);

export default router;
