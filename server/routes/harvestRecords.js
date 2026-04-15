/**
 * Harvest Records Route — CRUD for yield / post-harvest records.
 *
 * POST   /api/v2/harvest-records          — create a harvest record
 * GET    /api/v2/harvest-records/:farmId   — list records for a farm (+ summary)
 * PATCH  /api/v2/harvest-records/:id       — update a record
 * DELETE /api/v2/harvest-records/:id       — soft-delete a record
 *
 * Ownership enforced: farm must belong to req.user.id.
 * Never trusts client-sent userId.
 */

import express from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/authenticate.js';
import { validateCreate, validateUpdate, computeHarvestSummary } from '../lib/harvestRecordValidation.js';

const router = express.Router();

// ─── CREATE ──────────────────────────────────────────────
router.post('/', authenticate, async (req, res) => {
  try {
    const validation = validateCreate(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error,
        fieldErrors: validation.fieldErrors,
      });
    }

    const { farmId, ...rest } = validation.data;

    // Verify farm ownership
    const farm = await prisma.farmProfile.findFirst({
      where: { id: farmId, userId: req.user.id },
      select: { id: true, status: true },
    });

    if (!farm) {
      return res.status(404).json({ success: false, error: 'Farm not found' });
    }

    if (farm.status === 'archived') {
      return res.status(400).json({ success: false, error: 'Cannot add records to an archived farm' });
    }

    const record = await prisma.v2HarvestRecord.create({
      data: {
        farmId,
        ...rest,
        harvestDate: new Date(rest.harvestDate),
      },
    });

    return res.status(201).json({ success: true, record });
  } catch (error) {
    console.error('POST /api/v2/harvest-records failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to create harvest record' });
  }
});

// ─── LIST (per farm, with summary) ───────────────────────
router.get('/:farmId', authenticate, async (req, res) => {
  try {
    const { farmId } = req.params;

    // Verify farm ownership
    const farm = await prisma.farmProfile.findFirst({
      where: { id: farmId, userId: req.user.id },
      select: { id: true },
    });

    if (!farm) {
      return res.status(404).json({ success: false, error: 'Farm not found' });
    }

    const records = await prisma.v2HarvestRecord.findMany({
      where: { farmId },
      orderBy: { harvestDate: 'desc' },
    });

    const summary = computeHarvestSummary(records);

    return res.json({ success: true, records, summary, farmId });
  } catch (error) {
    console.error('GET /api/v2/harvest-records/:farmId failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to load harvest records' });
  }
});

// ─── UPDATE ──────────────────────────────────────────────
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const validation = validateUpdate(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error,
        fieldErrors: validation.fieldErrors,
      });
    }

    // Find record and verify ownership through farm
    const existing = await prisma.v2HarvestRecord.findUnique({
      where: { id },
      include: { farm: { select: { userId: true } } },
    });

    if (!existing || existing.farm.userId !== req.user.id) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }

    const updateData = { ...validation.data };
    if (updateData.harvestDate) {
      updateData.harvestDate = new Date(updateData.harvestDate);
    }

    const record = await prisma.v2HarvestRecord.update({
      where: { id },
      data: updateData,
    });

    return res.json({ success: true, record });
  } catch (error) {
    console.error('PATCH /api/v2/harvest-records/:id failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to update harvest record' });
  }
});

// ─── DELETE ──────────────────────────────────────────────
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Find record and verify ownership through farm
    const existing = await prisma.v2HarvestRecord.findUnique({
      where: { id },
      include: { farm: { select: { userId: true } } },
    });

    if (!existing || existing.farm.userId !== req.user.id) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }

    await prisma.v2HarvestRecord.delete({ where: { id } });

    return res.json({ success: true, deleted: true });
  } catch (error) {
    console.error('DELETE /api/v2/harvest-records/:id failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete harvest record' });
  }
});

export default router;
