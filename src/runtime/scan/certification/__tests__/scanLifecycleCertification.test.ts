/**
 * scanLifecycleCertification.test.ts — locks the automatic, real-metrics certification ladder.
 * Self-running: `tsx …`. The core invariant: PRODUCTION_CERTIFIED is impossible without real
 * volume + every threshold incl. measured accuracy. Never fabricates a state.
 */
import { certifyScanLifecycle, percentiles, scanAlerts, LIFECYCLE_THRESHOLDS }
  from '../scanLifecycleCertification.js';

let passed = 0;
function ok(c: boolean, m: string) { if (!c) { console.error('  ✗ ' + m); process.exit(1); } passed++; }

// ── percentiles ──────────────────────────────────────────────────
const p = percentiles([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
ok(p.p50 === 50 && p.p95 === 100 && p.p99 === 100, 'percentiles nearest-rank correct');
ok(percentiles([]).p95 === 0, 'empty samples → 0 (no crash)');

// ── HONESTY: no/zero volume → DEVELOPMENT, never higher ─────────
ok(certifyScanLifecycle(null).state === 'DEVELOPMENT', 'null snapshot → DEVELOPMENT, never throws');
ok(certifyScanLifecycle({ volume: 0, successRate: 1, p95LatencyMs: 1, timeoutRate: 0, crashFreeRate: 1, verifiedAccuracy: 1 }).state
  === 'DEVELOPMENT', 'perfect rates but ZERO volume → DEVELOPMENT (cannot certify without real scans)');

// ── ladder ───────────────────────────────────────────────────────
const pilot = { volume: 60, successRate: 0.88, p95LatencyMs: 7000, timeoutRate: 0.08, crashFreeRate: 0.98, verifiedAccuracy: null };
ok(certifyScanLifecycle(pilot).state === 'PILOT', 'real volume + pilot bar → PILOT');

const staging = { volume: 800, successRate: 0.93, p95LatencyMs: 5000, timeoutRate: 0.03, crashFreeRate: 0.992, verifiedAccuracy: null };
ok(certifyScanLifecycle(staging).state === 'STAGING', 'staging bar met → STAGING');

// ── HONESTY: STAGING-with-unverified-accuracy can't reach PRODUCTION ─
const prodButUnverified = { volume: 9000, successRate: 0.97, p95LatencyMs: 3000, timeoutRate: 0.01, crashFreeRate: 0.999, verifiedAccuracy: null };
const r1 = certifyScanLifecycle(prodButUnverified);
ok(r1.state === 'STAGING' && r1.reasons.some((x) => /accuracy/i.test(x)),
  'production volume + rates but UNVERIFIED accuracy → STAGING, not PRODUCTION_CERTIFIED');

// ── PRODUCTION_CERTIFIED only with everything incl. measured accuracy ─
const prod = { volume: 9000, successRate: 0.97, p95LatencyMs: 3000, timeoutRate: 0.01, crashFreeRate: 0.999, verifiedAccuracy: 0.93 };
ok(certifyScanLifecycle(prod).state === 'PRODUCTION_CERTIFIED', 'all thresholds incl. verified accuracy → PRODUCTION_CERTIFIED');

// just-below production volume → STAGING (volume gate is hard)
ok(certifyScanLifecycle({ ...prod, volume: LIFECYCLE_THRESHOLDS.PRODUCTION_CERTIFIED.volume - 1 }).state === 'STAGING',
  'one scan below the production volume floor → STAGING');

// ── alerts ───────────────────────────────────────────────────────
ok(scanAlerts({ volume: 100, successRate: 0.80, p95LatencyMs: 1000, timeoutRate: 0.01, crashFreeRate: 0.99, verifiedAccuracy: null }).includes('SUCCESS_RATE_DROP'), 'low success → alert');
ok(scanAlerts({ volume: 100, successRate: 0.99, p95LatencyMs: 9000, timeoutRate: 0.2, crashFreeRate: 0.99, verifiedAccuracy: null }).includes('TIMEOUT_SPIKE'), 'timeout spike → alert');
ok(scanAlerts({ volume: 100, successRate: 0.99, p95LatencyMs: 9000, timeoutRate: 0.01, crashFreeRate: 0.99, verifiedAccuracy: null }).includes('LATENCY_EXCEEDED'), 'latency over threshold → alert');

console.log('[scanLifecycleCertification] PASS — ' + passed + ' assertions. Automatic ladder from real '
  + 'metrics; zero/low volume + unverified accuracy can NEVER reach PRODUCTION_CERTIFIED; alerts fire; never throws.');
