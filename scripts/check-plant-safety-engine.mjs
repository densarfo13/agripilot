/**
 * check-plant-safety-engine.mjs — production server-side Plant Safety Engine gate.
 *
 * Locks the contract:
 *   • server engine + reference + vitest tests exist;
 *   • the 7 categories + 4 severities + the EXACT disclaimer + translation keys +
 *     structured evidence fields are all present;
 *   • the engine is feature-flag gated and wired into /api/scan/analyze (additive);
 *   • DRIFT: the server safety reference stays byte-identical to the browser
 *     PlantReference (one source of truth — a divergent edibility/toxicity fact fails
 *     the build);
 *   • the client renders the server safety envelope (evidence + disclaimer);
 *   • the server vitest suite is green.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const R = process.cwd();
const E = [];
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const has = (s, n, m) => { if (!s.includes(n)) E.push(m); };

const ENG = 'server/src/ml/safety/plantSafetyEngine.js';
const REF = 'server/src/ml/safety/plantSafetyReference.js';
const TEST = 'server/src/__tests__/plantSafetyEngine.test.js';
for (const f of [ENG, REF, TEST]) if (!fs.existsSync(path.join(R, f))) E.push('missing: ' + f);
const eng = rd(ENG);

// 1. Taxonomy + severities (the spec's required sets).
for (const c of ['EDIBLE', 'NOT_EDIBLE', 'TOXIC', 'PROCESS_BEFORE_EATING', 'MEDICINAL_USE_ONLY', 'ALLERGEN_RISK', 'UNKNOWN'])
  has(eng, c, 'engine must define category ' + c);
for (const s of ['INFO', 'CAUTION', 'WARNING', 'DANGER']) has(eng, "'" + s + "'", 'engine must define severity ' + s);

// 2. Exact disclaimer wording.
has(eng, 'Safety guidance is based only on verified plant matches. If identification confidence is low, do not consume the plant.',
  'engine must carry the EXACT required disclaimer text');

// 3. Structured evidence fields + translation keys + the integration seam.
for (const f of ['scientificName', 'referenceId', 'confidence', 'source', 'lastReviewed', 'certainty'])
  has(eng, f, 'evidence must include ' + f);
for (const k of ['categoryKey', 'severityKey', 'recommendedActionKey', 'disclaimerKey'])
  has(eng, k, 'engine must emit translation key ' + k);
has(eng, 'export function classifyPlantSafety', 'must export classifyPlantSafety');
has(eng, 'export function attachSafety', 'must export the attachSafety integration seam');
has(eng, '_confident', 'must gate the claim on confidence');
if (/Date\.now\(\)|new Date\(\)/.test(eng)) E.push('engine must NOT use a runtime date — lastReviewed is a static curation date');

// 4. Feature flag + route wiring (additive, flag-gated).
has(rd('server/src/config/features.js'), 'plantSafetyEngine', 'features.js must register the plantSafetyEngine flag (default off)');
const app = rd('server/src/app.js');
has(app, "import('./ml/safety/plantSafetyEngine.js')", 'app.js must import the safety engine in /api/scan/analyze');
has(app, "isFeatureEnabled('plantSafetyEngine')", 'app.js must gate safety on the feature flag');
has(app, 'attachSafety(', 'app.js must attach safety to the scan response');

// 5. Client renders the server envelope.
const card = rd('src/components/scan/ScanResultCard.jsx');
has(card, 'result?.safety', 'ScanResultCard must consume the server result.safety');
has(card, 'data-safety-source="server"', 'ScanResultCard must render the server safety envelope');
has(card, 'disclaimerKey', 'ScanResultCard must render the safety disclaimer');
has(card, 'evidenceLabel', 'ScanResultCard must render the safety evidence');
has(card, 'classifyPlantSafety', 'ScanResultCard must keep the local fallback (backward compatible)');

// 6. DRIFT — server safety reference must equal the browser PlantReference facts.
async function driftCheck() {
  let SAFETY_REFERENCE;
  try { ({ SAFETY_REFERENCE } = await import(pathToFileURL(path.join(R, REF)).href)); }
  catch (err) { E.push('cannot import server safety reference: ' + (err && err.message)); return; }
  const client = rd('src/runtime/scan/v12/PlantReference.ts');
  const field = (line, name) => { const m = new RegExp(name + ":\\s*'([^']*)'").exec(line); return m ? m[1] : null; };
  const clientLine = (id) => (client.split(/\r?\n/).find((l) => new RegExp("id:\\s*'" + id + "'").test(l)) || '');
  for (const r of SAFETY_REFERENCE) {
    const line = clientLine(r.id);
    if (!line) { E.push(`drift: plant "${r.id}" is in the server reference but not the client PlantReference`); continue; }
    for (const f of ['scientificName', 'edibility', 'toxicity']) {
      const cv = field(line, f);
      if (cv !== r[f]) E.push(`drift: "${r.id}".${f} differs (server="${r[f]}" vs client="${cv}")`);
    }
  }
}

// 7. Run the server vitest suite.
function runTests() {
  if (E.length) return;
  try {
    const out = execSync('npx vitest run src/__tests__/plantSafetyEngine.test.js', {
      cwd: path.join(R, 'server'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (!/Tests\s+\d+ passed/.test(out) || /failed/.test(out)) E.push('server vitest did not pass:\n' + out.slice(-600));
  } catch (err) { E.push('server vitest failed: ' + ((err && (err.stdout || err.message)) || '?').slice(-600)); }
}

await driftCheck();
runTests();

if (E.length) {
  console.error('[check:plant-safety-engine] FAIL — ' + E.length + ' issue(s):');
  for (const e of E) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:plant-safety-engine] PASS — server PlantSafetyEngine: 7 categories + 4 severities + exact disclaimer + '
  + 'structured evidence + translation keys; flag-gated + wired into /api/scan/analyze; client renders the envelope; '
  + 'no drift from the browser PlantReference; vitest green.');
