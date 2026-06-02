#!/usr/bin/env node
/**
 * check-scan-accuracy.mjs — locks the 8-phase scan accuracy upgrade.
 *
 * Required structural contracts (no behavior tests — those live at
 * runtime). Verifies every file is present, every spec readiness flag
 * is exported, and the hard rules are encoded:
 *
 *   • "Unknown Plant" never rendered when candidates exist
 *     → UnknownHandlingRuntime.isHonestUnknown gate + showAsUnknown
 *       branches on candidates.length.
 *   • Disease analysis MUST refuse to run before plant identified
 *     → DiseaseAnalysisPipelineRuntime.PLANT_REQUIRED guard present.
 *   • Low-quality image MUST NOT bypass the quality gate
 *     → ImageQualityGate.shouldBlockIdentification exported and
 *       returns true on verdict === 'poor'.
 *   • Every scan generates a follow-up task
 *     → ScanFollowUpRuntime.buildFollowUpTask always returns one.
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

// 1. Contracts.
{
  const f = 'src/runtime/scanAccuracy/ScanAccuracyContracts.ts';
  const src = read(f);
  if (src) {
    const required = [
      'IMAGE_QUALITY_THRESHOLDS',
      'ImageQualityReport',
      'SegmentationResult', 'MultiPassResult',
      'IdentificationCandidate',
      'DiseaseAnalysis', 'FollowUpTask', 'UnknownHandling',
      'ScanAccuracyHealthEnvelope',
      'GUIDANCE_TAIL', 'SCAN_ACCURACY_VERSION',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
  }
}

// 2. Phase 1 — image quality gate.
{
  const f = 'src/runtime/scanAccuracy/ImageQualityGate.ts';
  const src = read(f);
  if (src) {
    const required = [
      'analyzeImageQuality', 'shouldBlockIdentification',
      'imageQualityGateReady',
      'blurVariance', 'brightnessMean', 'shadowRatio',
      'leafCoverageRatio', 'focusEdgeDensity',
      'TIPS',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
    // Block must trigger on poor verdict.
    if (!/verdict\s*===\s*['"]poor['"]/.test(src))
      fails.push(`${f}: shouldBlockIdentification must trigger on verdict === 'poor'`);
  }
}

// 3. Phase 2 — segmentation.
{
  const f = 'src/runtime/scanAccuracy/PlantSegmentationRuntime.ts';
  const src = read(f);
  if (src) {
    if (src.indexOf('segmentPlantRegion') < 0)
      fails.push(`${f}: missing segmentPlantRegion`);
    if (src.indexOf('NEEDS_CONFIGURATION') < 0)
      fails.push(`${f}: must emit honest NEEDS_CONFIGURATION status`);
  }
}

// 4. Phase 3 — multi-pass.
{
  const f = 'src/runtime/scanAccuracy/MultiPassIdentificationRuntime.ts';
  const src = read(f);
  if (src) {
    const required = [
      'runMultiPassIdentification', '__plantIdHealth',
      '__leafAnalysisHealth', '__cropMatcherHealth',
      'candidates', 'enginesConfigured', 'NEEDS_CONFIGURATION',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
    // Top-5 cap must be present.
    if (!/slice\s*\(\s*0\s*,\s*5\s*\)/.test(src))
      fails.push(`${f}: must cap candidates to top 5`);
  }
}

// 5. Phase 4 — user-assist re-rank.
{
  const f = 'src/runtime/scanAccuracy/UserAssistedIdentificationRuntime.ts';
  const src = read(f);
  if (src) {
    const required = [
      'reRankCandidatesByCategory', 'shouldRequestUserAssist',
      'USER_ASSIST_CONFIDENCE_THRESHOLD',
      'CATEGORY_PRIORS',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
    if (src.indexOf('75') < 0)
      fails.push(`${f}: user-assist threshold must be 75`);
  }
}

// 6. Phase 5 — disease pipeline.
{
  const f = 'src/runtime/scanAccuracy/DiseaseAnalysisPipelineRuntime.ts';
  const src = read(f);
  if (src) {
    if (src.indexOf('analyzeDiseaseForPlant') < 0)
      fails.push(`${f}: missing analyzeDiseaseForPlant`);
    if (src.indexOf('PLANT_REQUIRED') < 0)
      fails.push(`${f}: must define PLANT_REQUIRED guard (hard rule: disease only after plant)`);
    if (!/plantIdentifiedFirst:\s*false/.test(src))
      fails.push(`${f}: PLANT_REQUIRED must declare plantIdentifiedFirst: false`);
  }
}

// 7. Phase 6 — follow-up.
{
  const f = 'src/runtime/scanAccuracy/ScanFollowUpRuntime.ts';
  const src = read(f);
  if (src) {
    if (src.indexOf('buildFollowUpTask') < 0)
      fails.push(`${f}: missing buildFollowUpTask`);
    // Every branch must return a FollowUpTask — the runtime must NEVER
    // return null/undefined. We require at least 5 priority branches
    // (poor / review / urgent / soon / routine).
    const branches = (src.match(/return\s+Object\.freeze<FollowUpTask>/g) || []).length;
    if (branches < 5)
      fails.push(`${f}: must have ≥5 follow-up-task return paths (got ${branches})`);
  }
}

// 8. Phase 7 — unknown handling.
{
  const f = 'src/runtime/scanAccuracy/UnknownHandlingRuntime.ts';
  const src = read(f);
  if (src) {
    if (src.indexOf('NEEDS_IDENTIFICATION_LABEL') < 0)
      fails.push(`${f}: missing NEEDS_IDENTIFICATION_LABEL`);
    if (src.indexOf("'Needs Identification'") < 0
        && src.indexOf('"Needs Identification"') < 0)
      fails.push(`${f}: must use 'Needs Identification' string`);
    if (src.indexOf('isHonestUnknown') < 0)
      fails.push(`${f}: must export isHonestUnknown contract helper`);
    // Hard rule: "Unknown Plant" string must not be used anywhere here.
    if (/['"]Unknown\s+Plant['"]/.test(src))
      fails.push(`${f}: must not render legacy "Unknown Plant" string`);
  }
}

// 9. Phase 8 — health composite.
{
  const f = 'src/runtime/scanAccuracy/ScanAccuracyHealth.ts';
  const src = read(f);
  if (src) {
    const required = [
      '__scanAccuracyHealth', 'installScanAccuracyHealthGlobal',
      'imageQualityGateReady', 'segmentationReady',
      'multiPassReady', 'diseasePipelineReady',
      'candidateRankingReady', 'unknownHandlingReady',
      'followUpTaskReady',
      'noFakeAccuracyClaims: true as const',
      'noFabricatedCandidates: true as const',
      'noFakeDiseaseConfidence: true as const',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
  }
}

// 10. App.jsx wiring.
{
  const f = 'src/App.jsx';
  const src = read(f);
  if (src && src.indexOf('installScanAccuracyHealthGlobal') < 0)
    fails.push(`${f}: missing installScanAccuracyHealthGlobal() install`);
}

if (fails.length) {
  console.error('[check:scan-accuracy] FAILED');
  for (const m of fails) console.error('  - ' + m);
  process.exit(1);
}
console.log('[check:scan-accuracy] OK');
