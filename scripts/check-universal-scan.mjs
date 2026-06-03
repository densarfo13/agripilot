/**
 * check-universal-scan.mjs — locks the Universal Crop Scan
 * contract (sprint #178 / spec §12). Fails build when:
 *
 *   1. UniversalScanClassifier missing OR doesn't export
 *      classifyObjectType / classifyIssue / 11 object types /
 *      18 issue labels.
 *   2. UniversalScanHealthRuntime missing OR doesn't pin
 *      window.__universalScanHealth() with the 15 spec §11 flags.
 *   3. server/src/ml/issueAnalysisEngine.js missing OR doesn't
 *      export classifyObjectType / classifyIssue / safeNextAction
 *      / analyzeUniversalScan OR the 18-label issue catalog is
 *      incomplete OR a banned pesticide name appears in the
 *      safe-action map.
 *   4. scanRecoveryEnvelope.js NOT bumped to v6 OR doesn't carry
 *      `objectType:` + `issueType:` envelope fields.
 *   5. server/src/app.js does NOT mirror objectType + issueType
 *      at the response root.
 *   6. IntelligentScanResult.jsx missing Type-chip testid
 *      (scan-intel-type-chip) OR missing Save-plant testid
 *      (scan-intel-save-plant) OR doesn't read objectType / issueType.
 *   7. App.jsx does NOT call installUniversalScanHealthGlobal in
 *      boot.
 *   8. UI bakes in literal "Plant: —" / "Unknown Plant" dead-ends
 *      (defends against regression).
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

// ─── 1. UniversalScanClassifier ───────────────────────────────
const CLASSIFIER = 'src/runtime/universalScan/UniversalScanClassifier.ts';
if (!_exists(CLASSIFIER)) {
  errors.push('missing: ' + CLASSIFIER
    + ' (sibling namespace — wave-36 forbids src/runtime/scan/)');
} else {
  const src = _read(CLASSIFIER);
  _has(src, 'export function classifyObjectType',
    'UniversalScanClassifier must export classifyObjectType');
  _has(src, 'export function classifyIssue',
    'UniversalScanClassifier must export classifyIssue');
  _has(src, 'export function safeNextAction',
    'UniversalScanClassifier must export safeNextAction');
  // 11 object types (spec §1).
  const TYPES = [
    'fruit', 'vegetable', 'leaf', 'crop', 'flower',
    'herb', 'tree', 'weed', 'soil_surface', 'seedling', 'unknown',
  ];
  for (const t of TYPES) {
    if (!src.includes("'" + t + "'")) {
      errors.push('UniversalScanClassifier missing object type: ' + t);
    }
  }
  // 18 issue labels (spec §5).
  const ISSUES = [
    'leaf_spot', 'blight', 'rust', 'mildew', 'mosaic', 'rot', 'wilt',
    'holes', 'chewing', 'leaf_miners', 'mites', 'aphids',
    'whiteflies', 'thrips', 'armyworm',
    'yellowing', 'curling', 'sun_scorch',
  ];
  for (const i of ISSUES) {
    if (!src.includes("'" + i + "'")) {
      errors.push('UniversalScanClassifier missing issue label: ' + i);
    }
  }
}

// ─── 2. UniversalScanHealthRuntime ────────────────────────────
const RUNTIME = 'src/runtime/universalScan/UniversalScanHealthRuntime.ts';
if (!_exists(RUNTIME)) {
  errors.push('missing: ' + RUNTIME);
} else {
  const src = _read(RUNTIME);
  _has(src, 'export function installUniversalScanHealthGlobal',
    'UniversalScanHealthRuntime must export installUniversalScanHealthGlobal');
  _has(src, '__universalScanHealth',
    'UniversalScanHealthRuntime must pin window.__universalScanHealth');
  // 15 spec §11 flags.
  const FLAGS = [
    'detectsFruit', 'detectsVegetables', 'detectsLeaves',
    'detectsCrops', 'detectsFlowers',
    'plantIdConnected', 'plantNetConnected', 'insectIdConnectedOrOptional',
    'imageQualityReady', 'issueAnalysisReady', 'topCandidatesReady',
    'taskReady', 'followUpReady', 'noPlantDash', 'noUnknownDeadEnds',
  ];
  for (const f of FLAGS) {
    if (!src.includes(f + ':')
        && !src.includes(f + ',')) {
      errors.push('UniversalScanHealthRuntime missing spec §11 flag: ' + f);
    }
  }
  // Spec §1 NEVER-DOs as literal-true constants.
  _has(src, 'neverShowsPlantDash',
    'UniversalScanHealthRuntime must pin neverShowsPlantDash');
  _has(src, 'neverShows100PctCertainty',
    'UniversalScanHealthRuntime must pin neverShows100PctCertainty');
  _has(src, 'neverNamesPesticideDose',
    'UniversalScanHealthRuntime must pin neverNamesPesticideDose');
}

// ─── 3. Server-side issueAnalysisEngine ──────────────────────
const ENGINE = 'server/src/ml/issueAnalysisEngine.js';
if (!_exists(ENGINE)) {
  errors.push('missing: ' + ENGINE);
} else {
  const src = _read(ENGINE);
  _has(src, 'export function classifyObjectType',
    'issueAnalysisEngine must export classifyObjectType');
  _has(src, 'export function classifyIssue',
    'issueAnalysisEngine must export classifyIssue');
  _has(src, 'export function safeNextAction',
    'issueAnalysisEngine must export safeNextAction');
  _has(src, 'export function analyzeUniversalScan',
    'issueAnalysisEngine must export analyzeUniversalScan');
  // Same 18 issue labels.
  const ISSUES = [
    'leaf_spot', 'blight', 'rust', 'mildew', 'mosaic', 'rot', 'wilt',
    'holes', 'chewing', 'leaf_miners', 'mites', 'aphids',
    'whiteflies', 'thrips', 'armyworm',
    'yellowing', 'curling', 'sun_scorch',
  ];
  for (const i of ISSUES) {
    if (!src.includes("'" + i + "'")) {
      errors.push('issueAnalysisEngine missing issue label: ' + i);
    }
  }
  // Safety rule (spec §6): no specific pesticide name / dosage in
  // the safe-action map. Block these grower-facing strings.
  const BANNED = [
    'mg/L', 'kg/ha', 'g/L', '/litre', 'glyphosate',
    'malathion', 'imidacloprid', 'cypermethrin', 'paraquat',
  ];
  for (const w of BANNED) {
    // The pattern must appear inside the safe-action *values*; allow
    // mentions in JSDoc / comments by stripping comment lines first.
    const stripped = src.split('\n').filter((l) => {
      const t = l.trim();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    }).join('\n');
    if (stripped.includes(w)) {
      errors.push('issueAnalysisEngine safe-action map contains banned chemical reference: ' + w);
    }
  }
}

// ─── 4. scanRecoveryEnvelope v6 + new fields ─────────────────
const ENVELOPE = 'server/src/ml/scanRecoveryEnvelope.js';
if (!_exists(ENVELOPE)) {
  errors.push('missing: ' + ENVELOPE);
} else {
  const src = _read(ENVELOPE);
  _has(src, 'scan-recovery-envelope-v6',
    'scanRecoveryEnvelope must bump runtimeVersion to v6');
  _has(src, 'objectType:',
    'scanRecoveryEnvelope must emit objectType field');
  _has(src, 'issueType:',
    'scanRecoveryEnvelope must emit issueType field');
}

// ─── 5. app.js mirrors objectType + issueType on response root
const APP = 'server/src/app.js';
if (!_exists(APP)) {
  errors.push('missing: ' + APP);
} else {
  const src = _read(APP);
  if (!/objectType\s*:\s*scanRecovery\.objectType/.test(src)) {
    errors.push('app.js must mirror objectType: scanRecovery.objectType');
  }
  if (!/issueType\s*:\s*scanRecovery\.issueType/.test(src)) {
    errors.push('app.js must mirror issueType: scanRecovery.issueType');
  }
}

// ─── 6. IntelligentScanResult — Type chip + Save plant ───────
const RESULT = 'src/components/scan/IntelligentScanResult.jsx';
if (!_exists(RESULT)) {
  errors.push('missing: ' + RESULT);
} else {
  const src = _read(RESULT);
  _has(src, 'data-testid="scan-intel-type-chip"',
    'IntelligentScanResult must render Type chip (scan-intel-type-chip)');
  _has(src, 'data-testid="scan-intel-save-plant"',
    'IntelligentScanResult must expose Save plant button (scan-intel-save-plant)');
  _has(src, 'objectType',
    'IntelligentScanResult must read objectType from envelope');
  _has(src, 'issueType',
    'IntelligentScanResult must read issueType from envelope');
  // Defends against regression — never bake in dead-end strings.
  // Strip comments first to avoid false-flagging the documentation.
  let stripped = src.replace(new RegExp('/\\*[\\s\\S]*?\\*/', 'g'), '');
  stripped = stripped.replace(
    new RegExp('\\{/\\*[\\s\\S]*?\\*/\\}', 'g'), '');
  stripped = stripped.replace(new RegExp('//[^\\n]*', 'g'), '');
  if (/['"]Plant:\s*—['"]/i.test(stripped)) {
    errors.push('IntelligentScanResult must NOT bake in literal "Plant: —"');
  }
}

