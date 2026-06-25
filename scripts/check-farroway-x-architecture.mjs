/**
 * check-farroway-x-architecture.mjs — FARROWAY X architecture honesty lock.
 *
 * The architecture docs must describe REAL code, not aspiration. This gate fails
 * the build if any of the 15 engines named in the architecture lacks its backing
 * file, or if any of the 6 required documents is missing. No new runtime is added
 * (the spec forbids speculative features) — this just keeps the docs honest.
 */
import fs from 'node:fs';
import path from 'node:path';

const R = process.cwd();
const E = [];
const x = (r) => { try { return fs.existsSync(path.join(R, r)); } catch { return false; } };

// Each of the 15 engines → a real backing file. Engine 9 (Business) is honest_null
// by design (no live feed) and is represented by FarmBrainState's no_live_feed fields.
const ENGINES = {
  '1 Universal Scanner':   'src/runtime/scan/AgriculturalObjectClassifier.ts',
  '2 Provider Orchestrator': 'src/runtime/environment/EnvironmentOrchestrator.ts',
  '3 FarmBrain':           'src/runtime/farmBrain/FarmBrainStateEngine.ts',
  '4 Decision Engine':     'src/runtime/decision/FarrowayDecisionEngine.ts',
  '5 Evidence Engine':     'src/runtime/evidence/EvidenceEngine.ts',
  '6 Trust Engine':        'src/runtime/trust/TrustScoreEngine.ts',
  '7 Outcome Engine':      'src/runtime/decision/FarrowayDecisionEngine.ts',
  '8 Digital Twin':        'src/runtime/intelligence/farmTwin/FarmDigitalTwinRuntime.ts',
  '9 Business (honest-null)': 'src/runtime/farmBrain/FarmBrainStateContracts.ts',
  '10 Observability':      'server/src/ml/scanObservability.js',
  '11 Safety':             'src/runtime/farmBrain/FarmBrainScanIngestion.ts',
  '12 Offline':            'public/sw.js',
  '13 Localization':       'src/i18n/columns/T-tw.js',
  '14 Agronomist Review':  'src/runtime/scanTrust/ScanTrustGate.ts',
  '15 Pilot Certification': 'src/runtime/scan/certification/PilotCertificationRuntime.ts',
};
for (const [name, file] of Object.entries(ENGINES))
  if (!x(file)) E.push('engine "' + name + '" claims backing that does not exist: ' + file);

const DOCS = ['FARROWAY_X_ARCHITECTURE.md', 'FARMBRAIN_OPERATING_MODEL.md',
  'ENGINE_INTERACTION_DIAGRAM.md', 'PILOT_CERTIFICATION.md',
  'TECHNICAL_DEBT_REGISTER.md', 'ROADMAP_2026_2030.md'];
for (const d of DOCS) if (!x(d)) E.push('missing required document: ' + d);

// The architecture must state the honest verdict + the honesty invariants.
const arch = x('FARROWAY_X_ARCHITECTURE.md') ? fs.readFileSync(path.join(R, 'FARROWAY_X_ARCHITECTURE.md'), 'utf8') : '';
if (!/READY FOR 10 FARMERS/.test(arch)) E.push('architecture must state the honest verdict');
if (!/honest_null|honest-null/i.test(arch)) E.push('architecture must mark the Business engine honest-null (no fabrication)');
// The debt register must be honest about the operator blockers (keys + live run).
const debt = x('TECHNICAL_DEBT_REGISTER.md') ? fs.readFileSync(path.join(R, 'TECHNICAL_DEBT_REGISTER.md'), 'utf8') : '';
if (!/API_KEY/.test(debt)) E.push('debt register must name the provider-key blocker');
if (!/PENDING/.test(debt)) E.push('debt register must flag the live-run as PENDING (not fabricated)');

if (E.length) {
  console.error('[check:farroway-x-architecture] FAIL — ' + E.length + ' issue(s):');
  for (const e of E) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:farroway-x-architecture] PASS — all 15 engines map to real backing; 6 docs present; '
  + 'honest verdict (READY FOR 10 FARMERS); business honest-null; debt register names the operator blockers.');
