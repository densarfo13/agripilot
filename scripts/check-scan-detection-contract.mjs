#!/usr/bin/env node
/**
 * scripts/check-scan-detection-contract.mjs — §1/§3 canonical detection
 * contract.
 *
 * Fails if scanDetectionContracts.ts does not declare the category
 * vocabularies, the confidence thresholds (0.75 / 0.45), the artifact
 * idempotency key builders, and the banned-words / disclaimer policy.
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

const src = read('src/runtime/scanDetection/scanDetectionContracts.ts');
if (!src) { F.push('src/runtime/scanDetection/scanDetectionContracts.ts: missing'); }
else {
  const VOCAB = ['PLANT_TYPES', 'HEALTH_STATUSES', 'SEVERITIES', 'GROWTH_STAGES',
    'HARVEST_STATUSES', 'DISEASE_KEYS', 'PEST_KEYS', 'NUTRIENT_KEYS'];
  const missingVocab = VOCAB.filter((v) => !src.includes(v));
  if (missingVocab.length) F.push(`contract missing category vocabularies: ${missingVocab.join(', ')}`);
  else P.push('all 8 category vocabularies declared');

  // §3 disease/pest/nutrient canonical keys present (sample anchors).
  for (const k of ['late_blight', 'cassava_mosaic_disease', 'maize_lethal_necrosis']) {
    if (!src.includes(k)) F.push(`disease vocabulary missing ${k}`);
  }
  for (const k of ['fall_armyworm', 'tuta_absoluta']) {
    if (!src.includes(k)) F.push(`pest vocabulary missing ${k}`);
  }
  for (const k of ['nitrogen_deficiency', 'boron_deficiency']) {
    if (!src.includes(k)) F.push(`nutrient vocabulary missing ${k}`);
  }
  if (!F.some((m) => m.includes('vocabulary missing'))) P.push('canonical disease/pest/nutrient keys present');

  // Confidence thresholds.
  if (!/HIGH:\s*0\.75/.test(src) || !/REVIEW:\s*0\.45/.test(src))
    F.push('confidence thresholds must be HIGH 0.75 / REVIEW 0.45');
  else P.push('confidence thresholds 0.75 / 0.45 declared');

  // Idempotency key builders (§9).
  for (const k of ['scan:start:', 'scan:complete:', 'scan:failed:', 'task:from-scan:']) {
    if (!src.includes(k)) F.push(`artifact idempotency key format missing: ${k}`);
  }
  if (!F.some((m) => m.includes('idempotency key format'))) P.push('artifact idempotency key builders present');

  // Banned words + disclaimer policy.
  if (!/BANNED_WORDS/.test(src) || !/guaranteed/.test(src) || !/confirmed/.test(src))
    F.push('contract must declare the BANNED_WORDS policy (guaranteed/confirmed/100%)');
  else P.push('banned-words policy declared');
  if (!/Decision support, not a guarantee/.test(src))
    F.push('contract must carry the detection disclaimer');
  else P.push('detection disclaimer present');
}

if (F.length) {
  console.error('[check:scan-detection-contract] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:scan-detection-contract] PASS — categories, thresholds, idempotency keys, safe-words policy.');
for (const m of P) console.log('  ✓ ' + m);
