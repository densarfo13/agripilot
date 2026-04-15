/**
 * Farm Benchmarks Route — GET benchmark summary for a farm.
 *
 * GET /api/v2/farm-benchmarks/:farmId
 *   ?mode=season|year|custom
 *   &currentStart=...&currentEnd=...&previousStart=...&previousEnd=...
 *
 * Ownership enforced: farm must belong to req.user.id.
 * Never trusts client-sent userId.
 */

import express from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/authenticate.js';
import {
  calculateFarmBenchmarks,
  detectBenchmarkInsights,
  validateBenchmarkQuery,
} from '../lib/farmBenchmarking.js';

const router = express.Router();

router.get('/:farmId', authenticate, async (req, res) => {
  try {
    const { farmId } = req.params;

    // Validate query params
    const validation = validateBenchmarkQuery(req.query);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const query = validation.data;

    // Verify farm ownership
    const farm = await prisma.farmProfile.findFirst({
      where: { id: farmId, userId: req.user.id },
      select: { id: true },
    });

    if (!farm) {
      return res.status(404).json({ success: false, error: 'Farm not found' });
    }

    // Fetch all records for the farm (the engine filters by period)
    const [harvestRecords, costRecords] = await Promise.all([
      prisma.v2HarvestRecord.findMany({ where: { farmId } }),
      prisma.v2FarmCostRecord.findMany({ where: { farmId } }),
    ]);

    // Build custom periods if provided
    let currentPeriod = null;
    let previousPeriod = null;
    if (query.currentStart && query.currentEnd && query.previousStart && query.previousEnd) {
      currentPeriod = {
        label: 'Custom current',
        startDate: query.currentStart,
        endDate: query.currentEnd,
      };
      previousPeriod = {
        label: 'Custom previous',
        startDate: query.previousStart,
        endDate: query.previousEnd,
      };
    }

    const benchmark = calculateFarmBenchmarks({
      farmId,
      harvestRecords,
      costRecords,
      currentPeriod,
      previousPeriod,
      mode: query.mode || 'season',
    });

    const insights = detectBenchmarkInsights(benchmark);

    return res.json({
      success: true,
      benchmark,
      insights,
      farmId,
    });
  } catch (error) {
    console.error('GET /api/v2/farm-benchmarks/:farmId failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to compute farm benchmarks' });
  }
});

export default router;
