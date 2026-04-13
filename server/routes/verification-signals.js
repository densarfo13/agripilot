import express from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/authenticate.js';

const router = express.Router();

// ─── GET / — list signals for current user's profile ─────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const profile = await prisma.farmProfile.findFirst({
      where: { userId: req.user.id, status: 'active' },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (!profile) return res.json({ success: true, signals: [] });

    const signals = await prisma.v2VerificationSignal.findMany({
      where: { profileId: profile.id },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, signals });
  } catch (error) {
    console.error('GET /api/v2/verification-signals failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to load signals' });
  }
});

export default router;
