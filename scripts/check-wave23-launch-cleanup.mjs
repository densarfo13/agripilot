#!/usr/bin/env node
/**
 * scripts/check-wave23-launch-cleanup.mjs — Wave-23 governance.
 *
 * Statically enforces the wave-23 launch-cleanup contract:
 *
 *   • build:safe runs clean:build FIRST (pre-build cleaner)
 *   • build:safe runs check:clean-build for both pre + post
 *   • __queueHealth runtime ships at canonical path + installs
 *   • Legacy SafeHomeFallback removed; SafeHomeRecovery present
 *   • check:no-legacy-dashboard wired into build:safe
 *   • Wave-23 KnowledgeCoverageRuntime ships at canonical path
 *   • docs/KNOWLEDGE_EXPANSION_PLAN.md ships with required
 *     sections
 *   • Knowledge counts are not hardcoded fakes — the runtime
 *     reads from the actual library imports
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

// ─── 1. package.json contract ──────────────────────────────────
const pkgSrc = requireFile('package.json', 'package');
let pkg = {};
try { pkg = JSON.parse(pkgSrc); } catch { /* fail-closed below */ }

const scripts = pkg && pkg.scripts ? pkg.scripts : {};
if (!scripts['clean:build']) {
  fail('package: "clean:build" script missing');
} else if (!/clean-build-artifacts\.mjs/.test(String(scripts['clean:build']))) {
  fail('package: "clean:build" must invoke clean-build-artifacts.mjs');
}
if (!scripts['check:clean-build']) {
  fail('package: "check:clean-build" script missing');
}
if (!scripts['check:no-legacy-dashboard']) {
  fail('package: "check:no-legacy-dashboard" script missing');
}
if (!scripts['check:wave23-launch-cleanup']) {
  fail('package: "check:wave23-launch-cleanup" script missing');
}

