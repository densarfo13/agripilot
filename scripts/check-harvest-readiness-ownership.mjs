#!/usr/bin/env node
/**
 * scripts/check-harvest-readiness-ownership.mjs — Wave-28 CI gate
 * enforcing the harvest-readiness ownership contract.
 *
 * Fails the build when:
 *   • UI calculates ripeness directly (only the runtime may)
 *   • Harvest runtime calls Plant.id directly
 *   • Harvest runtime owns the camera (mediaDevices.getUserMedia)
 *   • Recommendation/result wording uses banned phrases like
 *     "guaranteed ripe" / "confirmed harvest date" / "definitely"
 *   • Harvest tasks are written directly from UI (must go through
 *     the canonical addScanTasks / Task Runtime)
 *   • Unsupported plants render the harvest card (gate missing)
 *   • Duplicate harvest tasks can be generated from the same scan
 *     (idempotency-key derivation missing)
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

function readDir(dir) {
  try {
    return fs.readdirSync(dir)
      .map((f) => path.join(dir, f))
      .filter((p) => fs.statSync(p).isFile());
  } catch { return []; }
}

// ─── 1. Runtime suite exists ───────────────────────────────────
const SUITE_FILES = [
  'harvestContracts.ts',
  'RipenessEngine.ts',
  'HarvestStageEngine.ts',
  'HarvestTaskEngine.ts',
  'HarvestReadinessRuntime.ts',
  'index.ts',
];
const RUNTIME_DIR = path.join(ROOT, 'src/runtime/harvest');
for (const f of SUITE_FILES) {
  if (!fs.existsSync(path.join(RUNTIME_DIR, f))) {
    fail(`harvest-suite: missing src/runtime/harvest/${f}`);
  }
}

const runtimeSrc = SUITE_FILES
  .map((f) => read(path.join(RUNTIME_DIR, f)))
  .join('\n');
const runtimeFiles = readDir(RUNTIME_DIR);
const runtimeJoined = runtimeFiles.map((p) => read(p)).join('\n');

// ─── 2. Banned wording — neither runtime nor UI cards may use ─
// We check ONLY EXECUTED-CODE lines, not the BANNED_WORDING /
// SAFE_VERBS declaration in harvestContracts.ts (which lists the
// phrases on purpose so the engine can detect them downstream).
// Strategy: strip JS/TS comments + the BANNED_WORDING /
// SAFE_VERBS declaration blocks, then lowercase + scan.
const BANNED = [
  'guaranteed ripe',
  'confirmed harvest date',
  'definitely safe to eat',
];
function _stripComments(src) {
  if (!src) return '';
  // Block comments / docstrings
  let out = src.replace(/\/\*[\s\S]*?\*\//g, '');
  // Line comments
  out = out.replace(/(^|[^:])\/\/.*$/gm, '$1');
  return out;
}
function _stripExpectedBannedDeclarations(src) {
  // harvestContracts.ts intentionally lists the banned phrases in
  // BANNED_WORDING + SAFE_VERBS so the runtime + CI gate share
  // one source of truth. Strip those declarations so the gate
  // doesn't trip on its own catalogue.
  let out = src;
  out = out.replace(/export\s+const\s+BANNED_WORDING\s*=\s*Object\.freeze\(\[[\s\S]*?\]\s*as\s+const\);?/g, '');
  out = out.replace(/export\s+const\s+SAFE_VERBS\s*=\s*Object\.freeze\(\[[\s\S]*?\]\s*as\s+const\);?/g, '');
  return out;
}
const SURFACES = [
  ...runtimeFiles,
  path.join(ROOT, 'src/components/scan/HarvestReadinessCard.jsx'),
  path.join(ROOT, 'src/components/scan/BloomStageCard.jsx'),
];
for (const file of SURFACES) {
  const raw = read(file);
  if (!raw) continue;
  let src = _stripComments(raw);
  if (file.endsWith('harvestContracts.ts')) {
    src = _stripExpectedBannedDeclarations(src);
  }
  const lc = src.toLowerCase();
  for (const phrase of BANNED) {
    if (lc.includes(phrase)) {
      fail(`harvest-wording: ${path.relative(ROOT, file)} uses banned phrase "${phrase}" in executable code`);
    }
  }
}

// ─── 3. Runtime must not call Plant.id directly ───────────────
//     (the scan flow already gated this; harvest must NOT add
//      a second classifier path)
// Strip comments before checking so docstrings explaining the
// rule don't trip the gate.
const runtimeNoComments = _stripComments(runtimeJoined);
// Real bypass would be a fetch / axios call to an external host.
if (/api\.plant\.id|plantnet|openai\.com|api-key/i.test(runtimeNoComments)) {
  fail(`harvest-runtime: must NOT call external classifier APIs — ScanRuntime owns that`);
}

// ─── 4. Runtime must not own camera ─────────────────────────────
if (/getUserMedia|mediaDevices|MediaStream|HTMLVideoElement/i.test(runtimeJoined)) {
  fail(`harvest-runtime: must NOT access camera APIs — that's ScanRuntime's responsibility`);
}

// ─── 5. UI must not calculate ripeness directly ────────────────
const HarvestCard = read(path.join(ROOT, 'src/components/scan/HarvestReadinessCard.jsx'));
const BloomCard   = read(path.join(ROOT, 'src/components/scan/BloomStageCard.jsx'));
// The cards should only READ result.ripenessStatus, never derive it.
// Heuristic: cards must not import RipenessEngine.
for (const [name, src] of [
  ['HarvestReadinessCard.jsx', HarvestCard],
  ['BloomStageCard.jsx',       BloomCard],
]) {
  if (/from\s+['"][^'"]*runtime\/harvest\/RipenessEngine['"]/.test(src)) {
    fail(`harvest-ui: ${name} must NOT import RipenessEngine directly — read result.ripenessStatus only`);
  }
  if (/evaluateRipeness\s*\(/.test(src)) {
    fail(`harvest-ui: ${name} must NOT call evaluateRipeness — runtime owns the math`);
  }
}

// ─── 6. UI must gate the card on category !== 'unknown' ────────
if (HarvestCard && !/category\s*===\s*['"]unknown['"]/.test(HarvestCard)) {
  fail(`harvest-ui: HarvestReadinessCard must gate render on category !== 'unknown' (unsupported plants must not see the card)`);
}

// ─── 7. ScanResultCard wires the card and gates by category ────
const ScanResultCard = read(path.join(ROOT, 'src/components/scan/ScanResultCard.jsx'));
if (!ScanResultCard.includes('HarvestReadinessCard')
    || !ScanResultCard.includes('BloomStageCard')) {
  fail(`scan-result-card: must import HarvestReadinessCard AND BloomStageCard`);
}
if (!/result\.harvest\.category\s*===\s*['"]flower['"]/.test(ScanResultCard)
    || !/result\.harvest\.category\s*!==\s*['"]unknown['"]/.test(ScanResultCard)) {
  fail(`scan-result-card: must render BloomStageCard only on category === 'flower' and HarvestReadinessCard only on category !== 'unknown'`);
}

// ─── 8. ScanPage uses evaluate from the harvest runtime ────────
const ScanPage = read(path.join(ROOT, 'src/pages/ScanPage.jsx'));
if (!/from\s+['"][^'"]*runtime\/harvest['"]/.test(ScanPage)) {
  fail(`scan-page: must import the harvest runtime via 'runtime/harvest' barrel`);
}
if (!/evaluateHarvest|evaluate\s+as\s+evaluateHarvest/.test(ScanPage)) {
  fail(`scan-page: must call the harvest runtime's evaluate() (aliased as evaluateHarvest is fine)`);
}
if (!/isHarvestSupportedPlant|isSupportedPlant\s+as\s+isHarvestSupportedPlant/.test(ScanPage)) {
  fail(`scan-page: must gate evaluation on isSupportedPlant() / isHarvestSupportedPlant() before calling evaluate`);
}

// ─── 9. Idempotency — runtime must derive a stable key per scan ─
if (!/idemEvaluate|idemTask|idemArtifact/.test(runtimeJoined)) {
  fail(`harvest-runtime: must derive deterministic idempotency keys from scanId (idemEvaluate / idemTask / idemArtifact)`);
}
if (!/idempotencyKey/.test(runtimeJoined)) {
  fail(`harvest-runtime: result envelope must carry idempotencyKey`);
}

// ─── 10. Task generation must NOT directly write tasks ─────────
// HarvestTaskEngine must only RETURN task envelopes; addScanTasks
// is the canonical writer and is called by the UI, not the runtime.
const taskEngine = read(path.join(RUNTIME_DIR, 'HarvestTaskEngine.ts'));
if (/addScanTasks\s*\(/.test(taskEngine)) {
  fail(`harvest-task-engine: must NOT call addScanTasks — return envelopes only, the UI passes them to the canonical Task Runtime`);
}

// ─── 11. App.jsx boot wires installHarvestReadinessGlobal ──────
const app = read(path.join(ROOT, 'src/App.jsx'));
if (!app.includes('installHarvestReadinessGlobal')) {
  fail(`app-boot: must call installHarvestReadinessGlobal() during boot`);
}

// ─── 12. Release lock surfaces harvest flags ──────────────────
const lock = read(path.join(ROOT, 'src/runtime/launchBlockers/index.ts'));
for (const f of ['harvestReadinessReady', 'ripenessDetectionReady']) {
  if (!lock.includes(f)) {
    fail(`release-lock: launchBlockers/index.ts must surface ${f}`);
  }
}

// ─── 13. EVENT_TYPES whitelist includes the 5 new timeline events
const events = read(path.join(ROOT, 'src/lib/events/eventLogger.js'));
for (const t of ['harvest_readiness_checked', 'fruit_ripeness_checked',
                  'harvest_task_generated', 'harvest_completed',
                  'bloom_stage_checked']) {
  if (!events.includes(`'${t}'`)) {
    fail(`event-types: EVENT_TYPES whitelist must include '${t}'`);
  }
}

if (FAILED.length === 0) {
  pass(`harvest-readiness: suite + UI + scan integration + release lock + EVENT_TYPES all wired`);
}

// ─── Report ────────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:harvest-readiness-ownership] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} checks passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:harvest-readiness-ownership] PASS — wave-28 harvest readiness ownership contract intact.');
console.log(`  Runtime owns ripeness math.   UI is pure presentation.`);
console.log(`  ScanRuntime is not bypassed.  Camera is not re-owned.`);
console.log(`  Banned wording absent.        Idempotency keys present.`);
console.log(`  5 timeline event types whitelisted.   Release lock surfaces 2 flags.`);
