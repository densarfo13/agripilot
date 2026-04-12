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
  const hasRealMetadata = metadata?.width != null && metadata?.height != null;

  // Resolution from actual metadata (no generous defaults)
  const width = metadata?.width ?? 0;
  const height = metadata?.height ?? 0;
  const resolutionOk = hasRealMetadata ? (width >= 640 && height >= 480) : false;

  // Blur proxy: higher-resolution images with larger file sizes are likely sharper.
  // Without a vision model, file-size-per-pixel is the best heuristic available.
  let blurScore: number;
  if (hasRealMetadata && metadata?.fileSize) {
    const pixels = width * height;
    const bytesPerPixel = metadata.fileSize / Math.max(pixels, 1);
    // JPEG at 0.8 quality: ~0.3-0.8 bytes/pixel for sharp images, <0.15 for very blurry
    blurScore = Math.min(100, Math.round(bytesPerPixel * 200));
    // Type bonus for leaf closeups (naturally more detail per pixel)
    if (imageType === 'leaf_closeup') blurScore = Math.min(blurScore + 5, 100);
  } else if (hasRealMetadata) {
    // Has dimensions but no file size — derive from resolution
    blurScore = width >= 1200 ? baseScore + 5 : width >= 800 ? baseScore : baseScore - 15;
  } else {
    // No metadata at all — penalize: we can't verify quality
    blurScore = Math.max(baseScore - 20, 25);
  }
  blurScore = Math.max(0, Math.min(100, blurScore));

  // Brightness: without pixel analysis, use a neutral mid-range.
  // Field-wide shots are more likely overexposed (open sky), closeups darker (shadow).
  const brightnessScore = imageType === 'field_wide' ? 65 : 55;

  // Compute composite quality — weight resolution higher when we have real data
  const resWeight = hasRealMetadata ? 0.3 : 0.15;
  const blurWeight = hasRealMetadata ? 0.4 : 0.5;
  const brightWeight = 1 - resWeight - blurWeight;
  let qualityScore = Math.round(
    blurScore * blurWeight + brightnessScore * brightWeight + (resolutionOk ? 80 : 20) * resWeight,
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
