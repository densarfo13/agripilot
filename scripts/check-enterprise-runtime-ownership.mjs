#!/usr/bin/env node
/**
 * check-enterprise-runtime-ownership.mjs — Phase 14 governance.
 *
 *   node scripts/check-enterprise-runtime-ownership.mjs
 *
 * Enforces the Enterprise Runtime ownership boundaries:
 *
 *   - Enterprise UI cannot write directly to Prisma/API without
 *     EnterpriseRuntime (no `fetch('/api/...')` in pages without
 *     going through a hook/runtime layer)
 *   - Enterprise Runtime cannot import React components
 *   - Enterprise Runtime cannot call Plant.id (classifier hosts)
 *   - Enterprise Runtime cannot own camera APIs
 *   - Enterprise Runtime cannot write directly to localStorage
 *   - Enterprise pages must include an access gate
 *   - Enterprise dashboard files must not contain literal fake
 *     metrics (placeholder numbers, lorem text)
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const HEADER    = '[check:enterprise-runtime-ownership]';

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

const runtimeFiles = _walk('src/runtime/enterprise');
if (runtimeFiles.length === 0) {
  fail('no runtime files found under src/runtime/enterprise');
}
const enterpriseUiFiles = _walk('src/pages/enterprise')
  .concat(_walk('src/components/enterprise'));

const sources = {};
for (const f of runtimeFiles.concat(enterpriseUiFiles)) {
  sources[f] = _read(f);
}

const violations = [];

// ── Enterprise Runtime must NOT import React ────────────────────
for (const f of runtimeFiles) {
  const src = sources[f] || '';
  if (/from\s+['"]react['"]/.test(src)) {
    violations.push(f + ' imports react (runtime must not import UI)');
  }
  if (/from\s+['"][^'"]*components\//.test(src)) {
    violations.push(f + ' imports from /components (runtime → UI bleed)');
  }
}

// ── Enterprise Runtime must NOT own camera ──────────────────────
for (const f of runtimeFiles) {
  const src = sources[f] || '';
  if (/getUserMedia|navigator\.mediaDevices|@capacitor\/camera/i.test(src)) {
    violations.push(f + ' references camera (Scan Runtime ownership)');
  }
}

// ── Enterprise Runtime must NOT call Plant.id ───────────────────
const PLANT_ID_HOSTS = /api\.plant\.id|kindwise|imagga|plant-id\.com|plantid\.app/i;
for (const f of runtimeFiles) {
  const src = sources[f] || '';
  if (PLANT_ID_HOSTS.test(src)) {
    violations.push(f + ' references Plant.id classifier host '
      + '(Scan Runtime ownership)');
  }
  if (/import[^;]*['"][^'"]*scanDetectionEngine[^'"]*['"]/i.test(src)) {
    violations.push(f + ' imports scanDetectionEngine '
      + '(Scan Runtime ownership)');
  }
}

// ── Enterprise Runtime must NOT write to localStorage ───────────
for (const f of runtimeFiles) {
  const src = sources[f] || '';
  if (/localStorage\.setItem\s*\(/.test(src)
      || /localStorage\[.+?\]\s*=/.test(src)) {
    violations.push(f + ' writes to localStorage '
      + '(wave-5 single-writer: writes belong to the store/queue)');
  }
  if (/\bfetch\s*\(/.test(src)) {
    violations.push(f + ' uses fetch() — runtime must be pure '
      + '(routes / hooks own the network layer)');
  }
}

// ── Enterprise pages must have an access gate ──────────────────
for (const f of enterpriseUiFiles) {
  const src = sources[f] || '';
  // Crude but effective: every enterprise page must reference
  // either `farroway_internal` or a role-check string.
  if (!/farroway_internal|role\s*===\s*'(super_admin|admin|institutional_admin)'|isInternal|requireEnterpriseAccess/i.test(src)) {
    violations.push(f + ' has no visible access gate — '
      + 'enterprise UI must check role or internal flag');
  }
  // Direct localStorage WRITES from enterprise UI
  if (/localStorage\.setItem\s*\(/.test(src)
      || /localStorage\[.+?\]\s*=/.test(src)) {
    violations.push(f + ' writes to localStorage '
      + '(wave-5: writes belong to a dedicated store)');
  }
  // No direct fetch to /api/enterprise without runtime/hook layer
  if (/\bfetch\s*\(\s*['"`]\/api\/enterprise/.test(src)) {
    violations.push(f + ' calls /api/enterprise directly — '
      + 'must go through a runtime hook');
  }
  // Forbidden lorem / placeholder counts
  if (/lorem ipsum|placeholder.*\b\d{2,}|"\b(?:1234|5678|9999)\b"/i.test(src)) {
    violations.push(f + ' contains lorem / placeholder metrics '
      + '(real data only)');
  }
}

if (violations.length > 0) {
  for (const v of violations) console.error(HEADER, 'VIOLATION:', v);
  fail(violations.length + ' enterprise ownership violation(s)');
}

console.log(HEADER, 'PASS — Enterprise Runtime ownership clean.');
console.log('  Runtime files scanned: ' + runtimeFiles.length
  + ' · Enterprise UI files scanned: ' + enterpriseUiFiles.length + '.');
console.log('  No React in runtime · no camera ownership · '
  + 'no Plant.id calls · no localStorage / fetch from runtime · '
  + 'enterprise UI gated · no fake metrics.');
process.exit(0);
