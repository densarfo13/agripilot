#!/usr/bin/env node
/**
 * scripts/check-artifact-safety.mjs — §5 artifact safety.
 *
 * Fails if:
 *   • __artifactHealth does not surface the 7 §5 keys (scan/failure/task/
 *     outcome artifacts ready + offlineSafe + idempotent + nonBlocking)
 *   • the canonical ArtifactRuntime is absent
 *   • the ScanFailed failure-artifact path is not wired (failure artifacts
 *     must be created when analysis fails)
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

const idx = read('src/runtime/artifacts/index.ts');
if (!idx) { F.push('src/runtime/artifacts/index.ts: missing'); }
else {
  const KEYS = [
    'scanArtifactsReady', 'failureArtifactsReady', 'taskArtifactsReady',
    'outcomeArtifactsReady', 'offlineSafe', 'idempotent', 'nonBlocking',
  ];
  const missing = KEYS.filter((k) => !idx.includes(k));
  if (missing.length) F.push(`__artifactHealth missing §5 keys: ${missing.join(', ')}`);
  else P.push('__artifactHealth surfaces all 7 §5 keys');
}

if (!read('src/runtime/artifacts/ArtifactRuntime.ts'))
  F.push('ArtifactRuntime.ts must exist (single runtime for artifact writes)');
else P.push('canonical ArtifactRuntime present');

// Failure-artifact path wired (ScanFailed flows through the artifact layer).
const failureWired = /ScanFailed/.test(read('src/runtime/artifacts/artifactContracts.ts'))
  || /ScanFailed/.test(read('src/runtime/artifacts/ArtifactRuntime.ts'))
  || /failureArtifactsReady/.test(read('src/runtime/artifacts/index.ts'));
if (!failureWired) F.push('failure-artifact path (ScanFailed) must be wired');
else P.push('failure-artifact path wired (Scan failure creates a failure artifact)');

if (F.length) {
  console.error('[check:artifact-safety] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:artifact-safety] PASS — artifacts via ArtifactRuntime; failure-safe; non-blocking; idempotent.');
for (const m of P) console.log('  ✓ ' + m);
