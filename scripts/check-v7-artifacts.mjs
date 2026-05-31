#!/usr/bin/env node
/**
 * scripts/check-v7-artifacts.mjs — V7 artifacts via ArtifactRuntime only.
 *
 * Fails if:
 *   • the canonical ArtifactRuntime is absent
 *   • the composite does not declare the 6 V7 event types
 *   • the composite does not assert artifactRuntimeOnly / idempotency /
 *     offlineSafe
 *   • a V7 engine writes directly (fetch POST/PUT/PATCH, or a
 *     localStorage write) — engines READ; evidence flows via
 *     ArtifactRuntime, never the UI/engine directly.
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

if (!read('src/runtime/artifacts/ArtifactRuntime.ts'))
  F.push('src/runtime/artifacts/ArtifactRuntime.ts must exist');
else P.push('canonical ArtifactRuntime present');

const composite = read('src/runtime/v7/V7HealthRuntime.ts');
const EVENTS = [
  'PredictiveRiskCalculated', 'FarmAssistantRecommendationCreated',
  'NGOImpactSnapshotGenerated', 'MarketplaceTrustCalculated',
  'RemoteSensingSnapshotCreated', 'InstitutionalReadinessChecked',
];
if (!composite) F.push('V7HealthRuntime.ts: missing');
else {
  const missing = EVENTS.filter((e) => !composite.includes(e));
  if (missing.length) F.push(`V7 artifact events missing: ${missing.join(', ')}`);
  else P.push('all 6 V7 event types declared');
  if (!/artifactRuntimeOnly:\s*true/.test(composite))
    F.push('composite must declare artifactRuntimeOnly:true');
  else P.push('artifactRuntimeOnly:true declared');
  if (!/idempotenc/i.test(composite)) F.push('composite must surface an idempotency contract');
  else P.push('idempotency contract surfaced');
  if (!/offlineSafe/.test(composite)) F.push('composite must surface offlineSafe');
  else P.push('offlineSafe surfaced');
}

// Engines must not persist directly.
const DIR = 'src/runtime/v7';
const ENGINES = [
  'predictive/PredictiveRiskEngine.ts', 'ngo/NGOIntelligenceEngine.ts',
  'marketplace/MarketplaceIntelligenceEngine.ts', 'remote/RemoteSensingEngine.ts',
  'assistant/FarmAssistantEngine.ts', 'institutional/InstitutionalReadinessEngine.ts',
  'V7HealthRuntime.ts',
];
let writes = 0;
for (const rel of ENGINES) {
  const src = strip(read(`${DIR}/${rel}`));
  if (!src) continue;
  if (/\bfetch\s*\(/.test(src)) { F.push(`${rel}: no direct fetch — evidence flows via ArtifactRuntime`); writes++; }
  if (/localStorage\.setItem|localStorage\.removeItem|localStorage\.clear/.test(src)) {
    F.push(`${rel}: no direct localStorage write — V7 engines are read-only`); writes++;
  }
}
if (!writes) P.push('no V7 engine performs a direct persistence write (read-only)');

if (F.length) {
  console.error('[check:v7-artifacts] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:v7-artifacts] PASS — V7 artifacts via ArtifactRuntime only; engines read-only.');
for (const m of P) console.log('  ✓ ' + m);
