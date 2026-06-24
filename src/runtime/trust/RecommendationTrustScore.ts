/**
 * RecommendationTrustScore.ts — sprint #216 §8.
 *
 * A numeric 0-100 trust score for a recommendation, shown to the
 * farmer. Composed ONLY from contributors that genuinely exist:
 * scan confidence, photo quality, farm history, region confidence.
 * Satellite confidence is FROZEN → always null and EXCLUDED from the
 * weighted average (never a fabricated slice). The score is the
 * weighted mean of the present contributors only.
 *
 * Pure. Never throws. Pins window.__recommendationTrustHealth().
 */

export const RECOMMENDATION_TRUST_SCORE_VERSION = 'recommendation-trust-score-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _pct = (v: unknown): number | null => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  const n = v <= 1 ? v * 100 : v;
  return Math.max(0, Math.min(100, n));
};

// Weights for the REAL contributors. Satellite is intentionally absent.
const WEIGHTS: ReadonlyArray<readonly [string, number]> = Object.freeze([
  ['scanConfidence', 0.45],
  ['photoQuality', 0.20],
  ['farmHistory', 0.20],
  ['regionConfidence', 0.15],
]);

export function buildRecommendationTrustScore(input: {
  scanConfidence?: number;
  photoQuality?: number;
  farmHistory?: number;
  regionConfidence?: number;
} = {}): Readonly<{
  runtimeVersion: string;
  score: number | null;        // null when NO contributor is present
  components: Readonly<Record<string, number | null>>;
  satelliteConfidence: null;   // frozen — never a number
  measured: boolean;
}> {
  return _safe(() => {
    const vals: Record<string, number | null> = {
      scanConfidence: _pct(input.scanConfidence),
      photoQuality: _pct(input.photoQuality),
      farmHistory: _pct(input.farmHistory),
      regionConfidence: _pct(input.regionConfidence),
    };
    let sum = 0, wsum = 0;
    for (const [key, w] of WEIGHTS) {
      const v = vals[key];
      if (v != null) { sum += v * w; wsum += w; }
    }
    const score = wsum > 0 ? Math.round(sum / wsum) : null;
    return Object.freeze({
      runtimeVersion: RECOMMENDATION_TRUST_SCORE_VERSION,
      score,
      components: Object.freeze(vals),
      satelliteConfidence: null,
      measured: wsum > 0,
    });
  }, Object.freeze({
    runtimeVersion: RECOMMENDATION_TRUST_SCORE_VERSION,
    score: null,
    components: Object.freeze({ scanConfidence: null, photoQuality: null, farmHistory: null, regionConfidence: null }),
    satelliteConfidence: null, measured: false,
  }));
}

export function buildRecommendationTrustHealth(): Readonly<{
  ok: boolean; runtimeVersion: string;
  recommendationTrustReady: true; satelliteExcluded: true; neverFabricates: true;
}> {
  return Object.freeze({
    ok: true, runtimeVersion: RECOMMENDATION_TRUST_SCORE_VERSION,
    recommendationTrustReady: true as const,
    satelliteExcluded: true as const,
    neverFabricates: true as const,
  });
}

let _installed = false;
export function installRecommendationTrustHealthGlobal(): void {
  if (_installed) return;
  if (_safe(() => typeof window === 'undefined', true)) return;
  _safe(() => {
    Object.defineProperty(window as any, '__recommendationTrustHealth', {
      configurable: true, enumerable: false, writable: false,
      value: () => buildRecommendationTrustHealth(),
    });
    _installed = true;
  }, undefined);
}

export const _internal = Object.freeze({
  buildRecommendationTrustScore, buildRecommendationTrustHealth, installRecommendationTrustHealthGlobal,
});
export default buildRecommendationTrustScore;
