/**
 * check-field-intelligence-v11.mjs — Scan Intelligence v11 field intelligence.
 *
 * Locks the honest split: calendar fields estimate from a planting date; the
 * CV-dependent fields (counts/canopy/density/spacing/yield/biomass/coverage) are
 * ALWAYS 'unavailable' with a null value — never a fabricated number. Runs the test.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const R = process.cwd();
const E = [];
const x = (r) => { try { return fs.existsSync(path.join(R, r)); } catch { return false; } };
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const h = (s, n, m) => { if (!s.includes(n)) E.push(m); };

const ENG = 'src/runtime/scan/field/FieldIntelligenceEngine.ts';
const TEST = 'src/runtime/scan/field/__tests__/FieldIntelligence.test.ts';
for (const f of [ENG, TEST]) if (!x(f)) E.push('missing: ' + f);
const eng = rd(ENG);

h(eng, 'export function estimateFieldIntelligence', 'must export estimateFieldIntelligence');
h(eng, '__fieldIntelligenceHealth', 'must pin the health global');
// Calendar fields present.
for (const f of ['plantAge', 'maturityDate', 'growthVelocity', 'harvestWindow'])
  h(eng, f + ':', 'must produce calendar field: ' + f);
// CV fields routed through unavailable() (never a fabricated value).
for (const f of ['fruitCount', 'flowerCount', 'canopyCoverage', 'plantDensity', 'rowSpacing', 'estimatedBiomass', 'fieldCoverage'])
  h(eng, f + ':', 'must produce CV field: ' + f);
h(eng, 'function unavailable', 'must have the honest unavailable() helper for CV fields');
// No fabricated CV literal (e.g. fruitCount: 47).
if (/(fruitCount|flowerCount|canopyCoverage|plantDensity|estimatedYield|estimatedBiomass)\s*:\s*est\([^,]*\b\d{1,4}\b/.test(eng))
  E.push('CV field must not be given a fabricated numeric value');
// It composes the real lifecycle calendar (not an invented one).
h(eng, 'computeLifecycleSnapshot', 'calendar estimates must compose computeLifecycleSnapshot');

// 3 reports.
for (const doc of ['FIELD_INTELLIGENCE_REPORT.md', 'FARM_MEMORY_REPORT.md', 'SCAN_V11_REPORT.md'])
  if (!x(doc)) E.push('missing report: ' + doc);

if (E.length === 0) {
  try {
    const out = execSync('npx tsx ' + TEST, { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/PASS/.test(out)) E.push('field-intelligence test did not PASS: ' + out.trim());
  } catch (err) { E.push('field-intelligence test failed: ' + ((err && (err.stdout || err.message)) || '?')); }
}

if (E.length) {
  console.error('[check:field-intelligence-v11] FAIL — ' + E.length + ' issue(s):');
  for (const e of E) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:field-intelligence-v11] PASS — calendar fields estimate from planting date; CV fields '
  + 'always unavailable (never fabricated); composes the real crop calendar; test green.');
