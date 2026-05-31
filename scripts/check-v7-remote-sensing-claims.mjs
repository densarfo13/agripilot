#!/usr/bin/env node
/**
 * scripts/check-v7-remote-sensing-claims.mjs — no fake satellite.
 *
 * Fails if the V7 RemoteSensingEngine:
 *   • does not default activePredictionEnabled to false
 *   • hardcodes activePredictionEnabled: true (a satellite-prediction
 *     claim without real fetched + stored API data)
 *   • fabricates an NDVI/vegetation/soil number (a numeric NDVI literal)
 *   • makes a live network call (fetch) from the health probe
 *   • lacks the honest "Not enough remote data yet" readiness fallback
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const rel = 'src/runtime/v7/remote/RemoteSensingEngine.ts';
const raw = read(rel);
if (!raw) { F.push(`${rel}: missing`); }
else {
  const src = strip(raw);
  if (!/activePredictionEnabled:\s*false/.test(src))
    F.push('RemoteSensingEngine must default activePredictionEnabled:false');
  else P.push('activePredictionEnabled defaults to false');
  if (/activePredictionEnabled:\s*true/.test(src))
    F.push('RemoteSensingEngine must NOT hardcode activePredictionEnabled:true (no satellite claim without real data)');
  else P.push('no hardcoded active-prediction claim');
  // Fabricated NDVI number — an NDVI key/var assigned a numeric literal.
  if (/ndvi\w*\s*[:=]\s*-?\d/i.test(src))
    F.push('RemoteSensingEngine must NOT assign a numeric NDVI value (no fabricated NDVI)');
  else P.push('no fabricated NDVI number');
  if (/\bfetch\s*\(/.test(src))
    F.push('RemoteSensingEngine must NOT call fetch from a health probe');
  else P.push('no live network call');
  if (!/not enough remote data yet/i.test(raw))
    F.push('RemoteSensingEngine must carry the honest "Not enough remote data yet" fallback');
  else P.push('honest "Not enough remote data yet" fallback present');
}

if (F.length) {
  console.error('[check:v7-remote-sensing-claims] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:v7-remote-sensing-claims] PASS — readiness only, no fabricated NDVI, no fake satellite claim.');
for (const m of P) console.log('  ✓ ' + m);
