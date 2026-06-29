/**
 * LocationRetryPolicy.test.ts — locks the GPS retry + accuracy policy. Self-running:
 * `tsx LocationRetryPolicy.test.ts`. Prints PASS or exits 1.
 */
import {
  shouldRetry, attemptOptions, accuracyVerdict,
  LOCATION_ATTEMPTS, ACCURACY_THRESHOLD_M,
} from '../locationRetryPolicy';

let passed = 0;
function ok(c: boolean, m: string) { if (!c) { console.error('  ✗ ' + m); process.exit(1); } passed++; }

// ── shouldRetry: only conditions a different attempt can help ────────────────
ok(shouldRetry('timeout') === true, 'retry on timeout');
ok(shouldRetry('unavailable') === true, 'retry on position-unavailable');
ok(shouldRetry(3) === true && shouldRetry(2) === true, 'retry on native codes 3/2');
ok(shouldRetry('access_denied') === false, 'do NOT retry a permission denial (it cannot improve)');
ok(shouldRetry(1) === false, 'do NOT retry native code 1 (denied)');
ok(shouldRetry('unsupported') === false, 'do NOT retry an unsupported browser');
ok(shouldRetry('unknown') === false && shouldRetry(null) === false, 'no retry on unknown/null');

// ── attempt plan: precise first, balanced retry ─────────────────────────────
ok(LOCATION_ATTEMPTS.length === 2, 'two planned attempts');
ok(attemptOptions(0).enableHighAccuracy === true, 'attempt 1 = high accuracy');
ok(attemptOptions(0).maximumAge === 30000 && attemptOptions(0).timeout === 15000, 'attempt 1 = 30s cache / 15s timeout (PHASE 4)');
ok(attemptOptions(1).enableHighAccuracy === false, 'attempt 2 = balanced (no high accuracy)');
ok(attemptOptions(5).enableHighAccuracy === false, 'index clamps to the last attempt');
ok(attemptOptions(-1).enableHighAccuracy === true, 'negative index clamps to attempt 0');

// ── accuracy verdict (PHASE 7) — non-blocking quality signal ────────────────
ok(ACCURACY_THRESHOLD_M === 100, 'threshold is 100m');
ok(accuracyVerdict(18) === 'ok', '18m → ok');
ok(accuracyVerdict(100) === 'ok', '100m boundary → ok');
ok(accuracyVerdict(101) === 'low', '101m → low');
ok(accuracyVerdict(5000) === 'low', '5km → low (weak fix)');
ok(accuracyVerdict(undefined) === 'unknown' && accuracyVerdict(NaN) === 'unknown', 'missing/NaN → unknown');
ok(accuracyVerdict(-5) === 'unknown', 'negative → unknown');

console.log('[LocationRetryPolicy] PASS — ' + passed + ' assertions. Retries only when it can help '
  + '(timeout/unavailable, never a denial); precise→balanced plan; non-blocking accuracy verdict.');
