#!/usr/bin/env node
/**
 * scripts/check-ooda-artifact-ownership.mjs — Ownership /
 * purity gates for the OODA Engine + Artifacts Evidence Layer.
 *
 * Hard blockers:
 *   A. src/runtime/intelligence/{OODAEngine,DecisionEngine,
 *      OutcomeEngine,index}.ts exist with version constants.
 *   B. OODA engine files do NOT import React or any UI module.
 *   C. ArtifactRuntime + ArtifactRegistry do NOT write
 *      localStorage / IndexedDB directly (wave-5 invariant).
 *   D. Artifacts module does NOT import React.
 *   E. Forbidden artifact-PII fields are declared in
 *      ARTIFACT_PII_DROP_LIST (phone, email, fullName,
 *      deviceId, ipAddress, gpsExact, fileName).
 *   F. ArtifactRuntime emits the 7 spec'd artifact types.
 *
 * Strict-rule audit
 *   • Read-only. Never mutates source.
 *   • Returns exit 1 on hard blocker.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FAILED = [];
const PASSED = [];
function fail(m) { FAILED.push(m); }
function pass(m) { PASSED.push(m); }

function readOrEmpty(f) {
  try { return fs.readFileSync(f, 'utf8'); } catch { return ''; }
}

// ─── A. OODA files exist with versions ─────────────────────────
// Files must declare the canonical version constant either as
// a literal string OR import/re-export the constant by name.
const OODA_FILES = [
  ['src/runtime/intelligence/OODAEngine.ts',     'ooda-engine-v1',     'OODA_ENGINE_VERSION'],
  ['src/runtime/intelligence/DecisionEngine.ts', 'decision-engine-v1', 'DECISION_ENGINE_VERSION'],
  ['src/runtime/intelligence/OutcomeEngine.ts',  'outcome-engine-v1',  'OUTCOME_ENGINE_VERSION'],
  ['src/runtime/intelligence/index.ts',          'ooda-engine-v1',     'OODA_ENGINE_VERSION'],
];
const oodaSources = {};
for (const [f, literal, constant] of OODA_FILES) {
  const src = readOrEmpty(path.join(ROOT, f));
  oodaSources[f] = src;
  if (!src) fail(`ooda: missing ${f}`);
  else if (!src.includes(literal) && !src.includes(constant)) {
    fail(`ooda: ${f} missing version literal "${literal}" or constant "${constant}"`);
  }
}
if (Object.values(oodaSources).every(Boolean)) {
  pass(`ooda: 4 files present with version constants`);
}

// ─── B. OODA never imports React or UI modules ─────────────────
for (const [f, src] of Object.entries(oodaSources)) {
  if (!src) continue;
  if (/from\s+['"]react['"]/.test(src)
      || /from\s+['"][^'"]*\/components?\//.test(src)
      || /from\s+['"][^'"]*\/pages\//.test(src)) {
    fail(`ooda-purity: ${f} imports React / components / pages — engines stay pure`);
  }
}
pass(`ooda-purity: no React / component / page imports in OODA engines`);

// ─── C. Artifact runtime exists + no direct persistence ────────
const ART_FILES = [
  ['src/runtime/artifacts/artifactContracts.ts',         'farroway-artifact-runtime-v1', 'ARTIFACT_RUNTIME_VERSION'],
  ['src/runtime/artifacts/ArtifactRegistry.ts',          'artifact-registry-v1',         'ARTIFACT_REGISTRY_VERSION'],
  ['src/runtime/artifacts/ArtifactRuntime.ts',           'farroway-artifact-runtime-v1', 'ARTIFACT_RUNTIME_VERSION'],
  ['src/runtime/artifacts/ArtifactEvidenceService.ts',   'artifact-evidence-v1',         'EVIDENCE_SERVICE_VERSION'],
  ['src/runtime/artifacts/index.ts',                     'farroway-artifact-runtime-v1', 'ARTIFACT_RUNTIME_VERSION'],
];
const artSources = {};
for (const [f, literal, constant] of ART_FILES) {
  const src = readOrEmpty(path.join(ROOT, f));
  artSources[f] = src;
  if (!src) fail(`artifacts: missing ${f}`);
  else if (!src.includes(literal) && !src.includes(constant)) {
    fail(`artifacts: ${f} missing version literal "${literal}" or constant "${constant}"`);
  }
}
if (Object.values(artSources).every(Boolean)) {
  pass(`artifacts: 5 files present with version constants`);
}

const FORBIDDEN_PERSISTENCE = [
  /localStorage\.setItem/,
  /localStorage\[/,
  /indexedDB\b/i,
  /sessionStorage\.setItem/,
];
function _stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\/\/[^\n]*/g, '')
          .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
}
for (const [f, src] of Object.entries(artSources)) {
  if (!src) continue;
  const stripped = _stripComments(src);
  for (const re of FORBIDDEN_PERSISTENCE) {
    if (re.test(stripped)) {
      fail(`artifact-persistence: ${f} writes to ${re} — wave-5 invariant: artifacts emit envelopes, callers persist`);
    }
  }
}
pass(`artifact-persistence: no direct localStorage / IndexedDB writes`);

// ─── D. Artifacts never import React ──────────────────────────
for (const [f, src] of Object.entries(artSources)) {
  if (!src) continue;
  if (/from\s+['"]react['"]/.test(src)
      || /from\s+['"][^'"]*\/components?\//.test(src)
      || /from\s+['"][^'"]*\/pages\//.test(src)) {
    fail(`artifact-purity: ${f} imports React / components / pages — engines stay pure`);
  }
}
pass(`artifact-purity: no React / component / page imports in Artifacts`);

// ─── E. PII drop-list contains the spec's forbidden fields ────
const contracts = artSources['src/runtime/artifacts/artifactContracts.ts'] || '';
const REQUIRED_PII = ['phone', 'email', 'fullName', 'deviceId',
                       'ipAddress', 'gpsExact', 'fileName'];
for (const field of REQUIRED_PII) {
  if (!new RegExp("'" + field + "'").test(contracts)) {
    fail(`artifact-pii: ARTIFACT_PII_DROP_LIST missing "${field}"`);
  }
}
pass(`artifact-pii: drop-list covers ${REQUIRED_PII.length} forbidden PII fields`);

// ─── F. 7 spec'd artifact types ───────────────────────────────
const SPEC_TYPES = ['ScanArtifact', 'PlantArtifact', 'TaskArtifact',
  'TreatmentArtifact', 'HarvestArtifact', 'InterventionArtifact',
  'BuyerInterestArtifact'];
const runtime = artSources['src/runtime/artifacts/ArtifactRuntime.ts'] || '';
for (const t of SPEC_TYPES) {
  if (!runtime.includes(`type: '${t}'`)) {
    fail(`artifact-types: ArtifactRuntime missing "${t}" emitter`);
  }
}
pass(`artifact-types: 7 spec types wired`);

// ─── Report ────────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:ooda-artifact-ownership] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} checks passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:ooda-artifact-ownership] PASS — OODA + Artifacts ownership clean.');
console.log(`  OODA: 4 engines, no React/component imports.`);
console.log(`  Artifacts: 5 files, no direct persistence writes, 7 spec types, PII drop-list complete.`);
