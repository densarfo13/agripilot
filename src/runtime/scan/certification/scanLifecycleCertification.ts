/**
 * scanLifecycleCertification.ts — automatic scan-pipeline lifecycle state from REAL metrics
 * (Scan Production Certification §6: "mark the pipeline based on real metrics rather than manual
 * flags"). Pure, total, never throws, never fabricates: with no real production volume it returns
 * DEVELOPMENT — it can NEVER auto-promote to PRODUCTION_CERTIFIED without real scans meeting every
 * threshold.
 *
 * Composes the existing reliability data (server/.../providerReliability.js already computes
 * p50/p95/p99 + success/timeout/uptime) — this engine consumes a metrics snapshot, it does not
 * recompute the pipeline. `percentiles()` is provided so the engine is self-contained + testable;
 * the server reliability scorecard is the production source of the same numbers.
 */
export type ScanLifecycleState = 'DEVELOPMENT' | 'PILOT' | 'STAGING' | 'PRODUCTION_CERTIFIED';

export interface ScanMetricsSnapshot {
  volume: number;                 // real scans observed in the window
  successRate: number;            // 0..1 (confident usable result)
  p95LatencyMs: number;           // provider/scan p95
  timeoutRate: number;            // 0..1
  crashFreeRate: number;          // 0..1
  verifiedAccuracy: number | null;// 0..1 where verified against ground truth; null = not yet measured
}

/** Threshold ladder. Each higher state requires MORE real volume + tighter quality. */
export const LIFECYCLE_THRESHOLDS = Object.freeze({
  PILOT:                { volume: 50,   successRate: 0.85, crashFreeRate: 0.97 },
  STAGING:              { volume: 500,  successRate: 0.92, crashFreeRate: 0.99, p95LatencyMs: 6000, timeoutRate: 0.05 },
  PRODUCTION_CERTIFIED: { volume: 5000, successRate: 0.95, crashFreeRate: 0.995, p95LatencyMs: 4000, timeoutRate: 0.02, verifiedAccuracy: 0.90 },
});

/** Alert thresholds (§4). */
export const ALERT_THRESHOLDS = Object.freeze({
  successRateFloor: 0.90, timeoutSpike: 0.10, latencyMs: 8000,
});

const _n = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** Pure p50/p95/p99 over a numeric sample array (nearest-rank). */
export function percentiles(samples: number[]): { p50: number; p95: number; p99: number } {
  const s = (Array.isArray(samples) ? samples.filter((x) => typeof x === 'number' && Number.isFinite(x)) : [])
    .slice().sort((a, b) => a - b);
  if (s.length === 0) return { p50: 0, p95: 0, p99: 0 };
  const at = (p: number) => s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))];
  return { p50: at(50), p95: at(95), p99: at(99) };
}

function _meets(m: ScanMetricsSnapshot, t: any): boolean {
  if (m.volume < t.volume) return false;
  if (m.successRate < t.successRate) return false;
  if (m.crashFreeRate < t.crashFreeRate) return false;
  if (t.p95LatencyMs != null && m.p95LatencyMs > t.p95LatencyMs) return false;
  if (t.timeoutRate != null && m.timeoutRate > t.timeoutRate) return false;
  if (t.verifiedAccuracy != null) {
    if (m.verifiedAccuracy == null || m.verifiedAccuracy < t.verifiedAccuracy) return false; // unverified ≠ certified
  }
  return true;
}

/** Compute alert flags from a snapshot. */
export function scanAlerts(m: ScanMetricsSnapshot): string[] {
  const a: string[] = [];
  if (m.volume > 0 && m.successRate < ALERT_THRESHOLDS.successRateFloor) a.push('SUCCESS_RATE_DROP');
  if (m.timeoutRate > ALERT_THRESHOLDS.timeoutSpike) a.push('TIMEOUT_SPIKE');
  if (m.volume > 0 && m.crashFreeRate < 0.97) a.push('CRASH_RATE_HIGH');
  if (m.p95LatencyMs > ALERT_THRESHOLDS.latencyMs) a.push('LATENCY_EXCEEDED');
  return a;
}

/**
 * Certify the scan pipeline's lifecycle state from a real-metrics snapshot.
 * Honest: null/zero/low volume → DEVELOPMENT. PRODUCTION_CERTIFIED requires real volume + every
 * threshold incl. measured accuracy — it is never granted on synthetic or absent data.
 */
export function certifyScanLifecycle(snapshot: Partial<ScanMetricsSnapshot> | null | undefined) {
  const m: ScanMetricsSnapshot = {
    volume: _n(snapshot?.volume), successRate: _n(snapshot?.successRate),
    p95LatencyMs: _n(snapshot?.p95LatencyMs), timeoutRate: _n(snapshot?.timeoutRate),
    crashFreeRate: _n(snapshot?.crashFreeRate),
    verifiedAccuracy: (typeof snapshot?.verifiedAccuracy === 'number') ? snapshot!.verifiedAccuracy : null,
  };

  let state: ScanLifecycleState = 'DEVELOPMENT';
  const reasons: string[] = [];
  if (m.volume <= 0) {
    reasons.push('No real production scans yet — DEVELOPMENT until live volume accrues.');
  } else if (_meets(m, LIFECYCLE_THRESHOLDS.PRODUCTION_CERTIFIED)) {
    state = 'PRODUCTION_CERTIFIED';
  } else if (_meets(m, LIFECYCLE_THRESHOLDS.STAGING)) {
    state = 'STAGING';
    if (m.verifiedAccuracy == null) reasons.push('Accuracy not yet verified against ground truth — cannot certify.');
  } else if (_meets(m, LIFECYCLE_THRESHOLDS.PILOT)) {
    state = 'PILOT';
  } else {
    reasons.push('Real volume present but quality thresholds for PILOT not yet met.');
  }

  return Object.freeze({
    state,
    reasons: Object.freeze(reasons),
    alerts: Object.freeze(scanAlerts(m)),
    metrics: Object.freeze(m),
    thresholds: LIFECYCLE_THRESHOLDS,
  });
}

/** Daily certification report shape (§3) — composed from the snapshot + provider health. */
export function buildScanCertificationReport(snapshot: Partial<ScanMetricsSnapshot> | null,
  providerHealth: unknown, latency: { p50: number; p95: number; p99: number } | null,
  confidenceDistribution: unknown) {
  const cert = certifyScanLifecycle(snapshot);
  return Object.freeze({
    state: cert.state,
    scanVolume: cert.metrics.volume,
    providerHealth: providerHealth ?? null,
    latency: latency ?? null,
    crashFreeScans: cert.metrics.crashFreeRate,
    classificationAccuracy: cert.metrics.verifiedAccuracy ?? 'unverified',
    confidenceDistribution: confidenceDistribution ?? null,
    alerts: cert.alerts,
    reasons: cert.reasons,
  });
}
