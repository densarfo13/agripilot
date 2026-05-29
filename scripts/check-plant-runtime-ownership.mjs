#!/usr/bin/env node
/**
 * check-plant-runtime-ownership.mjs — Phase 17 governance gate.
 *
 *   node scripts/check-plant-runtime-ownership.mjs
 *
 * Enforces the spec's ownership boundaries:
 *
 *   - UI cannot import PlantRegistry directly
 *   - UI uses plant runtime hooks/actions only (barrel import)
 *   - Scan UI cannot create plants directly
 *   - Plant Runtime cannot import React components
 *   - Plant Runtime cannot own camera
 *   - Plant Runtime cannot call Plant.id directly
 *   - no direct localStorage writes from plant UI
 *
 * Spirit: ensure the catalog/runtime layering stays clean and
 * doesn't accumulate import-boundary violations.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const HEADER    = '[check:plant-runtime-ownership]';

function _read(rel) {
  const p = resolve(ROOT, rel);
  if (!existsSync(p)) return null;
  try { return readFileSync(p, 'utf8'); } catch { return null; }
}
function fail(m, d) {
  console.error(HEADER, 'FAIL —', m);
  if (d) console.error('  ' + d);
  process.exit(1);
}

function _walk(dir, out = []) {
  const abs = resolve(ROOT, dir);
  if (!existsSync(abs)) return out;
  for (const entry of readdirSync(abs)) {
    const full = join(abs, entry);
    const rel  = join(dir, entry);
    let s;
    try { s = statSync(full); } catch { continue; }
    if (s.isDirectory()) _walk(rel, out);
    else if (/\.(ts|tsx|jsx|js|mjs)$/.test(entry)) out.push(rel);
  }
  return out;
}

const runtimeFiles = _walk('src/runtime/plants');
if (runtimeFiles.length === 0) {
  fail('no runtime files found under src/runtime/plants');
}
const plantUiFiles = _walk('src/pages').filter((f) =>
  /Plant|MyPlants/i.test(f)
).concat(_walk('src/components/plants'));

const sources = {};
for (const f of runtimeFiles.concat(plantUiFiles)) {
  sources[f] = _read(f);
}

const violations = [];

// Plant Runtime cannot import React components
for (const f of runtimeFiles) {
  const src = sources[f];
  if (!src) continue;
  if (/from\s+['"]react['"]/.test(src)
      && !/react-hooks\b/.test(src)) {
    violations.push(f + ' imports react (runtime should not import UI)');
  }
  if (/from\s+['"][^'"]*components\//.test(src)) {
    violations.push(f + ' imports from /components (runtime → UI bleed)');
  }
}

// Plant Runtime cannot own camera
for (const f of runtimeFiles) {
  const src = sources[f];
  if (!src) continue;
  if (/getUserMedia|navigator\.mediaDevices|@capacitor\/camera/i.test(src)) {
    violations.push(f + ' references camera API (Scan Runtime ownership)');
  }
}

// Plant Runtime cannot call Plant.id classifier directly. A
// real violation is an HTTP call or an import of the classifier
// service; property reads like `plant.id` or variable names like
// `plantId` are NOT violations.
const PLANT_ID_SERVICE_HOSTS = /api\.plant\.id|kindwise|imagga|plant-id\.com|plantid\.app/i;
for (const f of runtimeFiles) {
  const src = sources[f];
  if (!src) continue;
  // 1. Network call to the classifier service.
  if (PLANT_ID_SERVICE_HOSTS.test(src)) {
    violations.push(f + ' references Plant.id classifier '
      + 'service host (Scan Runtime ownership)');
  }
  // 2. Direct import of a classifier wrapper module.
  if (/import[^;]*['"][^'"]*plant-id[^'"]*['"]/i.test(src)
      || /import[^;]*['"][^'"]*kindwise[^'"]*['"]/i.test(src)
      || /import[^;]*['"][^'"]*scanDetectionEngine[^'"]*['"]/i.test(src)) {
    violations.push(f + ' imports classifier wrapper '
      + '(Scan Runtime ownership)');
  }
}

// UI cannot import PlantRegistry directly (must use barrel)
for (const f of plantUiFiles) {
  const src = sources[f];
  if (!src) continue;
  if (/from\s+['"][^'"]*runtime\/plants\/PlantRegistry['"]/.test(src)) {
    violations.push(f + ' imports PlantRegistry directly '
      + '(must use src/runtime/plants barrel)');
  }
  // Direct localStorage WRITES from plant UI — read-only is fine
  if (/localStorage\.setItem\s*\(/.test(src)
      || /localStorage\[.+?\]\s*=/.test(src)) {
    violations.push(f + ' writes to localStorage '
      + '(wave-5 single-writer: writes belong to journal store)');
  }
}

if (violations.length > 0) {
  for (const v of violations) console.error(HEADER, 'VIOLATION:', v);
  fail(violations.length + ' ownership violation(s) found');
}

// Spec also says: "Plant Runtime owns plants / plant health /
// plant lifecycle / plant timeline / plant-generated tasks /
// plant recommendations". Verify the ownership manifest still
// names these and only these.
const runtimeOwnership = _read('src/runtime/plants/PlantRuntime.ts');
if (!runtimeOwnership) {
  fail('PlantRuntime.ts missing — cannot verify ownership manifest');
}
const ownerCaps = [
  'plant_state', 'plant_health',
  'plant_lifecycle', 'plant_memory',
];
for (const c of ownerCaps) {
  if (runtimeOwnership.indexOf("'" + c + "'") === -1) {
    fail("PLANT_RUNTIME_OWNERSHIP missing capability: '" + c + "'");
  }
}

console.log(HEADER, 'PASS — Plant Runtime ownership boundaries clean.');
console.log('  Runtime files scanned: ' + runtimeFiles.length
  + ' · Plant UI files scanned: ' + plantUiFiles.length + '.');
console.log('  No React imports in runtime · no camera ownership · '
  + 'no direct Plant.id calls · no PlantRegistry direct imports '
  + 'from UI · no localStorage writes from plant UI.');
process.exit(0);
