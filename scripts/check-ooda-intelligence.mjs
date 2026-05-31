#!/usr/bin/env node
/**
 * scripts/check-ooda-intelligence.mjs — §12 OODA integration must be
 * NON-BLOCKING for scan/upload/camera.
 *
 * Fails if:
 *   • the intelligence OODA probe does not declare nonBlocking:true
 *   • the OODA/intelligence layer does not assert grower-safe output
 *   • a SCAN-render component statically imports the intelligence
 *     engines or the OODA engine at module load (which would let an
 *     analysis engine block the camera/upload render path)
 *
 * Intelligence + OODA compose AFTER a scan result — the scan shell must
 * render before any analysis runs. This gate enforces that structurally.
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

// 1. Composite OODA probe is non-blocking + grower-safe.
const composite = read('src/runtime/intelligence/IntelligenceHealthRuntime.ts');
if (!composite) F.push('IntelligenceHealthRuntime.ts: missing');
else {
  if (!/nonBlocking:\s*true/.test(composite))
    F.push('intelligenceOODAHealth must declare nonBlocking:true (OODA never blocks scan/upload)');
  else P.push('OODA probe declares nonBlocking:true');
  if (!/growerSafeOutput/.test(composite))
    F.push('intelligence OODA must assert growerSafeOutput (growers never see raw OODA text)');
  else P.push('OODA probe asserts grower-safe output');
}

// 2. The OODA engine itself documents the non-blocking / grower-safe contract.
const oodaBarrel = read('src/runtime/intelligence/index.ts');
if (oodaBarrel && !/nonBlocking:\s*true/.test(oodaBarrel))
  F.push('__oodaHealth must report nonBlocking:true');
else if (oodaBarrel) P.push('__oodaHealth reports nonBlocking:true');

// 3. Scan-render components must NOT statically import the intelligence
//    engines or the OODA engine (they would couple analysis to render).
const SCAN_COMPONENTS = [
  'src/components/scan/ScanCameraLikeShell.jsx',
  'src/components/scan/ScanHub.jsx',
  'src/components/scan/ScanFallback.jsx',
  'src/components/scan/PlainUploadFallback.jsx',
  'src/pages/ScanPage.jsx',
];
const IMPORT_RE = /import[\s\S]{0,200}?from\s*['"][^'"]*runtime\/intelligence[^'"]*['"]/;
let leaks = 0;
for (const rel of SCAN_COMPONENTS) {
  const src = read(rel);
  if (!src) continue; // optional file
  if (IMPORT_RE.test(src)) { F.push(`${rel}: must NOT statically import runtime/intelligence (would block scan render)`); leaks++; }
}
if (!leaks) P.push('no scan-render component statically imports the intelligence/OODA engines');

if (F.length) {
  console.error('[check:ooda-intelligence] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:ooda-intelligence] PASS — OODA is non-blocking + grower-safe; scan render is decoupled.');
for (const m of P) console.log('  ✓ ' + m);
