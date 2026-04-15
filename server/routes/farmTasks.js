/**
 * Farm Tasks Route — GET /api/v2/farm-tasks/:id/tasks
 *
 * Generates rules-based tasks for a specific farm.
 * Ownership enforced: farm must belong to req.user.id.
 * No database writes — tasks are computed on-the-fly from rules.
 * Uses crop stage + seasonal timing + weather for accurate recommendations.
 */

import express from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/authenticate.js';
import { generateTasksForFarm } from '../lib/farmTaskEngine.js';
import { resolveStage, CROP_STAGES } from '../lib/cropStages.js';
import { getSeasonalContext } from '../lib/seasonalTiming.js';
import { getWeatherForFarm } from '../lib/weatherProvider.js';
import { generateRisksForFarm } from '../lib/pestRiskEngine.js';
import { generateInputRecommendations } from '../lib/inputTimingEngine.js';
import { generateHarvestRecommendations } from '../lib/harvestEngine.js';
import { calculateFarmBenchmarks, detectBenchmarkInsights } from '../lib/farmBenchmarking.js';

const router = express.Router();

/**
 * GET /:id/tasks
 *
 * Returns generated tasks for a farm based on its crop, stage, farmer type,
 * and seasonal timing.
 * Query params:
 *   ?stage=<override> — override the farm's current stage (optional)
 */
