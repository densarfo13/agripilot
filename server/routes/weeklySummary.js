/**
 * Weekly Summary Route — GET /api/v2/weekly-summary/:farmId
 *
 * Generates a farm-specific weekly decision digest by aggregating
 * all existing farm intelligence: tasks, weather, risks, inputs,
 * harvest, economics, benchmarks.
 *
 * Ownership enforced: farm must belong to req.user.id.
 * Never trusts client-sent userId.
 * No database writes — digest is computed on-the-fly.
 */

import express from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/authenticate.js';
import { generateTasksForFarm } from '../lib/farmTaskEngine.js';
import { resolveStage } from '../lib/cropStages.js';
import { getSeasonalContext } from '../lib/seasonalTiming.js';
import { getWeatherForFarm } from '../lib/weatherProvider.js';
import { generateRisksForFarm } from '../lib/pestRiskEngine.js';
import { generateInputRecommendations } from '../lib/inputTimingEngine.js';
import { generateHarvestRecommendations } from '../lib/harvestEngine.js';
import { calculateFarmBenchmarks, detectBenchmarkInsights } from '../lib/farmBenchmarking.js';
import { computeFarmEconomics } from '../lib/farmCostValidation.js';
import { computeHarvestSummary } from '../lib/harvestRecordValidation.js';
import { generateWeeklySummary } from '../lib/weeklySummary.js';

const router = express.Router();

