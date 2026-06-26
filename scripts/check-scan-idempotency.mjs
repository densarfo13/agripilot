/**
 * check-scan-idempotency.mjs — duplicate-scan guard (provider-credit protection).
 * Tests beginScan/endScan (fail-open; blocks only certain duplicates) and asserts
 * the guard is wired into the analyzeImage path.
 */
import fs from 'node:fs';
import path from 'node:path';

const R = process.cwd();
const E = [];
const LIB = 'src/lib/scanIdempotency.js';
const src = fs.readFileSync(path.join(R, LIB), 'utf8');
for (const tok of ['export function beginScan', 'export function endScan', 'FAIL-OPEN'])
  if (!src.includes(tok)) E.push('missing token: ' + tok);

// Wired into the scan analyze path.
const hook = fs.readFileSync(path.join(R, 'src/hooks/useScanRuntime.js'), 'utf8');
if (!/beginScan\(key\)/.test(hook)) E.push('useScanRuntime.analyzeImage must call beginScan(key)');
if (!/duplicate_ignored/.test(hook)) E.push('analyzeImage must short-circuit a duplicate with duplicate_ignored');
if (!/endScan\(key\)/.test(hook)) E.push('analyzeImage must call endScan(key) when the scan settles');

// Behavioural test.
if (E.length === 0) {
  const mod = await import('file://' + path.join(R, LIB).replace(/\\/g, '/'));
  const { beginScan, endScan, resetScanIdempotency } = mod;
  resetScanIdempotency();
  const t0 = 1_000_000;
  // First scan of a key proceeds; an immediate second is blocked (the double-tap).
  if (beginScan('s1', t0) !== true) E.push('first scan of a key must proceed');
  if (beginScan('s1', t0 + 50) !== false) E.push('immediate duplicate of an in-flight key must be blocked');
  endScan('s1', t0 + 100);
  // A re-submit just after completion is still a duplicate (within the window).
  if (beginScan('s1', t0 + 200) !== false) E.push('re-submit within the window must be blocked');
  // A legitimate NEW scan (different key) always proceeds.
  if (beginScan('s2', t0 + 200) !== true) E.push('a different key must always proceed');
  // After the window, the same key is allowed again (fail-open over time).
  if (beginScan('s1', t0 + 100 + 6001) !== true) E.push('after the window the key is allowed again');
  // FAIL-OPEN: empty/missing key never blocks.
  if (beginScan('', t0) !== true || beginScan(null, t0) !== true) E.push('missing key must never block (fail-open)');
  resetScanIdempotency();
}

if (E.length) {
  console.error('[check:scan-idempotency] FAIL — ' + E.length + ' issue(s):');
  for (const e of E) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:scan-idempotency] PASS — duplicate scans blocked (fail-open; only certain duplicates), wired into analyzeImage — protects provider credits.');
