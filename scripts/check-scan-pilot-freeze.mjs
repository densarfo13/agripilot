#!/usr/bin/env node
/**
 * check-scan-pilot-freeze.mjs — Scan Pilot Freeze contract lock.
 *
 *   • ScanPilotMetricsRuntime pins __scanPilotMetrics +
 *     __scanPilotMetricsHealth with the 6 spec funnel counts +
 *     completionRate. completionRate must be null when scans === 0
 *     (honest NEEDS_DATA, not 0%). noFakeFunnel + noFabricatedCounts
 *     literal-true.
 *   • ScanPilotFreezeHealth pins __scanPilotFreezeHealth with the 8
 *     spec freeze flags (trust / outcomeLoop / escalation /
 *     taskGeneration / followUp / commandCenter / weeklyReview +
 *     noDeadEnds literal-true). architectureFrozen literal-true.
 *   • App.jsx wires both installs.
 *
 * Plus the hard build-safe rules already locked by sibling gates:
 *   • scan has no task / follow-up / outcome path / confidence /
 *     limitations → check:scan-trust + check:scan-v2 + check:scan-accuracy
 *   • low confidence has no escalation path → check:scan-review
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

// 1. ScanPilotMetricsRuntime.
{
  const f = 'src/runtime/scanAccuracy/ScanPilotMetricsRuntime.ts';
  const src = read(f);
  if (src) {
    const required = [
      '__scanPilotMetrics',
      '__scanPilotMetricsHealth',
      'installScanPilotMetricsGlobal',
      'computeScanPilotMetrics',
      'scanPilotMetricsReady',
      'scanPilotMetricsHealth',
      'ScanPilotMetrics',
      // 6 spec funnel fields.
      'scans', 'tasksCreated', 'tasksCompleted',
      'outcomesRecorded', 'followUpScans', 'completionRate',
      'noFakeFunnel: true as const',
      'noFabricatedCounts: true as const',
      // localStorage sources.
      'farroway_scan_memory_log',
      'farroway_scan_outcome_log',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
    // completionRate must be null when scans is 0. Accept any of:
    //   scans > 0 ? ... : null
    //   scans === 0 ? null : ...
    //   !scans ? null : ...
    //   _pctOrNull(num, scans)  (helper that returns null on 0 denom)
    const okPatterns = [
      /completionRate\s*[:=]\s*scans\s*>\s*0\s*\?[\s\S]{0,200}?:\s*null/,
      /scans\s*(?:===|==)\s*0[\s\S]{0,200}?(?:return|completionRate)[\s\S]{0,80}?null/,
      /completionRate\s*[:=]\s*(?:scans\s*(?:===|==)\s*0|!\s*scans)\s*\?\s*null/,
      /\b_pctOrNull\s*\(/,
    ];
    const honestNullPresent = okPatterns.some((re) => re.test(src));
    if (!honestNullPresent)
      fails.push(`${f}: completionRate must be null when scans === 0 (honest NEEDS_DATA)`);
    // No hardcoded percentage fallbacks.
    if (/(?:\?\?|\|\|)\s*\d{2,3}\s*[,;)]/.test(src))
      fails.push(`${f}: forbidden hardcoded percentage fallback`);
  }
}

// 2. ScanPilotFreezeHealth composite.
{
  const f = 'src/runtime/scanAccuracy/ScanPilotFreezeHealth.ts';
  const src = read(f);
  if (src) {
    const required = [
      '__scanPilotFreezeHealth',
      'installScanPilotFreezeHealthGlobal',
      'scanPilotFreezeHealth',
      'ScanPilotFreezeHealthEnvelope',
      // 8 spec freeze flags.
      'trustReady', 'outcomeLoopReady', 'escalationReady',
      'taskGenerationReady', 'followUpReady',
      'commandCenterReady', 'weeklyReviewReady',
      'noDeadEnds: true as const',
      // Honesty constants.
      'noFakeMetrics: true as const',
      'architectureFrozen: true as const',
      // Probes composed.
      '__scanTrustHealth',
      '__scanOutcomeLoopHealth',
      '__scanReviewHealth',
      '__commandCenterHealth',
      '__weeklyFarmReviewHealth',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
  }
}

// 3. App.jsx wires both installs.
{
  const f = 'src/App.jsx';
  const src = read(f);
  if (src) {
    const required = [
      'installScanPilotMetricsGlobal',
      'installScanPilotFreezeHealthGlobal',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}()" install`);
    }
  }
}

if (fails.length) {
  console.error('[check:scan-pilot-freeze] FAILED');
  for (const m of fails) console.error('  - ' + m);
  process.exit(1);
}
console.log('[check:scan-pilot-freeze] OK');