router.get('/:id/tasks', authenticate, async (req, res) => {
  try {
    const farm = await prisma.farmProfile.findFirst({
      where: { id: req.params.id, userId: req.user.id },
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
      return res.json({ success: true, tasks: [], farmId: farm.id, message: 'Archived farms have no active tasks' });
    }

    // Resolve crop stage: query param override → farm.stage → default 'planning'
    const stageParam = req.query.stage;
    let stage;
    if (stageParam && CROP_STAGES.includes(stageParam.toLowerCase())) {
      stage = stageParam.toLowerCase();
    } else {
      stage = resolveStage(farm.stage);
    }

    // Flag whether stage was explicitly set by the farmer
    const stageIsDefault = !farm.stage || farm.stage === 'planning';

    // Build seasonal context from farm's timing data
    const seasonal = getSeasonalContext({
      seasonStartMonth: farm.seasonStartMonth,
      seasonEndMonth: farm.seasonEndMonth,
      plantingWindowStartMonth: farm.plantingWindowStartMonth,
      plantingWindowEndMonth: farm.plantingWindowEndMonth,
      currentSeasonLabel: farm.currentSeasonLabel,
    });

    // Parse crop from stored value (handles "OTHER:CustomName" format)
    let cropName = (farm.crop || '').toLowerCase().trim();
    if (cropName.startsWith('other:')) {
      cropName = cropName.slice(6).trim();
    }

    // Build weather context (non-blocking — tasks still work without weather)
    let weatherCtx = null;
    try {
      const weatherResult = await getWeatherForFarm(farm);
      if (weatherResult?.weather) {
        weatherCtx = { ...weatherResult.weather, hasWeatherData: true };
      }
    } catch (weatherErr) {
      console.error('Weather fetch failed for task generation (non-blocking):', weatherErr.message);
    }

    // Generate pest/disease risks (non-blocking — tasks still work without risks)
    let farmRisks = [];
    try {
      farmRisks = generateRisksForFarm({
        farmId: farm.id,
        crop: cropName,
        stage,
        farmerType: farm.experienceLevel || 'new',
        seasonal,
        weather: weatherCtx,
      });
    } catch (riskErr) {
      console.error('Risk generation failed for task generation (non-blocking):', riskErr.message);
    }

    // Generate input/fertilizer recommendations (non-blocking)
    let farmInputRecs = [];
    try {
      farmInputRecs = generateInputRecommendations({
        farmId: farm.id,
        crop: cropName,
        stage,
        farmerType: farm.experienceLevel || 'new',
        seasonal,
        weather: weatherCtx,
      });
    } catch (inputErr) {
      console.error('Input recommendation generation failed (non-blocking):', inputErr.message);
    }

    // Generate harvest/post-harvest recommendations (non-blocking)
    let farmHarvestRecs = [];
    try {
      farmHarvestRecs = generateHarvestRecommendations({
        farmId: farm.id,
        crop: cropName,
        stage,
        farmerType: farm.experienceLevel || 'new',
        seasonal,
        weather: weatherCtx,
      });
    } catch (harvestErr) {
      console.error('Harvest recommendation generation failed (non-blocking):', harvestErr.message);
    }

    // Check for recent harvest records (non-blocking)
    let hasRecentHarvestRecord = false;
    let hasRevenueData = false;
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentRecords = await prisma.v2HarvestRecord.findMany({
        where: {
          farmId: farm.id,
          harvestDate: { gte: thirtyDaysAgo },
        },
        select: { averageSellingPrice: true, quantitySold: true },
      });
      hasRecentHarvestRecord = recentRecords.length > 0;
      hasRevenueData = recentRecords.some(r => r.averageSellingPrice != null && r.quantitySold != null);
    } catch (recErr) {
      console.error('Harvest record check failed (non-blocking):', recErr.message);
    }

    // Check for cost records (non-blocking)
    let hasCostRecords = false;
    try {
      const costCount = await prisma.v2FarmCostRecord.count({
        where: { farmId: farm.id },
      });
      hasCostRecords = costCount > 0;
    } catch (costErr) {
      console.error('Cost record check failed (non-blocking):', costErr.message);
    }

    // Compute benchmark insights (non-blocking)
    let benchmarkInsights = null;
    try {
      const [allHarvest, allCosts] = await Promise.all([
        prisma.v2HarvestRecord.findMany({ where: { farmId: farm.id } }),
        prisma.v2FarmCostRecord.findMany({ where: { farmId: farm.id } }),
      ]);
      const benchmark = calculateFarmBenchmarks({
        farmId: farm.id,
        harvestRecords: allHarvest,
        costRecords: allCosts,
      });
      benchmarkInsights = detectBenchmarkInsights(benchmark);
    } catch (benchErr) {
      console.error('Benchmark computation failed (non-blocking):', benchErr.message);
    }

    const tasks = generateTasksForFarm({
      farmId: farm.id,
      crop: cropName,
      stage,
      farmerType: farm.experienceLevel || 'new',
      country: farm.country || '',
      location: farm.locationName || '',
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

    // Filter out tasks already completed by this farmer
    let completedTaskIds = new Set();
    try {
      const completions = await prisma.v2FarmTaskCompletion.findMany({
        where: { farmId: farm.id },
        select: { taskId: true },
      });
      completedTaskIds = new Set(completions.map(c => c.taskId));
    } catch (compErr) {
      console.error('Completion fetch failed (non-blocking):', compErr.message);
    }

    const pendingTasks = tasks.filter(t => !completedTaskIds.has(t.id));

    return res.json({
      success: true,
      tasks: pendingTasks,
      allTaskCount: tasks.length,
      completedCount: completedTaskIds.size,
      farmId: farm.id,
      crop: cropName,
      stage,
      stageIsDefault,
      seasonal,
      weather: weatherCtx,
      risks: farmRisks,
      inputRecs: farmInputRecs,
      harvestRecs: farmHarvestRecs,
      farmerType: farm.experienceLevel || 'new',
    });
  } catch (error) {
    console.error('GET /api/v2/farm-tasks/:id/tasks failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to generate farm tasks' });
  }
});

/**
 * POST /:id/tasks/:taskId/complete
 *
 * Marks a farm task as completed. Creates a V2FarmTaskCompletion record.
 * Idempotent: re-completing the same task returns the existing record.
 * Returns the next primary task for immediate refresh.
 */
router.post('/:id/tasks/:taskId/complete', authenticate, async (req, res) => {
  try {
    const farm = await prisma.farmProfile.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      select: { id: true, crop: true, stage: true, experienceLevel: true, status: true,
        latitude: true, longitude: true, country: true, locationName: true,
        seasonStartMonth: true, seasonEndMonth: true,
        plantingWindowStartMonth: true, plantingWindowEndMonth: true,
        currentSeasonLabel: true },
    });

    if (!farm) {
      return res.status(404).json({ success: false, error: 'Farm not found' });
    }

    const taskId = req.params.taskId;
    const { title, priority, actionType, status } = req.body;

    // Extract rule ID from task ID (format: "ruleId-farmId")
    const taskRuleId = taskId.replace(`-${farm.id}`, '');

    // Idempotent upsert — completing same task twice returns existing
    const completion = await prisma.v2FarmTaskCompletion.upsert({
      where: { farmId_taskRuleId: { farmId: farm.id, taskRuleId } },
      update: { status: status || 'completed', completedAt: new Date() },
      create: {
        userId: req.user.id,
        farmId: farm.id,
        taskRuleId,
        taskId,
        title: title || taskRuleId,
        priority: priority || 'medium',
        actionType: actionType || null,
        status: status || 'completed',
      },
    });

    // Generate fresh tasks for next-task refresh
    let nextTask = null;
    try {
      // Resolve context for task regeneration
      const stage = resolveStage(farm.stage);
      const seasonal = getSeasonalContext({
        seasonStartMonth: farm.seasonStartMonth,
        seasonEndMonth: farm.seasonEndMonth,
        plantingWindowStartMonth: farm.plantingWindowStartMonth,
        plantingWindowEndMonth: farm.plantingWindowEndMonth,
        currentSeasonLabel: farm.currentSeasonLabel,
      });
      let cropName = (farm.crop || '').toLowerCase().trim();
      if (cropName.startsWith('other:')) cropName = cropName.slice(6).trim();

      let weatherCtx = null;
      try {
        const wr = await getWeatherForFarm(farm);
        if (wr?.weather) weatherCtx = { ...wr.weather, hasWeatherData: true };
      } catch {}

      const tasks = generateTasksForFarm({
        farmId: farm.id, crop: cropName, stage,
        farmerType: farm.experienceLevel || 'new',
        country: farm.country || '', location: farm.locationName || '',
        seasonal, weather: weatherCtx,
        risks: [], inputRecs: [], harvestRecs: [],
        hasRecentHarvestRecord: false, hasCostRecords: false,
        hasRevenueData: false, benchmarkInsights: null,
      });

      // Get ALL completions for this farm to filter
      const allCompletions = await prisma.v2FarmTaskCompletion.findMany({
        where: { farmId: farm.id },
        select: { taskId: true },
      });
      const doneSet = new Set(allCompletions.map(c => c.taskId));

      const pending = tasks.filter(t => !doneSet.has(t.id));
      nextTask = pending.find(t => t.priority === 'high')
        || pending.find(t => t.priority === 'medium')
        || pending.find(t => t.priority === 'low')
        || pending[0] || null;
    } catch (err) {
      console.error('Next-task generation failed (non-blocking):', err.message);
    }

    return res.status(200).json({
      success: true,
      completion,
      nextTask,
    });
  } catch (error) {
    console.error('POST /api/v2/farm-tasks/:id/tasks/:taskId/complete failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to complete task' });
  }
});

/**
 * GET /stats/completions
 *
 * Admin endpoint: returns task completion counts per farm, scoped to the
 * user's organization. Useful for monitoring farmer engagement.
 */
router.get('/stats/completions', authenticate, async (req, res) => {
  try {
    // Only admins / org-level users
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { role: true, organizationId: true },
    });

    if (!user || !['ADMIN', 'FIELD_OFFICER', 'ORG_ADMIN'].includes(user.role)) {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    // Org-scoped: only farms belonging to users in this org
    const where = user.organizationId
      ? { farm: { user: { organizationId: user.organizationId } } }
      : {};

    const completions = await prisma.v2FarmTaskCompletion.groupBy({
      by: ['farmId'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 100,
    });

    const totalCompletions = await prisma.v2FarmTaskCompletion.count({ where });

    return res.json({
      success: true,
      totalCompletions,
      farmStats: completions.map(c => ({
        farmId: c.farmId,
        completedTasks: c._count.id,
      })),
    });
  } catch (error) {
    console.error('GET /api/v2/farm-tasks/stats/completions failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch completion stats' });
  }
});

export default router;
