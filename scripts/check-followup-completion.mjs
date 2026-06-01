#!/usr/bin/env node
/**
 * scripts/check-followup-completion.mjs — §4 follow-up automation tracking.
 *
 * Fails if follow-up is not tracked end-to-end: a follow-up scan task is
 * generated from a detection, follow-up capture is recorded, and a follow-up
 * completion/scan rate is computed for the pilot.
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

// Follow-up task generated from a detection (scan task candidates or daily decision).
const taskGen = read('src/runtime/scanDetection/ScanDetectionNormalizer.ts')
  + read('src/runtime/intelligence/DailyDecisionEngine.ts');
if (!/follow.?up/i.test(taskGen) || !/follow_up_scan|FollowUpScan|follow-up scan/i.test(taskGen))
  F.push('a follow-up scan task must be generated from a detection');
else P.push('follow-up scan task generated from detection');

// Follow-up capture recorded in the outcome chain.
const cap = read('src/runtime/pilot/PilotHealthRuntime.ts');
if (!/followUpScanCaptured/.test(cap))
  F.push('__outcomeCaptureHealth must record followUpScanCaptured');
else P.push('follow-up capture recorded (followUpScanCaptured)');

// Follow-up completion / scan rate computed for the pilot.
const analytics = read('src/runtime/outcomeIntelligence/PilotAnalyticsRuntime.ts');
const success = read('src/runtime/farmerSuccess/FarmerSuccessEngine.ts');
if (!/followUpScanRate|followUpCompletion|followUpRate/.test(analytics + success))
  F.push('a follow-up completion/scan rate must be computed (pilot analytics / farmer success)');
else P.push('follow-up completion/scan rate computed');

if (F.length) {
  console.error('[check:followup-completion] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:followup-completion] PASS — follow-up generated, captured, and rate-tracked.');
for (const m of P) console.log('  ✓ ' + m);
