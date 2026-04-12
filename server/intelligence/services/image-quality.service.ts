/**
 * Image Quality Enforcement Service
 *
 * Validates uploaded crop images for blur, brightness, and resolution
 * before allowing pest analysis to proceed.
 */

// @ts-ignore — JS module
import prisma from '../lib/prisma.js';

// ── Thresholds ──

const MIN_BLUR_SCORE = 35;       // below = too blurry
const MIN_BRIGHTNESS = 20;       // below = too dark
const MAX_BRIGHTNESS = 90;       // above = overexposed
const MIN_QUALITY_OVERALL = 40;  // below = reject

// Required image types for a complete analysis set
export const REQUIRED_IMAGE_TYPES = ['leaf_closeup', 'whole_plant', 'field_wide'] as const;

// Quality baseline by image type (leaf closeups are most diagnostic)
const TYPE_QUALITY_BASE: Record<string, number> = {
  leaf_closeup: 85,
  whole_plant: 78,
  field_wide: 72,
  hotspot_photo: 80,
  followup: 75,
};

// ── Quality assessment result ──

export interface ImageQualityResult {
  qualityScore: number;
  blurScore: number;
  brightnessScore: number;
  resolutionOk: boolean;
  qualityPassed: boolean;
  rejectionReason: string | null;
  qualityNotes: string | null;
}

/**
 * Assess image quality from available metadata.
 * In production this would call a vision model; here we use deterministic
 * scoring from image type + metadata hints (width, fileSize, etc.).
 */
export function assessImageQuality(
  imageType: string,
  metadata?: { width?: number; height?: number; fileSize?: number },
): ImageQualityResult {
  const baseScore = TYPE_QUALITY_BASE[imageType] || 70;

  // Simulate blur scoring: leaf closeups penalized less for natural variation
  const blurScore = imageType === 'leaf_closeup'
    ? Math.min(baseScore + 5, 95)
    : baseScore;

  // Brightness: derive from type (field_wide tends toward overexposure)
  const brightnessScore = imageType === 'field_wide' ? 65 : 55;

  // Resolution check from metadata if available
  const width = metadata?.width ?? 1200;
  const height = metadata?.height ?? 900;
  const resolutionOk = width >= 640 && height >= 480;

  // Compute composite quality
  let qualityScore = Math.round(
    blurScore * 0.4 + brightnessScore * 0.3 + (resolutionOk ? 80 : 20) * 0.3,
  );
  qualityScore = Math.max(0, Math.min(100, qualityScore));

  // Determine pass/fail and reason
  let rejectionReason: string | null = null;
  let qualityPassed = true;

  if (blurScore < MIN_BLUR_SCORE) {
    rejectionReason = 'too_blurry';
    qualityPassed = false;
  } else if (brightnessScore < MIN_BRIGHTNESS) {
    rejectionReason = 'too_dark';
    qualityPassed = false;
  } else if (brightnessScore > MAX_BRIGHTNESS) {
    rejectionReason = 'too_bright';
    qualityPassed = false;
  } else if (!resolutionOk) {
    rejectionReason = 'low_resolution';
    qualityPassed = false;
  } else if (qualityScore < MIN_QUALITY_OVERALL) {
    rejectionReason = 'quality_too_low';
    qualityPassed = false;
  }

  const qualityNotes = rejectionReason
    ? REJECTION_MESSAGES[rejectionReason] || 'Image quality below threshold'
    : null;

  return { qualityScore, blurScore, brightnessScore, resolutionOk, qualityPassed, rejectionReason, qualityNotes };
}

// User-friendly error messages
const REJECTION_MESSAGES: Record<string, string> = {
  too_blurry: 'Image is too blurry. Please hold your phone steady and retake the photo.',
  too_dark: 'Image is too dark. Please move to a well-lit area and retake.',
  too_bright: 'Image is overexposed. Please avoid direct sunlight on the lens.',
  low_resolution: 'Image resolution is too low. Please take a closer, higher-quality photo.',
  quality_too_low: 'Image quality is below the minimum. Please retake the photo.',
};

export function getRejectionMessage(reason: string): string {
  return REJECTION_MESSAGES[reason] || 'Please retake photo';
}

/**
 * Check whether a profile has all 3 required image types uploaded (with passing quality).
 */
export async function checkImageCompleteness(profileId: string, imageIds: string[]): Promise<{
  complete: boolean;
  missing: string[];
  failedQuality: string[];
}> {
  const images = await prisma.v2PestImage.findMany({
    where: { id: { in: imageIds } },
    select: { imageType: true, qualityPassed: true, rejectionReason: true },
  });

  const passedTypes = new Set(
    images.filter((i: any) => i.qualityPassed !== false).map((i: any) => i.imageType),
  );

  const missing = REQUIRED_IMAGE_TYPES.filter(t => !passedTypes.has(t));
  const failedQuality = images
    .filter((i: any) => i.qualityPassed === false)
    .map((i: any) => `${i.imageType}: ${getRejectionMessage(i.rejectionReason || 'quality_too_low')}`);

  return { complete: missing.length === 0, missing: [...missing], failedQuality };
}
