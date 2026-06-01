#!/usr/bin/env node
/**
 * scripts/check-v13-regional-network.mjs — regional signals must require a
 * minimum scan count AND multiple farms; no single-user outbreak claim.
 *
 * Fails if RegionalNetworkRuntime:
 *   • has no minimum scan-count guard
 *   • has no minimum farm-count guard (multiple farms before a signal)
 *   • lacks the honest "Not enough regional data yet" fallback
 *   • lacks explanation + limitations
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const rel = 'src/runtime/v13/regionalNetwork/RegionalNetworkRuntime.ts';
const raw = read(rel);
if (!raw) { F.push(`${rel}: missing`); }
else {
  const src = strip(raw);
  if (!/MIN_SCAN_COUNT|minScan/.test(src) || !/<\s*(MIN_SCAN_COUNT|minScan)/i.test(src))
    F.push('RegionalNetworkRuntime must require a minimum scan count');
  else P.push('minimum scan-count guard present');
  if (!/MIN_FARM_COUNT|minFarm/.test(src) || !/<\s*(MIN_FARM_COUNT|minFarm)/i.test(src))
    F.push('RegionalNetworkRuntime must require multiple farms (minimum farm count) before a region signal');
  else P.push('minimum farm-count guard present (no single-user outbreak)');
  if (!/not enough regional data yet/i.test(raw))
    F.push('RegionalNetworkRuntime must carry the honest "Not enough regional data yet" fallback');
  else P.push('honest "Not enough regional data yet" fallback present');
  if (!/\bexplanation\b/.test(raw) || !/\blimitations\b/.test(raw))
    F.push('RegionalNetworkRuntime must surface explanation + limitations');
  else P.push('explanation + limitations present');
}

if (F.length) {
  console.error('[check:v13-regional-network] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:v13-regional-network] PASS — min scans + multiple farms, no single-user outbreak.');
for (const m of P) console.log('  ✓ ' + m);
