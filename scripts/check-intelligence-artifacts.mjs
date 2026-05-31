#!/usr/bin/env node
/**
 * scripts/check-intelligence-artifacts.mjs — §11 artifacts via the
 * ArtifactRuntime ONLY.
 *
 * Intelligence events must flow through the existing ArtifactRuntime —
 * no UI / engine writing to a database directly. Fails if:
 *   • the canonical ArtifactRuntime is absent
 *   • the composite does not declare the 7 intelligence event types
 *   • the composite does not assert artifactRuntimeOnly / idempotent /
 *     offlineSafe
 *   • an intelligence engine performs a direct persistence write
 *     (fetch POST/PUT/PATCH, or localStorage.setItem) — engines READ;
 *     evidence is emitted via ArtifactRuntime, not by the engines.
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

// 1. Canonical ArtifactRuntime exists.
if (!read('src/runtime/artifacts/ArtifactRuntime.ts'))
  F.push('src/runtime/artifacts/ArtifactRuntime.ts must exist (artifacts have a single runtime)');
else P.push('canonical ArtifactRuntime present');

// 2. Composite declares the 7 intelligence event types + the contracts.
const composite = read('src/runtime/intelligence/IntelligenceHealthRuntime.ts');
const EVENTS = [
  'FarmHealthCalculated', 'TrendDetected', 'DailyActionRecommended',
  'WeatherRiskFlagged', 'OutcomeImprovementRecorded',
  'BuyerTrustCalculated', 'NGOImpactSnapshotGenerated',
];
if (!composite) F.push('IntelligenceHealthRuntime.ts: missing');
else {
  const missing = EVENTS.filter((e) => !composite.includes(e));
  if (missing.length) F.push(`intelligence artifact events missing: ${missing.join(', ')}`);
  else P.push(`all 7 intelligence event types declared`);
  if (!/artifactRuntimeOnly:\s*true/.test(composite))
    F.push('composite must declare artifactRuntimeOnly:true (no UI/engine direct DB writes)');
  else P.push('artifactRuntimeOnly:true declared');
  for (const flag of ['idempotent', 'offlineSafe']) {
    if (!new RegExp(`${flag}`).test(composite)) F.push(`composite must surface ${flag}`);
  }
  if (!F.some((m) => m.includes('idempotent') || m.includes('offlineSafe')))
    P.push('artifact envelope surfaces idempotent + offlineSafe');
}

// 3. Engines must not persist directly — they READ.
const DIR = 'src/runtime/intelligence';
const ENGINES = [
  'CropMemoryEngine.ts', 'TrendEngine.ts', 'FarmHealthScoreEngine.ts',
  'YieldReadinessEngine.ts', 'DailyDecisionEngine.ts', 'RemoteSensingReadiness.ts',
];
let writes = 0;
for (const f of ENGINES) {
  const src = strip(read(`${DIR}/${f}`));
  if (!src) continue;
  if (/\bfetch\s*\(/.test(src)) { F.push(`${f}: no direct fetch — engines read; evidence flows via ArtifactRuntime`); writes++; }
  if (/localStorage\.setItem|localStorage\.removeItem|localStorage\.clear/.test(src)) {
    F.push(`${f}: no direct localStorage write — engines are read-only`); writes++;
  }
}
if (!writes) P.push('no intelligence engine performs a direct persistence write (read-only)');

if (F.length) {
  console.error('[check:intelligence-artifacts] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:intelligence-artifacts] PASS — artifacts via ArtifactRuntime only; engines read-only.');
for (const m of P) console.log('  ✓ ' + m);
