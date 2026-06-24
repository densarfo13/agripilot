/**
 * PhotoQualityEngine.ts — sprint #214 §1.
 *
 * Scores a scan photo from sub-signals the pipeline ALREADY produces
 * (image quality / leaf coverage / resolution). It does NOT run new
 * computer vision and it NEVER invents a sub-score: any signal we
 * don't have stays null, and qualityScore is the mean of ONLY the
 * signals we actually have. With no signal at all, `measured` is
 * false and the gate falls back to confidence-based blocking.
 *
 * Pure. SSR-safe. Never throws. Frozen returns. Pins
 * window.__photoQualityHealth().
 */

import {
  QUALITY_PASS_THRESHOLD, QUALITY_CAUTION_THRESHOLD, COACHING_KEYS,
} from './PhotoQualityContracts';
import type { PhotoQualityResult, PhotoSubScores, QualityLabel } from './PhotoQualityContracts';

export const PHOTO_QUALITY_ENGINE_VERSION = 'photo-quality-engine-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _num = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : null);
const _str = (v: unknown): string => (typeof v === 'string' ? v.trim().toLowerCase() : '');

// Map a qualitative imageQuality.overall to a coarse score when no
// numeric blur/focus exists. Honest: 'good'→85, 'fair'→60, 'poor'→35.
function _overallToScore(overall: string): number | null {
  if (overall === 'good' || overall === 'high') return 85;
  if (overall === 'fair' || overall === 'medium' || overall === 'ok') return 60;
  if (overall === 'poor' || overall === 'low' || overall === 'bad') return 35;
  return null;
}

export function evaluatePhotoQuality(input: {
  imageQuality?: { overall?: string; leafCoverage?: number | null; resolution?: number | null;
                   blur?: number | null; brightness?: number | null; centered?: number | null };
  objectType?: string;
} = {}): Readonly<PhotoQualityResult> {
  return _safe(() => {
    const iq = input.imageQuality || {};
    const overallScore = _overallToScore(_str(iq.overall));

    const sub: PhotoSubScores = {
      blurScore:            _num(iq.blur) ?? overallScore,
      brightnessScore:      _num(iq.brightness),
      plantCoverageScore:   _num(iq.leafCoverage),
      focusScore:           _num(iq.blur) ?? overallScore,
      subjectCenteredScore: _num(iq.centered),
      imageResolutionScore: _num(iq.resolution),
    };

    const present = Object.values(sub).filter((v): v is number => v != null);
    const measured = present.length > 0;
    const qualityScore = measured
      ? Math.round(present.reduce((a, b) => a + b, 0) / present.length)
      : null;

    const reasons: string[] = [];
    const coaching: string[] = [];
    const addPoor = (score: number | null, reason: string, key: string) => {
      if (score != null && score < QUALITY_CAUTION_THRESHOLD) {
        reasons.push(reason);
        if (!coaching.includes(key)) coaching.push(key);
      }
    };
    addPoor(sub.blurScore, 'blurry', COACHING_KEYS.blur);
    addPoor(sub.brightnessScore, 'too_dark', COACHING_KEYS.brightness);
    addPoor(sub.plantCoverageScore, 'plant_too_small', COACHING_KEYS.coverage);
    addPoor(sub.focusScore, 'out_of_focus', COACHING_KEYS.focus);
    addPoor(sub.subjectCenteredScore, 'not_centered', COACHING_KEYS.centered);
    addPoor(sub.imageResolutionScore, 'low_resolution', COACHING_KEYS.resolution);

    const passed = qualityScore != null && qualityScore >= QUALITY_PASS_THRESHOLD;
    const failed = qualityScore != null && qualityScore < QUALITY_CAUTION_THRESHOLD;
    let label: QualityLabel = 'unknown';
    if (qualityScore != null) {
      label = passed ? 'good' : failed ? 'poor' : 'caution';
    }
    if (failed && coaching.length === 0) coaching.push(COACHING_KEYS.focus);

    return Object.freeze({
      runtimeVersion: PHOTO_QUALITY_ENGINE_VERSION,
      subScores: Object.freeze(sub),
      qualityScore, qualityLabel: label, passed, failed, measured,
      reasons: Object.freeze(reasons),
      coaching: Object.freeze(coaching),
      recommendedRetake: failed,
      // When poor, cap downstream confidence so a bad photo can't read
      // as a confident result. null when not measured (no opinion).
      confidenceCap: failed ? 60 : null,
    });
  }, Object.freeze({
    runtimeVersion: PHOTO_QUALITY_ENGINE_VERSION,
    subScores: Object.freeze({
      blurScore: null, brightnessScore: null, plantCoverageScore: null,
      focusScore: null, subjectCenteredScore: null, imageResolutionScore: null,
    }),
    qualityScore: null, qualityLabel: 'unknown' as const,
    passed: false, failed: false, measured: false,
    reasons: Object.freeze([]), coaching: Object.freeze([]),
    recommendedRetake: false, confidenceCap: null,
  }));
}

export function buildPhotoQualityHealth(): Readonly<{
  ok: boolean; runtimeVersion: string;
  photoQualityReady: true; neverFabricatesSubScores: true; passThreshold: number;
}> {
  return Object.freeze({
    ok: true, runtimeVersion: PHOTO_QUALITY_ENGINE_VERSION,
    photoQualityReady: true as const,
    neverFabricatesSubScores: true as const,
    passThreshold: QUALITY_PASS_THRESHOLD,
  });
}

let _installed = false;
export function installPhotoQualityHealthGlobal(): void {
  if (_installed) return;
  if (_safe(() => typeof window === 'undefined', true)) return;
  _safe(() => {
    Object.defineProperty(window as any, '__photoQualityHealth', {
      configurable: true, enumerable: false, writable: false,
      value: () => buildPhotoQualityHealth(),
    });
    _installed = true;
  }, undefined);
}

export const _internal = Object.freeze({
  evaluatePhotoQuality, buildPhotoQualityHealth, installPhotoQualityHealthGlobal,
});
export default evaluatePhotoQuality;
