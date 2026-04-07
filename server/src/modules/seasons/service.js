import prisma from '../../config/database.js';
import { getCropCalendar, getRegionConfig, DEFAULT_COUNTRY_CODE } from '../regionConfig/service.js';
import { STAGE_ORDER } from '../lifecycle/service.js';
import { generateCropLifecycleReminders } from '../reminders/service.js';
import { isValidFileReference } from '../../utils/uploadHealth.js';

/**
 * Farm Season Service
 *
 * Manages farming cycles (seasons) and progress tracking.
 * A season represents one crop cycle from planting to harvest.
 *
 * Integrates with:
 * - regionConfig: crop calendars, expected harvest dates
 * - lifecycle: stage ordering
 * - reminders: auto-generated lifecycle reminders on season creation
 */

// ─── Season CRUD ────────────────────────────────────────

export async function createSeason(farmerId, data) {
  const farmer = await prisma.farmer.findUnique({ where: { id: farmerId } });
  if (!farmer) {
    const err = new Error('Farmer not found');
    err.statusCode = 404;
    throw err;
  }

  if (!data.cropType || !data.plantingDate || !data.farmSizeAcres) {
    const err = new Error('cropType, plantingDate, and farmSizeAcres are required');
    err.statusCode = 400;
    throw err;
  }

  // Check for existing active season with same crop
  const existingActive = await prisma.farmSeason.findFirst({
    where: { farmerId, status: 'active', cropType: data.cropType },
  });
  if (existingActive) {
    const err = new Error(`An active season for ${data.cropType} already exists. Complete or abandon it first.`);
    err.statusCode = 409;
    throw err;
  }

  const plantingDate = new Date(data.plantingDate);
  if (isNaN(plantingDate.getTime())) {
    const err = new Error('Invalid plantingDate');
    err.statusCode = 400;
    throw err;
  }

  // Validate planting date is within reasonable bounds
  const now = new Date();
  const maxFutureDays = 365; // 1 year ahead
  const maxPastDays = 730;   // 2 years back
  const daysDiff = Math.floor((plantingDate - now) / (1000 * 60 * 60 * 24));
  if (daysDiff > maxFutureDays) {
    const err = new Error(`Planting date cannot be more than ${maxFutureDays} days in the future`);
    err.statusCode = 400;
    throw err;
  }
  if (daysDiff < -maxPastDays) {
    const err = new Error(`Planting date cannot be more than ${maxPastDays} days in the past`);
    err.statusCode = 400;
    throw err;
  }

  // Compute expected harvest date from crop calendar
  const countryCode = farmer.countryCode || DEFAULT_COUNTRY_CODE;
  const calendar = getCropCalendar(countryCode, data.cropType);
  let expectedHarvestDate = null;
  if (calendar && calendar.growingDays) {
    expectedHarvestDate = new Date(plantingDate);
    expectedHarvestDate.setDate(expectedHarvestDate.getDate() + calendar.growingDays);
  }

  const regionCfg = getRegionConfig(countryCode);

  const season = await prisma.farmSeason.create({
    data: {
      farmerId,
      cropType: data.cropType,
      farmSizeAcres: parseFloat(data.farmSizeAcres),
      areaUnit: data.areaUnit || regionCfg.areaUnit || 'acres',
      seedQuantity: data.seedQuantity ? parseFloat(data.seedQuantity) : null,
      seedType: data.seedType || null,
      plantingDate,
      expectedHarvestDate,
      declaredIntent: data.declaredIntent || null,
      status: 'active',
    },
    include: { farmer: { select: { id: true, fullName: true, countryCode: true } } },
  });

  // Auto-generate lifecycle reminders for this season
  try {
    await generateCropLifecycleReminders(farmerId, data.cropType, plantingDate);
  } catch (e) {
    console.error('Failed to generate season reminders:', e.message);
  }

  return season;
}

