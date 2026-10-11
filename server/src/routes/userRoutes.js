import { Router } from 'express';
import {
  listUsers,
  addTeamMember,
  updateTeamMember,
  updateMe,
  changeMyPassword,
} from '../controllers/userController.js';
import { validate } from '../middleware/validate.js';
import { requireRole } from '../middleware/rbac.js';
import {
  addTeamMemberSchema,
  updateTeamMemberSchema,
  updateProfileSchema,
  changePasswordSchema,
} from '../validators/userValidators.js';

const router = Router();

router.get('/', listUsers);
router.post('/', requireRole('owner', 'admin'), validate(addTeamMemberSchema), addTeamMember);
router.patch('/me', validate(updateProfileSchema), updateMe);
router.post('/me/change-password', validate(changePasswordSchema), changeMyPassword);
router.patch('/:id', requireRole('owner', 'admin'), validate(updateTeamMemberSchema), updateTeamMember);

export default router;
