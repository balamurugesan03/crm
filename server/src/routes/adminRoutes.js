import { Router } from 'express';
import {
  getStats,
  listOrganizations,
  getOrganization,
  createOrganization,
  updateOrganization,
  resetUserPassword,
  recordSettlement,
  deleteSettlement,
  listSettlements,
  listPlans,
  createPlan,
  updatePlan,
  deletePlan,
  getPlatformSettings,
  updatePlatformSettings,
  listSuperAdmins,
  createSuperAdmin,
  updateSuperAdmin,
} from '../controllers/adminController.js';
import { requireSuperAdmin } from '../middleware/rbac.js';

const router = Router();

router.use(requireSuperAdmin);

router.get('/stats', getStats);

router.get('/organizations', listOrganizations);
router.post('/organizations', createOrganization);
router.get('/organizations/:id', getOrganization);
router.patch('/organizations/:id', updateOrganization);
router.post('/organizations/:id/reset-password', resetUserPassword);
router.post('/organizations/:id/settlements', recordSettlement);
router.delete('/organizations/:id/settlements/:settlementId', deleteSettlement);

router.get('/settlements', listSettlements);

router.get('/plans', listPlans);
router.post('/plans', createPlan);
router.patch('/plans/:id', updatePlan);
router.delete('/plans/:id', deletePlan);

router.get('/platform-settings', getPlatformSettings);
router.put('/platform-settings', updatePlatformSettings);

router.get('/super-admins', listSuperAdmins);
router.post('/super-admins', createSuperAdmin);
router.patch('/super-admins/:id', updateSuperAdmin);

export default router;
