#!/usr/bin/env node
/**
 * scripts/check-yield-satellite-graph-governance.mjs — Wave-36 CI gate
 * enforcing the V5 Invisible Agricultural Intelligence ownership.
 * Read-only.
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

function stripBannedDeclarations(src) {
  let out = src;
  out = out.replace(/export\s+const\s+YIELD_BANNED_WORDING\s*=\s*Object\.freeze\(\[[\s\S]*?\]\s*as\s+const\);?/g, '');
  out = out.replace(/export\s+const\s+YIELD_SAFE_VERBS\s*=\s*Object\.freeze\(\[[\s\S]*?\]\s*as\s+const\);?/g, '');
  out = out.replace(/export\s+const\s+SATELLITE_BANNED_WORDING\s*=\s*Object\.freeze\(\[[\s\S]*?\]\s*as\s+const\);?/g, '');
  return out;
}

const SUITE = [
  { dir: 'yield',          installer: 'installYieldIntelligenceGlobal',     global: '__yieldIntelligenceHealth' },
  { dir: 'satellite',      installer: 'installSatelliteIntelligenceGlobal', global: '__satelliteIntelligenceHealth' },
  { dir: 'knowledgeGraph', installer: 'installKnowledgeGraphGlobal',        global: '__knowledgeGraphHealth' },
];

// 1. Each suite present.
for (const { dir, installer, global } of SUITE) {
  const barrel = read(path.join(ROOT, `src/runtime/${dir}/index.ts`));
  if (!barrel) { fail(`v5: missing barrel src/runtime/${dir}/index.ts`); continue; }
  if (!barrel.includes(installer)) {
    fail(`v5: ${dir}/index.ts must re-export ${installer}`);
  }
  const subtree = readDir(path.join(ROOT, `src/runtime/${dir}`))
    .map(read).join('\n');
  if (!subtree.includes(global)) {
    fail(`v5: ${dir} runtime must pin window.${global}`);
  }
}

// 2. No React imports anywhere in V5 runtimes.
for (const { dir } of SUITE) {
  for (const f of readDir(path.join(ROOT, `src/runtime/${dir}`))) {
    const src = read(f);
    if (/from\s+['"]react['"]/.test(src) || /from\s+['"]react-dom/.test(src)) {
      fail(`v5: ${path.relative(ROOT, f)} must NOT import React`);
    }
  }
}

// 3. Banned yield wording in executable code.
const YIELD_BANNED = ['guaranteed yield', 'exact yield',
                       'will produce exactly', 'confirmed yield'];
for (const f of readDir(path.join(ROOT, 'src/runtime/yield'))) {
  let src = stripComments(read(f));
  src = stripBannedDeclarations(src);
  const lc = src.toLowerCase();
  for (const phrase of YIELD_BANNED) {
    if (lc.includes(phrase)) {
      fail(`v5-wording (yield): ${path.relative(ROOT, f)} uses banned phrase "${phrase}"`);
    }
  }
}

// 4. Satellite no-fake-data.
const satRuntime = read(path.join(ROOT, 'src/runtime/satellite/SatelliteRuntime.ts'));
if (!/unavailable:\s*true/.test(satRuntime)) {
  fail(`v5: SatelliteRuntime must return unavailable:true when no provider configured`);
}
if (/ndviValue\s*:\s*0\.\d+/.test(satRuntime)) {
  fail(`v5: SatelliteRuntime must NOT hard-code NDVI values`);
}

// 5. Satellite unavailable does not block scan.
const scanPage = read(path.join(ROOT, 'src/pages/ScanPage.jsx'));
if (/throw\s+new\s+Error.*satellite/i.test(scanPage)) {
  fail(`v5: ScanPage must NOT throw on satellite unavailability`);
}

// 6. No grower-visible routes for yield/satellite/graph.
const appJsx = read(path.join(ROOT, 'src/App.jsx'));
const bottomNav = read(path.join(ROOT, 'src/components/farmer/BottomTabNav.jsx'));
const FORBIDDEN_ROUTES = [
  /path="\/yield"/,
  /path="\/satellite"/,
  /path="\/knowledge-graph"/,
  /path="\/graph"/,
];
for (const r of FORBIDDEN_ROUTES) {
  if (r.test(appJsx)) {
    fail(`v5: App.jsx must NOT register grower-visible yield/satellite/knowledge-graph route`);
  }
}
if (/(yield|satellite|knowledge.?graph)/i.test(bottomNav)) {
  fail(`v5: BottomTabNav must NOT expose yield/satellite/knowledge-graph tabs to growers`);
}

// 7. V5 runtimes never call addScanTasks.
for (const { dir } of SUITE) {
  for (const f of readDir(path.join(ROOT, `src/runtime/${dir}`))) {
    const src = stripComments(read(f));
    if (/addScanTasks\s*\(/.test(src)) {
      fail(`v5: ${path.relative(ROOT, f)} must NOT call addScanTasks — return envelopes only`);
    }
  }
}

// 8. App.jsx boot wires all three installers.
for (const { installer } of SUITE) {
  if (!appJsx.includes(installer)) {
    fail(`v5: App.jsx must call ${installer}() during boot`);
  }
}

// 9. Release lock surfaces all three readiness flags.
const lock = read(path.join(ROOT, 'src/runtime/launchBlockers/index.ts'));
for (const flag of ['yieldIntelligenceReady', 'satelliteIntelligenceReady',
                     'knowledgeGraphReady']) {
  if (!lock.includes(flag)) {
    fail(`v5: launchBlockers/index.ts must surface ${flag}`);
  }
}

if (FAILED.length === 0) {
  pass(`v5: 3 runtimes wired · no React imports · no banned wording · no fake satellite · graph invisible · release-lock wired`);
}

if (FAILED.length > 0) {
  console.error('[check:yield-satellite-graph-governance] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} checks passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:yield-satellite-graph-governance] PASS — wave-36 V5 ownership intact.');
console.log(`  Yield Intelligence     / Satellite Intelligence / Knowledge Graph runtimes wired`);
console.log(`  No React in runtimes · no banned yield wording · no fake satellite data`);
console.log(`  Graph invisible to growers · runtimes never call addScanTasks · release lock surfaces all 3 flags`);
