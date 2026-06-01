#!/usr/bin/env node
/**
 * scripts/check-v13-model-registry.mjs — no model may be production-approved
 * without validated metrics.
 *
 * Fails if ModelRegistryReadiness:
 *   • does not declare the 6 tracked models
 *   • hardcodes approvedForProduction:true (no model is validated yet)
 *   • does not surface productionApprovedCount: 0
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const rel = 'src/runtime/v13/modelRegistry/ModelRegistryReadiness.ts';
const raw = read(rel);
if (!raw) { F.push(`${rel}: missing`); }
else {
  const src = strip(raw);
  const MODELS = [
    'plant_diagnosis_ranker', 'disease_risk_model', 'pest_risk_model',
    'yield_readiness_model', 'buyer_trust_model', 'ngo_impact_model',
  ];
  const missing = MODELS.filter((m) => !raw.includes(m));
  if (missing.length) F.push(`ModelRegistryReadiness missing tracked models: ${missing.join(', ')}`);
  else P.push('all 6 tracked models declared');
  if (/approvedForProduction:\s*true/.test(src))
    F.push('ModelRegistryReadiness must NOT hardcode approvedForProduction:true (no validated model yet)');
  else P.push('no model production-approved (no validated metrics yet)');
  if (!/productionApprovedCount:\s*0/.test(src))
    F.push('ModelRegistryReadiness must surface productionApprovedCount: 0');
  else P.push('productionApprovedCount is 0');
}

if (F.length) {
  console.error('[check:v13-model-registry] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:v13-model-registry] PASS — 6 models tracked, none production-approved without metrics.');
for (const m of P) console.log('  ✓ ' + m);
