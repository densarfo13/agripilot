/**
 * DataQualityEngine.ts — ENTERPRISE CERTIFICATION, Phase 2.
 *
 * Scores the data behind a recommendation so the farmer (and FarmBrain) knows how
 * much to trust it: completeness · freshness · consistency · confidence → a
 * High/Medium/Low band. When quality is Low, the honest next step is "run a fresh
 * scan" — never a confident recommendation on thin data.
 *
 * Pure, total, never throws. Composes FarmBrainState + the farm record; invents
 * nothing (missing inputs lower the score, they don't get fabricated).
 */
export const DATA_QUALITY_VERSION = 'data-quality-engine-v1';
export type DataQualityBand = 'high' | 'medium' | 'low' | 'unknown';

export interface DataQualityScore {
  band: DataQualityBand;
  overall: number;                 // 0..100
  completeness: number;
  freshness: number;
  consistency: number;
  confidence: number;
  recommendNextScan: boolean;      // true when band is low
  reason: string;                  // farmer-facing, no jargon
}

export interface DataQualityInput {
  farmBrainState?: any;
  crop?: string | null;
  plantingDate?: string | null;
  location?: any;
  hasScan?: boolean;
  scanCount?: number;
  taskCount?: number;
  lastUpdatedAt?: number | null;
  nowMs?: number;
}

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
const _num = (v: any): number | null => { const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? n : null; };
const _clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function scoreDataQuality(input: DataQualityInput = {}): DataQualityScore {
  return _safe(() => {
    const fb = input.farmBrainState || {};
    const hasScan = input.hasScan === true || fb.hasFirstScan === true || (_num(input.scanCount) || 0) > 0;

    // ── Completeness: how many key context fields are present. ──
    const fields = [
      !!input.crop || !!fb.crop,
      !!input.plantingDate || !!(fb.growthStage && fb.growthStage.value),
      !!input.location,
      hasScan,
      (_num(input.taskCount) || 0) > 0,
    ];
    const completeness = _clamp((fields.filter(Boolean).length / fields.length) * 100);

    // ── Freshness: how recent the last update is (7d window). ──
    const now = _num(input.nowMs);
    const last = _num(input.lastUpdatedAt) ?? _num(fb.updatedAt);
    let freshness: number;
    if (last == null || now == null) freshness = hasScan ? 50 : 0;
    else {
      const days = Math.max(0, (now - last) / 864e5);
      freshness = _clamp(days <= 1 ? 100 : days <= 3 ? 80 : days <= 7 ? 60 : days <= 14 ? 35 : 10);
    }

    // ── Consistency: do the signals agree (no contradiction)? ──
    // Health high but disease risk also high = contradictory → lower consistency.
    let consistency = 80;
    const health = _num(fb.farmHealth && fb.farmHealth.value);
    const disease = _num(fb.diseaseRisk && fb.diseaseRisk.value);
    if (health != null && disease != null && health >= 75 && disease >= 60) consistency = 40;
    if (!hasScan) consistency = 50;

    // ── Confidence: FarmBrain's own confidence. ──
    const confidence = _clamp(_num(fb.confidence) ?? (hasScan ? 50 : 0));

    const overall = _clamp(0.30 * completeness + 0.25 * freshness + 0.20 * consistency + 0.25 * confidence);
    const band: DataQualityBand = !hasScan && completeness < 40 ? 'low'
      : overall >= 70 ? 'high' : overall >= 45 ? 'medium' : 'low';
    const recommendNextScan = band === 'low';
    const reason = band === 'high' ? 'Based on recent, complete farm data.'
      : band === 'medium' ? 'Based on partial data — a fresh scan would sharpen this.'
      : 'Not enough recent data yet — run a scan for reliable guidance.';

    return Object.freeze({
      band, overall, completeness, freshness, consistency, confidence, recommendNextScan, reason,
    });
  }, Object.freeze({
    band: 'unknown' as DataQualityBand, overall: 0, completeness: 0, freshness: 0,
    consistency: 0, confidence: 0, recommendNextScan: true,
    reason: 'Not enough data yet — run a scan for reliable guidance.',
  }));
}

export function dataQualityHealth() {
  const probe = scoreDataQuality({ crop: 'Onion', plantingDate: '2026-05-01', location: {}, hasScan: true,
    scanCount: 3, taskCount: 2, lastUpdatedAt: 1, nowMs: 1, farmBrainState: { hasFirstScan: true, confidence: 80 } });
  return Object.freeze({
    ok: true, version: DATA_QUALITY_VERSION,
    dimensions: Object.freeze(['completeness', 'freshness', 'consistency', 'confidence']),
    bands: Object.freeze(['high', 'medium', 'low']),
    lowRecommendsRescan: scoreDataQuality({}).recommendNextScan === true,
    sampleBand: probe.band,
  });
}

export function installDataQualityHealth(): void {
  _safe(() => {
    if (typeof window === 'undefined' || (window as any).__dataQualityHealth) return;
    Object.defineProperty(window, '__dataQualityHealth', {
      configurable: true, enumerable: false, writable: false, value: () => dataQualityHealth(),
    });
  }, undefined);
}
