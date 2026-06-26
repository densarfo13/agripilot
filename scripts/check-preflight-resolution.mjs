/**
 * check-preflight-resolution.mjs — verifies the image-quality preflight blocks
 * too-small photos before the provider call (accuracy + credit-saving).
 *
 * Tests the pure `resolutionOk` helper AND asserts it is wired into
 * scoreImageQuality so the gate can't silently regress.
 */
import fs from 'node:fs';
import path from 'node:path';

const R = process.cwd();
const E = [];
const LIB = 'src/lib/imageQualityPreflight.js';

// 1. The gate must be wired into the scoring path (not just defined).
const src = fs.readFileSync(path.join(R, LIB), 'utf8');
if (!/export function resolutionOk/.test(src)) E.push('resolutionOk must be exported (unit-testable)');
if (!/MIN_DIMENSION/.test(src)) E.push('PREFLIGHT_THRESHOLDS must define MIN_DIMENSION');
if (!/if \(!resolutionOk\(stats\.width, stats\.height\)\)/.test(src)) E.push('scoreImageQuality must call resolutionOk on the real image dimensions');

// 2. Behavioural test of the pure helper.
if (E.length === 0) {
  const mod = await import('file://' + path.join(R, LIB).replace(/\\/g, '/'));
  const { resolutionOk, PREFLIGHT_THRESHOLDS } = mod;
  const MIN = PREFLIGHT_THRESHOLDS.MIN_DIMENSION;
  const cases = [
    [[1536, 2048], true,  'a normalized phone photo passes'],
    [[256, 256],   true,  'exactly the minimum passes'],
    [[200, 200],   false, 'a small thumbnail is rejected'],
    [[4000, 100],  false, 'a thin strip (short side too small) is rejected'],
    [[null, null], true,  'unknown dimensions never block (legacy/SSR safe)'],
    [[0, 0],       true,  'zero dimensions treated as unknown (never block)'],
  ];
  for (const [[w, h], want, label] of cases) {
    const got = resolutionOk(w, h);
    if (got !== want) E.push(`resolutionOk(${w},${h}) = ${got}, expected ${want} — ${label}`);
  }
  if (!(MIN >= 128 && MIN <= 512)) E.push('MIN_DIMENSION should be a conservative 128–512px (got ' + MIN + ')');
}

if (E.length) {
  console.error('[check:preflight-resolution] FAIL — ' + E.length + ' issue(s):');
  for (const e of E) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:preflight-resolution] PASS — too-small photos blocked before the provider call (resolutionOk wired into preflight; 6 behavioural cases green).');
