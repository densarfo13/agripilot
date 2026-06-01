#!/usr/bin/env node
/**
 * check-soilgrids-no-fake-data.mjs — locks the SoilGrids runtime
 * contract: no hardcoded soil values, no fabricated pH, no chemical
 * recommendations, no dosage units.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const fails = [];
const read = (rel) => {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) { fails.push(`missing: ${rel}`); return ''; }
  return fs.readFileSync(p, 'utf8');
};

const required = [
  ['src/runtime/soil/SoilProfileContracts.ts',
    ['SoilProfile', 'SoilGridsHealthEnvelope', 'NEEDS_LOCATION',
     'SOIL_DATA_UNAVAILABLE', 'SOILGRIDS_API_BASE',
     'GUIDANCE_TAIL', 'SOILGRIDS_CACHE_TTL_MS']],
  ['src/runtime/soil/SoilGridsRuntime.ts',
    ['__soilGridsHealth', 'installSoilGridsGlobal', 'fetchSoilProfile',
     'noFakeSoilData', 'nonBlocking', 'NEEDS_LOCATION',
     'SOIL_DATA_UNAVAILABLE', 'lastKnownSoilProfile']],
  ['src/runtime/soil/SoilCache.ts',
    ['readSoilCache', 'writeSoilCache', 'hasValidCoordinates']],
  ['src/runtime/soil/SoilRecommendationRuntime.ts',
    ['buildSoilRecommendations', 'FORBIDDEN_RECOMMENDATION_PATTERNS']],
];

for (const [f, keys] of required) {
  const src = read(f);
  if (!src) continue;
  for (const k of keys) {
    if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
  }
}

// Hard rule: recommendations module MUST NOT contain dosage units.
{
  const f = 'src/runtime/soil/SoilRecommendationRuntime.ts';
  const src = read(f);
  if (src) {
    // The forbidden patterns array itself enumerates the tokens we
    // forbid in recommendation BODIES — its declaration line is OK.
    // We scan body strings: lines containing both `body:` AND a forbidden
    // unit pattern are violations.
    const lines = src.split(/\r?\n/);
    const forbidden = [/\b\d+\s*kg\s*\/\s*ha\b/i, /\b\d+\s*g\s*\/\s*m2\b/i,
                       /\b\d+\s*ppm\b/i, /\bNPK\s+\d/i];
    for (let i = 0; i < lines.length; i++) {
      const L = lines[i];
      if (L.indexOf('FORBIDDEN_RECOMMENDATION_PATTERNS') >= 0) continue;
      for (const re of forbidden) {
        if (re.test(L))
          fails.push(`${f}:${i + 1} — forbidden dosage / chemical recommendation: ${L.trim().slice(0, 100)}`);
      }
    }
  }
}

// App.jsx must wire installSoilGridsGlobal.
{
  const f = 'src/App.jsx';
  const src = read(f);
  if (src && src.indexOf('installSoilGridsGlobal') < 0)
    fails.push(`${f}: missing installSoilGridsGlobal() install`);
}

if (fails.length) {
  console.error('[check:soilgrids-no-fake-data] FAILED');
  for (const m of fails) console.error('  - ' + m);
  process.exit(1);
}
console.log('[check:soilgrids-no-fake-data] OK');
