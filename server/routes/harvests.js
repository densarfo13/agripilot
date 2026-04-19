/**
 * harvests.js — farmer harvest reporting with validation + dedup.
 *
 *   POST /api/v2/harvests            — create a harvest report
 *   GET  /api/v2/harvests/my         — current farmer's harvests
 *
 * Validation lives in services/harvests/harvestValidation.js so the
 * rules can be unit-tested without spinning up Prisma.
 *
 * Dedupe logic:
 *   - If the payload carries cropCycleId, enforce one harvest per
 *     cycle (DB unique index provides the hard guarantee).
 *   - If the payload carries idempotencyKey, we short-circuit if an
 *     existing row with the same key already exists.
 */
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/authenticate.js';
import { requireAuth } from '../middleware/rbac.js';
import { validateHarvestPayload } from '../src/services/harvests/harvestValidation.js';

const prisma = new PrismaClient();
const router = express.Router();

const FARMER_SCOPE = [authenticate, requireAuth];

router.post('/', ...FARMER_SCOPE, express.json(), async (req, res) => {
  const v = validateHarvestPayload(req.body || {});
  if (!v.ok) return res.status(400).json({ error: v.error });
  const { data } = v;

  // Resolve target farm: explicit farmProfileId or the user's default.
  const farmProfileId = typeof req.body?.farmProfileId === 'string'
    ? req.body.farmProfileId : null;
  let farm = null;
  if (farmProfileId) {
    farm = await prisma.farmProfile.findFirst({
      where: { id: farmProfileId, userId: req.user.id },
      select: { id: true },
    });
  } else {
    farm = await prisma.farmProfile.findFirst({
      where: { userId: req.user.id, status: 'active', isDefault: true },
      select: { id: true },
    });
  }
  if (!farm) return res.status(404).json({ error: 'farm_not_found' });

  // If a cropCycleId was supplied, verify ownership and that it
  // hasn't already been harvested (the DB unique index backs this up).
  if (data.cropCycleId) {
    const cycle = await prisma.v2CropCycle.findUnique({
      where: { id: data.cropCycleId },
      select: { id: true, profileId: true, lifecycleStatus: true },
    });
    if (!cycle) return res.status(404).json({ error: 'cycle_not_found' });
    if (cycle.profileId !== farm.id) return res.status(403).json({ error: 'cycle_not_on_farm' });
    const existing = await prisma.v2HarvestRecord.findFirst({
      where: { cropCycleId: data.cropCycleId },
      select: { id: true },
    });
    if (existing) return res.status(409).json({ error: 'duplicate_harvest_for_cycle' });
  }

  const idempotencyKey = typeof req.body?.idempotencyKey === 'string'
    ? req.body.idempotencyKey : null;
  if (idempotencyKey) {
    const dup = await prisma.v2HarvestRecord.findFirst({
      where: { idempotencyKey, farmId: farm.id },
      select: { id: true },
    });
    if (dup) return res.json({ record: { id: dup.id }, deduped: true });
  }

  try {
    const record = await prisma.v2HarvestRecord.create({
      data: {
        farmId: farm.id,
        cropCycleId: data.cropCycleId,
        cropId: data.cropId,
        cropLabel: data.cropLabel,
        harvestDate: data.harvestDate,
        quantityHarvested: data.quantityHarvested,
        quantityUnit: data.quantityUnit,
        quantityLost: data.quantityLost,
        quantitySold: data.quantitySold,
        quantityStored: data.quantityStored,
        qualityGrade: data.qualityGrade,
        notes: data.notes,
        idempotencyKey,
      },
    });

    // If the harvest ties to a cycle, advance it to harvested.
    // Non-fatal: the harvest row is still valid even if the cycle
    // update fails (schema mismatch in a stale build, race, etc.).
    if (data.cropCycleId) {
      try {
        await prisma.v2CropCycle.update({
          where: { id: data.cropCycleId },
          data: { lifecycleStatus: 'harvested' },
        });
      } catch (err) {
        console.warn('[harvests] could not advance cycle status', err?.message);
      }
    }
    res.status(201).json({ record });
  } catch (err) {
    // Prisma P2002 on the cropCycleId unique index — race with another
    // request. Return 409 rather than 500.
    if (err?.code === 'P2002') return res.status(409).json({ error: 'duplicate_harvest_for_cycle' });
    console.error('[harvests] create failed', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

router.get('/my', ...FARMER_SCOPE, async (req, res) => {
  const farms = await prisma.farmProfile.findMany({
    where: { userId: req.user.id }, select: { id: true },
  });
  const farmIds = farms.map((f) => f.id);
  if (!farmIds.length) return res.json({ harvests: [] });
  const harvests = await prisma.v2HarvestRecord.findMany({
    where: { farmId: { in: farmIds } },
    orderBy: { harvestDate: 'desc' },
    take: 100,
  });
  res.json({ harvests });
});

export default router;
