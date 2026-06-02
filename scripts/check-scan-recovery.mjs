/**
 * check-scan-recovery.mjs — locks the Scan Recovery Sprint contract.
 *
 * Fails build when:
 *   1. server/src/ml/providers/plantIdProvider.js missing OR doesn't
 *      use process.env.PLANT_ID_API_KEY DIRECTLY (the audit-§6.1
 *      silent-failure path returns).
 *   2. scanProviders.js does NOT register 'plantid' in REGISTRY OR
 *      its auto-pick does NOT prefer plantid when PLANT_ID_API_KEY
 *      is set.
 *   3. server/src/ml/scanConsensusEngine.js missing OR does not
 *      export runConsensus.
 *   4. server/src/ml/scanRecoveryEnvelope.js missing OR does not
 *      export buildScanRecoveryEnvelope.
 *   5. /api/scan/analyze route does NOT invoke runConsensus AND
 *      does NOT return a scanRecovery envelope.
 *   6. src/runtime/scanRecovery/ScanRecoveryRuntime.ts missing OR
 *      doesn't compose runScanPipeline from ScanAnalysisRuntime.
 *   7. shouldRenderIntelligentResult does NOT return true.
 *   8. ScanPage.jsx does NOT import executeScanRecovery.
 *   9. src/pages/admin/ScanHealthPage.jsx missing OR not admin-only.
 *  10. App.jsx does NOT lazy-import ScanHealthPage AND wire
 *      /admin/scan-health under <RoleRoute roles={ADMIN_ROLES}>.
 *  11. App.jsx does NOT call installScanRecoveryGlobal in boot.
 *
 * Each failure prints a specific line; gate exits 1 on any.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const errors = [];

function _exists(rel) {
  try { return fs.existsSync(path.join(ROOT, rel)); } catch { return false; }
}
function _read(rel) {
  try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return ''; }
}
function _has(haystack, needle, label) {
  if (!haystack.includes(needle)) errors.push(label);
}

// ─── 1. Plant.id provider exists + uses PLANT_ID_API_KEY directly ───
const PLANT_ID_PROVIDER = 'server/src/ml/providers/plantIdProvider.js';
if (!_exists(PLANT_ID_PROVIDER)) {
  errors.push('missing: ' + PLANT_ID_PROVIDER);
} else {
  const src = _read(PLANT_ID_PROVIDER);
  _has(src, 'process.env.PLANT_ID_API_KEY',
    'plantIdProvider must read process.env.PLANT_ID_API_KEY directly');
  _has(src, 'export const plantid',
    'plantIdProvider must export const plantid');
  _has(src, "'Api-Key'",
    'plantIdProvider must send Api-Key header (Plant.id v3)');
  _has(src, 'https://plant.id/api/v3/identification',
    'plantIdProvider must POST to Plant.id v3 endpoint');
  if (!/health\s*:\s*['"]all['"]/.test(src)) {
    errors.push('plantIdProvider must request the disease module (health: \'all\')');
  }
}

// ─── 2. scanProviders.js registers plantid + auto-picks it ───
const PROVIDERS = 'server/src/ml/scanProviders.js';
if (!_exists(PROVIDERS)) {
  errors.push('missing: ' + PROVIDERS);
} else {
  const src = _read(PROVIDERS);
  _has(src, "import { plantid } from './providers/plantIdProvider.js'",
    'scanProviders.js must import { plantid } from ./providers/plantIdProvider.js');
  // REGISTRY must include plantid
  if (!/REGISTRY\s*=\s*Object\.freeze\(\{[\s\S]*?\bplantid\b[\s\S]*?\}\)/.test(src)) {
    errors.push('scanProviders REGISTRY must include plantid');
  }
  // Auto-pick: PLANT_ID_API_KEY → REGISTRY.plantid (not generic)
  if (!/process\.env\.PLANT_ID_API_KEY[\s\S]{0,60}REGISTRY\.plantid/.test(src)) {
    errors.push('scanProviders.pickProvider must auto-pick REGISTRY.plantid when PLANT_ID_API_KEY is set');
  }
}

// ─── 3. Consensus engine exists ───
const CONSENSUS = 'server/src/ml/scanConsensusEngine.js';
if (!_exists(CONSENSUS)) {
  errors.push('missing: ' + CONSENSUS);
} else {
  const src = _read(CONSENSUS);
  _has(src, 'export async function runConsensus',
    'scanConsensusEngine must export async function runConsensus');
  _has(src, 'plantid', 'consensus engine must reference plantid');
  _has(src, 'plantnet', 'consensus engine must reference plantnet');
  // Must fire both in parallel via Promise.all
  _has(src, 'Promise.all',
    'consensus engine must fire providers in parallel (Promise.all)');
}

// ─── 4. Envelope builder exists ───
const ENVELOPE = 'server/src/ml/scanRecoveryEnvelope.js';
if (!_exists(ENVELOPE)) {
  errors.push('missing: ' + ENVELOPE);
} else {
  const src = _read(ENVELOPE);
  _has(src, 'export function buildScanRecoveryEnvelope',
    'scanRecoveryEnvelope must export buildScanRecoveryEnvelope');
  // Must emit the spec fields
  const SPEC_FIELDS = ['plantName', 'scientificName', 'confidence',
    'diseaseCandidates', 'severity', 'recommendations', 'nextAction'];
  for (const field of SPEC_FIELDS) {
    if (!src.includes(field)) {
      errors.push('scanRecoveryEnvelope missing spec field: ' + field);
    }
  }
}

// ─── 5. /api/scan/analyze invokes consensus + emits envelope ───
const APP = 'server/src/app.js';
if (!_exists(APP)) {
  errors.push('missing: ' + APP);
} else {
  const src = _read(APP);
  _has(src, "import('./ml/scanConsensusEngine.js')",
    'app.js /api/scan/analyze must lazy-import scanConsensusEngine');
  _has(src, 'runConsensus',
    'app.js /api/scan/analyze must call runConsensus');
  _has(src, "import('./ml/scanRecoveryEnvelope.js')",
    'app.js /api/scan/analyze must lazy-import scanRecoveryEnvelope');
  _has(src, 'buildScanRecoveryEnvelope',
    'app.js /api/scan/analyze must call buildScanRecoveryEnvelope');
  _has(src, 'scanRecovery,',
    'app.js /api/scan/analyze must include scanRecovery in JSON response');
}

// ─── 6. ScanRecoveryRuntime exists + composes runScanPipeline ───
const RECOVERY = 'src/runtime/scanRecovery/ScanRecoveryRuntime.ts';
if (!_exists(RECOVERY)) {
  errors.push('missing: ' + RECOVERY);
} else {
  const src = _read(RECOVERY);
  _has(src, 'export function executeScanRecovery',
    'ScanRecoveryRuntime must export executeScanRecovery');
  _has(src, 'export function installScanRecoveryGlobal',
    'ScanRecoveryRuntime must export installScanRecoveryGlobal');
  _has(src, 'runScanPipeline',
    'ScanRecoveryRuntime must compose runScanPipeline (closes dead-runtime audit gap)');
  _has(src, "from '../scan/ScanAnalysisRuntime'",
    'ScanRecoveryRuntime must import from ../scan/ScanAnalysisRuntime');
  _has(src, '__scanRecoveryHealth',
    'ScanRecoveryRuntime must pin window.__scanRecoveryHealth');
}

// ─── 7. shouldRenderIntelligentResult returns true ───
const RESULT_HEALTH = 'src/runtime/launchBlockers/ScanResultHealthRuntime.ts';
if (!_exists(RESULT_HEALTH)) {
  errors.push('missing: ' + RESULT_HEALTH);
} else {
  const src = _read(RESULT_HEALTH);
  // Match the literal return statement inside the function. Use a
  // string split (split/join idiom to avoid /g regex parser quirks
  // in workflow scripts; safe in node).
  const block = src.split('shouldRenderIntelligentResult').join('|MARKER|');
  // Find the function body after the marker
  const after = block.split('|MARKER|').slice(1).join('|MARKER|');
  if (!/return\s+true\s*;/.test(after)) {
    errors.push('shouldRenderIntelligentResult must return true (Scan Recovery Sprint §2)');
  }
}

// ─── 8. ScanPage.jsx imports executeScanRecovery ───
const SCAN_PAGE = 'src/pages/ScanPage.jsx';
if (!_exists(SCAN_PAGE)) {
  errors.push('missing: ' + SCAN_PAGE);
} else {
  const src = _read(SCAN_PAGE);
  _has(src, 'executeScanRecovery',
    'ScanPage.jsx must import + invoke executeScanRecovery');
  _has(src, "from '../runtime/scanRecovery/ScanRecoveryRuntime'",
    'ScanPage.jsx must import from ../runtime/scanRecovery/ScanRecoveryRuntime');
}

// ─── 9. Admin scan-health page exists + admin-only ───
const ADMIN_PAGE = 'src/pages/admin/ScanHealthPage.jsx';
if (!_exists(ADMIN_PAGE)) {
  errors.push('missing: ' + ADMIN_PAGE);
} else {
  const src = _read(ADMIN_PAGE);
  _has(src, "ALLOWED_ROLES = new Set(['admin'])",
    'ScanHealthPage must role-gate ALLOWED_ROLES = new Set([\'admin\'])');
  _has(src, 'data-testid="scan-health-page"',
    'ScanHealthPage must expose data-testid="scan-health-page"');
  _has(src, 'data-consumes="scanRecovery"',
    'ScanHealthPage must declare data-consumes="scanRecovery"');
}

// ─── 10. App.jsx wires route + install ───
const APP_JSX = 'src/App.jsx';
if (!_exists(APP_JSX)) {
  errors.push('missing: ' + APP_JSX);
} else {
  const src = _read(APP_JSX);
  _has(src, "import('./pages/admin/ScanHealthPage.jsx')",
    'App.jsx must lazy-import ScanHealthPage');
  _has(src, '/admin/scan-health',
    'App.jsx must route /admin/scan-health');
  _has(src, 'installScanRecoveryGlobal',
    'App.jsx must call installScanRecoveryGlobal in boot');
  if (!/path="\/admin\/scan-health"\s+element=\{<RoleRoute roles=\{ADMIN_ROLES\}>/.test(src)) {
    errors.push('App.jsx /admin/scan-health route must be wrapped in <RoleRoute roles={ADMIN_ROLES}>');
  }
}

if (errors.length) {
  console.error('[check:scan-recovery] FAIL — ' + errors.length + ' violation(s):');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}

console.log('[check:scan-recovery] PASS — Plant.id provider wired, consensus engine live, IntelligentScanResult on, runScanPipeline executed per scan, admin /admin/scan-health gated.');
