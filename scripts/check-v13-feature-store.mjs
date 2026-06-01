#!/usr/bin/env node
/**
 * scripts/check-v13-feature-store.mjs — feature store is READINESS ONLY and
 * never fabricates feature values.
 *
 * Fails if FeatureStoreReadiness:
 *   • does not declare the 10 feature groups
 *   • does not surface readiness booleans (ready flags)
 *   • fabricates data (random) or calls the network
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const rel = 'src/runtime/v13/featureStore/FeatureStoreReadiness.ts';
const raw = read(rel);
if (!raw) { F.push(`${rel}: missing`); }
else {
  const src = strip(raw);
  const GROUPS = [
    'farmer_activity_features', 'plant_health_features', 'scan_quality_features',
    'disease_pressure_features', 'pest_pressure_features', 'weather_risk_features',
    'task_completion_features', 'outcome_features', 'buyer_trust_features',
    'ngo_program_features',
  ];
  const missing = GROUPS.filter((g) => !raw.includes(g));
  if (missing.length) F.push(`FeatureStoreReadiness missing feature groups: ${missing.join(', ')}`);
  else P.push('all 10 feature groups declared');
  if (!/\bready\b/.test(src)) F.push('FeatureStoreReadiness must surface readiness flags');
  else P.push('readiness flags surfaced');
  if (/Math\.random\s*\(/.test(src)) F.push('FeatureStoreReadiness must not fabricate feature values (no random)');
  else P.push('no fabricated feature values');
  if (/\bfetch\s*\(/.test(src)) F.push('FeatureStoreReadiness must not call the network');
  else P.push('no network call');
}

if (F.length) {
  console.error('[check:v13-feature-store] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:v13-feature-store] PASS — readiness only, 10 groups, no fabricated values.');
for (const m of P) console.log('  ✓ ' + m);
