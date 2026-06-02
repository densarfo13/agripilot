/**
 * check-scan-intel-v2-sprint.mjs — locks the Scan Intelligence V2
 * SPRINT contract (insect + Sentinel Hub + auto-persist + Recent
 * Scans + learning loop).
 *
 * Distinct from the older check-scan-intelligence-v2.mjs which
 * locks the wave-29 growth/severity/outcomeComparison/weatherRisk
 * runtime subtree contract.
 *
 * Fails build when:
 *   1. server/src/ml/providers/insectProvider.js missing OR doesn't
 *      use process.env.INSECT_ID_API_KEY directly.
 *   2. server/src/ml/providers/fieldHealthProvider.js missing OR
 *      doesn't read SENTINEL_HUB_CLIENT_ID + SENTINEL_HUB_CLIENT_SECRET
 *      via the existing sentinelHubService.
 *   3. server/src/ml/scanOutcomePersister.js missing OR doesn't
 *      export persistScanOutcome.
 *   4. server/src/ml/scanLearningEngine.js missing OR doesn't
 *      export recordConfirmation + applyLearningBoost.
 *   5. /api/scan/analyze route does NOT lazy-import insectProvider,
 *      fieldHealthProvider, scanOutcomePersister, scanLearningEngine.
 *   6. /api/scan/analyze does NOT invoke runConsensus + detectInsect
 *      + fetchFieldHealth in Promise.all (parallel).
 *   7. /api/scan/history GET endpoint missing.
 *   8. /api/scan/feedback route does NOT branch on `correct`
 *      boolean (V2 learning shape).
 *   9. src/runtime/scanLearning/ScanLearningRuntime.ts missing OR
 *      doesn't export submitConfirmation + fetchScanHistory +
 *      installScanLearningGlobal.
 *  10. src/components/scan/RecentScansCard.jsx missing OR doesn't
 *      call fetchScanHistory.
 *  11. ScanPage.jsx does NOT mount <RecentScansCard /> AND import
 *      submitConfirmation from the learning runtime.
 *  12. App.jsx does NOT call installScanLearningGlobal in boot.
 *  13. ScanRecoveryEnvelope does NOT carry pest + fieldHealth.
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

// ─── 1. Insect provider ───────────────────────────────────────
const INSECT = 'server/src/ml/providers/insectProvider.js';
if (!_exists(INSECT)) {
  errors.push('missing: ' + INSECT);
} else {
  const src = _read(INSECT);
  _has(src, 'process.env.INSECT_ID_API_KEY',
    'insectProvider must read process.env.INSECT_ID_API_KEY directly');
  _has(src, 'export async function detectInsect',
    'insectProvider must export async function detectInsect');
  _has(src, "'Api-Key'",
    'insectProvider must send Api-Key header');
  const CATEGORIES = ['aphid', 'thrip', 'whitefly', 'armyworm',
    'beetle', 'mite', 'leaf_miner'];
  for (const c of CATEGORIES) {
    if (!src.includes("'" + c + "'")) {
      errors.push('insectProvider missing pest category: ' + c);
    }
  }
}

// ─── 2. Field-health provider ─────────────────────────────────
const FIELD = 'server/src/ml/providers/fieldHealthProvider.js';
if (!_exists(FIELD)) {
  errors.push('missing: ' + FIELD);
} else {
  const src = _read(FIELD);
  _has(src, 'export async function fetchFieldHealth',
    'fieldHealthProvider must export fetchFieldHealth');
  _has(src, 'SENTINEL_HUB_CLIENT_ID',
    'fieldHealthProvider must reference SENTINEL_HUB_CLIENT_ID');
  _has(src, 'SENTINEL_HUB_CLIENT_SECRET',
    'fieldHealthProvider must reference SENTINEL_HUB_CLIENT_SECRET');
  _has(src, 'fetchNDVI',
    'fieldHealthProvider must compose existing sentinelHubService.fetchNDVI');
  const SIGNALS = ['ndvi', 'cropVigor', 'stressScore', 'vegetationTrend'];
  for (const s of SIGNALS) {
    if (!src.includes(s)) {
      errors.push('fieldHealthProvider missing signal: ' + s);
    }
  }
}

// ─── 3. Outcome persister ─────────────────────────────────────
const PERSIST = 'server/src/ml/scanOutcomePersister.js';
if (!_exists(PERSIST)) {
  errors.push('missing: ' + PERSIST);
} else {
  const src = _read(PERSIST);
  _has(src, 'export async function persistScanOutcome',
    'scanOutcomePersister must export persistScanOutcome');
  _has(src, 'prisma.scanTrainingEvent',
    'scanOutcomePersister must write through prisma.scanTrainingEvent');
  _has(src, 'console.warn',
    'scanOutcomePersister must log failures (no silent training-corpus loss)');
}

// ─── 4. Learning engine ───────────────────────────────────────
const LEARN = 'server/src/ml/scanLearningEngine.js';
if (!_exists(LEARN)) {
  errors.push('missing: ' + LEARN);
} else {
  const src = _read(LEARN);
  _has(src, 'export async function recordConfirmation',
    'scanLearningEngine must export recordConfirmation');
  _has(src, 'export function applyLearningBoost',
    'scanLearningEngine must export applyLearningBoost');
  _has(src, 'export async function readUserConfirmationHistory',
    'scanLearningEngine must export readUserConfirmationHistory');
}

// ─── 5+6+7+8. /api/scan/analyze + history + feedback wiring ───
const APP = 'server/src/app.js';
if (!_exists(APP)) {
  errors.push('missing: ' + APP);
} else {
  const src = _read(APP);
  _has(src, "import('./ml/providers/insectProvider.js')",
    'app.js must lazy-import insectProvider');
  _has(src, "import('./ml/providers/fieldHealthProvider.js')",
    'app.js must lazy-import fieldHealthProvider');
  _has(src, "import('./ml/scanOutcomePersister.js')",
    'app.js must lazy-import scanOutcomePersister');
  _has(src, "import('./ml/scanLearningEngine.js')",
    'app.js must lazy-import scanLearningEngine');
  _has(src, 'detectInsect(',
    'app.js must call detectInsect in the analyze route');
  _has(src, 'fetchFieldHealth(',
    'app.js must call fetchFieldHealth in the analyze route');
  _has(src, 'persistScanOutcome(',
    'app.js must call persistScanOutcome after the response is built');
  if (!/Promise\.all\(\s*\[\s*[\s\S]*?runConsensus[\s\S]*?detectInsect[\s\S]*?\]/.test(src)) {
    errors.push('app.js must run consensus + insect detection in Promise.all');
  }
  _has(src, "app.get('/api/scan/history'",
    'app.js must expose GET /api/scan/history');
  if (!/typeof\s+correct\s*===\s*['"]boolean['"]/.test(src)) {
    errors.push('app.js /api/scan/feedback must branch on typeof correct === "boolean"');
  }
}

// ─── 9. ScanLearningRuntime ───────────────────────────────────
const LEARN_RT = 'src/runtime/scanLearning/ScanLearningRuntime.ts';
if (!_exists(LEARN_RT)) {
  errors.push('missing: ' + LEARN_RT);
} else {
  const src = _read(LEARN_RT);
  _has(src, 'export async function submitConfirmation',
    'ScanLearningRuntime must export submitConfirmation');
  _has(src, 'export async function fetchScanHistory',
    'ScanLearningRuntime must export fetchScanHistory');
  _has(src, 'export function installScanLearningGlobal',
    'ScanLearningRuntime must export installScanLearningGlobal');
  _has(src, '__scanLearningHealth',
    'ScanLearningRuntime must pin window.__scanLearningHealth');
  _has(src, '/api/scan/feedback',
    'ScanLearningRuntime must POST to /api/scan/feedback');
  _has(src, '/api/scan/history',
    'ScanLearningRuntime must GET /api/scan/history');
}

// ─── 10. RecentScansCard ──────────────────────────────────────
const RECENT = 'src/components/scan/RecentScansCard.jsx';
if (!_exists(RECENT)) {
  errors.push('missing: ' + RECENT);
} else {
  const src = _read(RECENT);
  _has(src, 'fetchScanHistory',
    'RecentScansCard must call fetchScanHistory');
  _has(src, 'data-testid="recent-scans-card"',
    'RecentScansCard must expose data-testid="recent-scans-card"');
  _has(src, 'data-consumes="scanHistory"',
    'RecentScansCard must declare data-consumes="scanHistory"');
}

// ─── 11. ScanPage wiring ──────────────────────────────────────
const SCAN_PAGE = 'src/pages/ScanPage.jsx';
if (!_exists(SCAN_PAGE)) {
  errors.push('missing: ' + SCAN_PAGE);
} else {
  const src = _read(SCAN_PAGE);
  _has(src, 'RecentScansCard',
    'ScanPage.jsx must import + mount RecentScansCard');
  _has(src, '<RecentScansCard',
    'ScanPage.jsx must render <RecentScansCard');
  _has(src, 'submitConfirmation',
    'ScanPage.jsx must import submitConfirmation from ScanLearningRuntime');
}

// ─── 12. App.jsx boot install ─────────────────────────────────
const APP_JSX = 'src/App.jsx';
if (!_exists(APP_JSX)) {
  errors.push('missing: ' + APP_JSX);
} else {
  const src = _read(APP_JSX);
  _has(src, 'installScanLearningGlobal',
    'App.jsx must call installScanLearningGlobal in boot');
}

// ─── 13. Recovery envelope carries V2 + V3 fields ────────────
const ENVELOPE = 'server/src/ml/scanRecoveryEnvelope.js';
if (!_exists(ENVELOPE)) {
  errors.push('missing: ' + ENVELOPE);
} else {
  const src = _read(ENVELOPE);
  _has(src, 'pest:',
    'scanRecoveryEnvelope must carry pest field (V2)');
  _has(src, 'fieldHealth',
    'scanRecoveryEnvelope must carry fieldHealth field (V2)');
  // Accept v3 OR ANY higher version — later sprints (V3 spec) bump
  // the envelope past v3 (e.g. v4 adds growthStage + regional +
  // market). The minimum bar is "at least v3", i.e. the soil
  // closure landed.
  if (!/scan-recovery-envelope-v[3-9]/.test(src)
      && !/scan-recovery-envelope-v\d{2,}/.test(src)) {
    errors.push('scanRecoveryEnvelope runtimeVersion must be v3 or higher (soil + later);'
      + ' found earlier version.');
  }
  _has(src, 'soil',
    'scanRecoveryEnvelope must carry soil field (V3 — final 3-point gap closure)');
}

// ─── 14. Soil provider exists + key-less SoilGrids ────────────
const SOIL = 'server/src/ml/providers/soilProvider.js';
if (!_exists(SOIL)) {
  errors.push('missing: ' + SOIL);
} else {
  const src = _read(SOIL);
  _has(src, 'export async function fetchSoilProfile',
    'soilProvider must export fetchSoilProfile');
  _has(src, 'rest.isric.org/soilgrids',
    'soilProvider must hit SoilGrids endpoint');
  // No API key — public service.
  const SIGNALS = ['soilTexture', 'drainageRisk', 'ph', 'organicMatterProxy'];
  for (const s of SIGNALS) {
    if (!src.includes(s)) {
      errors.push('soilProvider missing signal: ' + s);
    }
  }
}

// ─── 15. /api/scan/analyze wires soil into Promise.all ────────
const APP_FOR_SOIL = 'server/src/app.js';
if (_exists(APP_FOR_SOIL)) {
  const src = _read(APP_FOR_SOIL);
  _has(src, "import('./ml/providers/soilProvider.js')",
    'app.js must lazy-import soilProvider');
  _has(src, 'fetchSoilProfile(',
    'app.js must call fetchSoilProfile in the analyze route');
  // Promise.all must include 4 readers (consensus + insect + fieldHealth + soil).
  if (!/const\s*\[\s*consensus\s*,\s*pest\s*,\s*fieldHealth\s*,\s*soil\s*\]\s*=\s*await\s+Promise\.all/.test(src)) {
    errors.push('app.js Promise.all must destructure to [consensus, pest, fieldHealth, soil]');
  }
}

if (errors.length) {
  console.error('[check:scan-intel-v2-sprint] FAIL — ' + errors.length + ' violation(s):');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}

console.log('[check:scan-intel-v2-sprint] PASS — INSECT_ID + Sentinel Hub wired; outcomes auto-persisted; Recent Scans surface live; learning loop closed.');
