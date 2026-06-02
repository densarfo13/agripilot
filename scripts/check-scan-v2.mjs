#!/usr/bin/env node
/**
 * check-scan-v2.mjs — locks the Scan V2 Field Assistant contract.
 *
 *   §STAGE 12  ScanTimelineRuntime exposes buildScanTimeline + 5 event kinds
 *   §STAGE 13  CommandCenterScanIntegration surfaces the 5 CC scan fields
 *   §STAGE 14  ScanV2Health pins __scanV2Health with the 11 spec flags
 *
 * Hard build-safe rules (composing prior gates):
 *   • Unknown Plant displayed without alternatives — locked by check:scan-accuracy
 *   • No task created after scan — locked by ≥5 ScanFollowUpRuntime branches
 *   • No follow-up created — same
 *   • No outcome capture — ScanOutcomeLoopRuntime must be wired
 *   • No next action — followUpTaskReady literal-true safety constant
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const fails = [];
const read = (rel) => {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) { fails.push(`missing: ${rel}`); return ''; }
  return fs.readFileSync(p, 'utf8');
};

// 1. ScanTimelineRuntime.
{
  const f = 'src/runtime/scanAccuracy/ScanTimelineRuntime.ts';
  const src = read(f);
  if (src) {
    const required = [
      'buildScanTimeline', 'ScanTimelineEvent', 'ScanTimelineEventKind',
      'scanTimelineReady', 'scanTimelineHealth',
      '__scanTimelineHealth', 'installScanTimelineGlobal',
      'noFakeTimelineEvents: true as const',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
    // Must enumerate the 5 spec event kinds.
    for (const kind of ["'first_scan'", "'issue_found'", "'task_created'",
                         "'follow_up'", "'outcome'"]) {
      if (src.indexOf(kind) < 0) fails.push(`${f}: missing event kind ${kind}`);
    }
    if (src.indexOf('__farmScanMemoryHealth') < 0)
      fails.push(`${f}: must compose __farmScanMemoryHealth`);
  }
}

// 2. CommandCenter scan integration.
{
  const f = 'src/runtime/scanAccuracy/CommandCenterScanIntegration.ts';
  const src = read(f);
  if (src) {
    const required = [
      'readCommandCenterScanIntegration',
      'CCScanIntegration', 'LastScanSummary', 'OpenIssue',
      'ccScanIntegrationHealth', '__ccScanIntegrationHealth',
      'installCommandCenterScanIntegrationGlobal',
      'noFabricatedSurface: true as const',
      'lastScan', 'currentHealth', 'openIssue',
      'nextActionTitle', 'followUpDueLabel',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
    // Must compose CC + farm-health probes (not invent values).
    for (const p of ['__commandCenterHealth', '__farmScanMemoryHealth',
                     '__farmHealthScoreHealth']) {
      if (src.indexOf(p) < 0) fails.push(`${f}: must compose probe "${p}"`);
    }
  }
}

// 3. ScanV2Health composite.
{
  const f = 'src/runtime/scanAccuracy/ScanV2Health.ts';
  const src = read(f);
  if (src) {
    const required = [
      '__scanV2Health', 'installScanV2HealthGlobal',
      'ScanV2HealthEnvelope',
      'qualityGateReady', 'autoCropReady', 'consensusPlantIdReady',
      'issueDetectionReady', 'actionEngineReady', 'taskGenerationReady',
      'followUpReady', 'outcomeCaptureReady', 'farmMemoryReady',
      'scanTimelineReady',
      'noDeadEnds: true as const',
      'noFakeIntelligence: true as const',
      'noFabricatedConfidence: true as const',
      'composedFrom',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
  }
}

// 4. Timeline UI card.
{
  const f = 'src/components/scan/ScanTimelineCard.jsx';
  const src = read(f);
  if (src) {
    if (src.indexOf('scan-timeline-card') < 0)
      fails.push(`${f}: missing data-testid="scan-timeline-card"`);
    if (src.indexOf('buildScanTimeline') < 0)
      fails.push(`${f}: must call buildScanTimeline()`);
    if (src.indexOf('scanTimeline.empty.title') < 0)
      fails.push(`${f}: missing i18n key scanTimeline.empty.title (empty state)`);
    for (const k of ['first_scan', 'issue_found', 'task_created',
                     'follow_up', 'outcome']) {
      if (src.indexOf(`scanTimeline.kind.${k}`) < 0)
        fails.push(`${f}: missing i18n key scanTimeline.kind.${k}`);
    }
  }
}

// 5. App.jsx wires the 3 new installs.
{
  const f = 'src/App.jsx';
  const src = read(f);
  if (src) {
    const required = [
      'installScanTimelineGlobal',
      'installCommandCenterScanIntegrationGlobal',
      'installScanV2HealthGlobal',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}()" install`);
    }
  }
}

if (fails.length) {
  console.error('[check:scan-v2] FAILED');
  for (const m of fails) console.error('  - ' + m);
  process.exit(1);
}
console.log('[check:scan-v2] OK');
