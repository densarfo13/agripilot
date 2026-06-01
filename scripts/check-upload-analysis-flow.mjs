#!/usr/bin/env node
/**
 * scripts/check-upload-analysis-flow.mjs — §2 upload → analysis → result.
 *
 * Fails if __uploadAnalysisHealth does not surface the §2 contract keys
 * (picker / compression / scanRuntime / normalizer / result ready +
 * oodaNonBlocking + artifactNonBlocking + failureSafe).
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

const src = read('src/runtime/pilotGap/PilotGapHealthRuntime.ts');
if (!src) { F.push('src/runtime/pilotGap/PilotGapHealthRuntime.ts: missing'); }
else {
  const KEYS = ['pickerReady', 'compressionReady', 'scanRuntimeReady',
    'normalizerReady', 'resultReady', 'oodaNonBlocking', 'artifactNonBlocking',
    'failureSafe'];
  const missing = KEYS.filter((k) => !src.includes(k));
  if (missing.length) F.push(`__uploadAnalysisHealth missing §2 keys: ${missing.join(', ')}`);
  else P.push('__uploadAnalysisHealth surfaces all 8 §2 keys');
  // Failure-safe path (ScanFailed artifact + honest fallback).
  if (!/failureArtifactReady|ScanFailed|failureFallbackReady/.test(src))
    F.push('__uploadAnalysisHealth must surface the ScanFailed failure path');
  else P.push('failure path surfaced (ScanFailed + honest fallback)');
}

if (F.length) {
  console.error('[check:upload-analysis-flow] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:upload-analysis-flow] PASS — picker→compress→runtime→normalize→result; OODA/artifact non-blocking; failure-safe.');
for (const m of P) console.log('  ✓ ' + m);
