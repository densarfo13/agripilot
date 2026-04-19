import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/authenticate.js';
import { logEvent } from '../src/services/analytics/eventLogService.js';

const prisma = new PrismaClient();
const router = express.Router();

/**
 * POST /events — fire-and-forget beacon from the browser
 * analyticsClient. Writes to the canonical EventLog table via
 * the shared logEvent helper (which validates the eventType
 * against the EVENT_TYPES allowlist). We never fail the
 * response — analytics must not block UX.
 */
router.post('/events', authenticate, express.json(), async (req, res) => {
  try {
    const body = req.body || {};
    await logEvent(prisma, {
      user: req.user,
      eventType: body.eventType,
      metadata: body.metadata,
    });
  } catch { /* swallow */ }
  res.status(202).json({ ok: true });
});

router.post('/track', authenticate, async (req, res) => {
  try {
    const { event, metadata } = req.body;

    if (!event || typeof event !== 'string') {
      return res.status(400).json({ success: false, error: 'event is required' });
    }

    await prisma.v2AnalyticsEvent.create({
      data: {
        userId: req.user.id,
        event: event.slice(0, 255),
        metadata: metadata || null,
      },
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('POST /api/v2/analytics/track failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to track event' });
  }
});

export default router;
