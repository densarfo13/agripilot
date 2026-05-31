#!/usr/bin/env node
/**
 * scripts/check-v8-remote-sensing-claims.mjs
 *
 * Satellite/soil readiness must make NO claim without real provider data.
 * Fails if RemoteSensingReadinessEngine:
 *   • does not default activeRemotePrediction to false
 *   • hardcodes activeRemotePrediction: true
 *   • fabricates an NDVI/soil number
 *   • calls the network (fetch)
 *   • lacks the honest "Not enough remote data yet" fallback
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const rel = 'src/runtime/v8/remoteSensing/RemoteSensingReadinessEngine.ts';
const raw = read(rel);
if (!raw) { F.push(`${rel}: missing`); }
else {
  const src = strip(raw);
  if (!/activeRemotePrediction:\s*false/.test(src))
    F.push('RemoteSensingReadinessEngine must default activeRemotePrediction:false');
  else P.push('activeRemotePrediction defaults to false');
  if (/activeRemotePrediction:\s*true/.test(src))
    F.push('RemoteSensingReadinessEngine must NOT hardcode activeRemotePrediction:true');
  else P.push('no hardcoded active-prediction claim');
  if (/ndvi\w*\s*[:=]\s*-?\d/i.test(src))
    F.push('RemoteSensingReadinessEngine must NOT assign a numeric NDVI value');
  else P.push('no fabricated NDVI number');
  if (/\bfetch\s*\(/.test(src))
    F.push('RemoteSensingReadinessEngine must NOT call the network from a readiness probe');
  else P.push('no network call');
  if (!/not enough remote data yet/i.test(raw))
    F.push('RemoteSensingReadinessEngine must carry the honest "Not enough remote data yet" fallback');
  else P.push('honest "Not enough remote data yet" fallback present');
}

if (F.length) {
  console.error('[check:v8-remote-sensing-claims] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:v8-remote-sensing-claims] PASS — readiness only, no fabricated NDVI/soil, no fake claim.');
for (const m of P) console.log('  ✓ ' + m);
