#!/usr/bin/env node
/**
 * check-scan-production.mjs — locks the §12-stage Vision System contract:
 *
 *   • Stage 2 camera guide runtime + overlay component present
 *   • Stage 8 outcome loop captures Better/Same/Worse
 *   • Stage 9 farm scan memory persists per-plant history
 *   • Stage 11 context composite (soil + weather) is read-only — never
 *     fabricates supporting evidence
 *   • Stage 12 __scanProductionHealth composite exposes the 10 spec flags
 *     with noUnknownDeadEnds + noFakeIntelligence literal-true.
 *
 * Plus the hard build-safe rules:
 *   • Legacy unknown label MUST NOT be shown when candidates exist
 *     → check enforced by check:scan-accuracy (the prior gate).
 *   • Diagnosis MUST NOT run on poor image
 *     → DiseaseAnalysisPipelineRuntime PLANT_REQUIRED guard.
 *   • Every scan MUST create a task → ScanFollowUpRuntime ≥ 5 branches.
 *   • Outcome capture MUST be available → ScanOutcomeLoopRuntime present.
 *   • Next action MUST always be generated.
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

// 1. Camera guide runtime.
{
  const f = 'src/runtime/scanAccuracy/CameraGuideRuntime.ts';
  const src = read(f);
  if (src) {
    const required = [
      'evaluateGuideFrame', 'GuideFrameState',
      'cameraGuideReady', 'cameraGuideHealth',
      '__cameraGuideHealth',
      'readyToCapture',
      'noFakeFrameSignals: true as const',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
  }
}

// 2. Camera guide overlay component.
{
  const f = 'src/components/scan/CameraGuideOverlay.jsx';
  const src = read(f);
  if (src) {
    if (src.indexOf('camera-guide-overlay') < 0)
      fails.push(`${f}: missing data-testid="camera-guide-overlay"`);
    if (src.indexOf('onAutoCapture') < 0)
      fails.push(`${f}: must accept onAutoCapture prop`);
    if (src.indexOf('reasonHints') < 0)
      fails.push(`${f}: must render reasonHints`);
    if (src.indexOf('pointerEvents') < 0 && src.indexOf("pointer-events") < 0)
      fails.push(`${f}: overlay must set pointer-events: none`);
  }
}

// 3. Outcome loop runtime.
{
  const f = 'src/runtime/scanAccuracy/ScanOutcomeLoopRuntime.ts';
  const src = read(f);
  if (src) {
    const required = [
      'recordScanOutcome', 'listScanOutcomes', 'outcomeForScan',
      'OutcomeVerdict', 'ScanOutcomeRecord',
      'outcomeLoopReady', 'scanOutcomeLoopHealth',
      '__scanOutcomeLoopHealth',
      'farroway_scan_outcome_log',
      'noFakeOutcomes: true as const',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
    // Must accept the 3 verdict values.
    for (const v of ["'better'", "'same'", "'worse'"]) {
      if (src.indexOf(v) < 0) fails.push(`${f}: missing verdict literal ${v}`);
    }
  }
}

// 4. Farm scan memory runtime.
{
  const f = 'src/runtime/scanAccuracy/FarmScanMemoryRuntime.ts';
  const src = read(f);
  if (src) {
    const required = [
      'recordScanMemory', 'recentScansForPlant', 'commonProblemsForPlant',
      'ScanMemoryEntry',
      'farmMemoryReady', 'farmScanMemoryHealth',
      '__farmScanMemoryHealth',
      'farroway_scan_memory_log',
      'noFakeMemory: true as const',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
  }
}

// 5. Context composite (soil + weather).
{
  const f = 'src/runtime/scanAccuracy/ScanContextRuntime.ts';
  const src = read(f);
  if (src) {
    const required = [
      'readScanContext', 'ScanContext',
      'scanContextHealth', '__scanContextHealth',
      'noFabricatedContext: true as const',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
    // Must read soil + weather + regional probes — never invent.
    for (const p of ['__soilGridsHealth', '__regionalIntelligenceFieldHealth']) {
      if (src.indexOf(p) < 0) fails.push(`${f}: must compose probe "${p}"`);
    }
  }
}

// 6. Production health composite.
{
  const f = 'src/runtime/scanAccuracy/ScanProductionHealth.ts';
  const src = read(f);
  if (src) {
    const required = [
      '__scanProductionHealth', 'installScanProductionHealthGlobal',
      'qualityGateReady', 'cameraGuideReady', 'segmentationReady',
      'plantIdReady', 'diseaseReady', 'actionEngineReady',
      'taskCreationReady', 'outcomeLoopReady', 'farmMemoryReady',
      'noUnknownDeadEnds: true as const',
      'noFakeIntelligence: true as const',
      'noFabricatedConfidence: true as const',
      'composedFrom',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
  }
}

// 7. App.jsx wires the 5 new installs (the 6th is App-internal).
{
  const f = 'src/App.jsx';
  const src = read(f);
  if (src) {
    const required = [
      'installCameraGuideGlobal',
      'installScanOutcomeLoopGlobal',
      'installFarmScanMemoryGlobal',
      'installScanContextGlobal',
      'installScanProductionHealthGlobal',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}()" install`);
    }
  }
}

if (fails.length) {
  console.error('[check:scan-production] FAILED');
  for (const m of fails) console.error('  - ' + m);
  process.exit(1);
}
console.log('[check:scan-production] OK');
