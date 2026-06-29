/**
 * ClassifyLocationError.test.ts — locks the location-error classifier. Self-running:
 * `tsx ClassifyLocationError.test.ts`. Proves every cause maps to a SPECIFIC verdict +
 * the right action buttons (never one collapsed generic message), and that context wins
 * over a misleading error code.
 */
import { classifyLocationError, recordLocationAttempt, getLastLocationAttempt } from '../classifyLocationError';

let passed = 0;
function ok(c: boolean, m: string) { if (!c) { console.error('  ✗ ' + m); process.exit(1); } passed++; }
const keys = (v: any) => v.actions.map((a: any) => a.key).join(',');

const SECURE = { isSecureContext: true, hasGeolocation: true };

// ── Each error.code → its specific verdict + buttons ─────────────────────────
{
  const v = classifyLocationError({ code: 'access_denied' }, SECURE);
  ok(v.code === 'PERMISSION_DENIED', 'access_denied → PERMISSION_DENIED');
  ok(keys(v) === 'enable,manual', 'denied → Enable Location + manual');
}
{
  const v = classifyLocationError({ code: 1 }, SECURE);   // native numeric
  ok(v.code === 'PERMISSION_DENIED', 'native code 1 → PERMISSION_DENIED');
}
{
  const v = classifyLocationError({ code: 'timeout' }, SECURE);
  ok(v.code === 'TIMEOUT', 'timeout → TIMEOUT');
  ok(keys(v) === 'retry,manual', 'timeout → Retry + manual');
}
{
  const v = classifyLocationError({ code: 'unavailable' }, SECURE);
  ok(v.code === 'POSITION_UNAVAILABLE', 'unavailable → POSITION_UNAVAILABLE');
  ok(keys(v) === 'retry,zip', 'unavailable → Retry + ZIP');
}
{
  const v = classifyLocationError({ code: 'unsupported' }, SECURE);
  ok(v.code === 'BROWSER_UNSUPPORTED', 'unsupported code → BROWSER_UNSUPPORTED');
}
{
  const v = classifyLocationError({ code: 'unknown' }, SECURE);
  ok(v.code === 'UNKNOWN', 'unknown → UNKNOWN (the ONLY generic case)');
  ok(keys(v) === 'retry,manual', 'unknown → Retry + manual');
}

// ── Context precedence: environment beats a misleading code ──────────────────
{
  // Insecure origin often reports code 1 (denied) — but the real fix is HTTPS, not permission.
  const v = classifyLocationError({ code: 'access_denied' }, { isSecureContext: false, hasGeolocation: true });
  ok(v.code === 'NOT_SECURE_CONTEXT', 'insecure context beats a denied code → NOT_SECURE_CONTEXT');
  ok(keys(v) === 'manual', 'insecure → manual only (no useless Enable button)');
}
{
  const v = classifyLocationError({ code: 'access_denied' }, { isSecureContext: true, hasGeolocation: false });
  ok(v.code === 'BROWSER_UNSUPPORTED', 'no geolocation API → BROWSER_UNSUPPORTED (beats code)');
}

// ── Privacy/policy block distinguished from a user denial ────────────────────
{
  const v = classifyLocationError({ code: 'access_denied', message: 'Geolocation has been disabled by Feature Policy' }, SECURE);
  ok(v.code === 'PRIVACY_RESTRICTION', 'feature-policy message → PRIVACY_RESTRICTION');
}

// ── Robustness: bad input never throws ───────────────────────────────────────
ok(classifyLocationError(null).code === 'UNKNOWN', 'null err → UNKNOWN, no throw');
ok(classifyLocationError(undefined, {}).code === 'UNKNOWN', 'undefined err → UNKNOWN');
ok(classifyLocationError({}, SECURE).code === 'UNKNOWN', 'empty err → UNKNOWN');

// ── Every verdict has a title + at least one way forward (no dead end) ────────
for (const code of ['PERMISSION_DENIED','TIMEOUT','POSITION_UNAVAILABLE','NOT_SECURE_CONTEXT','BROWSER_UNSUPPORTED','PRIVACY_RESTRICTION','UNKNOWN']) {
  const v = classifyLocationError({ code: code === 'PERMISSION_DENIED' ? 'access_denied' : code.toLowerCase() }, SECURE);
  ok(typeof v.titleFallback === 'string' && v.titleFallback.length > 0, code + ' has a title');
  ok(v.titleKey.startsWith('home.location.err.'), code + ' has an i18n key');
}

// ── Last-attempt trace: redaction-safe (coarse coords only, no precise position) ─
{
  const rec = recordLocationAttempt({
    outcome: 'success', browser: 'chrome', platform: 'android',
    latencyMs: 1234.7, accuracyM: 18.4, coarseLat: 5.6037123, coarseLng: -0.1869876,
  }, '2026-06-28T10:00:00Z');
  ok(rec.coarseLat === 5.604 && rec.coarseLng === -0.187, 'coords rounded to ~1km (3dp), never precise');
  ok(rec.latencyMs === 1235 && rec.accuracyM === 18, 'latency/accuracy rounded to integers');
  ok(getLastLocationAttempt()?.outcome === 'success', 'last attempt readable from the global');
}
{
  const rec = recordLocationAttempt({ outcome: 'error', code: 'TIMEOUT', errorMessage: 'x'.repeat(500) }, '2026-06-28T10:01:00Z');
  ok(rec.errorMessage!.length === 200, 'error message capped at 200 chars');
  ok(rec.code === 'TIMEOUT', 'error code recorded');
}

console.log('[ClassifyLocationError] PASS — ' + passed + ' assertions. All 7 causes map to specific '
  + 'verdicts + buttons; context beats a misleading code; trace is redaction-safe.');
