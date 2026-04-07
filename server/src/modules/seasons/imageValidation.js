import prisma from '../../config/database.js';
import { getRegionConfig, DEFAULT_COUNTRY_CODE } from '../regionConfig/service.js';
import { isValidFileReference } from '../../utils/uploadHealth.js';

/**
 * Image Validation Service
 *
 * Manages and validates progress images with metadata.
 * This is metadata and timing validation — not computer vision.
 *
 * Validates:
 *   - Image stage tag matches season timing
 *   - Image sequence is chronologically coherent
 *   - Stage coverage across the growing period
 *   - Upload timing vs entry date consistency
 */

const IMAGE_STAGES = ['early_growth', 'mid_stage', 'pre_harvest', 'harvest', 'storage'];

// Maximum progress images per season (prevents upload flooding)
const MAX_IMAGES_PER_SEASON = 50;

// Expected stage timing as fraction of growing period
const STAGE_TIMING = {
  early_growth: { min: 0, max: 0.25 },
  mid_stage: { min: 0.15, max: 0.55 },
  pre_harvest: { min: 0.40, max: 0.80 },
  harvest: { min: 0.60, max: 1.10 },
  storage: { min: 0.75, max: 1.50 },
};

export { IMAGE_STAGES, STAGE_TIMING, MAX_IMAGES_PER_SEASON };

/**
 * Add a progress image entry with metadata validation.
 * Creates a progress entry of type 'activity' with image fields.
 * Returns the entry + any validation warnings (non-blocking).
 */
export async function addProgressImage(seasonId, data) {
  const season = await prisma.farmSeason.findUnique({
    where: { id: seasonId },
    include: { farmer: { select: { countryCode: true } } },
  });

  if (!season) {
    const err = new Error('Season not found');
    err.statusCode = 404;
    throw err;
  }

  if (season.status !== 'active') {
    const err = new Error('Images can only be added to active seasons');
    err.statusCode = 400;
    throw err;
  }

  if (!data.imageUrl) {
    const err = new Error('imageUrl is required');
    err.statusCode = 400;
    throw err;
  }

  // Guard against unlimited image uploads per season
  const existingImageCount = await prisma.seasonProgressEntry.count({
    where: { seasonId, imageUrl: { not: null } },
  });
  if (existingImageCount >= MAX_IMAGES_PER_SEASON) {
    const err = new Error(`Maximum of ${MAX_IMAGES_PER_SEASON} images per season reached`);
    err.statusCode = 400;
    throw err;
  }

  // Validate image URL is safe (no directory traversal, valid format)
  if (!isValidFileReference(data.imageUrl)) {
    const err = new Error('Invalid imageUrl format. Must be an /uploads/ path or https:// URL.');
    err.statusCode = 400;
    throw err;
  }

  const imageStage = data.imageStage || null;
  if (imageStage && !IMAGE_STAGES.includes(imageStage)) {
    const err = new Error(`imageStage must be one of: ${IMAGE_STAGES.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  const entryDate = data.entryDate ? new Date(data.entryDate) : new Date();
  const warnings = [];

  // Validate image stage timing
  if (imageStage) {
    const regionCfg = getRegionConfig(season.farmer?.countryCode || DEFAULT_COUNTRY_CODE);
    const growingDays = regionCfg.cropCalendars?.[season.cropType]?.growingDays || 120;
    const daysSincePlanting = Math.floor(
      (entryDate - new Date(season.plantingDate)) / (1000 * 60 * 60 * 24)
    );
    const fraction = daysSincePlanting / growingDays;
    const expected = STAGE_TIMING[imageStage];

    if (expected && (fraction < expected.min - 0.05 || fraction > expected.max + 0.10)) {
      warnings.push({
        code: 'stage_timing_mismatch',
        message: `Image tagged as '${imageStage}' at day ${daysSincePlanting} of ${growingDays}-day growing period — outside expected window`,
        expected: `${Math.round(expected.min * growingDays)}-${Math.round(expected.max * growingDays)} days`,
        actual: `${daysSincePlanting} days`,
      });
    }
  }

  // Check upload timing vs entry date
  const imageUploadedAt = data.imageUploadedAt ? new Date(data.imageUploadedAt) : new Date();
  const uploadLag = Math.floor((imageUploadedAt - entryDate) / (1000 * 60 * 60 * 24));
  if (uploadLag > 7) {
    warnings.push({
      code: 'upload_lag',
      message: `Image uploaded ${uploadLag} days after the entry date — may be retroactive`,
    });
  }

  // Transaction: create entry + update lastActivityDate atomically
  const entry = await prisma.$transaction(async (tx) => {
    const created = await tx.seasonProgressEntry.create({
      data: {
        seasonId,
        entryType: 'activity',
        activityType: data.activityType || null,
        description: data.description || `Progress image: ${imageStage || 'untagged'}`,
        imageUrl: data.imageUrl,
        imageStage,
        imageUploadedAt,
        imageLatitude: data.latitude ? parseFloat(data.latitude) : null,
        imageLongitude: data.longitude ? parseFloat(data.longitude) : null,
        entryDate,
      },
    });
    await tx.farmSeason.update({
      where: { id: seasonId },
      data: { lastActivityDate: entryDate },
    });
    return created;
  });

  return { entry, warnings };
}

/**
 * Get all progress images for a season with validation metadata.
 */
export async function getProgressImages(seasonId) {
  const season = await prisma.farmSeason.findUnique({
    where: { id: seasonId },
    include: { farmer: { select: { countryCode: true } } },
  });

  if (!season) {
    const err = new Error('Season not found');
    err.statusCode = 404;
    throw err;
  }

  const images = await prisma.seasonProgressEntry.findMany({
    where: { seasonId, imageUrl: { not: null } },
    orderBy: { entryDate: 'asc' },
    select: {
      id: true, imageUrl: true, imageStage: true, imageUploadedAt: true,
      imageLatitude: true, imageLongitude: true, entryDate: true,
      lifecycleStage: true, description: true, createdAt: true,
    },
  });

  // Compute coverage
  const coveredStages = [...new Set(images.map(i => i.imageStage).filter(Boolean))];
  const regionCfg = getRegionConfig(season.farmer?.countryCode || DEFAULT_COUNTRY_CODE);
  const growingDays = regionCfg.cropCalendars?.[season.cropType]?.growingDays || 120;

  // Validate sequence coherence
  const sequenceIssues = [];
  const stagedImages = images.filter(i => i.imageStage);
  for (let i = 1; i < stagedImages.length; i++) {
    const prevIdx = IMAGE_STAGES.indexOf(stagedImages[i - 1].imageStage);
    const currIdx = IMAGE_STAGES.indexOf(stagedImages[i].imageStage);
    if (currIdx >= 0 && prevIdx >= 0 && currIdx < prevIdx) {
      sequenceIssues.push({
        code: 'stage_regression',
        from: stagedImages[i - 1].imageStage,
        to: stagedImages[i].imageStage,
        fromDate: stagedImages[i - 1].entryDate,
        toDate: stagedImages[i].entryDate,
      });
    }
  }

  return {
    seasonId,
    cropType: season.cropType,
    growingDays,
    images,
    coverage: {
      totalImages: images.length,
      coveredStages,
      missingStages: IMAGE_STAGES.filter(s => !coveredStages.includes(s)),
      coverageRate: Math.round((coveredStages.length / IMAGE_STAGES.length) * 100),
    },
    sequenceIssues,
  };
}
