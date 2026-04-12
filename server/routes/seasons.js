import express from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/authenticate.js';
import { writeAuditLog } from '../lib/audit.js';
import { getStageStarterTasks } from '../lib/seasonEngine.js';

const router = express.Router();

// Get active season with tasks
router.get('/active', authenticate, async (req, res) => {
  try {
    const season = await prisma.v2Season.findFirst({
      where: { userId: req.user.id, isActive: true },
      orderBy: { createdAt: 'desc' },
      include: {
        tasks: {
          orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    return res.json({ success: true, season });
  } catch (error) {
    console.error('GET /api/v2/seasons/active failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to load active season' });
  }
});

// Start a new season
router.post('/start', authenticate, async (req, res) => {
  try {
    const existingActive = await prisma.v2Season.findFirst({
      where: { userId: req.user.id, isActive: true },
      select: { id: true },
    });

    if (existingActive) {
      return res.status(409).json({ success: false, error: 'An active season already exists' });
    }

    const profile = await prisma.farmProfile.findFirst({
      where: { userId: req.user.id },
      select: { crop: true },
    });

    const cropType = String(req.body?.cropType || profile?.crop || '').trim();
    const stage = String(req.body?.stage || 'planting').trim().toLowerCase();

    if (!cropType) {
      return res.status(400).json({ success: false, error: 'Crop type is required to start a season' });
    }

    const startDate = req.body?.startDate ? new Date(req.body.startDate) : new Date();

    if (Number.isNaN(startDate.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid start date' });
    }

    const starterTasks = getStageStarterTasks(cropType, stage, startDate);

    const season = await prisma.v2Season.create({
      data: {
        userId: req.user.id,
        cropType,
        startDate,
        stage,
        isActive: true,
        tasks: { create: starterTasks },
      },
      include: {
        tasks: {
          orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    await writeAuditLog(req, {
      userId: req.user.id,
      action: 'season.started',
      entityType: 'V2Season',
      entityId: season.id,
      metadata: { cropType, stage },
    });

    return res.status(201).json({ success: true, season });
  } catch (error) {
    console.error('POST /api/v2/seasons/start failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to start season' });
  }
});

// Complete a season
router.post('/:seasonId/complete', authenticate, async (req, res) => {
  try {
    const season = await prisma.v2Season.findFirst({
      where: { id: req.params.seasonId, userId: req.user.id },
    });

    if (!season) {
      return res.status(404).json({ success: false, error: 'Season not found' });
    }

    const updated = await prisma.v2Season.update({
      where: { id: season.id },
      data: { isActive: false },
      include: { tasks: true },
    });

    await writeAuditLog(req, {
      userId: req.user.id,
      action: 'season.completed',
      entityType: 'V2Season',
      entityId: updated.id,
      metadata: { cropType: updated.cropType },
    });

    return res.json({ success: true, season: updated });
  } catch (error) {
    console.error('POST /api/v2/seasons/:seasonId/complete failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to complete season' });
  }
});

export default router;
