#!/usr/bin/env node
/**
 * scripts/check-v13-no-fake-ml.mjs — V13 must never fake ML / forecasts.
 *
 * Fails if any V13 runtime:
 *   • fabricates data (random) or calls the network (fetch)
 *   • emits a numeric confidence instead of a label
 *   • emits an exact yield/revenue forecast (numeric tons/bags/kg per
 *     acre/ha, or a currency-prefixed revenue figure)
 *   • reaches into the tree with a deep '../' project import
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const DIR = 'src/runtime/v13';
function walk(dir) {
  const out = [];
  let entries = [];
  try { entries = fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...walk(rel));
    else if (e.name.endsWith('.ts')) out.push(rel);
  }
  return out;
}
const files = walk(DIR);
if (!files.length) F.push('src/runtime/v13/**/*.ts runtimes must exist');

for (const rel of files) {
  const src = strip(read(rel));
  if (!src) continue;
  if (/Math\.random\s*\(/.test(src)) F.push(`${rel}: Math.random — no fabricated ML/data`);
  if (/\bfetch\s*\(/.test(src)) F.push(`${rel}: fetch — a readiness probe must not call the network`);
  if (/confidence:\s*\d/.test(src)) F.push(`${rel}: numeric confidence — use a 'low'|'medium'|'high' label`);
  if (/\b\d+(?:\.\d+)?\s*(tons?|bags?|kg|kilograms?)\s*\/\s*(acre|ha|hectare)/i.test(src))
    F.push(`${rel}: numeric yield forecast — V13 is readiness-only, no exact yield`);
  if (/(revenue|income|profit)\b[^.\n]{0,40}?[$₵€£]\s*\d|[$₵€£]\s*\d[\d,.]*\b[^.\n]{0,20}?(revenue|income|profit)/i.test(src))
    F.push(`${rel}: revenue forecast — not permitted in V13`);
  if (/from\s*['"]\.\.\//.test(src))
    F.push(`${rel}: deep '../' project import — V13 runtimes must be self-contained`);
}
if (!F.length) P.push(`${files.length} V13 files: no fabrication, no network, label confidence, no yield/revenue, no deep imports`);

if (F.length) {
  console.error('[check:v13-no-fake-ml] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:v13-no-fake-ml] PASS — no fake ML, no forecasts, no network, self-contained.');
for (const m of P) console.log('  ✓ ' + m);
