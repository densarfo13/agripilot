#!/usr/bin/env node
/**
 * scripts/check-scan-intelligence-v2.mjs — Wave-29 CI gate.
 *
 * Enforces the Scan Intelligence V2 ownership contract:
 *   • Four runtime subtrees exist (growth / severity /
 *     outcomeComparison / weatherRisk) with the canonical
 *     install*Global function + ready-flag.
 *   • App.jsx boot wires every installer.
 *   • Release lock surfaces every ready flag.
 *   • EVENT_TYPES whitelist includes the three new V2 timeline events.
 *   • ScanResultCard renders the ScanIntelligenceSections wrapper.
 *   • ScanPage imports the four V2 evaluate() functions.
 *   • Wording is safe — banned tokens in executable code fail.
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

function stripComments(src) {
  if (!src) return '';
  let out = src.replace(/\/\*[\s\S]*?\*\//g, '');
  out = out.replace(/(^|[^:])\/\/.*$/gm, '$1');
  return out;
}

const SUITE = [
  {
    dir: 'growth',
    installer: 'installGrowthStageGlobal',
    global:    '__growthStageHealth',
    readyKey:  'growthStageReady',
  },
  {
    dir: 'severity',
    installer: 'installSeverityGlobal',
    global:    '__severityHealth',
    readyKey:  'severityReady',
  },
  {
    dir: 'outcomeComparison',
    installer: 'installOutcomeComparisonGlobal',
    global:    '__outcomeComparisonHealth',
    readyKey:  'outcomeComparisonReady',
  },
  {
    dir: 'weatherRisk',
    installer: 'installWeatherRiskGlobal',
    global:    '__weatherRiskHealth',
    readyKey:  'weatherRiskReady',
  },
];

// ─── 1. Each runtime subtree present with installer + global + flag
for (const { dir, installer, global, readyKey } of SUITE) {
  const barrelPath = path.join(ROOT, `src/runtime/${dir}/index.ts`);
  const barrel = read(barrelPath);
  if (!barrel) {
    fail(`scan-v2: missing barrel src/runtime/${dir}/index.ts`);
    continue;
  }
  if (!barrel.includes(installer)) {
    fail(`scan-v2: ${dir}/index.ts must re-export ${installer}`);
  }
  const subtree = readDir(path.join(ROOT, `src/runtime/${dir}`))
    .map(read).join('\n');
  if (!subtree.includes(global)) {
    fail(`scan-v2: ${dir} runtime must pin window.${global}`);
  }
  if (!subtree.includes(readyKey)) {
    fail(`scan-v2: ${dir} health envelope must include ${readyKey}`);
  }
}

// ─── 2. App.jsx boot wires every installer
const app = read(path.join(ROOT, 'src/App.jsx'));
for (const { installer } of SUITE) {
  if (!app.includes(installer)) {
    fail(`scan-v2: App.jsx must call ${installer}() during boot`);
  }
}

// ─── 3. Release lock surfaces every ready flag
const lock = read(path.join(ROOT, 'src/runtime/launchBlockers/index.ts'));
for (const { readyKey } of SUITE) {
  if (!lock.includes(readyKey)) {
    fail(`scan-v2: launchBlockers/index.ts must surface ${readyKey} on __releaseLock()`);
  }
}

// ─── 4. EVENT_TYPES whitelist includes the V2 timeline events
const events = read(path.join(ROOT, 'src/lib/events/eventLogger.js'));
for (const t of ['growth_stage_detected', 'severity_updated', 'outcome_compared']) {
  if (!events.includes(`'${t}'`)) {
    fail(`scan-v2: EVENT_TYPES whitelist must include '${t}'`);
  }
}

// ─── 5. ScanResultCard wires ScanIntelligenceSections
const scanCard = read(path.join(ROOT, 'src/components/scan/ScanResultCard.jsx'));
if (!scanCard.includes('ScanIntelligenceSections')) {
  fail(`scan-v2: ScanResultCard must render ScanIntelligenceSections`);
}
if (!/result\.intelligence/.test(scanCard)) {
  fail(`scan-v2: ScanResultCard must gate ScanIntelligenceSections on result.intelligence`);
}

// ─── 6. ScanPage imports the four V2 evaluators
const scanPage = read(path.join(ROOT, 'src/pages/ScanPage.jsx'));
for (const ev of [
  'evaluate as evaluateGrowthStage',
  'evaluate as evaluateSeverity',
  'evaluate as evaluateOutcomeComparison',
  'evaluate as evaluateWeatherRisk',
]) {
  if (!scanPage.includes(ev)) {
    fail(`scan-v2: ScanPage must import "${ev}" from the V2 runtimes`);
  }
}
if (!/intelligence:\s*Object\.freeze/.test(scanPage)) {
  fail(`scan-v2: ScanPage must attach a frozen result.intelligence envelope`);
}

// ─── 7. Banned wording — executable code only.
const BANNED_SEVERITY = ['emergency', 'guaranteed loss', 'confirmed crop failure'];
const BANNED_WEATHER  = ['guaranteed', 'definitely', 'confirmed'];

function _stripDeclarations(src) {
  // The BANNED_* contracts lists the phrases by design — exempt
  // the declaration block so the gate doesn't trip on its own
  // catalogue.
  let out = src;
  out = out.replace(/export\s+const\s+SEVERITY_BANNED_WORDING\s*=\s*Object\.freeze\(\[[\s\S]*?\]\s*as\s+const\);?/g, '');
  out = out.replace(/export\s+const\s+WEATHER_BANNED_WORDING\s*=\s*Object\.freeze\(\[[\s\S]*?\]\s*as\s+const\);?/g, '');
  return out;
}

function scanFile(file, banned, label) {
  const raw = read(file);
  if (!raw) return;
  let src = stripComments(raw);
  src = _stripDeclarations(src);
  const lc = src.toLowerCase();
  for (const b of banned) {
    // 'confirmed' is too generic — the V2 weather wording check
    // looks for 'confirmed crop' / 'confirmed harvest' / 'confirmed
    // loss' rather than a bare 'confirmed' word, which can appear
    // legitimately (e.g. function names like _confirmCallback).
    if (label === 'weather' && b === 'confirmed') {
      if (/confirmed (crop|harvest|loss|disease|infection)/i.test(src)) {
        fail(`scan-v2-wording: ${path.relative(ROOT, file)} uses "confirmed <noun>" in executable code`);
      }
      continue;
    }
    if (lc.includes(b)) {
      fail(`scan-v2-wording (${label}): ${path.relative(ROOT, file)} uses banned phrase "${b}" in executable code`);
    }
  }
}

const sevDir   = path.join(ROOT, 'src/runtime/severity');
const weatherDir = path.join(ROOT, 'src/runtime/weatherRisk');
for (const f of readDir(sevDir))     scanFile(f, BANNED_SEVERITY, 'severity');
for (const f of readDir(weatherDir)) scanFile(f, BANNED_WEATHER,  'weather');

if (FAILED.length === 0) {
  pass(`scan-v2: 4 runtimes wired · boot installs present · release-lock + EVENT_TYPES + UI + ScanPage integration intact · banned wording absent`);
}

if (FAILED.length > 0) {
  console.error('[check:scan-intelligence-v2] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} checks passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:scan-intelligence-v2] PASS — wave-29 Scan Intelligence V2 wired.');
console.log(`  Growth Stage      — installGrowthStageGlobal       / __growthStageHealth`);
console.log(`  Severity          — installSeverityGlobal          / __severityHealth`);
console.log(`  Outcome Compare   — installOutcomeComparisonGlobal / __outcomeComparisonHealth`);
console.log(`  Weather Risk      — installWeatherRiskGlobal       / __weatherRiskHealth`);
console.log(`  Release lock + EVENT_TYPES + ScanResultCard wiring all green.`);
