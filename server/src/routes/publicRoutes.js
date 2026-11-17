import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getPublicForm, submitPublicForm } from '../controllers/webFormController.js';
import PlatformSettings, { ASSET_KINDS } from '../models/PlatformSettings.js';
import { catchAsync } from '../utils/catchAsync.js';

// Unauthenticated endpoints. Keep this surface small and rate limited.
const router = Router();

const submitLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many submissions. Please try again later.' },
});

// Platform branding (name, colours, logos) shown before anyone logs in.
router.get('/branding', catchAsync(async (req, res) => {
  const settings = await PlatformSettings.get();
  res.set('Cache-Control', 'no-cache');
  res.json(settings.toPublic());
}));
router.get('/branding/:kind', catchAsync(async (req, res) => {
  if (!ASSET_KINDS.includes(req.params.kind)) return res.status(404).end();
  const settings = await PlatformSettings.get();
  const asset = settings[req.params.kind];
  if (!asset?.data?.length) return res.status(404).end();
  res.set({ 'Content-Type': asset.contentType, 'Cache-Control': 'public, max-age=31536000, immutable' });
  return res.send(asset.data);
}));

router.get('/forms/:key', getPublicForm);
router.post('/forms/:key/submit', submitLimiter, submitPublicForm);

export default router;
