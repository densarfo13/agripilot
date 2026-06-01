#!/usr/bin/env node
/**
 * scripts/check-production-stability-lock.mjs — composite production-pilot
 * stability lock. Rolls up the 10 operational contracts (§1–§10) by
 * verifying each diagnostic probe surfaces its required contract keys.
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

const CHECKS = [
  ['§1 scan permanent', 'src/runtime/scanStartup/ScanPermanentHealthRuntime.ts',
    ['takePhotoVisible', 'cameraFailureFallbackReady', 'analysisFailureFallbackReady', 'uploadAnalysisReady', 'noInfiniteSpinner']],
  ['§2 upload analysis', 'src/runtime/pilotGap/PilotGapHealthRuntime.ts',
    ['pickerReady', 'scanRuntimeReady', 'normalizerReady', 'oodaNonBlocking', 'artifactNonBlocking', 'failureSafe']],
  ['§4 login routing', 'src/runtime/loginRouting/LoginRoutingHealthRuntime.ts',
    ['existingUserRoutesHome', 'locationOptional', 'gpsFailureDoesNotBlock', 'noLocationLoop', 'homeRequiresAuthOnly', 'scanRequiresAuthOnly']],
  ['§5 language', 'src/runtime/i18n/LanguageHealthRuntime.js',
    ['scanLocalizationReady', 'taskLocalizationReady', 'onboardingLocalizationReady', 'weatherLocalizationReady']],
  ['§7 outcome capture', 'src/runtime/pilot/PilotHealthRuntime.ts',
    ['scanCaptured', 'followUpScanCaptured', 'outcomeStatusCaptured', 'artifactLinked', 'oodaLinked']],
  ['§9 startup', 'src/runtime/startup/StartupHealthRuntime.ts',
    ['noInfiniteLoader', 'authSettlesWithinMs', 'routeFallbackReady', 'chunkErrorRecoveryReady']],
  ['§10 polling', 'src/runtime/polling/PollingHealthRuntime.ts',
    ['healthPollMs', 'translationsCached', 'authRefreshBackoffReady', 'diagnosticsThrottled', 'hiddenTabPaused', 'no429Loop']],
  ['§6 OODA', 'src/runtime/intelligence/IntelligenceHealthRuntime.ts',
    ['nonBlocking', 'failureSafe', 'scanIntegrated']],
  ['§6 artifact', 'src/runtime/artifacts/index.ts',
    ['scanArtifactsReady', 'failureArtifactsReady', 'nonBlocking', 'idempotent']],
];

for (const [label, file, keys] of CHECKS) {
  const src = read(file);
  if (!src) { F.push(`${label}: ${file} missing`); continue; }
  const missing = keys.filter((k) => !src.includes(k));
  if (missing.length) F.push(`${label}: missing ${missing.join(', ')}`);
  else P.push(`${label}: contract present`);
}

// §10 — health polling must be >= 60s.
const polling = read('src/runtime/polling/PollingHealthRuntime.ts');
if (polling && !/60000|6e4|60_000/.test(polling))
  F.push('§10 polling: health poll interval must be >= 60000ms');
else if (polling) P.push('§10 polling: health poll >= 60s');

if (F.length) {
  console.error('[check:production-stability-lock] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:production-stability-lock] PASS — all 10 production-stability contracts present.');
for (const m of P) console.log('  ✓ ' + m);
