#!/usr/bin/env node
/**
 * scripts/check-v7-ooda-safety.mjs — V7 OODA must NEVER block scan/upload.
 *
 * Fails if:
 *   • the V7 OODA probe does not declare nonBlocking:true
 *   • V7 OODA does not assert grower-safe output
 *   • a SCAN-render component statically imports runtime/v7 (which would
 *     couple analysis to the camera/upload render path)
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

const composite = read('src/runtime/v7/V7HealthRuntime.ts');
if (!composite) F.push('V7HealthRuntime.ts: missing');
else {
  if (!/nonBlocking:\s*true/.test(composite))
    F.push('v7OODAHealth must declare nonBlocking:true (V7 OODA never blocks scan/upload)');
  else P.push('V7 OODA declares nonBlocking:true');
  if (!/growerSafeOutput/.test(composite))
    F.push('V7 OODA must assert growerSafeOutput');
  else P.push('V7 OODA asserts grower-safe output');
  if (!/__v7OODAHealth/.test(composite))
    F.push('V7HealthRuntime must install __v7OODAHealth');
  else P.push('__v7OODAHealth installed');
}

// Scan-render components must NOT statically import runtime/v7.
const SCAN_COMPONENTS = [
  'src/components/scan/ScanCameraLikeShell.jsx',
  'src/components/scan/ScanHub.jsx',
  'src/components/scan/ScanFallback.jsx',
  'src/components/scan/PlainUploadFallback.jsx',
  'src/pages/ScanPage.jsx',
];
const IMPORT_RE = /import[\s\S]{0,200}?from\s*['"][^'"]*runtime\/v7[^'"]*['"]/;
let leaks = 0;
for (const rel of SCAN_COMPONENTS) {
  const src = read(rel);
  if (!src) continue;
  if (IMPORT_RE.test(src)) { F.push(`${rel}: must NOT statically import runtime/v7 (would block scan render)`); leaks++; }
}
if (!leaks) P.push('no scan-render component statically imports the V7 engines');

if (F.length) {
  console.error('[check:v7-ooda-safety] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:v7-ooda-safety] PASS — V7 OODA is non-blocking + grower-safe; scan render decoupled.');
for (const m of P) console.log('  ✓ ' + m);
