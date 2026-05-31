#!/usr/bin/env node
/**
 * scripts/check-v8-ooda-artifacts.mjs
 *
 * V8 OODA must never block scan/upload/login, and V8 artifacts must flow
 * through ArtifactRuntime only. Fails if:
 *   • the V8 OODA probe does not declare nonBlocking:true / growerSafeOutput
 *   • a scan-render component statically imports runtime/v8
 *   • the composite does not declare the 7 V8 event types +
 *     artifactRuntimeOnly + idempotency + offlineSafe
 *   • a V8 engine performs a direct persistence write (fetch / localStorage)
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

const composite = read('src/runtime/v8/V8HealthRuntime.ts');
if (!composite) F.push('V8HealthRuntime.ts: missing');
else {
  if (!/nonBlocking:\s*true/.test(composite))
    F.push('v8OODAHealth must declare nonBlocking:true (V8 OODA never blocks scan/upload/login)');
  else P.push('V8 OODA declares nonBlocking:true');
  if (!/growerSafeOutput/.test(composite)) F.push('V8 OODA must assert growerSafeOutput');
  else P.push('V8 OODA asserts grower-safe output');
  const EVENTS = [
    'RegionalRiskSnapshot', 'FarmTwinSnapshot', 'VoiceReadinessChecked',
    'NGOEnterpriseSnapshot', 'SupplyChainReadinessCalculated',
    'RemoteSensingReadinessChecked', 'InstitutionalDataReadinessChecked',
  ];
  const missing = EVENTS.filter((e) => !composite.includes(e));
  if (missing.length) F.push(`V8 artifact events missing: ${missing.join(', ')}`);
  else P.push('all 7 V8 event types declared');
  if (!/artifactRuntimeOnly:\s*true/.test(composite)) F.push('composite must declare artifactRuntimeOnly:true');
  else P.push('artifactRuntimeOnly:true declared');
  if (!/idempotenc/i.test(composite)) F.push('composite must surface an idempotency contract');
  else P.push('idempotency contract surfaced');
  if (!/offlineSafe/.test(composite)) F.push('composite must surface offlineSafe');
  else P.push('offlineSafe surfaced');
}

// Scan-render components must NOT import runtime/v8.
const SCAN_COMPONENTS = [
  'src/components/scan/ScanCameraLikeShell.jsx',
  'src/components/scan/ScanHub.jsx',
  'src/components/scan/ScanFallback.jsx',
  'src/components/scan/PlainUploadFallback.jsx',
  'src/pages/ScanPage.jsx',
];
const IMPORT_RE = /import[\s\S]{0,200}?from\s*['"][^'"]*runtime\/v8[^'"]*['"]/;
let leaks = 0;
for (const rel of SCAN_COMPONENTS) {
  const src = read(rel);
  if (!src) continue;
  if (IMPORT_RE.test(src)) { F.push(`${rel}: must NOT statically import runtime/v8 (would block scan render)`); leaks++; }
}
if (!leaks) P.push('no scan-render component statically imports the V8 engines');

// Engines must not persist directly.
const ENGINES = [
  'regional/RegionalIntelligenceEngine.ts', 'farmTwin/FarmTwinEngine.ts',
  'voice/VoiceAssistantReadiness.ts', 'ngoEnterprise/NGOEnterpriseEngine.ts',
  'supplyChain/SupplyChainIntelligenceEngine.ts',
  'remoteSensing/RemoteSensingReadinessEngine.ts',
  'institutionalData/InstitutionalDataReadiness.ts', 'V8HealthRuntime.ts',
];
let writes = 0;
for (const rel of ENGINES) {
  const src = strip(read(`src/runtime/v8/${rel}`));
  if (!src) continue;
  if (/\bfetch\s*\(/.test(src)) { F.push(`${rel}: no direct fetch — evidence flows via ArtifactRuntime`); writes++; }
  if (/localStorage\.setItem|localStorage\.removeItem|localStorage\.clear/.test(src)) {
    F.push(`${rel}: no direct localStorage write — V8 engines are read-only`); writes++;
  }
}
if (!writes) P.push('no V8 engine performs a direct persistence write (read-only)');

if (F.length) {
  console.error('[check:v8-ooda-artifacts] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:v8-ooda-artifacts] PASS — V8 OODA non-blocking; artifacts via ArtifactRuntime only; engines read-only.');
for (const m of P) console.log('  ✓ ' + m);