router.get('/:farmId', authenticate, async (req, res) => {
  try {
    const { farmId } = req.params;

    // Verify farm ownership
    const farm = await prisma.farmProfile.findFirst({
      where: { id: farmId, userId: req.user.id },
      select: {
        id: true,
        crop: true,
        stage: true,
        experienceLevel: true,
        status: true,
        latitude: true,
        longitude: true,
        country: true,
        locationName: true,
        seasonStartMonth: true,
        seasonEndMonth: true,
        plantingWindowStartMonth: true,
        plantingWindowEndMonth: true,
        currentSeasonLabel: true,
      },
    });

    if (!farm) {
      return res.status(404).json({ success: false, error: 'Farm not found' });
    }

    if (farm.status === 'archived') {
      return res.json({
        success: true,
        summary: {
          farmId: farm.id,
          headline: 'This farm is archived.',
          priorities: [],
          risks: [],
          inputNotes: [],
          harvestNotes: [],
          economicsNote: null,
          nextSteps: [],
          missingData: [],
          generatedAt: new Date().toISOString(),
        },
      });
    }

    // Resolve crop stage
    const stage = resolveStage(farm.stage);

    // Parse crop
    let cropName = (farm.crop || '').toLowerCase().trim();
    if (cropName.startsWith('other:')) {
      cropName = cropName.slice(6).trim();
    }

    const farmerType = farm.experienceLevel || 'new';

    // Build seasonal context
    const seasonal = getSeasonalContext({
      seasonStartMonth: farm.seasonStartMonth,
      seasonEndMonth: farm.seasonEndMonth,
      plantingWindowStartMonth: farm.plantingWindowStartMonth,
      plantingWindowEndMonth: farm.plantingWindowEndMonth,
      currentSeasonLabel: farm.currentSeasonLabel,
    });

    // ─── Non-blocking enrichments (same pattern as farmTasks route) ───

    // Weather
    let weatherCtx = null;
    try {
      const weatherResult = await getWeatherForFarm(farm);
      if (weatherResult?.weather) {
        weatherCtx = { ...weatherResult.weather, hasWeatherData: true };
      }
    } catch (e) {
      console.error('Weekly summary: weather fetch failed (non-blocking):', e.message);
    }

    // Pest/disease risks
    let farmRisks = [];
    try {
      farmRisks = generateRisksForFarm({
        farmId: farm.id, crop: cropName, stage, farmerType, seasonal, weather: weatherCtx,
      });
    } catch (e) {
      console.error('Weekly summary: risk generation failed (non-blocking):', e.message);
    }

    // Input recommendations
    let farmInputRecs = [];
    try {
      farmInputRecs = generateInputRecommendations({
        farmId: farm.id, crop: cropName, stage, farmerType, seasonal, weather: weatherCtx,
      });
    } catch (e) {
      console.error('Weekly summary: input rec generation failed (non-blocking):', e.message);
    }

    // Harvest recommendations
    let farmHarvestRecs = [];
    try {
      farmHarvestRecs = generateHarvestRecommendations({
        farmId: farm.id, crop: cropName, stage, farmerType, seasonal, weather: weatherCtx,
      });
    } catch (e) {
      console.error('Weekly summary: harvest rec generation failed (non-blocking):', e.message);
    }

    // Recent harvest records + revenue data
    let hasRecentHarvestRecord = false;
    let hasRevenueData = false;
    let allHarvestRecords = [];
    try {
      allHarvestRecords = await prisma.v2HarvestRecord.findMany({
        where: { farmId: farm.id },
      });
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentRecords = allHarvestRecords.filter(
        r => new Date(r.harvestDate) >= thirtyDaysAgo
      );
      hasRecentHarvestRecord = recentRecords.length > 0;
      hasRevenueData = recentRecords.some(
        r => r.averageSellingPrice != null && r.quantitySold != null
      );
    } catch (e) {
      console.error('Weekly summary: harvest record check failed (non-blocking):', e.message);
    }

    // Cost records
    let hasCostRecords = false;
    let allCostRecords = [];
    try {
      allCostRecords = await prisma.v2FarmCostRecord.findMany({
        where: { farmId: farm.id },
      });
      hasCostRecords = allCostRecords.length > 0;
    } catch (e) {
      console.error('Weekly summary: cost record check failed (non-blocking):', e.message);
    }

    // Economics
    let economics = null;
    try {
      if (allHarvestRecords.length > 0 || allCostRecords.length > 0) {
        economics = computeFarmEconomics(allHarvestRecords, allCostRecords);
      }
    } catch (e) {
      console.error('Weekly summary: economics computation failed (non-blocking):', e.message);
    }

    // Harvest summary
    let harvestSummary = null;
    try {
      if (allHarvestRecords.length > 0) {
        harvestSummary = computeHarvestSummary(allHarvestRecords);
      }
    } catch (e) {
      console.error('Weekly summary: harvest summary failed (non-blocking):', e.message);
    }

    // Benchmarks
    let benchmarkInsights = null;
    let benchmark = null;
    try {
      const benchmarkResult = calculateFarmBenchmarks({
        farmId: farm.id,
        harvestRecords: allHarvestRecords,
        costRecords: allCostRecords,
      });
      benchmark = benchmarkResult;
      benchmarkInsights = detectBenchmarkInsights(benchmarkResult);
    } catch (e) {
      console.error('Weekly summary: benchmark computation failed (non-blocking):', e.message);
    }

    // Generate tasks (these feed into the summary priorities)
    let tasks = [];
    try {
      tasks = generateTasksForFarm({
        farmId: farm.id,
        crop: cropName,
        stage,
        farmerType,
        seasonal,
        weather: weatherCtx,
        risks: farmRisks,
        inputRecs: farmInputRecs,
        harvestRecs: farmHarvestRecs,
        hasRecentHarvestRecord,
        hasCostRecords,
        hasRevenueData,
        benchmarkInsights,
      });
    } catch (e) {
      console.error('Weekly summary: task generation failed (non-blocking):', e.message);
    }

    // ─── Generate the weekly summary ─────────────────────

    const summary = generateWeeklySummary({
      farmId: farm.id,
      crop: cropName,
      stage,
      farmerType,
      seasonal,
      weather: weatherCtx,
      risks: farmRisks,
      inputRecs: farmInputRecs,
      harvestRecs: farmHarvestRecs,
      tasks,
      hasRecentHarvestRecord,
      hasCostRecords,
      hasRevenueData,
      benchmarkInsights,
      benchmark,
      economics,
      harvestSummary,
    });

    return res.json({
      success: true,
      summary,
      farmId: farm.id,
      crop: cropName,
      stage,
    });
  } catch (error) {
    console.error('GET /api/v2/weekly-summary/:farmId failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to generate weekly summary' });
  }
});

export default router;
