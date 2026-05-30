/**
 * src/runtime/intelligence/oodaContracts.ts — Frozen contracts
 * for the OODA Engine + spec-aligned envelope shape.
 *
 *   import {
 *     OODA_RUNTIME_VERSION, CONFIDENCE_BANDS, RISK_LEVELS,
 *     SCAN_CATEGORIES, SAFE_WORDS, BANNED_WORDS,
 *     normalizedConfidenceLabel,
 *   } from 'src/runtime/intelligence/oodaContracts';
 *
 * Strict-rule audit
 *   • Pure data. No engine imports. SSR-safe.
 *   • Centralises the wording / banding / category contracts
 *     so the gate AND the runtime both read the same source
 *     of truth.
 */

export const OODA_RUNTIME_VERSION = 'farroway-ooda-runtime-v1';

/** Confidence bands per spec §4.
 *  >= 0.75 → normal · 0.45-0.74 → needs review · < 0.45 → unknown.
 */
export const CONFIDENCE_BANDS = Object.freeze({
  NORMAL_MIN:        0.75,
  NEEDS_REVIEW_MIN:  0.45,
  UNKNOWN_MAX:       0.45,
});

export const RISK_LEVELS = Object.freeze(['high', 'medium', 'low', 'unknown'] as const);
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const CONFIDENCE_LABELS = Object.freeze(['high', 'medium', 'low', 'unknown'] as const);
export type ConfidenceLabel = (typeof CONFIDENCE_LABELS)[number];

/** Normalised scan categories per spec §4 enum. */
export const SCAN_CATEGORIES = Object.freeze([
  'plant', 'crop', 'flower', 'vegetable', 'fruit',
  'herb', 'houseplant', 'tree', 'weed', 'disease',
  'pest', 'nutrient_deficiency', 'unknown',
] as const);
export type ScanCategory = (typeof SCAN_CATEGORIES)[number];

/** Grower-safe wording. Recommendations MUST use these only. */
export const SAFE_WORDS = Object.freeze([
  'likely', 'possible', 'needs review', 'recommended',
  'monitor', 'expected', 'observed',
]);

/** Banned wording — never surfaces in grower-facing copy. */
export const BANNED_WORDS = Object.freeze([
  'guaranteed', 'confirmed', 'will cure', 'will heal',
  'certainly', 'definitely',
]);

/**
 * Map a raw 0..1 confidence to the spec's three bands +
 * `needsReview` boolean. Pure utility used by the analysis
 * pipeline + the OODA engine.
 */
export function bandedConfidence(raw: number) {
  try {
    const n = (typeof raw === 'number' && Number.isFinite(raw)) ? raw : null;
    if (n == null) return Object.freeze({
      score: null, band: 'unknown' as ConfidenceLabel,
      needsReview: true, reason: 'confidence_unknown',
    });
    if (n >= CONFIDENCE_BANDS.NORMAL_MIN) return Object.freeze({
      score: n, band: 'high' as ConfidenceLabel,
      needsReview: false, reason: '',
    });
    if (n >= CONFIDENCE_BANDS.NEEDS_REVIEW_MIN) return Object.freeze({
      score: n, band: 'medium' as ConfidenceLabel,
      needsReview: true, reason: 'confidence_needs_review',
    });
    return Object.freeze({
      score: n, band: 'low' as ConfidenceLabel,
      needsReview: true, reason: 'confidence_low',
    });
  } catch {
    return Object.freeze({
      score: null, band: 'unknown' as ConfidenceLabel,
      needsReview: true, reason: 'error',
    });
  }
}

/** Grower-facing wording for a normalised band. Never returns
 *  any banned word. */
export function normalizedConfidenceLabel(band: ConfidenceLabel): string {
  switch (band) {
    case 'high':   return 'Likely';
    case 'medium': return 'Possible';
    case 'low':    return 'Needs review';
    default:       return 'Needs review';
  }
}
