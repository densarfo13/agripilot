/**
 * scanRetryEngine.test.ts — provider-interaction resilience. Locks all nine failure
 * modes from the Scan Reliability mandate: transient failures retry, terminal ones give
 * up immediately, cancellation is honored, nothing throws, nothing is fabricated.
 * Self-running: `tsx scanRetryEngine.test.ts`.
 */
import {
  withScanRetry, isRetriableScanFailure, _setDelayForTests, _resetDelayForTests,
} from '../scanRetryEngine.js';

let passed = 0;
function ok(c: boolean, m: string) { if (!c) { console.error('  ✗ ' + m); process.exit(1); } passed++; }

_setDelayForTests(() => Promise.resolve()); // no real sleeps

// helper: a fn that fails N times (with a reason) then succeeds
function failsThenSucceeds(failCount: number, reason: string) {
  let n = 0;
  return async () => {
    if (n++ < failCount) return { ok: false, reason };
    return { ok: true, name: 'tomato' };
  };
}
const run = (fn: any, opts: any = {}) => withScanRetry(fn, { maxAttempts: 3, jitter: false, ...opts });

(async () => {
  // ── isRetriableScanFailure: TRANSIENT → retry ──────────────────────
  ok(isRetriableScanFailure('request timed out') === true, 'timeout is transient');
  ok(isRetriableScanFailure('http_500') === true, 'http 500 is transient');
  ok(isRetriableScanFailure('fetch failed') === true, 'network is transient');
  ok(isRetriableScanFailure('http_429 rate limit') === true, 'rate-limit is transient (retry w/ backoff)');
  ok(isRetriableScanFailure('') === true, 'unknown/empty reason → retry (safe default)');

  // ── isRetriableScanFailure: TERMINAL → do NOT retry ────────────────
  ok(isRetriableScanFailure('http_401') === false, 'auth 401 is terminal');
  ok(isRetriableScanFailure('invalid api key') === false, 'auth text is terminal');
  ok(isRetriableScanFailure('http_402 credits exhausted') === false, 'credits 402 is terminal');
  ok(isRetriableScanFailure('unexpected token in JSON') === false, 'malformed body is terminal');
  ok(isRetriableScanFailure('no_candidates') === false, 'empty candidates is terminal (same photo → same empty)');

  // ── RETRY: a transient failure is retried, then succeeds ───────────
  const r1 = await run(failsThenSucceeds(2, 'timeout'), { shouldRetry: isRetriableScanFailure });
  ok(r1.ok === true && r1.attempts === 3 && r1.value.name === 'tomato', 'transient: retried twice then succeeded');

  // ── TIMEOUT / NETWORK / 429 are retried to the budget ──────────────
  for (const reason of ['request timed out', 'http_500', 'fetch failed', 'rate limit exceeded']) {
    const v = await run(async () => ({ ok: false, reason }), { shouldRetry: isRetriableScanFailure });
    ok(v.ok === false && v.attempts === 3 && !v.gaveUp, `transient "${reason}" → retried to budget (3), no early give-up`);
  }

  // ── TERMINAL gives up on attempt 1 (no wasted retries) ─────────────
  for (const reason of ['http_401', 'http_402', 'unexpected token in JSON', 'no_candidates']) {
    const v = await run(async () => ({ ok: false, reason }), { shouldRetry: isRetriableScanFailure });
    ok(v.ok === false && v.attempts === 1 && v.gaveUp === 'terminal', `terminal "${reason}" → stopped after 1 attempt`);
  }

  // ── CANCELLATION: stale session short-circuits, never crashes ──────
  const r2 = await run(async () => ({ ok: false, reason: 'timeout' }), {
    shouldRetry: isRetriableScanFailure, isStale: () => true,
  });
  ok(r2.ok === false && r2.stale === true && r2.attempts === 0, 'cancellation (stale) → stale verdict, no attempt');

  // ── NEVER THROWS: fn that throws becomes a verdict, not a crash ─────
  const r3 = await run(async () => { throw new Error('boom'); }, { shouldRetry: isRetriableScanFailure, maxAttempts: 2 });
  ok(r3.ok === false && /boom/.test(r3.lastError), 'thrown error → verdict ok:false (never throws)');

  // ── BACKWARD-COMPAT: no shouldRetry → retries every failure (today) ─
  const r4 = await run(async () => ({ ok: false, reason: 'http_401' }));
  ok(r4.ok === false && r4.attempts === 3 && !r4.gaveUp, 'no predicate → retries all (backward-compatible)');

  // ── NEVER FABRICATES: failure verdict carries no invented success ──
  const r5 = await run(async () => ({ ok: false, reason: 'http_402' }), { shouldRetry: isRetriableScanFailure });
  ok(r5.value === null, 'failure verdict has null value — never a fabricated result');

  console.log('[scanRetryEngine] PASS — ' + passed + ' assertions. Transient failures retry; terminal '
    + '(auth/credits/malformed/empty) give up immediately; cancellation honored; never throws; never fabricates.');
})();
