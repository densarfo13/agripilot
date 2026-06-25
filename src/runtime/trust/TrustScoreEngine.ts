/**
 * TrustScoreEngine.ts — TRUST ENGINE + EVIDENCE PLATFORM, Phase 2.
 *
 * Calculates how much to trust a recommendation from the signals that already
 * exist — scan quality, provider agreement, farm history, weather quality, soil
 * freshness, task completion, outcome history — and exposes only a High/Medium/
 * Low band to the farmer (never the raw math). Honest: a missing or weak signal
 * lowers trust; nothing is invented.
 *
 * Pure, total, never throws. Pins window.__trustScoreHealth().
 */
export const TRUST_SCORE_VERSION = 'trust-score-engine-v1';
export type TrustBand = 'high' | 'medium' | 'low';

export interface TrustInput {
  scanQuality?: number | null;        // 0..100
  providerAgreement?: number | null;  // 0..100 (how much providers agree)
  farmHistory?: number | null;        // 0..100 (depth of history)
  weatherQuality?: number | null;     // 0..100
  soilFreshness?: number | null;      // 0..100
  taskCompletion?: number | null;     // 0..100
  outcomeHistory?: number | null;     // 0..100
}

export interface TrustScore {
  band: TrustBand;
  score: number;                      // 0..100 (internal — never shown raw)
  factorsConsidered: number;          // how many signals were present
  weakestFactor: string | null;
  reason: string;                     // farmer-facing band explanation, no math
}

const FACTORS: Array<{ key: keyof TrustInput; weight: number; label: string }> = [
  { key: 'scanQuality',       weight: 0.25, label: 'scan quality' },
  { key: 'providerAgreement', weight: 0.20, label: 'agreement between checks' },
  { key: 'farmHistory',       weight: 0.15, label: 'farm history' },
  { key: 'weatherQuality',    weight: 0.10, label: 'weather data' },
  { key: 'soilFreshness',     weight: 0.10, label: 'soil data freshness' },
  { key: 'taskCompletion',    weight: 0.10, label: 'task follow-through' },
  { key: 'outcomeHistory',    weight: 0.10, label: 'past outcomes' },
];

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
const _num = (v: any): number | null => { const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null; };

export function scoreTrust(input: TrustInput = {}): TrustScore {
  return _safe(() => {
    let weighted = 0, totalWeight = 0, present = 0;
    let weakest: { label: string; v: number } | null = null;
    for (const f of FACTORS) {
      const v = _num(input[f.key]);
      if (v == null) continue;
      present += 1;
      weighted += v * f.weight;
      totalWeight += f.weight;
      if (!weakest || v < weakest.v) weakest = { label: f.label, v };
    }
    // Score over the weight that was actually present; absent signals do not
    // inflate it. With no signals present, trust is low (not high-by-default).
    const score = totalWeight > 0 ? Math.round(weighted / totalWeight) : 0;
    // Coverage penalty: fewer signals → lower effective trust.
    const coverage = present / FACTORS.length;
    const effective = Math.round(score * (0.6 + 0.4 * coverage));

    const band: TrustBand = (present === 0) ? 'low'
      : effective >= 72 ? 'high' : effective >= 48 ? 'medium' : 'low';
    const reason = band === 'high' ? 'Strong, agreeing evidence behind this.'
      : band === 'medium' ? 'Reasonable evidence — a fresh scan would raise confidence.'
      : 'Limited evidence — take another photo for more reliable guidance.';

    return Object.freeze({
      band, score: effective, factorsConsidered: present,
      weakestFactor: weakest ? weakest.label : null, reason,
    });
  }, Object.freeze({ band: 'low' as TrustBand, score: 0, factorsConsidered: 0,
    weakestFactor: null, reason: 'Limited evidence — take another photo for more reliable guidance.' }));
}

export function trustScoreHealth() {
  const strong = scoreTrust({ scanQuality: 90, providerAgreement: 85, farmHistory: 70,
    weatherQuality: 80, soilFreshness: 75, taskCompletion: 80, outcomeHistory: 70 });
  const weak = scoreTrust({ scanQuality: 30 });
  return Object.freeze({
    ok: true, version: TRUST_SCORE_VERSION,
    bands: Object.freeze(['high', 'medium', 'low']),
    factors: Object.freeze(FACTORS.map((f) => f.label)),
    strongIsHigh: strong.band === 'high',
    sparseIsNotHigh: weak.band !== 'high',     // missing signals never trust-high
  });
}

export function installTrustScoreHealth(): void {
  _safe(() => {
    if (typeof window === 'undefined' || (window as any).__trustScoreHealth) return;
    Object.defineProperty(window, '__trustScoreHealth', {
      configurable: true, enumerable: false, writable: false, value: () => trustScoreHealth(),
    });
  }, undefined);
}