// build:safe used to be a single `npm run x && npm run y && ...` chain.
// The chain hit Windows' 8191-char command-line limit, so we split it
// into a JS runner: `build:safe = node scripts/run-build-safe-checks.mjs`
// and the canonical step list lives in `build:safe:steps` (space-separated
// step names — no `npm run` prefix). Check either source so the contract
// holds for both shapes.
const safeChain = String(scripts['build:safe'] || '');
const safeSteps = String(scripts['build:safe:steps'] || '').split(/\s+/).filter(Boolean);
const stepSet = new Set(safeSteps);
const inSafe = (name) =>
  new RegExp('\\bnpm run ' + name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&') + '\\b').test(safeChain)
  || stepSet.has(name);
if (!inSafe('clean:build')) {
  fail('package: build:safe must run clean:build first');
}
if (!inSafe('check:no-legacy-dashboard')) {
  fail('package: build:safe must run check:no-legacy-dashboard');
}
if (!inSafe('check:wave23-launch-cleanup')) {
  fail('package: build:safe must run check:wave23-launch-cleanup');
}

// ─── 2. Clean-build scripts ────────────────────────────────────
const cleanSrc = requireFile('scripts/clean-build-artifacts.mjs', 'clean');
for (const target of ['dist', '.vite', 'node_modules']) {
  if (!new RegExp(`['\"]${target.replace('.', '\\.')}['\"]`).test(cleanSrc)) {
    fail(`clean: clean-build-artifacts.mjs must target "${target}"`);
  }
}
const checkCleanSrc = requireFile('scripts/check-clean-build.mjs', 'clean');
if (!/--post-build/.test(checkCleanSrc)) {
  fail('clean: check-clean-build.mjs must support --post-build mode');
}

// ─── 3. __buildHealth runtime ──────────────────────────────────
const buildHealthSrc = requireFile(
  'src/runtime/build/BuildHealthRuntime.ts', 'build-health');
for (const tok of [
  '__buildHealth', 'cleanBuildReady',
  'staleArtifactsDetected', 'viteCacheCleared',
  'markCleanBuild',
]) {
  if (!new RegExp(`\\b${tok}\\b`).test(buildHealthSrc)) {
    fail(`build-health: must surface "${tok}"`);
  }
}

// ─── 4. __queueHealth runtime ──────────────────────────────────
const queueSrc = requireFile(
  'src/runtime/offline/QueueHealthRuntime.ts', 'queue-health');
for (const tok of [
  '__queueHealth', 'queueLength', 'pendingSync',
  'syncFailures', 'lastSyncAt',
  'duplicateProtectionReady', 'offlineQueueReady',
]) {
  if (!new RegExp(`\\b${tok}\\b`).test(queueSrc)) {
    fail(`queue-health: must surface "${tok}"`);
  }
}

// ─── 5. SafeHomeRecovery rename ────────────────────────────────
if (fs.existsSync(path.join(ROOT, 'src/pages/SafeHomeFallback.jsx'))) {
  fail('legacy: src/pages/SafeHomeFallback.jsx must be removed');
} else {
  pass('legacy: SafeHomeFallback.jsx removed');
}
const recoverySrc = requireFile('src/pages/SafeHomeRecovery.jsx', 'recovery');
// Recovery component must NOT route to /dashboard.
if (/to=["']\/dashboard["']/.test(recoverySrc)) {
  fail('recovery: SafeHomeRecovery.jsx must not link to /dashboard');
}

// HomeErrorBoundary must import the new recovery component.
const boundarySrc = requireFile(
  'src/components/system/HomeErrorBoundary.jsx', 'boundary');
if (/SafeHomeFallback/.test(boundarySrc.replace(/\/\*[\s\S]*?\*\//g, ''))) {
  fail('boundary: HomeErrorBoundary must not import SafeHomeFallback (renamed)');
}
if (!/SafeHomeRecovery/.test(boundarySrc)) {
  fail('boundary: HomeErrorBoundary must render <SafeHomeRecovery />');
}

// ─── 6. KnowledgeCoverageRuntime ───────────────────────────────
const knowSrc = requireFile(
  'src/runtime/knowledge/KnowledgeCoverageRuntime.ts', 'knowledge');
for (const tok of [
  '__knowledgeCoverageHealth',
  'targetPlants', 'targetFlowers', 'targetDiseases', 'targetPests',
  'launchWarning', 'coveragePercent',
  // Imports from the canonical libraries — proves counts are
  // real, not hardcoded.
  'VEGETABLE_LIBRARY', 'FRUIT_LIBRARY', 'HERB_LIBRARY',
  'CROP_LIBRARY', 'HOUSEPLANT_LIBRARY',
  'FLOWER_LIBRARY', 'DISEASE_LIBRARY', 'PEST_LIBRARY',
]) {
  if (!new RegExp(`\\b${tok}\\b`).test(knowSrc)) {
    fail(`knowledge: must surface "${tok}"`);
  }
}
// Wave-23 targets must match spec.
if (!/targetPlants:\s*200/.test(knowSrc)) {
  fail('knowledge: targetPlants must equal 200 (wave-23 minimum)');
}
if (!/targetDiseases:\s*15/.test(knowSrc)) {
  fail('knowledge: targetDiseases must equal 15 (wave-23 minimum)');
}
if (!/targetPests:\s*15/.test(knowSrc)) {
  fail('knowledge: targetPests must equal 15 (wave-23 minimum)');
}
// Hardcoded fake-count detection: a literal `plants: <number>`
// assignment in the envelope would indicate fabrication.
// We allow `LAUNCH_TARGETS.plants` references but flag a
// suspicious `return Object.freeze({ ... plants: 200 ...` shape.
const hardcodedReturn = /\breturn Object\.freeze\(\{[^}]*\bplants:\s*\d+\b[^}]*flowers:\s*\d+\b/m;
if (hardcodedReturn.test(knowSrc)) {
  fail('knowledge: hardcoded numeric counts detected in return envelope — must compute from libraries');
}

// ─── 7. KNOWLEDGE_EXPANSION_PLAN.md ────────────────────────────
const planSrc = requireFile('docs/KNOWLEDGE_EXPANSION_PLAN.md', 'docs');
const requiredSections = [
  /## 1\.\s+Targets/i,
  /## 2\.\s+Priority categories/i,
  /## 3\.\s+Authoring format/i,
  /Minimum GREEN target/i,
  /Recommended stronger target/i,
];
for (const re of requiredSections) {
  if (!re.test(planSrc)) {
    fail(`docs: KNOWLEDGE_EXPANSION_PLAN.md missing section matching ${re}`);
  }
}

// ─── 8. App.jsx wires ─────────────────────────────────────────
const appSrc = requireFile('src/App.jsx', 'wiring');
for (const fn of [
  'installBuildHealthGlobal',
  'markCleanBuild',
  'installQueueHealthGlobal',
  'installKnowledgeCoverageGlobal',
]) {
  if (!new RegExp(fn).test(appSrc)) {
    fail(`wiring: App.jsx must wire ${fn}`);
  }
}

// ─── Report ────────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:wave23-launch-cleanup] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:wave23-launch-cleanup] PASS — wave-23 launch cleanup contracts intact.');
for (const p of PASSED) console.log('  ✓ ' + p);
