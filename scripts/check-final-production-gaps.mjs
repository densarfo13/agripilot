#!/usr/bin/env node
/**
 * scripts/check-final-production-gaps.mjs — umbrella proof gate.
 *
 * One gate that asserts every §1–§13 launch-blocker diagnostic + its
 * spec-exact envelope keys are present in source, so the full
 * production-gap contract can't silently regress. It composes the
 * subjects the focused gates already enforce; this is the single
 * "everything is wired" checkpoint.
 *
 * Read-only. Never mutates source.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
function need(rel, tokens, label) {
  const src = read(rel);
  if (!src) { F.push(`${label}: ${rel} missing`); return; }
  const miss = tokens.filter((t) => !new RegExp(`\\b${t}\\b`).test(src));
  if (miss.length) F.push(`${label}: missing ${miss.join(', ')}`);
  else P.push(`${label}: all keys present`);
}

// §1 mobile scan
need('src/runtime/scanStartup/ScanPermanentHealthRuntime.ts',
  ['safeShellFirst', 'uploadPrimary', 'uploadVisibleWithinMs', 'iosCameraAutostartDisabled',
   'cameraStartsOnlyAfterUserTap', 'noRuntimeInitializedWarningOnLoad', 'scanCanNeverSpinForever'],
  '§1 __scanPermanentHealth');
// §2 upload analysis
need('src/runtime/pilotGap/PilotGapHealthRuntime.ts',
  ['pickerReady', 'compressionReady', 'scanRuntimeLazyLoaded', 'oodaIntegrated',
   'artifactsIntegrated', 'resultReady', 'failureArtifactReady'],
  '§2 __uploadAnalysisHealth');
// §3 camera
need('src/core/camera/cameraRuntimeManager.js',
  ['permissionState', 'getUserMediaSupported', 'videoReady', 'failedStage', 'cleanupReady'],
  '§3 __cameraHealth');
// §4 ooda + artifacts
need('src/runtime/intelligence/index.ts', ['scanIntegrated', 'nonBlocking', 'growerSafeOutput'], '§4 __oodaHealth');
need('src/runtime/artifacts/index.ts', ['scanArtifactsReady', 'failureArtifactsReady', 'offlineSafe', 'idempotent'], '§4 __artifactHealth');
// §5 login/location
need('src/runtime/loginRouting/LoginRoutingHealthRuntime.ts',
  ['existingUserRoutesHome', 'locationOptional', 'gpsFailureDoesNotBlock', 'noLocationLoop',
   'homeRequiresAuthOnly', 'scanRequiresAuthOnly'],
  '§5 __loginRoutingHealth');
// §6 language
need('src/runtime/i18n/LanguageHealthRuntime.js',
  ['selectedLanguage', 'supportedLanguages', 'translationCoverage', 'cropLocalizationReady',
   'scanLocalizationReady', 'messageTemplatesReady'],
  '§6 __languageHealth');
// §7 polling
need('src/runtime/polling/PollingHealthRuntime.ts',
  ['healthPollMs', 'translationsCached', 'authRefreshBackoffReady', 'diagnosticsThrottled',
   'hiddenTabPaused', 'no429Loop'],
  '§7 __pollingHealth');
// §8 persistence
need('src/runtime/persistence/PersistenceHealth.ts',
  ['productionWritesEnabled', 'criticalWritesPersisted'], '§8 __persistenceHealth');
// §12 outcome
need('src/runtime/pilot/PilotHealthRuntime.ts',
  ['scanCaptured', 'diagnosisCaptured', 'recommendationCaptured', 'taskCaptured',
   'followUpScanCaptured', 'outcomeStatusCaptured', 'artifactLinked', 'oodaLinked'],
  '§12 __outcomeCaptureHealth');
// §13 startup / no-infinite-loader
need('src/runtime/startup/StartupHealthRuntime.ts',
  ['noInfiniteLoader', 'authSettlesWithinMs', 'routeFallbackReady', 'chunkErrorRecoveryReady'],
  '§13 __startupHealth');
// §13 SafeLoader timeout-bearing
{
  const sl = read('src/components/common/SafeLoader.jsx');
  if (!/setTimeout/.test(sl) || !/safe-loader-recovery/.test(sl))
    F.push('§13 SafeLoader: must self-time-out to a recovery panel');
  else P.push('§13 SafeLoader: self-times-out to recovery');
}

if (F.length) {
  console.error('[check:final-production-gaps] FAIL');
  for (const m of F) console.error('  ✗ ' + m);
  console.error(`\n${P.length} passed, ${F.length} failed.`);
  process.exit(1);
}
console.log('[check:final-production-gaps] PASS — all §1–§13 launch-blocker diagnostics wired with spec envelopes.');
for (const m of P) console.log('  ✓ ' + m);
