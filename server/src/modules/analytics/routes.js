import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { extractOrganization, orgWhereViaUser } from '../../middleware/orgScope.js';
import * as service from './service.js';

const router = Router();
router.use(authenticate);

// POST /api/v1/analytics/track — track an event
router.post('/track', asyncHandler(async (req, res) => {
  const { event, metadata } = req.body;
  if (!event || typeof event !== 'string') {
    return res.status(400).json({ error: 'event string is required' });
  }
  await service.trackEvent(event, req.user.sub, metadata || null);
  res.json({ tracked: true });
}));

// GET /api/v1/analytics/counts — admin: get event counts (org-scoped for NGO admins)
router.get('/counts', authorize('super_admin', 'institutional_admin'), extractOrganization, asyncHandler(async (req, res) => {
  const counts = await service.getEventCounts(req.query.since || null, orgWhereViaUser(req));
  res.json({ counts });
}));

// GET /api/v1/analytics/voice-summary — admin: voice analytics summary (org-scoped for NGO admins/officers)
router.get('/voice-summary', authorize('super_admin', 'institutional_admin', 'field_officer'), extractOrganization, asyncHandler(async (req, res) => {
  const summary = await service.getVoiceAnalyticsSummary(req.query.since || null, orgWhereViaUser(req));
  res.json(summary);
}));

export default router;
