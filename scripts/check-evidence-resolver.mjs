/**
 * check-evidence-resolver.mjs — evidence resolver + image quality gate.
 *
 * Enforces the spec's build gates: the resolver composes the single tier engine
 * (no duplicate logic), every field returns the full contract with confidence +
 * reason, lab fields are never photo-valued, the farmer label never leaks the enum/
 * provider/API, the FarmBrain ingestion policy blocks LAB/UNKNOWN/UNAVAILABLE/
 * NO_LIVE_FEED, and a low-quality image blocks diagnose/ingest/task. Runs the test.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const R = process.cwd();
const E = [];
const x = (r) => { try { return fs.existsSync(path.join(R, r)); } catch { return false; } };
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const h = (s, n, m) => { if (!s.includes(n)) E.push(m); };

const RES = 'src/runtime/scan/evidence/EvidenceFieldResolver.ts';
const QG = 'src/runtime/scan/quality/ImageQualityGate.ts';
const TEST = 'src/runtime/scan/evidence/__tests__/EvidenceResolver.test.ts';
for (const f of [RES, QG, TEST]) if (!x(f)) E.push('missing: ' + f);

const res = rd(RES);
// Single source of truth — resolver must COMPOSE the tier engine, not re-implement.
h(res, "from './EvidenceTierEngine'", 'resolver must compose EvidenceTierEngine (no duplicate tier logic)');
for (const fn of ['export function resolveField', 'export function farmerLabel', 'export function canFarmBrainIngest'])
  h(res, fn, 'resolver must export: ' + fn);
// Ingestion policy must list the ingestable tiers and exclude the rest.
h(res, 'FARMBRAIN_INGESTABLE_TIERS', 'resolver must define the ingestable-tier allow-list');
if (/FARMBRAIN_INGESTABLE_TIERS[^]*?(LAB_REQUIRED|UNKNOWN|UNAVAILABLE|NO_LIVE_FEED)'/.test(res.slice(res.indexOf('FARMBRAIN_INGESTABLE_TIERS'), res.indexOf('FARMBRAIN_INGESTABLE_TIERS') + 160)))
  E.push('ingestable allow-list must NOT contain a blocked tier');

const qg = rd(QG);
h(qg, 'imageQualityPreflight', 'quality gate should reference the existing preflight (single source)');
h(qg, 'canDiagnose', 'quality gate must gate canDiagnose');
h(qg, 'canIngestFarmBrain', 'quality gate must gate canIngestFarmBrain');
h(qg, 'canCreateTask', 'quality gate must gate canCreateTask');
h(qg, 'not_assessed', 'CV-dependent factors must be not_assessed (never fabricated)');

// Farmer UI must NOT leak the tier enum / provider / API jargon as visible text.
const JARGON = /(DIRECT_MEASURED|MODEL_ESTIMATED|FUSED_ESTIMATE|LIVE_PROVIDER|NO_LIVE_FEED|evidenceTier|plant\.id|crop\.health|provider API)/;
let scanned = 0;
const compDir = path.join(R, 'src/components/scan');
const walk = (d) => { let out = []; let ents = []; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return out; } for (const e of ents) { const p = path.join(d, e.name); if (e.isDirectory()) out = out.concat(walk(p)); else if (/\.(jsx|tsx)$/.test(e.name)) out.push(p); } return out; };
for (const file of walk(compDir)) {
  scanned++;
  const c = fs.readFileSync(file, 'utf8');
  if (JARGON.test(c)) E.push('farmer scan UI leaks evidence-tier/provider/API jargon: ' + path.relative(R, file));
}

// 4 reports (2 new + 2 reused from the prior evidence-tier sprint).
for (const doc of ['EVIDENCE_ENGINE_REPORT.md', 'IMAGE_QUALITY_GATE_REPORT.md', 'SCAN_STATUS_MATRIX.md', 'CV_ESTIMATION_RULES.md'])
  if (!x(doc)) E.push('missing report: ' + doc);

if (E.length === 0) {
  try {
    const out = execSync('npx tsx ' + TEST, { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/PASS/.test(out)) E.push('resolver test did not PASS: ' + out.trim());
  } catch (err) { E.push('resolver test failed: ' + ((err && (err.stdout || err.message)) || '?')); }
}

if (E.length) {
  console.error('[check:evidence-resolver] FAIL — ' + E.length + ' issue(s):');
  for (const e of E) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:evidence-resolver] PASS — resolver composes the tier engine (no dup); 8-field contract w/ confidence+reason; '
  + 'farmer labels jargon-free (' + scanned + ' scan components clean); ingestion blocks LAB/UNKNOWN/UNAVAILABLE/NO_LIVE_FEED; '
  + 'low photo blocks diagnose/ingest/task; CV factors not fabricated; test green.');
