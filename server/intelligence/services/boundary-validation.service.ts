/**
 * Farm Boundary Validation Service
 *
 * Validates polygon geometry, computes boundary confidence,
 * and gates satellite intelligence on valid boundaries.
 */

// @ts-ignore — JS module
import prisma from '../lib/prisma.js';

const MIN_POINTS = 3;
const MIN_AREA_HECTARES = 0.01;    // ~100 sq meters
const MAX_AREA_HECTARES = 10000;   // sanity check
const MIN_GPS_ACCURACY = 50;       // meters - warn above this
const GOOD_GPS_ACCURACY = 15;      // meters - full confidence

export interface BoundaryValidationResult {
  valid: boolean;
  boundaryConfidence: number;  // 0–100
  validationStatus: 'valid' | 'invalid' | 'needs_redraw';
  validationReason: string | null;
  warnings: string[];
}

/**
 * Validate a farm boundary and compute confidence score.
 */
export async function validateBoundary(boundaryId: string): Promise<BoundaryValidationResult> {
  const boundary = await prisma.v2LandBoundary.findUnique({
    where: { id: boundaryId },
    include: { points: { orderBy: { pointOrder: 'asc' } } },
  });

  if (!boundary) {
    return { valid: false, boundaryConfidence: 0, validationStatus: 'invalid', validationReason: 'Boundary not found', warnings: [] };
  }

  const warnings: string[] = [];
  let confidence = 100;

  // Check point count
  if (boundary.pointCount < MIN_POINTS || boundary.points.length < MIN_POINTS) {
    return {
      valid: false,
      boundaryConfidence: 0,
      validationStatus: 'invalid',
      validationReason: `Too few points (${boundary.points.length}). At least ${MIN_POINTS} required.`,
      warnings: [],
    };
  }

  // Check area
  if (boundary.measuredArea != null) {
    if (boundary.measuredArea < MIN_AREA_HECTARES) {
      return {
        valid: false,
        boundaryConfidence: 0,
        validationStatus: 'needs_redraw',
        validationReason: 'Boundary area is too small. Please redraw your farm boundary.',
        warnings: [],
      };
    }
    if (boundary.measuredArea > MAX_AREA_HECTARES) {
      warnings.push('Boundary area is unusually large. Please verify.');
      confidence -= 20;
    }
  } else {
    warnings.push('Area not calculated. Boundary may be incomplete.');
    confidence -= 15;
  }

  // Check GPS accuracy of points
  const accuracies = boundary.points
    .map((p: any) => p.accuracy)
    .filter((a: number | null): a is number => a != null);

  if (accuracies.length > 0) {
    const avgAccuracy = accuracies.reduce((s: number, a: number) => s + a, 0) / accuracies.length;
    if (avgAccuracy > MIN_GPS_ACCURACY) {
      warnings.push(`GPS accuracy is poor (avg ${Math.round(avgAccuracy)}m). Boundary may be imprecise.`);
      confidence -= 25;
    } else if (avgAccuracy > GOOD_GPS_ACCURACY) {
      confidence -= 10;
    }
  } else {
    // No accuracy data - manual pin entry
    confidence -= 15;
    if (boundary.captureMethod === 'fallback_pin') {
      confidence -= 10;
      warnings.push('Boundary captured via fallback pin. Consider GPS walk for better accuracy.');
    }
  }

  // Check for self-intersection (simplified: check if any point is duplicated)
  const pointSet = new Set(boundary.points.map((p: any) => `${p.latitude.toFixed(6)},${p.longitude.toFixed(6)}`));
  if (pointSet.size < boundary.points.length) {
    warnings.push('Boundary contains duplicate points.');
    confidence -= 10;
  }

  // Capture method bonus
  if (boundary.captureMethod === 'gps_walk') confidence = Math.min(confidence + 5, 100);
  if (boundary.captureMethod === 'officer_assisted') confidence = Math.min(confidence + 3, 100);

  confidence = Math.max(0, Math.min(100, confidence));
  const valid = confidence >= 30;
  const validationStatus = valid ? 'valid' : 'needs_redraw';
  const validationReason = valid ? null : 'Boundary confidence too low. Please redraw.';

  // Persist validation result
  await prisma.v2LandBoundary.update({
    where: { id: boundaryId },
    data: { boundaryConfidence: confidence, validationStatus, validationReason },
  });

  return { valid, boundaryConfidence: confidence, validationStatus, validationReason, warnings };
}

/**
 * Check if a farm has a valid boundary for satellite intelligence.
 * Returns true if boundary is valid, false if missing or invalid.
 */
export async function farmHasValidBoundary(profileId: string): Promise<{ valid: boolean; reason: string | null }> {
  const boundary = await prisma.v2LandBoundary.findFirst({
    where: { profileId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, validationStatus: true, boundaryConfidence: true },
  });

  if (!boundary) {
    return { valid: false, reason: 'No farm boundary on file. Please draw your farm boundary first.' };
  }

  if (boundary.validationStatus === 'invalid' || boundary.validationStatus === 'needs_redraw') {
    return { valid: false, reason: 'Farm boundary needs to be redrawn before satellite analysis can run.' };
  }

  if (boundary.validationStatus === 'pending') {
    // Auto-validate if not yet validated
    const result = await validateBoundary(boundary.id);
    return { valid: result.valid, reason: result.validationReason };
  }

  return { valid: true, reason: null };
}
