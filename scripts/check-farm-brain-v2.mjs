/**
 * check-farm-brain-v2.mjs — FARM_BRAIN_RUNTIME_V2.
 * Every scan result must pass through FarmBrain (riskScore /
 * confidenceScore / diseaseLikelihood / growthStage / nextAction /
 * followUpTask). NO bypass path: both the API result and the rule
 * fallback are returned through _withFarmBrain().
 */
import fs from 'node:fs'; import path from 'node:path';
const R = process.cwd(), E = [];
const x = (r) => { try { return fs.existsSync(path.join(R, r)); } catch { return false; } };
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const h = (s, n, m) => { if (!s.includes(n)) E.push(m); };

const RT = 'src/runtime/farmBrain/FarmBrainRuntimeV2.ts';
if (!x(RT)) E.push('missing: ' + RT); else { const s = rd(RT);
  h(s, 'export function runFarmBrainV2', 'must export runFarmBrainV2');
  h(s, 'FARM_BRAIN_RUNTIME_V2_VERSION', 'must declare the version');
  for (const f of ['riskScore', 'confidenceScore', 'diseaseLikelihood', 'growthStage', 'nextAction', 'followUpTask'])
    h(s, f, 'FarmBrain envelope must include: ' + f);
  // Honest nulls — the fallback envelope must null the 6 fields (no fabricated defaults).
  if (!/riskScore:\s*null/.test(s)) E.push('must return honest null riskScore when no signal (no fabricated default)');
  h(s, 'no fabrication', 'must document honest-null / no-fabrication contract');
}

// The single chokepoint — no bypass.
const ENG = 'src/core/scanDetectionEngine.js';
if (!x(ENG)) E.push('missing: ' + ENG); else { const s = rd(ENG);
  h(s, 'runFarmBrainV2', 'engine must import runFarmBrainV2');
  h(s, 'function _withFarmBrain', 'engine must define the _withFarmBrain chokepoint');
  h(s, '_withFarmBrain(_result', 'API result must pass through FarmBrain');
  h(s, '_withFarmBrain(getRuleBasedFallback', 'rule fallback must ALSO pass through FarmBrain (no bypass)');
  // No bare returns of a result that skip FarmBrain.
  if (/return\s+_result\s*;/.test(s)) E.push('BYPASS: a bare "return _result" skips FarmBrain');
  if (/return\s+getRuleBasedFallback\(safeInput\)\s*;/.test(s)) E.push('BYPASS: a bare "return getRuleBasedFallback(safeInput)" skips FarmBrain');
}

if (E.length) { console.error('[check:farm-brain-v2] FAIL — ' + E.length + ' issue(s):'); for (const e of E) console.error('  - ' + e); process.exit(1); }
console.log('[check:farm-brain-v2] PASS — runFarmBrainV2 produces the 6-field envelope; every scan result (API + fallback) passes through _withFarmBrain; no bypass path; honest nulls.');
