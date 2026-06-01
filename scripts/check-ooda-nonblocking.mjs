#!/usr/bin/env node
/**
 * scripts/check-ooda-nonblocking.mjs — §4 OODA must never block Scan.
 *
 * Fails if:
 *   • __intelligenceOODAHealth does not declare nonBlocking + failureSafe +
 *     scanIntegrated
 *   • a scan-render component statically imports the OODA engine
 *     (runtime/intelligence), which would couple OODA to the render path
 *   • __oodaHealth does not report nonBlocking
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

const composite = read('src/runtime/intelligence/IntelligenceHealthRuntime.ts');
if (!composite) F.push('IntelligenceHealthRuntime.ts: missing');
else {
  if (!/nonBlocking:\s*true/.test(composite))
    F.push('__intelligenceOODAHealth must declare nonBlocking:true');
  else P.push('OODA declares nonBlocking:true');
  if (!/failureSafe:\s*true/.test(composite))
    F.push('__intelligenceOODAHealth must declare failureSafe:true (OODA failure never crashes Scan)');
  else P.push('OODA declares failureSafe:true');
  if (!/scanIntegrated/.test(composite))
    F.push('__intelligenceOODAHealth must surface scanIntegrated');
  else P.push('OODA surfaces scanIntegrated');
}

const ooda = read('src/runtime/intelligence/index.ts');
if (ooda && !/nonBlocking:\s*true/.test(ooda)) F.push('__oodaHealth must report nonBlocking:true');
else if (ooda) P.push('__oodaHealth reports nonBlocking:true');

// Scan-render components must NOT statically import the OODA engine.
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
  if (!src) continue;
  if (IMPORT_RE.test(src)) { F.push(`${rel}: must NOT statically import the OODA engine (runtime/intelligence)`); leaks++; }
}
if (!leaks) P.push('no scan-render component statically imports the OODA engine');

if (F.length) {
  console.error('[check:ooda-nonblocking] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:ooda-nonblocking] PASS — OODA non-blocking + failure-safe; scan render decoupled.');
for (const m of P) console.log('  ✓ ' + m);
