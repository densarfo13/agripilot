/**
 * check-nutrient-guidance.mjs — nutrient-deficiency guidance surfacing (SAFE).
 * Locks: the engine composes the nutrient KB through the knowledge layer, NEVER
 * surfaces a synthetic fertiliser/dose (allowlist correction + deny-synthetic), defers
 * fertiliser to an officer, returns guidance only on a confident match, and is wired
 * into the result card (self-hiding on no match). Runs the test.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const R = process.cwd();
const E = [];
const x = (r) => { try { return fs.existsSync(path.join(R, r)); } catch { return false; } };
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const h = (s, n, m) => { if (!s.includes(n)) E.push(m); };

const SVC = 'src/knowledge/nutrients/NutrientKnowledgeService.ts';
const ENG = 'src/runtime/scan/treatment/NutrientDeficiencyEngine.ts';
const TEST = 'src/runtime/scan/treatment/__tests__/NutrientDeficiency.test.ts';
for (const f of [SVC, ENG, TEST]) if (!x(f)) E.push('missing: ' + f);
const eng = rd(ENG);

h(eng, 'export function nutrientGuidanceForIssue', 'must export nutrientGuidanceForIssue');
h(eng, 'knowledge/nutrients/NutrientKnowledgeService', 'must access the nutrient DB through the knowledge layer (not src/data directly)');
h(eng, '__nutrientGuidanceHealth', 'must pin the health global');
h(eng, '_confident', 'must gate the guidance on scan confidence');
// SAFETY: the synthetic-fertiliser allowlist/denylist discipline must be present.
h(eng, 'SYNTHETIC', 'must define a synthetic-fertiliser denylist');
h(eng, 'SAFE_AMENDMENT', 'must define a farmer-safe amendment allowlist');
h(eng, 'fertiliserDeferred', 'must defer synthetic fertiliser to an officer (never prescribe)');
// The correction list must be built from the allowlist (organicOnly), never raw treatment.
if (!/_organicOnly\s*\(/.test(eng)) E.push('correction steps must pass through the _organicOnly allowlist filter');

// Wired into the farmer result card, self-hiding on no match.
const card = rd('src/components/scan/ScanResultCard.jsx');
h(card, 'nutrientGuidanceForIssue', 'ScanResultCard must consume nutrientGuidanceForIssue');
h(card, 'data-testid="scan-nutrient"', 'ScanResultCard must render the nutrient block');
if (!/!_nx\.matched\) return null/.test(card)) E.push('nutrient block must self-hide when there is no confident match');

// Run the engine test (includes the whole-DB no-synthetic-leak proof).
if (E.length === 0) {
  try {
    const out = execSync('npx tsx ' + TEST, { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/PASS/.test(out)) E.push('nutrient-deficiency test did not PASS: ' + out.trim());
  } catch (err) { E.push('nutrient-deficiency test failed: ' + ((err && (err.stdout || err.message)) || '?')); }
}

if (E.length) {
  console.error('[check:nutrient-guidance] FAIL — ' + E.length + ' issue(s):');
  for (const e of E) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:nutrient-guidance] PASS — safe organic amendment guidance surfaced on a confident match; '
  + 'no synthetic fertiliser/dose ever leaks; fertiliser deferred to an officer; composes the nutrient knowledge layer; test green.');
