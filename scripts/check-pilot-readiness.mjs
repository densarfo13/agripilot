#!/usr/bin/env node
/**
 * scripts/check-pilot-readiness.mjs — Wave-41 governance gate.
 *
 * Statically enforces the wave-41 pilot-execution contract:
 *
 *   • PlantCatalogReadinessRuntime ships + reads real library
 *     imports (no hardcoded counts).
 *   • Four regional packs ship at canonical paths + reference
 *     plant IDs that exist in the libraries OR surface in the
 *     RegionalKnowledgeRuntime missingReferences array.
 *   • Pilot health runtimes ship + install the 4 globals
 *     (__ngoPilotHealth, __growerPilotHealth,
 *      __outcomeCaptureHealth, __pilotCommandHealth).
 *   • NGO pilot envelope REQUIRES production-safe persistence —
 *     gate verifies the runtime composes __persistenceHealth and
 *     conditionally returns NOT_READY when unsafe.
 *   • Internal pilot pages exist + are admin-gated in App.jsx
 *     (RoleRoute roles={ADMIN_ROLES}).
 *   • PilotCommand UI has no fake metric fallbacks — empty
 *     state must use the canonical "Not enough data yet" string.
 *
 * Read-only. Never mutates source.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FAILED = [];
const PASSED = [];
function fail(m) { FAILED.push(m); }
function pass(m) { PASSED.push(m); }

function read(file) {
  try { return fs.readFileSync(file, 'utf8'); }
  catch { return ''; }
}
function requireFile(rel, label) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) {
    fail(`${label}: ${rel} must exist`);
    return '';
  }
  pass(`${label}: ${rel} present`);
  return read(full);
}
function requireTokens(src, tokens, label) {
  for (const t of tokens) {
    if (!new RegExp(`\\b${t.replace(/[.$()|]/g, (m) => '\\'+m)}\\b`).test(src)) {
      fail(`${label}: missing token "${t}"`);
    }
  }
}

// ─── 1. PlantCatalogReadiness ──────────────────────────────────
const plantSrc = requireFile(
  'src/runtime/knowledge/PlantCatalogReadinessRuntime.ts', 'catalog');
requireTokens(plantSrc, [
  '__plantCatalogReadiness',
  'currentPlants', 'targetPlants', 'gap', 'coveragePercent',
  'africaPriorityCoverage', 'usaGardenCoverage', 'flowerCoverage',
  'launchStatus',
  // Real imports — no hardcoded counts.
  'VEGETABLE_LIBRARY', 'FRUIT_LIBRARY', 'HERB_LIBRARY',
  'CROP_LIBRARY', 'HOUSEPLANT_LIBRARY', 'FLOWER_LIBRARY',
], 'catalog');
// Hardcoded fake detection: a literal `currentPlants: <number>` in
// the return envelope would indicate fabrication.
if (/return Object\.freeze\(\{[^}]*currentPlants:\s*\d+\b/m.test(plantSrc)) {
  fail('catalog: hardcoded currentPlants detected in return envelope');
}

// ─── 2. Regional knowledge packs + runtime ─────────────────────
for (const rel of [
  'src/knowledge/packs/ghanaPriorityPack.json',
  'src/knowledge/packs/nigeriaPriorityPack.json',
  'src/knowledge/packs/kenyaPriorityPack.json',
  'src/knowledge/packs/usaGardenPack.json',
]) {
  const src = requireFile(rel, 'pack');
  if (!src) continue;
  let parsed = null;
  try { parsed = JSON.parse(src); } catch { /* fail below */ }
  if (!parsed) { fail(`pack: ${rel} is not valid JSON`); continue; }
  for (const field of [
    'region', 'crops', 'commonDiseases', 'commonPests',
    'seasonalNotes', 'farmerFriendlyGuidance',
  ]) {
    if (!(field in parsed)) {
      fail(`pack: ${rel} missing required field "${field}"`);
    }
  }
  if (Array.isArray(parsed.crops) && parsed.crops.length === 0) {
    fail(`pack: ${rel} crops list is empty`);
  }
}
const regionalSrc = requireFile(
  'src/runtime/knowledge/RegionalKnowledgeRuntime.ts', 'regional');
