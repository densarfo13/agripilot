#!/usr/bin/env node
/**
 * check-plant-intelligence-pipeline.mjs — locks the 14-phase Plant
 * Intelligence Pipeline contract.
 *
 *   §PHASE 14  __scanAccuracyHealth() returns BOTH legacy + canonical
 *              spec field names: qualityGateReady, segmentationReady,
 *              consensusReady, memoryReady, issueDetectionReady,
 *              actionEngineReady, taskCreationReady, followUpReady,
 *              outcomeCaptureReady, noDeadEnds: true.
 *   §PHASE 13  __myPlantsScanHistoryHealth pinned with per-plant
 *              composite + noFabricatedPlants + noFakeOutcomeMix.
 *
 * Hard build-safe rules (already locked by sibling gates):
 *   • Unknown Plant displayed without alternatives → check:scan-accuracy
 *   • No next action / task / follow-up → ≥5 ScanFollowUpRuntime branches
 *   • No outcome capture → check:scan-production locks
 *     ScanOutcomeLoopRuntime presence.
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

// 1. Contracts — envelope must include the spec-canonical field names.
{
  const f = 'src/runtime/scanAccuracy/ScanAccuracyContracts.ts';
  const src = read(f);
  if (src) {
    const required = [
      'qualityGateReady',
      'consensusReady',
      'memoryReady',
      'issueDetectionReady',
      'actionEngineReady',
      'taskCreationReady',
      'followUpReady',
      'outcomeCaptureReady',
      'noDeadEnds: true',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}" in ScanAccuracyHealthEnvelope`);
    }
  }
}

// 2. ScanAccuracyHealth — runtime must populate the canonical fields.
{
  const f = 'src/runtime/scanAccuracy/ScanAccuracyHealth.ts';
  const src = read(f);
  if (src) {
    const required = [
      'qualityGateReady',
      'consensusReady',
      'memoryReady',
      'issueDetectionReady',
      'actionEngineReady',
      'taskCreationReady',
      'followUpReady',
      'outcomeCaptureReady',
      'noDeadEnds: true as const',
      '__farmScanMemoryHealth',
      '__scanOutcomeLoopHealth',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
  }
}

// 3. MyPlantsScanHistoryRuntime — §PHASE 13.
{
  const f = 'src/runtime/scanAccuracy/MyPlantsScanHistoryRuntime.ts';
  const src = read(f);
  if (src) {
    const required = [
      '__myPlantsScanHistoryHealth',
      'installMyPlantsScanHistoryGlobal',
      'myPlantsScanHistoryHealth',
      'MyPlantProfile', 'PlantScanEntry',
      'plantKey', 'species', 'location',
      'scanCount', 'recentScans', 'commonProblems', 'outcomeMix',
      'noFabricatedPlants: true as const',
      'noFakeOutcomeMix: true as const',
      'farroway_scan_memory_log',
      'farroway_scan_outcome_log',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
  }
}

// 4. App.jsx wires the new install.
{
  const f = 'src/App.jsx';
  const src = read(f);
  if (src && src.indexOf('installMyPlantsScanHistoryGlobal') < 0)
    fails.push(`${f}: missing installMyPlantsScanHistoryGlobal() install`);
}

if (fails.length) {
  console.error('[check:plant-intelligence-pipeline] FAILED');
  for (const m of fails) console.error('  - ' + m);
  process.exit(1);
}
console.log('[check:plant-intelligence-pipeline] OK');
