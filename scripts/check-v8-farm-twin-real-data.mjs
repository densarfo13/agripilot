#!/usr/bin/env node
/**
 * scripts/check-v8-farm-twin-real-data.mjs
 *
 * The digital farm twin must reflect REAL stored data — never invent farm
 * history. Fails if FarmTwinEngine:
 *   • fabricates data (random) or calls the network (fetch)
 *   • does not read from the real on-device stores (localStorage probes)
 *   • does not surface the readiness booleans (so missing data is honest)
 *   • lacks the honest "Not enough data yet" fallback / disclaimer
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const rel = 'src/runtime/v8/farmTwin/FarmTwinEngine.ts';
const raw = read(rel);
if (!raw) { F.push(`${rel}: missing`); }
else {
  const src = strip(raw);
  if (/\b(?:Math\.random|fetch)\s*\(/.test(src)) F.push('FarmTwinEngine must not fabricate data or call the network');
  else P.push('no fabricated data, no network call');
  // Reads real sources.
  if (!/_ls\s*\(|_probe\s*\(/.test(src))
    F.push('FarmTwinEngine must read from real on-device sources (_ls/_probe)');
  else P.push('reads real on-device sources');
  // Readiness booleans (honest missing data).
  const FLAGS = ['scanHistoryReady', 'taskHistoryReady', 'outcomeHistoryReady', 'weatherContextReady'];
  const missing = FLAGS.filter((f) => !raw.includes(f));
  if (missing.length) F.push(`FarmTwinEngine must surface readiness flags: ${missing.join(', ')}`);
  else P.push('surfaces readiness flags (missing data shown honestly)');
  if (!/not enough data yet/i.test(raw))
    F.push('FarmTwinEngine must carry the honest "Not enough data yet" fallback');
  else P.push('honest "Not enough data yet" fallback present');
  if (!/Decision support, not a guarantee/.test(raw))
    F.push('FarmTwinEngine must carry the disclaimer');
  else P.push('disclaimer present');
}

if (F.length) {
  console.error('[check:v8-farm-twin-real-data] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:v8-farm-twin-real-data] PASS — real data only, no invented history, honest readiness.');
for (const m of P) console.log('  ✓ ' + m);
