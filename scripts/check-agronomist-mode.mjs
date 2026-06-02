#!/usr/bin/env node
/**
 * check-agronomist-mode.mjs — Scan V3 Agronomist Mode contract lock.
 *
 *   • FarmContextBiasRuntime exists, declares MAX_CONTEXT_BOOST_PCT = 30
 *     and noFabricatedContext + capAtThirtyPct literal-true.
 *   • CommunityScanReviewRuntime exists, declares moderationRequired
 *     + noPublicWritesFromThisRuntime literal-true.
 *   • __agronomistModeHealth pins the 10 spec readiness flags +
 *     noDeadEnds + noFakeIntelligence + noFabricatedConfidence literal-true.
 *
 * Hard build-safe rules already locked by sibling gates:
 *   • Unknown Plant shown without alternatives → check:scan-accuracy
 *   • No task / follow-up / next action → ≥5 ScanFollowUpRuntime branches
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

// 1. FarmContextBiasRuntime.
{
  const f = 'src/runtime/scanAccuracy/FarmContextBiasRuntime.ts';
  const src = read(f);
  if (src) {
    const required = [
      '__farmContextBiasHealth',
      'installFarmContextBiasGlobal',
      'readFarmContext',
      'reRankByFarmContext',
      'farmContextBiasReady',
      'MAX_CONTEXT_BOOST_PCT',
      'FarmContextSnapshot', 'ContextBoostBreakdown',
      'noFabricatedContext: true as const',
      'capAtThirtyPct: true as const',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
    // Hard cap = 30.
    if (src.indexOf('MAX_CONTEXT_BOOST_PCT = 30') < 0)
      fails.push(`${f}: MAX_CONTEXT_BOOST_PCT must equal 30`);
    // Must compose at least the 4 context probes.
    for (const p of ['__commandCenterHealth', '__regionalIntelligenceFieldHealth',
                     '__weatherRiskHealth', '__cropLifecycleHealth']) {
      if (src.indexOf(p) < 0) fails.push(`${f}: must compose probe "${p}"`);
    }
  }
}

// 2. CommunityScanReviewRuntime.
{
  const f = 'src/runtime/scanAccuracy/CommunityScanReviewRuntime.ts';
  const src = read(f);
  if (src) {
    const required = [
      '__communityScanReviewHealth',
      'installCommunityScanReviewGlobal',
      'recordCommunityScanReview',
      'markReviewSubmitted',
      'markReviewResolved',
      'listPendingReviews',
      'communityReviewReady',
      'CommunityScanReviewRecord',
      "'identify'", "'diagnose'",
      'moderationRequired: true as const',
      'noPublicWritesFromThisRuntime: true as const',
      'farroway_community_scan_review_log',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
  }
}

// 3. AgronomistModeHealth composite.
{
  const f = 'src/runtime/scanAccuracy/AgronomistModeHealth.ts';
  const src = read(f);
  if (src) {
    const required = [
      '__agronomistModeHealth',
      'installAgronomistModeHealthGlobal',
      'AgronomistModeHealthEnvelope',
      // 10 spec flags.
      'qualityEngineReady', 'segmentationReady', 'contextReady',
      'multiModelReady', 'issueDetectionReady', 'actionGenerationReady',
      'taskGenerationReady', 'followUpReady', 'outcomeReady',
      'communityReviewReady',
      // Safety constants.
      'noDeadEnds: true as const',
      'noFakeIntelligence: true as const',
      'noFabricatedConfidence: true as const',
      // Composition.
      'FarmContextBiasRuntime',
      'CommunityScanReviewRuntime',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
  }
}

// 4. App.jsx wires the 3 new installs.
{
  const f = 'src/App.jsx';
  const src = read(f);
  if (src) {
    const required = [
      'installFarmContextBiasGlobal',
      'installCommunityScanReviewGlobal',
      'installAgronomistModeHealthGlobal',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}()" install`);
    }
  }
}

if (fails.length) {
  console.error('[check:agronomist-mode] FAILED');
  for (const m of fails) console.error('  - ' + m);
  process.exit(1);
}
console.log('[check:agronomist-mode] OK');