// ─── 7b. Repo-wide scan UI: forbid Plant: — and Unknown Plant
// dead-end fallbacks anywhere under src/components/scan/ or
// src/pages/scan*. Spec §12 build-fails rule. Sprint #179 root
// cause was ScanCommandCard.jsx baking `plantName || '—'` — the
// IntelligentScanResult-only gate let that regression ship to
// production.
const SCAN_UI_FILES = [
  'src/components/scan/ScanCommandCard.jsx',
  'src/components/scan/ScanResult.jsx',
  'src/components/scan/IntelligentScanResult.jsx',
  'src/components/scan/NeedsReviewActions.jsx',
  'src/pages/ScanPage.jsx',
  'src/pages/ScanResultPage.jsx',
];
for (const rel of SCAN_UI_FILES) {
  if (!_exists(rel)) continue; // ok — file may not exist in this repo
  const src = _read(rel);
  // Strip comments so JSDoc/inline rationale doesn't false-flag.
  let stripped = src.replace(new RegExp('/\\*[\\s\\S]*?\\*/', 'g'), '');
  stripped = stripped.replace(
    new RegExp('\\{/\\*[\\s\\S]*?\\*/\\}', 'g'), '');
  stripped = stripped.replace(new RegExp('//[^\\n]*', 'g'), '');
  // Forbid `plantName || '—'` / `plantName || "—"` (em-dash fallback).
  if (/plantName\s*\|\|\s*['"]—['"]/.test(stripped)
      || /commonName\s*\|\|\s*['"]—['"]/.test(stripped)) {
    errors.push(rel + ' must NOT use `plantName || "—"` — render '
      + 'a real fallback ("Needs confirmation" / "Scan unclear")');
  }
  // Forbid `plantName || "Unknown Plant"`.
  if (/plantName\s*\|\|\s*['"]Unknown Plant['"]/i.test(stripped)
      || /commonName\s*\|\|\s*['"]Unknown Plant['"]/i.test(stripped)) {
    errors.push(rel + ' must NOT use `plantName || "Unknown Plant"` — '
      + 'use "Needs confirmation" / "Scan unclear" placeholders');
  }
  // Forbid literal "Plant: —" / "Plant : —" in any JSX text.
  if (/['"]Plant:\s*—['"]/i.test(stripped)
      || /['"]Plant\s+:\s*—['"]/i.test(stripped)) {
    errors.push(rel + ' must NOT contain literal "Plant: —" string');
  }
}

// ─── 8. App.jsx wires install ────────────────────────────────
const APP_JSX = 'src/App.jsx';
if (!_exists(APP_JSX)) {
  errors.push('missing: ' + APP_JSX);
} else {
  const src = _read(APP_JSX);
  _has(src, 'installUniversalScanHealthGlobal',
    'App.jsx must call installUniversalScanHealthGlobal in boot');
  _has(src, "import('./runtime/universalScan/UniversalScanHealthRuntime')",
    'App.jsx must lazy-import UniversalScanHealthRuntime');
}

if (errors.length) {
  console.error('[check:universal-scan] FAIL — ' + errors.length + ' violation(s):');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}

console.log('[check:universal-scan] PASS — universal object-type detection (11 categories), 18-label issue taxonomy, safe non-chemical actions, envelope v6, top-level mirrors, type chip + save plant + 15 health flags wired.');
