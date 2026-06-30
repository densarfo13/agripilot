/**
 * LaunchCommandCenter.test.ts — locks the automatic go/no-go ladder + the honesty invariant.
 * Self-running: `tsx …`. Core: READY_FOR_1000/COMMERCIAL impossible without real farmer data
 * meeting every gate; build-not-green or crashing → NOT_READY; never throws.
 */
import { launchGateDecision, computePilotHealthScore, LAUNCH_GATES } from '../LaunchCommandCenter.js';

let passed = 0;
function ok(c: boolean, m: string) { if (!c) { console.error('  ✗ ' + m); process.exit(1); } passed++; }

// ── NOT_READY: build not green is a hard blocker ─────────────────
ok(launchGateDecision({ buildGreen: false, activeFarmers: 9999, crashFreeRate: 1 }).state === 'NOT_READY',
  'build not green → NOT_READY regardless of metrics');
ok(launchGateDecision(null).state === 'NOT_READY', 'null metrics → NOT_READY, never throws');

// ── PILOT_READY: build green + no real data → ready to BEGIN ─────
const begin = launchGateDecision({ buildGreen: true });
ok(begin.state === 'PILOT_READY' && begin.reasons.some((r) => /begin/i.test(r)),
  'build green + zero farmers → PILOT_READY (ready to begin), honest reason');

// ── HONESTY: production-scale rates but ZERO farmers can't advance ─
ok(launchGateDecision({ buildGreen: true, activeFarmers: 0, crashFreeRate: 1, onboardingCompletionRate: 1,
  scanSuccessRate: 1, recommendationAcceptanceRate: 1, retentionD7: 1, farmerSatisfaction: 1, p95LatencyMs: 1000 }).state
  === 'PILOT_READY', 'perfect rates but ZERO active farmers → still PILOT_READY (no real volume)');

// ── crash during traffic → NOT_READY ────────────────────────────
ok(launchGateDecision({ buildGreen: true, activeFarmers: 80, crashFreeRate: 0.90 }).state === 'NOT_READY',
  'real traffic + crash-free below floor → NOT_READY');

// ── READY_FOR_1000 only when every gate met by real data ────────
const thousand = { buildGreen: true, activeFarmers: 60, crashFreeRate: 0.99, onboardingCompletionRate: 0.75,
  scanSuccessRate: 0.88, recommendationAcceptanceRate: 0.35, taskCompletionRate: 0.5, retentionD7: 0.35,
  farmerSatisfaction: 0.75, p95LatencyMs: 5000 };
ok(launchGateDecision(thousand).state === 'READY_FOR_1000', 'all 1000-gates met → READY_FOR_1000');
// unmeasured satisfaction blocks it
ok(launchGateDecision({ ...thousand, farmerSatisfaction: null }).state === 'PILOT_READY',
  'unmeasured satisfaction → cannot reach READY_FOR_1000');
// below volume floor blocks it
ok(launchGateDecision({ ...thousand, activeFarmers: LAUNCH_GATES.READY_FOR_1000.activeFarmers - 1 }).state === 'PILOT_READY',
  'one farmer below the volume floor → stays PILOT_READY');

// ── READY_FOR_COMMERCIAL needs the full commercial bar ──────────
const commercial = { buildGreen: true, activeFarmers: 600, crashFreeRate: 0.996, onboardingCompletionRate: 0.85,
  scanSuccessRate: 0.93, recommendationAcceptanceRate: 0.45, taskCompletionRate: 0.6, retentionD7: 0.45,
  farmerSatisfaction: 0.82, p95LatencyMs: 3000 };
ok(launchGateDecision(commercial).state === 'READY_FOR_COMMERCIAL', 'full commercial bar → READY_FOR_COMMERCIAL');
ok(launchGateDecision({ ...commercial, p95LatencyMs: 9000 }).state === 'READY_FOR_1000',
  'slow p95 drops commercial → READY_FOR_1000');

// ── health score ─────────────────────────────────────────────────
const h = computePilotHealthScore({ crashFreeRate: 0.99, scanSuccessRate: 0.9, recommendationAcceptanceRate: 0.4, farmerSatisfaction: 0.8, p95LatencyMs: 2000 });
ok(h.productStability === 99 && h.overall > 0, 'health score computes components + overall');
ok(computePilotHealthScore(null).overall === 0, 'no data → 0 overall, never throws');

console.log('[LaunchCommandCenter] PASS — ' + passed + ' assertions. Automatic go/no-go ladder; '
  + 'READY_FOR_1000/COMMERCIAL impossible without real farmer volume + every gate; never fabricates a state.');