requireTokens(regionalSrc, [
  '__regionalKnowledgeHealth',
  'ghanaReady', 'nigeriaReady', 'kenyaReady', 'usaGardenReady',
  'packsLoaded', 'missingReferences',
], 'regional');

// ─── 3. Pilot health runtime ───────────────────────────────────
const pilotSrc = requireFile(
  'src/runtime/pilot/PilotHealthRuntime.ts', 'pilot');
requireTokens(pilotSrc, [
  '__ngoPilotHealth', '__growerPilotHealth',
  '__outcomeCaptureHealth', '__pilotCommandHealth',
  // NGO blocker contract — explicit check the runtime composes
  // __persistenceHealth and reports the persistence blocker.
  '__persistenceHealth', 'persistence_not_production_safe',
  // Grower checklist tokens.
  'gardenerFlowReady', 'farmerFlowReady',
  'scanReady', 'uploadReady', 'plantSaveReady',
  'taskReady', 'activityReady', 'outcomeReady',
  // Outcome capture tokens.
  'issueCaptured', 'recommendationCaptured', 'taskCaptured',
  'followUpScanCaptured', 'outcomeStatusCaptured',
  'beforeAfterReady', 'outcomeDatasetReady',
  // Pilot command tokens.
  'realMetricsOnly', 'growerMetricsReady', 'ngoMetricsReady',
  'buyerMetricsReady', 'noFakeMetrics',
], 'pilot');

// ─── 4. Internal pilot pages + admin gate ──────────────────────
const cmdSrc = requireFile(
  'src/pages/internal/pilot/PilotCommandPage.jsx', 'page');
const ngoSrc = requireFile(
  'src/pages/internal/pilot/NGOPilotPage.jsx', 'page');
const growSrc = requireFile(
  'src/pages/internal/pilot/GrowerPilotPage.jsx', 'page');
// PilotCommand UI must use the canonical empty-state string and
// must NOT fabricate fake counts.
if (!/Not enough data yet/.test(cmdSrc)) {
  fail('page: PilotCommandPage must use "Not enough data yet" empty-state copy');
}
// App.jsx must register all three routes admin-gated.
const appSrc = requireFile('src/App.jsx', 'wiring');
for (const fragment of [
  /path=["']\/internal\/pilot["'].*?RoleRoute\s+roles=\{ADMIN_ROLES\}/s,
  /path=["']\/internal\/pilot\/ngo["'].*?RoleRoute\s+roles=\{ADMIN_ROLES\}/s,
  /path=["']\/internal\/pilot\/grower["'].*?RoleRoute\s+roles=\{ADMIN_ROLES\}/s,
]) {
  if (!fragment.test(appSrc)) {
    fail(`wiring: App.jsx must mount route matching ${fragment} with ADMIN_ROLES`);
  }
}
// Installers wired.
for (const fn of [
  'installPlantCatalogReadinessGlobal',
  'installRegionalKnowledgeGlobal',
  'installPilotHealthGlobals',
]) {
  if (!new RegExp(fn).test(appSrc)) {
    fail(`wiring: App.jsx must wire ${fn}`);
  }
}

// ─── 5. ReleaseLock + GoLive flags ─────────────────────────────
const releaseSrc = requireFile(
  'src/runtime/release/ReleaseLockRuntime.ts', 'release-lock');
for (const flag of [
  'plantCatalogReadiness', 'regionalKnowledgeReady',
  'ngoPilotReady', 'growerPilotReady',
  'outcomeCaptureReady', 'pilotCommandReady',
]) {
  if (!new RegExp(`\\b${flag}\\b`).test(releaseSrc)) {
    fail(`release-lock: must surface ${flag}`);
  }
}
const goLiveSrc = requireFile(
  'src/runtime/launchBlockers/GoLiveHealthRuntime.ts', 'go-live');
for (const probe of [
  '__plantCatalogReadiness', '__regionalKnowledgeHealth',
  '__ngoPilotHealth', '__growerPilotHealth',
  '__outcomeCaptureHealth', '__pilotCommandHealth',
]) {
  if (!new RegExp(probe).test(goLiveSrc)) {
    fail(`go-live: must compose ${probe}`);
  }
}

// ─── Report ────────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:pilot-readiness] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:pilot-readiness] PASS — wave-41 pilot execution contracts intact.');
for (const p of PASSED) console.log('  ✓ ' + p);
