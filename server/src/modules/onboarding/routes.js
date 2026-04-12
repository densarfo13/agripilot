import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import {
  startOnboarding,
  recordStepCompleted,
  completeOnboarding,
  abandonOnboarding,
  resumeOnboarding,
  getOnboardingStatus,
  getOnboardingAnalytics,
} from './service.js';

const router = Router();
router.use(authenticate);

// ── Farmer-facing endpoints ──

// GET /onboarding/status — current user's onboarding status + events
router.get('/status', asyncHandler(async (req, res) => {
  const result = await getOnboardingStatus(req.user.sub);
  res.json({ data: result });
}));

// POST /onboarding/start — begin onboarding (not_started → in_progress)
router.post('/start', asyncHandler(async (req, res) => {
  const { source } = req.body || {};
  const event = await startOnboarding(req.user.sub, { source });
  res.status(201).json({ data: event });
}));

// POST /onboarding/step — record a step completion
router.post('/step', asyncHandler(async (req, res) => {
  const { stepName, metadata } = req.body || {};
  if (!stepName) return res.status(400).json({ error: 'stepName is required' });
  const event = await recordStepCompleted(req.user.sub, stepName, metadata || null);
  res.json({ data: event });
}));

// POST /onboarding/complete — finish onboarding (in_progress → completed)
router.post('/complete', asyncHandler(async (req, res) => {
  const { metadata } = req.body || {};
  const event = await completeOnboarding(req.user.sub, metadata || null);
  res.json({ data: event });
}));

// POST /onboarding/abandon — abandon onboarding (in_progress → abandoned)
router.post('/abandon', asyncHandler(async (req, res) => {
  const { metadata } = req.body || {};
  const event = await abandonOnboarding(req.user.sub, metadata || null);
  res.json({ data: event });
}));

// POST /onboarding/resume — resume onboarding (abandoned → in_progress)
router.post('/resume', asyncHandler(async (req, res) => {
  const event = await resumeOnboarding(req.user.sub);
  res.json({ data: event });
}));

// ── Admin endpoints ──

// GET /onboarding/admin/analytics — onboarding analytics summary
router.get('/admin/analytics', authorize('super_admin', 'institutional_admin'), asyncHandler(async (req, res) => {
  const days = Math.min(365, Math.max(1, parseInt(req.query.days || '30', 10)));
  const analytics = await getOnboardingAnalytics({ days });
  res.json({ data: analytics });
}));

// GET /onboarding/admin/user/:userId — specific user's onboarding detail
router.get('/admin/user/:userId', authorize('super_admin', 'institutional_admin'), asyncHandler(async (req, res) => {
  const result = await getOnboardingStatus(req.params.userId);
  res.json({ data: result });
}));

export default router;
