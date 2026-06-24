/**
 * PhotoQualityContracts.ts — sprint #214 §1.
 *
 * Types for the photo quality engine. Sibling namespace `scanQuality/`
 * (wave-36 locks `src/runtime/scan/`). Pure data.
 */

export const PHOTO_QUALITY_CONTRACTS_VERSION = 'photo-quality-contracts-v1';

export const QUALITY_PASS_THRESHOLD = 75;   // >= 75 = pass
export const QUALITY_CAUTION_THRESHOLD = 50; // 50-74 = usable, caution; <50 = fail

export type QualityLabel = 'good' | 'caution' | 'poor' | 'unknown';

// The six sub-scores (0-100 each). Any may be null when the underlying
// signal is not available — we NEVER invent a sub-score.
export interface PhotoSubScores {
  blurScore:            number | null;
  brightnessScore:      number | null;
  plantCoverageScore:   number | null;
  focusScore:           number | null;
  subjectCenteredScore: number | null;
  imageResolutionScore: number | null;
}

export interface PhotoQualityResult {
  runtimeVersion:    string;
  subScores:         Readonly<PhotoSubScores>;
  qualityScore:      number | null;   // null when NO sub-score is available
  qualityLabel:      QualityLabel;
  passed:            boolean;
  failed:            boolean;
  measured:          boolean;          // false when we had no signal at all
  reasons:           ReadonlyArray<string>;
  coaching:          ReadonlyArray<string>;   // i18n keys
  recommendedRetake: boolean;
  confidenceCap:     number | null;    // cap downstream confidence when poor
}

// Coaching i18n keys, keyed by the sub-score that triggered them.
export const COACHING_KEYS = Object.freeze({
  blur:        'scanQuality.holdSteady',
  brightness:  'scanQuality.useDaylight',
  shadow:      'scanQuality.avoidShadows',
  coverage:    'scanQuality.fillFrame',
  focus:       'scanQuality.moveCloser',
  centered:    'scanQuality.fillFrame',
  resolution:  'scanQuality.moveCloser',
  wholePlant:  'scanQuality.takeWholePlant',
});
