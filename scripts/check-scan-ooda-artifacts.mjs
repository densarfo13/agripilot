#!/usr/bin/env node
/**
 * scripts/check-scan-ooda-artifacts.mjs — §8/§9 detection→OODA + artifacts.
 *
 * Fails if:
 *   • __scanOODAHealth does not declare nonBlocking + failureSafe
 *   • __scanArtifactHealth does not declare the 9 scan artifact events +
 *     the idempotency key formats + artifactRuntimeOnly
 *   • a scan-render component statically imports the OODA engine
 *   • the canonical ArtifactRuntime is absent
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

const rt = read('src/runtime/scanDetection/ScanDetectionRuntime.ts');
if (!rt) { F.push('src/runtime/scanDetection/ScanDetectionRuntime.ts: missing'); }
else {
  // §8 OODA.
  if (!/observeDetectionReady/.test(rt) || !/decideRecommendationReady/.test(rt) || !/actTaskReady/.test(rt))
    F.push('__scanOODAHealth must surface observe/orient/decide/act detection readiness');
  else P.push('scan OODA surfaces observe/orient/decide/act readiness');
  if (!/nonBlocking/.test(rt)) F.push('__scanOODAHealth must declare nonBlocking');
  else P.push('scan OODA declares nonBlocking');
  if (!/failureSafe/.test(rt)) F.push('__scanOODAHealth must declare failureSafe');
  else P.push('scan OODA declares failureSafe');

  // §9 artifacts.
  const EVENTS = ['ScanStarted', 'ScanCompleted', 'ScanFailed', 'DiagnosisCreated',
    'RecommendationCreated', 'TaskCreatedFromScan', 'PlantCreatedFromScan',
    'FollowUpScanRequested', 'OutcomeFollowUpRequested'];
  // events come via the contract's SCAN_ARTIFACT_EVENTS — check the contract.
  const contract = read('src/runtime/scanDetection/scanDetectionContracts.ts');
  const missing = EVENTS.filter((e) => !contract.includes(e) && !rt.includes(e));
  if (missing.length) F.push(`scan artifact events missing: ${missing.join(', ')}`);
  else P.push('all 9 scan artifact events declared');
  for (const k of ['scan:start:{imageHash}', 'scan:complete:{scanId}', 'scan:failed:{scanId}', 'task:from-scan:{scanId}:{taskType}']) {
    if (!rt.includes(k)) F.push(`__scanArtifactHealth must declare idempotency key format: ${k}`);
  }
  if (!F.some((m) => m.includes('idempotency key format'))) P.push('artifact idempotency key formats declared');
  if (!/artifactRuntimeOnly:\s*true/.test(rt)) F.push('__scanArtifactHealth must declare artifactRuntimeOnly:true');
  else P.push('artifactRuntimeOnly:true declared');
}

if (!read('src/runtime/artifacts/ArtifactRuntime.ts'))
  F.push('canonical ArtifactRuntime must exist');
else P.push('canonical ArtifactRuntime present');

// Scan-render components must not statically import the OODA engine.
const SCAN_COMPONENTS = [
  'src/components/scan/ScanCameraLikeShell.jsx',
  'src/components/scan/ScanHub.jsx',
  'src/components/scan/PlainUploadFallback.jsx',
];
const IMPORT_RE = /import[\s\S]{0,200}?from\s*['"][^'"]*runtime\/intelligence\/OODAEngine[^'"]*['"]/;
let leaks = 0;
for (const rel of SCAN_COMPONENTS) {
  const src = read(rel);
  if (src && IMPORT_RE.test(src)) { F.push(`${rel}: must NOT import the OODA engine`); leaks++; }
}
if (!leaks) P.push('no scan-render component statically imports the OODA engine');

if (F.length) {
  console.error('[check:scan-ooda-artifacts] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:scan-ooda-artifacts] PASS — detection OODA non-blocking/failure-safe; artifacts via ArtifactRuntime.');
for (const m of P) console.log('  ✓ ' + m);
