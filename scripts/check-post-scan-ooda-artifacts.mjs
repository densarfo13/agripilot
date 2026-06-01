#!/usr/bin/env node
/**
 * scripts/check-post-scan-ooda-artifacts.mjs — §6/§7 post-scan OODA must be
 * non-blocking; artifacts via ArtifactRuntime only.
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

const rel = 'src/runtime/intelligence/PostScanIntelligenceRuntime.ts';
const raw = read(rel);
if (!raw) { F.push(`${rel}: missing`); }
else {
  // §6 OODA.
  for (const k of ['outcomeLoopIntegrated', 'farmTwinIntegrated', 'regionalIntegrated',
    'riskScoringIntegrated', 'ngoReportingIntegrated']) {
    if (!raw.includes(k)) F.push(`__postScanOODAHealth must surface ${k}`);
  }
  if (!F.some((m) => m.includes('Integrated'))) P.push('all post-scan integrations surfaced');
  if (!/nonBlocking:\s*true/.test(raw)) F.push('__postScanOODAHealth must declare nonBlocking:true');
  else P.push('OODA non-blocking');
  if (!/failureSafe:\s*true/.test(raw)) F.push('__postScanOODAHealth must declare failureSafe:true');
  else P.push('OODA failure-safe');
  if (!/growerSafe/.test(raw)) F.push('__postScanOODAHealth must assert growerSafe');
  else P.push('grower-safe output');
  // §7 artifacts.
  const EVENTS = ['OutcomeLearningSnapshotCreated', 'FarmTwinSnapshotCreated',
    'RegionalRiskSignalCreated', 'ScanRiskScoreCalculated',
    'NGOImpactAggregateCreated', 'FollowUpOutcomeRequested'];
  const missing = EVENTS.filter((e) => !raw.includes(e));
  if (missing.length) F.push(`post-scan artifact events missing: ${missing.join(', ')}`);
  else P.push('all 6 post-scan artifact events declared');
  if (!/artifactRuntimeOnly:\s*true/.test(raw)) F.push('must declare artifactRuntimeOnly:true');
  else P.push('artifactRuntimeOnly:true');
  if (!/idempotent/.test(raw)) F.push('must surface idempotent');
  else P.push('idempotent surfaced');
}

if (!read('src/runtime/artifacts/ArtifactRuntime.ts'))
  F.push('canonical ArtifactRuntime must exist');
else P.push('canonical ArtifactRuntime present');

// Scan-render components must NOT statically import the post-scan runtimes.
const SCAN_COMPONENTS = [
  'src/components/scan/ScanCameraLikeShell.jsx',
  'src/components/scan/ScanHub.jsx',
  'src/components/scan/PlainUploadFallback.jsx',
];
const IMPORT_RE = /import[\s\S]{0,200}?from\s*['"][^'"]*(intelligence\/(outcomes|farmTwin|regional|ngo|PostScan)|scanRisk)[^'"]*['"]/;
let leaks = 0;
for (const c of SCAN_COMPONENTS) {
  const src = read(c);
  if (src && IMPORT_RE.test(src)) { F.push(`${c}: must NOT import a post-scan intelligence runtime`); leaks++; }
}
if (!leaks) P.push('no scan-render component imports the post-scan runtimes');

if (F.length) {
  console.error('[check:post-scan-ooda-artifacts] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:post-scan-ooda-artifacts] PASS — non-blocking OODA; 6 events via ArtifactRuntime; scan decoupled.');
for (const m of P) console.log('  ✓ ' + m);
