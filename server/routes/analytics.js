import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/authenticate.js';

const prisma = new PrismaClient();
const router = express.Router();

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