export async function listSeasons(farmerId, filters = {}) {
  const where = { farmerId };
  if (filters.status) where.status = filters.status;
  if (filters.cropType) where.cropType = filters.cropType;

  // Paginate with sensible defaults (most farmers have <20 seasons)
  const page = Math.max(1, parseInt(filters.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(filters.limit) || 50));

  const [seasons, total] = await Promise.all([
    prisma.farmSeason.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        harvestReport: { select: { id: true, totalHarvestKg: true, yieldPerAcre: true } },
        progressScore: { select: { progressScore: true, performanceClassification: true } },
        _count: { select: { progressEntries: true, stageConfirmations: true } },
      },
    }),
    prisma.farmSeason.count({ where }),
  ]);

  return { seasons, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getSeasonById(id) {
  const season = await prisma.farmSeason.findUnique({
    where: { id },
    include: {
      farmer: { select: { id: true, fullName: true, countryCode: true, region: true, primaryCrop: true } },
      harvestReport: true,
      progressScore: true,
      _count: { select: { progressEntries: true, stageConfirmations: true } },
    },
  });
  if (!season) {
    const err = new Error('Season not found');
    err.statusCode = 404;
    throw err;
  }
  return season;
}

export async function updateSeason(id, data) {
  const season = await prisma.farmSeason.findUnique({ where: { id } });
  if (!season) {
    const err = new Error('Season not found');
    err.statusCode = 404;
    throw err;
  }

  // Only active seasons can be edited (harvested/completed/abandoned/failed are locked)
  const NON_EDITABLE = ['completed', 'harvested', 'abandoned', 'failed'];
  if (NON_EDITABLE.includes(season.status)) {
    const err = new Error(`Cannot update a season with status '${season.status}'. Reopen it first if corrections are needed.`);
    err.statusCode = 400;
    throw err;
  }

  const updateData = {};
  if (data.seedQuantity !== undefined) updateData.seedQuantity = data.seedQuantity ? parseFloat(data.seedQuantity) : null;
  if (data.seedType !== undefined) updateData.seedType = data.seedType;
  if (data.declaredIntent !== undefined) updateData.declaredIntent = data.declaredIntent;
  if (data.cropFailureReported !== undefined) updateData.cropFailureReported = !!data.cropFailureReported;
  if (data.partialHarvest !== undefined) updateData.partialHarvest = !!data.partialHarvest;

  // Status changes MUST go through transitionSeasonStatus — block direct status edits
  if (data.status && data.status !== season.status) {
    const err = new Error('Status changes must use the dedicated status transition endpoints (e.g., /abandon, /close, /reopen)');
    err.statusCode = 400;
    throw err;
  }

  return prisma.farmSeason.update({
    where: { id },
    data: updateData,
    include: { farmer: { select: { id: true, fullName: true } } },
  });
}

// ─── Progress Entries ───────────────────────────────────

export async function createProgressEntry(seasonId, data) {
  const season = await prisma.farmSeason.findUnique({ where: { id: seasonId } });
  if (!season) {
    const err = new Error('Season not found');
    err.statusCode = 404;
    throw err;
  }
  if (season.status !== 'active') {
    const err = new Error('Can only add progress to active seasons');
    err.statusCode = 400;
    throw err;
  }

  const entryType = data.entryType || 'activity';
  const validTypes = ['activity', 'condition', 'advice'];
  if (!validTypes.includes(entryType)) {
    const err = new Error(`entryType must be one of: ${validTypes.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  // Validate imageUrl if provided (prevent directory traversal)
  if (data.imageUrl && !isValidFileReference(data.imageUrl)) {
    const err = new Error('Invalid imageUrl format. Must be an /uploads/ path or https:// URL.');
    err.statusCode = 400;
    throw err;
  }

  // Determine lifecycle stage based on time since planting
  const lifecycleStage = data.lifecycleStage || computeExpectedStage(season.plantingDate, season.cropType, season.farmer?.countryCode);

  const entryDate = data.entryDate ? new Date(data.entryDate) : new Date();

  // Transaction: create entry + update lastActivityDate atomically
  const entry = await prisma.$transaction(async (tx) => {
    const created = await tx.seasonProgressEntry.create({
      data: {
        seasonId,
        entryType,
        activityType: data.activityType || null,
        description: data.description || null,
        quantity: data.quantity ? parseFloat(data.quantity) : null,
        unit: data.unit || null,
        cropCondition: data.cropCondition || null,
        conditionNotes: data.conditionNotes || null,
        followedAdvice: data.followedAdvice || null,
        adviceNotes: data.adviceNotes || null,
        imageUrl: data.imageUrl || null,
        imageStage: data.imageStage || null,
        imageUploadedAt: data.imageUrl ? new Date() : null,
        imageLatitude: data.imageLatitude ? parseFloat(data.imageLatitude) : null,
        imageLongitude: data.imageLongitude ? parseFloat(data.imageLongitude) : null,
        lifecycleStage,
        entryDate,
      },
    });
    await tx.farmSeason.update({
      where: { id: seasonId },
      data: { lastActivityDate: entryDate },
    });
    return created;
  });

  return entry;
}

export async function listProgressEntries(seasonId, filters = {}) {
  const where = { seasonId };
  if (filters.entryType) where.entryType = filters.entryType;

  return prisma.seasonProgressEntry.findMany({
    where,
    orderBy: { entryDate: 'desc' },
  });
}

// ─── Crop Condition (convenience for condition entries) ──

export async function createConditionUpdate(seasonId, data) {
  if (!data.cropCondition) {
    const err = new Error('cropCondition is required (good, average, poor)');
    err.statusCode = 400;
    throw err;
  }
  return createProgressEntry(seasonId, {
    entryType: 'condition',
    cropCondition: data.cropCondition,
    conditionNotes: data.conditionNotes || null,
    imageUrl: data.imageUrl || null,
    imageStage: data.imageStage || null,
    entryDate: data.entryDate,
  });
}

// ─── Stage Confirmation ─────────────────────────────────

export async function createStageConfirmation(seasonId, data) {
  const season = await prisma.farmSeason.findUnique({
    where: { id: seasonId },
    include: { farmer: { select: { countryCode: true } } },
  });
  if (!season) {
    const err = new Error('Season not found');
    err.statusCode = 404;
    throw err;
  }

  const expectedStage = computeExpectedStage(season.plantingDate, season.cropType, season.farmer?.countryCode);
  const confirmedStage = data.confirmedStage;

  if (!confirmedStage || !STAGE_ORDER.includes(confirmedStage)) {
    const err = new Error(`confirmedStage is required and must be one of: ${STAGE_ORDER.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  const isMismatch = expectedStage !== confirmedStage;

  return prisma.stageConfirmation.create({
    data: {
      seasonId,
      expectedStage,
      confirmedStage,
      isMismatch,
      note: data.note || null,
    },
  });
}

export async function listStageConfirmations(seasonId) {
  return prisma.stageConfirmation.findMany({
    where: { seasonId },
    orderBy: { createdAt: 'desc' },
  });
}

// ─── Expected Stage Computation ─────────────────────────

/**
 * Compute the expected lifecycle stage based on days since planting
 * and the crop calendar for the farmer's country.
 *
 * Uses a simple rule-based mapping:
 *   0-14 days   → planting (germination)
 *   15-45 days  → vegetative
 *   46-75 days  → flowering (scaled by growingDays)
 *   76-growDays → harvest
 *   >growDays   → post_harvest
 *
 * Ratios are scaled to the crop's growingDays.
 */
export function computeExpectedStage(plantingDate, cropType, countryCode) {
  const planting = new Date(plantingDate);
  const now = new Date();
  const daysSincePlanting = Math.floor((now - planting) / (1000 * 60 * 60 * 24));

  if (daysSincePlanting < 0) return 'pre_planting';

  const calendar = getCropCalendar(countryCode || DEFAULT_COUNTRY_CODE, cropType);
  const growingDays = calendar?.growingDays || 120; // default 120 days

  // Stage boundaries as fraction of total growing period
  const stages = [
    { stage: 'planting', endFraction: 0.12 },       // ~first 12%
    { stage: 'vegetative', endFraction: 0.38 },      // ~12-38%
    { stage: 'flowering', endFraction: 0.62 },        // ~38-62%
    { stage: 'harvest', endFraction: 1.0 },           // ~62-100%
  ];

  const fraction = daysSincePlanting / growingDays;

  if (fraction > 1.1) return 'post_harvest'; // >110% of growing period

  for (const s of stages) {
    if (fraction <= s.endFraction) return s.stage;
  }

  return 'harvest';
}

/**
 * Get the full expected timeline for a season.
 * Returns an array of { stage, expectedStartDate, expectedEndDate, durationDays }.
 */
export function getExpectedTimeline(plantingDate, cropType, countryCode) {
  const planting = new Date(plantingDate);
  const calendar = getCropCalendar(countryCode || DEFAULT_COUNTRY_CODE, cropType);
  const growingDays = calendar?.growingDays || 120;

  const stageFractions = [
    { stage: 'planting', start: 0, end: 0.12 },
    { stage: 'vegetative', start: 0.12, end: 0.38 },
    { stage: 'flowering', start: 0.38, end: 0.62 },
    { stage: 'harvest', start: 0.62, end: 1.0 },
    { stage: 'post_harvest', start: 1.0, end: 1.2 },
  ];

  return stageFractions.map(sf => {
    const startDay = Math.round(sf.start * growingDays);
    const endDay = Math.round(sf.end * growingDays);
    const startDate = new Date(planting);
    startDate.setDate(startDate.getDate() + startDay);
    const endDate = new Date(planting);
    endDate.setDate(endDate.getDate() + endDay);

    return {
      stage: sf.stage,
      expectedStartDate: startDate.toISOString().split('T')[0],
      expectedEndDate: endDate.toISOString().split('T')[0],
      durationDays: endDay - startDay,
      startDay,
      endDay,
    };
  });
}

// ─── Helper: get season with farmer for ownership checks ─

export async function getSeasonFarmerId(seasonId) {
  const season = await prisma.farmSeason.findUnique({
    where: { id: seasonId },
    select: { farmerId: true },
  });
  return season?.farmerId || null;
}
