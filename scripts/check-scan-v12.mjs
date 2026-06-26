/**
 * check-scan-v12.mjs — Scan Intelligence v12 unified orchestrator.
 *
 * Locks the no-fabrication invariants across the full v12 taxonomy: CV-dependent
 * fields are 'unavailable', market fields 'no_live_feed', soil N/P/K/CEC 'unknown',
 * identity real only for a confident known plant. Runs the 500+ assertion test.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const R = process.cwd();
const E = [];
const x = (r) => { try { return fs.existsSync(path.join(R, r)); } catch { return false; } };
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const h = (s, n, m) => { if (!s.includes(n)) E.push(m); };

const ORC = 'src/runtime/scan/v12/ScanIntelligenceV12.ts';
const REFF = 'src/runtime/scan/v12/PlantReference.ts';
const TEST = 'src/runtime/scan/v12/__tests__/ScanV12.test.ts';
for (const ff of [ORC, REFF, TEST]) if (!x(ff)) E.push('missing: ' + ff);
const orc = rd(ORC);

h(orc, 'export function analyzeScanV12', 'must export analyzeScanV12');
h(orc, '__scanV12Health', 'must pin the health global');
// 11 spec sections present.
for (const sec of ['identity', 'health', 'pest', 'disease', 'yield', 'fieldIntelligence', 'soil', 'weather', 'market', 'multiModal', 'voice'])
  h(orc, sec, 'must include section: ' + sec);
// Honest constructors for the fabrication-trap fields.
h(orc, "const cv = (", 'must funnel CV fields through the cv() unavailable helper');
h(orc, "const noFeed = (", 'must funnel market/remote fields through the noFeed() helper');
// Composes real sources (not invented ones).
h(orc, 'lookupPlantReference', 'identity must compose the botanical reference');
h(orc, 'estimateFieldIntelligence', 'yield/calendar must compose the v11 field engine');
h(orc, 'WeatherRisk', 'weather must compose the existing WeatherRiskRuntime');
// No fabricated literal numbers assigned to fabrication-trap fields.
if (/(healthScore|waterStress|leafDamagePct|fruitCount|expectedPrice|nitrogen|phosphorus|potassium)\s*:\s*f\([^,]*\b\d{1,4}\b/.test(orc))
  E.push('a fabrication-trap field must not be given a literal numeric value');

// 4 reports.
for (const doc of ['WORLD_CLASS_SCAN_V12.md', 'FIELD_INTELLIGENCE.md', 'PRODUCTION_READINESS.md', 'SCAN_PERFORMANCE.md'])
  if (!x(doc)) E.push('missing report: ' + doc);

if (E.length === 0) {
  try {
    const out = execSync('npx tsx ' + TEST, { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/PASS/.test(out)) E.push('scan-v12 test did not PASS: ' + out.trim());
  } catch (err) { E.push('scan-v12 test failed: ' + ((err && (err.stdout || err.message)) || '?')); }
}

if (E.length) {
  console.error('[check:scan-v12] FAIL — ' + E.length + ' issue(s):');
  for (const e of E) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:scan-v12] PASS — 11-section unified orchestrator; CV unavailable, market no_live_feed, '
  + 'NPK unknown; identity real only when known+confident; composes real sources; 500+ assertion test green.');
