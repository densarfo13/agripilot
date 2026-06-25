/**
 * check-universal-scanner.mjs — UNIVERSAL SCANNER governance gate.
 *
 * Locks the one-button scan: the agricultural object classifier covers all 10
 * classes, routes each, fires the <70% safety line, and the specialized engines
 * never fabricate a measured score. Also RUNS the routing acceptance test.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const R = process.cwd();
const E = [];
const x = (r) => { try { return fs.existsSync(path.join(R, r)); } catch { return false; } };
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const h = (s, n, m) => { if (!s.includes(n)) E.push(m); };

const CLS = 'src/runtime/scan/AgriculturalObjectClassifier.ts';
const ENG = 'src/runtime/scan/universal/ScanSpecializedEngines.ts';
const TEST = 'src/runtime/scan/universal/__tests__/AgriClassifier.test.ts';
for (const f of [CLS, ENG, TEST]) if (!x(f)) E.push('missing: ' + f);

// Classifier covers all 10 classes + the routing map + one-button + health.
const c = rd(CLS);
h(c, 'export function classifyAgriculturalObject', 'must export classifyAgriculturalObject');
for (const t of ['leaf', 'wholePlant', 'fruit', 'vegetable', 'flower', 'tree', 'seedling', 'insect', 'soil', 'unknown'])
  h(c, "'" + t + "'", 'classifier must support object type: ' + t);
h(c, 'AGRI_ROUTING', 'classifier must define the routing map (Phase 2)');
h(c, 'objectType', 'classification must return objectType');
h(c, 'routingDecision', 'classification must return routingDecision');
h(c, 'oneButtonScan: true', 'must attest one-button scan (no pre-selection)');
h(c, '__agriClassifierHealth', 'must pin window.__agriClassifierHealth');
// Phase 7 — the exact safety line.
h(c, "We're not confident enough.", 'must carry the <70% safety line');
h(c, 'AGRI_CONFIDENCE_MIN = 70', 'confidence floor must be 70');

// Specialized engines exist + never fabricate (assessed:false ⇒ value:null pattern).
const e = rd(ENG);
for (const fn of ['fruitEngine', 'flowerEngine', 'leafEngine', 'insectEngine'])
  h(e, 'export function ' + fn, 'must export ' + fn);
h(e, 'assessed', 'engine findings must mark assessed vs guidance (no fabricated scores)');
if (/value:\s*['"]\d+%/.test(e)) E.push('engine must not emit a fabricated percentage score');

// Run the routing acceptance test (real logic, not just strings).
if (E.length === 0) {
  try {
    const out = execSync('npx tsx ' + TEST, { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/PASS/.test(out)) E.push('acceptance test did not PASS: ' + out.trim());
  } catch (err) {
    E.push('acceptance test failed: ' + ((err && (err.stdout || err.message)) || 'unknown'));
  }
}

if (E.length) {
  console.error('[check:universal-scanner] FAIL — ' + E.length + ' issue(s):');
  for (const e2 of E) console.error('  - ' + e2);
  process.exit(1);
}
console.log('[check:universal-scanner] PASS — one-button classifier covers 10 classes + routing; '
  + '<70% safety line; specialized engines never fabricate; acceptance test green.');
