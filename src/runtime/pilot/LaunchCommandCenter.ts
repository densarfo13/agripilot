/**
 * LaunchCommandCenter.ts — the operational engine behind the pilot command center. Pure, total,
 * never throws. Composes a real-metrics snapshot (the dashboards feed it) into:
 *   • a Pilot Health Score (5 components → overall, 0–100), and
 *   • an automatic go/no-go state: NOT_READY → PILOT_READY → READY_FOR_1000 → READY_FOR_COMMERCIAL.
 *
 * Honesty (gate-locked): the state advances ONLY when predefined quality gates are met by REAL data.
 * A hard stability blocker → NOT_READY. With the build green + safety invariants but no real farmer
 * data yet → PILOT_READY (ready to BEGIN the pilot). READY_FOR_1000 / COMMERCIAL are impossible
 * without real farmer volume + crash-free + retention + scan-success + measured satisfaction.
 * It never fabricates a state from absent data.
 */
export type LaunchState = 'NOT_READY' | 'PILOT_READY' | 'READY_FOR_1000' | 'READY_FOR_COMMERCIAL';

export interface PilotMetrics {
  buildGreen: boolean;            // build:safe passing (release floor)
  activeFarmers: number;
  crashFreeRate: number;          // 0..1
  onboardingCompletionRate: number; // 0..1
  scanSuccessRate: number;        // 0..1
  recommendationAcceptanceRate: number; // 0..1
  taskCompletionRate: number;     // 0..1
  retentionD7: number;            // 0..1
  farmerSatisfaction: number | null; // 0..1 (CSAT), null = not measured
  p95LatencyMs: number;           // scan/API p95
}

const _01 = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);
const _pct = (v: number) => Math.round(v * 100);

/** Five-component Pilot Health Score (0–100 each) + overall. Components needing data read 0 (honest). */
export function computePilotHealthScore(m: Partial<PilotMetrics> | null) {
  const o = m || {};
  const productStability     = _pct(_01(o.crashFreeRate));
  const scanReliability      = _pct(_01(o.scanSuccessRate));
  const recommendationQuality= _pct(_01(o.recommendationAcceptanceRate));
  const farmerSatisfaction   = (typeof o.farmerSatisfaction === 'number') ? _pct(_01(o.farmerSatisfaction)) : null;
  // Performance: 100 at <=2s, 0 at >=8s, linear between.
  const p95 = (typeof o.p95LatencyMs === 'number' && o.p95LatencyMs > 0) ? o.p95LatencyMs : null;
  const performance = p95 == null ? null : Math.max(0, Math.min(100, Math.round(100 - ((p95 - 2000) / 6000) * 100)));

  const parts = [productStability, scanReliability, recommendationQuality, farmerSatisfaction, performance]
    .filter((x): x is number => typeof x === 'number');
  const overall = parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : 0;
  return Object.freeze({ productStability, farmerSatisfaction, recommendationQuality, scanReliability, performance, overall });
}

export const LAUNCH_GATES = Object.freeze({
  PILOT_READY:          { buildGreen: true, crashFreeRate: 0.95 },
  READY_FOR_1000:       { activeFarmers: 50,  crashFreeRate: 0.99,  onboardingCompletionRate: 0.70, scanSuccessRate: 0.85, recommendationAcceptanceRate: 0.30, retentionD7: 0.30, farmerSatisfaction: 0.70 },
  READY_FOR_COMMERCIAL: { activeFarmers: 500, crashFreeRate: 0.995, onboardingCompletionRate: 0.80, scanSuccessRate: 0.92, recommendationAcceptanceRate: 0.40, retentionD7: 0.40, farmerSatisfaction: 0.80, p95LatencyMs: 4000 },
});

function _unmet(m: PilotMetrics, g: any): string[] {
  const u: string[] = [];
  for (const k of Object.keys(g)) {
    if (k === 'p95LatencyMs') { if (m.p95LatencyMs <= 0 || m.p95LatencyMs > g.p95LatencyMs) u.push(`p95LatencyMs > ${g.p95LatencyMs}`); continue; }
    if (k === 'farmerSatisfaction') { if (m.farmerSatisfaction == null || m.farmerSatisfaction < g.farmerSatisfaction) u.push('farmerSatisfaction (unmeasured/low)'); continue; }
    if ((m as any)[k] < g[k]) u.push(`${k} < ${g[k]}`);
  }
  return u;
}

/** Automatic go/no-go state from real metrics. */
export function launchGateDecision(metrics: Partial<PilotMetrics> | null) {
  const m: PilotMetrics = {
    buildGreen: metrics?.buildGreen === true,
    activeFarmers: Math.max(0, Math.floor(_n(metrics?.activeFarmers))),
    crashFreeRate: _01(metrics?.crashFreeRate),
    onboardingCompletionRate: _01(metrics?.onboardingCompletionRate),
    scanSuccessRate: _01(metrics?.scanSuccessRate),
    recommendationAcceptanceRate: _01(metrics?.recommendationAcceptanceRate),
    taskCompletionRate: _01(metrics?.taskCompletionRate),
    retentionD7: _01(metrics?.retentionD7),
    farmerSatisfaction: (typeof metrics?.farmerSatisfaction === 'number') ? _01(metrics?.farmerSatisfaction) : null,
    p95LatencyMs: _n(metrics?.p95LatencyMs),
  };

  let state: LaunchState = 'NOT_READY';
  const reasons: string[] = [];
  // Hard blocker: build not green, or crash-free below the pilot floor (when there IS traffic).
  if (!m.buildGreen) reasons.push('build:safe not green — release floor not met.');
  else if (m.activeFarmers > 0 && m.crashFreeRate < LAUNCH_GATES.PILOT_READY.crashFreeRate)
    reasons.push('crash-free rate below the pilot floor.');
  else if (_unmet(m, LAUNCH_GATES.READY_FOR_COMMERCIAL).length === 0) state = 'READY_FOR_COMMERCIAL';
  else if (_unmet(m, LAUNCH_GATES.READY_FOR_1000).length === 0) state = 'READY_FOR_1000';
  else {
    state = 'PILOT_READY';
    if (m.activeFarmers === 0) reasons.push('No real farmer data yet — ready to BEGIN the pilot; advances automatically as metrics accrue.');
  }

  const nextGate = state === 'PILOT_READY' ? LAUNCH_GATES.READY_FOR_1000
    : state === 'READY_FOR_1000' ? LAUNCH_GATES.READY_FOR_COMMERCIAL : null;
  return Object.freeze({
    state, reasons: Object.freeze(reasons),
    unmetForNext: Object.freeze(nextGate ? _unmet(m, nextGate) : []),
    health: computePilotHealthScore(m), metrics: Object.freeze(m),
  });
}

function _n(v: unknown): number { return (typeof v === 'number' && Number.isFinite(v)) ? v : 0; }
