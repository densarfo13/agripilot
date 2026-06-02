/**
 * ConfidenceBandRuntime.ts — §CONFIDENCE BANDS.
 *
 * Maps a 0..100 confidence number to one of the 4 spec labels. Pure
 * function module — no UI, no DOM. FORBIDS use of overstated language
 * like 'Confirmed' / 'Guaranteed' / '100% accurate'.
 *
 *   90-100  → High Confidence
 *   80-89   → Likely Match
 *   65-79   → Needs Confirmation
 *   < 65    → Review Recommended
 */

import { GUIDANCE_TAIL } from './ScanAccuracyContracts';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
type Confidence = 'low' | 'medium' | 'high';

export const CONFIDENCE_BAND_VERSION = 'confidence-band-v1' as const;

export type ConfidenceBandLabel =
  | 'High Confidence'
  | 'Likely Match'
  | 'Needs Confirmation'
  | 'Review Recommended';

/** Words this module FORBIDS in band labels and explanations because
 *  they overstate scan accuracy. Gate enforces statically. */
export const FORBIDDEN_BAND_WORDS: ReadonlyArray<string> = Object.freeze([
  'Confirmed', 'Guaranteed', '100% accurate',
]);

export interface ConfidenceBandResult {
  pct: number;             // 0..100, clamped
  label: ConfidenceBandLabel;
  recommendReview: boolean;
  rationale: string;
}

export interface ConfidenceBandHealthEnvelope {
  initialized: true;
  bandingReady: true;
  noOverstatedLanguage: true;
  composedFrom: ReadonlyArray<string>;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

export function bandForConfidence(pct: number): Readonly<ConfidenceBandResult> {
  return _safe(() => {
    const safe = (typeof pct === 'number' && isFinite(pct))
      ? Math.max(0, Math.min(100, pct)) : 0;
    if (safe >= 90) {
      return Object.freeze<ConfidenceBandResult>({
        pct: safe,
        label: 'High Confidence',
        recommendReview: false,
        rationale: 'AI confidence at or above 90%.',
      });
    }
    if (safe >= 80) {
      return Object.freeze<ConfidenceBandResult>({
        pct: safe,
        label: 'Likely Match',
        recommendReview: false,
        rationale: 'AI confidence 80–89%.',
      });
    }
    if (safe >= 65) {
      return Object.freeze<ConfidenceBandResult>({
        pct: safe,
        label: 'Needs Confirmation',
        recommendReview: false,
        rationale: 'AI confidence 65–79% — grower confirmation recommended.',
      });
    }
    return Object.freeze<ConfidenceBandResult>({
      pct: safe,
      label: 'Review Recommended',
      recommendReview: true,
      rationale: 'AI confidence below 65% — route to human review.',
    });
  }, Object.freeze<ConfidenceBandResult>({
    pct: 0,
    label: 'Review Recommended',
    recommendReview: true,
    rationale: 'Banding threw — defaulting to review.',
  }));
}

export function confidenceBandsReady(): boolean { return true; }

export function confidenceBandHealth()
  : Readonly<ConfidenceBandHealthEnvelope> {
  return _safe(() => Object.freeze<ConfidenceBandHealthEnvelope>({
    initialized: true,
    bandingReady: true as const,
    noOverstatedLanguage: true as const,
    composedFrom: Object.freeze([]) as ReadonlyArray<string>,
    confidence: 'high' as Confidence,
    explanation:
      'Confidence band labeling: 90-100 High Confidence, 80-89 Likely Match, ' +
      '65-79 Needs Confirmation, below 65 Review Recommended. Overstated language ' +
      '(Confirmed / Guaranteed / 100% accurate) is forbidden — the runtime never uses ' +
      'those tokens.',
    limitations:
      'Bands are decision support, not absolute correctness signals. ' + GUIDANCE_TAIL,
  }), Object.freeze<ConfidenceBandHealthEnvelope>({
    initialized: true,
    bandingReady: true as const,
    noOverstatedLanguage: true as const,
    composedFrom: Object.freeze([]) as ReadonlyArray<string>,
    confidence: 'low' as Confidence,
    explanation: 'Confidence band runtime initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }));
}

export function installConfidenceBandGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__confidenceBandHealth !== 'function') {
      w.__confidenceBandHealth = function () {
        const out = confidenceBandHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Confidence Band]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
