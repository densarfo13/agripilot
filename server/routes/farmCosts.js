/**
 * Farm Cost Records Route — CRUD for expense tracking.
 *
 * POST   /api/v2/farm-costs              — create a cost record
 * GET    /api/v2/farm-costs/:farmId      — list cost records for a farm (+ summary)
 * PATCH  /api/v2/farm-costs/:id          — update a record
 * DELETE /api/v2/farm-costs/:id          — delete a record
 *
 * GET    /api/v2/farm-costs/:farmId/economics — full economics (revenue + costs + profit)
 *
 * Ownership enforced: farm must belong to req.user.id.
 * Never trusts client-sent userId.
 */

import express from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/authenticate.js';
import { validateCreate, validateUpdate, computeCostSummary, computeFarmEconomics } from '../lib/farmCostValidation.js';

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
      return res.status(400).json({ success: false, error: 'Cannot add costs to an archived farm' });
    }

    const record = await prisma.v2FarmCostRecord.create({
      data: {
        farmId,
        ...rest,
        date: new Date(rest.date),
      },
    });

    return res.status(201).json({ success: true, record });
  } catch (error) {
    console.error('POST /api/v2/farm-costs failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to create cost record' });
  }
});

// ─── LIST (per farm, with summary) ───────────────────────
router.get('/:farmId', authenticate, async (req, res) => {
  try {
    const { farmId } = req.params;

    const farm = await prisma.farmProfile.findFirst({
      where: { id: farmId, userId: req.user.id },
      select: { id: true },
    });

    if (!farm) {
      return res.status(404).json({ success: false, error: 'Farm not found' });
    }

    const records = await prisma.v2FarmCostRecord.findMany({
      where: { farmId },
      orderBy: { date: 'desc' },
    });

    const summary = computeCostSummary(records);

    return res.json({ success: true, records, summary, farmId });
  } catch (error) {
    console.error('GET /api/v2/farm-costs/:farmId failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to load cost records' });
  }
});

// ─── ECONOMICS (revenue + costs + profit) ────────────────
router.get('/:farmId/economics', authenticate, async (req, res) => {
  try {
    const { farmId } = req.params;

    const farm = await prisma.farmProfile.findFirst({
      where: { id: farmId, userId: req.user.id },
      select: { id: true },
    });

    if (!farm) {
      return res.status(404).json({ success: false, error: 'Farm not found' });
    }

    const [harvestRecords, costRecords] = await Promise.all([
      prisma.v2HarvestRecord.findMany({ where: { farmId } }),
      prisma.v2FarmCostRecord.findMany({ where: { farmId } }),
    ]);

    const economics = computeFarmEconomics(harvestRecords, costRecords);

    return res.json({ success: true, economics, farmId });
  } catch (error) {
    console.error('GET /api/v2/farm-costs/:farmId/economics failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to compute farm economics' });
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

    const existing = await prisma.v2FarmCostRecord.findUnique({
      where: { id },
      include: { farm: { select: { userId: true } } },
    });

    if (!existing || existing.farm.userId !== req.user.id) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }

    const updateData = { ...validation.data };
    if (updateData.date) {
      updateData.date = new Date(updateData.date);
    }

    const record = await prisma.v2FarmCostRecord.update({
      where: { id },
      data: updateData,
    });

    return res.json({ success: true, record });
  } catch (error) {
    console.error('PATCH /api/v2/farm-costs/:id failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to update cost record' });
  }
});

// ─── DELETE ──────────────────────────────────────────────
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.v2FarmCostRecord.findUnique({
      where: { id },
      include: { farm: { select: { userId: true } } },
    });

    if (!existing || existing.farm.userId !== req.user.id) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }

    await prisma.v2FarmCostRecord.delete({ where: { id } });

    return res.json({ success: true, deleted: true });
  } catch (error) {
    console.error('DELETE /api/v2/farm-costs/:id failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete cost record' });
  }
});

export default router;
