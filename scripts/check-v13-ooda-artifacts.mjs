#!/usr/bin/env node
/**
 * scripts/check-v13-ooda-artifacts.mjs — V13 OODA must never block scan/
 * upload/login, and V13 artifacts must flow through ArtifactRuntime only.
 *
 * Fails if:
 *   • the V13 OODA probe does not declare nonBlocking:true + growerSafeOutput
 *   • a scan-render component statically imports runtime/v13
 *   • the composite does not declare the 10 V13 event types +
 *     artifactRuntimeOnly + idempotency + offlineSafe
 *   • a V13 runtime performs a direct persistence write (fetch / localStorage)
 *   • the canonical ArtifactRuntime is absent
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

if (!read('src/runtime/artifacts/ArtifactRuntime.ts'))
  F.push('src/runtime/artifacts/ArtifactRuntime.ts must exist');
else P.push('canonical ArtifactRuntime present');

const composite = read('src/runtime/v13/V13HealthRuntime.ts');
if (!composite) F.push('V13HealthRuntime.ts: missing');
else {
  if (!/nonBlocking:\s*true/.test(composite))
    F.push('v13OODAHealth must declare nonBlocking:true (never blocks scan/upload/login)');
  else P.push('V13 OODA declares nonBlocking:true');
  if (!/growerSafeOutput/.test(composite)) F.push('V13 OODA must assert growerSafeOutput');
  else P.push('V13 OODA asserts grower-safe output');
  const EVENTS = [
    'EventSnapshotCreated', 'OutcomeLearningSnapshotCreated', 'RegionalNetworkSnapshotCreated',
    'VoiceReadinessChecked', 'YieldPredictionReadinessChecked', 'WarehouseReadinessChecked',
    'FeatureStoreReadinessChecked', 'ModelRegistryReadinessChecked', 'AnalyticsExportCreated',
    'GovernanceCheckCompleted',
  ];
  const missing = EVENTS.filter((e) => !composite.includes(e));
  if (missing.length) F.push(`V13 artifact events missing: ${missing.join(', ')}`);
  else P.push('all 10 V13 event types declared');
  if (!/artifactRuntimeOnly:\s*true/.test(composite)) F.push('composite must declare artifactRuntimeOnly:true');
  else P.push('artifactRuntimeOnly:true declared');
  if (!/idempotenc/i.test(composite)) F.push('composite must surface an idempotency contract');
  else P.push('idempotency contract surfaced');
  if (!/offlineSafe/.test(composite)) F.push('composite must surface offlineSafe');
  else P.push('offlineSafe surfaced');
}

// Scan-render components must NOT import runtime/v13.
const SCAN_COMPONENTS = [
  'src/components/scan/ScanCameraLikeShell.jsx',
  'src/components/scan/ScanHub.jsx',
  'src/components/scan/ScanFallback.jsx',
  'src/components/scan/PlainUploadFallback.jsx',
  'src/pages/ScanPage.jsx',
];
const IMPORT_RE = /import[\s\S]{0,200}?from\s*['"][^'"]*runtime\/v13[^'"]*['"]/;
let leaks = 0;
for (const rel of SCAN_COMPONENTS) {
  const src = read(rel);
  if (!src) continue;
  if (IMPORT_RE.test(src)) { F.push(`${rel}: must NOT statically import runtime/v13`); leaks++; }
}
if (!leaks) P.push('no scan-render component statically imports the V13 runtimes');

// Runtimes must not persist directly.
const DIR = 'src/runtime/v13';
function walk(dir) {
  const out = [];
  let entries = [];
  try { entries = fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...walk(rel));
    else if (e.name.endsWith('.ts')) out.push(rel);
  }
  return out;
}
let writes = 0;
for (const rel of walk(DIR)) {
  const src = strip(read(rel));
  if (!src) continue;
  if (/\bfetch\s*\(/.test(src)) { F.push(`${rel}: no direct fetch — evidence flows via ArtifactRuntime`); writes++; }
  if (/localStorage\.setItem|localStorage\.removeItem|localStorage\.clear/.test(src)) {
    F.push(`${rel}: no direct localStorage write — V13 runtimes are read-only`); writes++;
  }
}
if (!writes) P.push('no V13 runtime performs a direct persistence write (read-only)');

if (F.length) {
  console.error('[check:v13-ooda-artifacts] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:v13-ooda-artifacts] PASS — V13 OODA non-blocking; artifacts via ArtifactRuntime only; read-only.');
for (const m of P) console.log('  ✓ ' + m);
