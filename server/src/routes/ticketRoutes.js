import { Router } from 'express';
import {
  listTickets,
  getTicket,
  createTicket,
  updateTicket,
  deleteTicket,
  addTicketNote,
} from '../controllers/ticketController.js';

import { agentReply } from '../controllers/portalController.js';

const router = Router();

router.get('/', listTickets);
router.post('/', createTicket);
router.get('/:id', getTicket);
router.patch('/:id', updateTicket);
router.delete('/:id', deleteTicket);
router.post('/:id/notes', addTicketNote);
router.post('/:id/replies', agentReply);

export default router;
