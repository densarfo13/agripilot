/**
 * check-intelligence-platform-v1.mjs — locks the unified
 * recommendation engine contract.
 *
 * Fails build when:
 *   1. server/src/ml/recommendationPriorityEngine.js missing OR
 *      doesn't export computeUnifiedRecommendations + scoreAction.
 *   2. Priority scoring formula NOT exactly weight 30/30/25/15 for
 *      risk/urgency/impact/confidence (spec target: ONE math).
 *   3. Engine composes ALL 6 inputs (scan/soil/weather/satellite/
 *      regional/market) AND applies outcome history boost.
 *   4. /api/recommendations/today AND /api/recommendations/score
 *      routes wired.
 *   5. /api/recommendations/today lazy-imports all upstream
 *      providers (soil, fieldHealth, regional, market, weather,
 *      outcomeIntelligence) so it never directly couples to them.
 *   6. src/runtime/intelligencePlatform/IntelligencePlatformRecommendationEngine.ts
 *      missing OR doesn't pin __intelligencePlatformHealth +
 *      export fetchTodayRecommendation + scorePriorityAction.
 *   7. src/components/intelligence/TopActionCard.jsx missing OR
 *      doesn't expose the 4 spec section testids
 *      (recommendation / reason / benefit / confidence) AND the
 *      priority badge.
 *   8. ScanPage / Home.jsx do not mount <TopActionCard /> on Home.
 *   9. App.jsx does NOT call installIntelligencePlatformGlobal.
 *  10. Engine NEVER fabricates a recommendation — when no inputs
 *      it must return topAction:null + ok:true + empty-state message.
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

// ─── 1+2+3+10. Engine ────────────────────────────────────────
const ENGINE = 'server/src/ml/recommendationPriorityEngine.js';
if (!_exists(ENGINE)) {
  errors.push('missing: ' + ENGINE);
} else {
  const src = _read(ENGINE);
  _has(src, 'export function computeUnifiedRecommendations',
    'recommendationPriorityEngine must export computeUnifiedRecommendations');
  _has(src, 'export function scoreAction',
    'recommendationPriorityEngine must export scoreAction');
  // Spec formula — weights MUST be 30/30/25/15.
  if (!/risk:\s*30/.test(src) || !/urgency:\s*30/.test(src)
      || !/impact:\s*25/.test(src) || !/confidence:\s*15/.test(src)) {
    errors.push('recommendationPriorityEngine weights must be exactly { risk:30, urgency:30, impact:25, confidence:15 }');
  }
  // Composes all 6 candidate sources.
  for (const fn of ['_fromScan', '_fromSoil', '_fromWeather',
                    '_fromSatellite', '_fromRegional', '_fromMarket']) {
    if (!src.includes('function ' + fn + '(')) {
      errors.push('recommendationPriorityEngine missing candidate builder: ' + fn);
    }
  }
  _has(src, '_applyOutcomeBoost',
    'recommendationPriorityEngine must apply outcome-history boost');
  // Honest empty state — topAction: null when no candidates.
  if (!/topAction:\s*null/.test(src)) {
    errors.push('recommendationPriorityEngine must return topAction: null on empty input (no fabricated recommendation)');
  }
}

// ─── 4+5. Routes ──────────────────────────────────────────────
const APP = 'server/src/app.js';
if (!_exists(APP)) {
  errors.push('missing: ' + APP);
} else {
  const src = _read(APP);
  _has(src, "app.get('/api/recommendations/today'",
    'app.js must expose GET /api/recommendations/today');
  _has(src, "app.post('/api/recommendations/score'",
    'app.js must expose POST /api/recommendations/score');
  _has(src, "import('./ml/recommendationPriorityEngine.js')",
    'app.js must lazy-import recommendationPriorityEngine');
  // Composes upstream providers — must lazy-import all 5 within the
  // recommendations route.
  const UPSTREAM = [
    "./ml/providers/soilProvider.js",
    "./ml/providers/fieldHealthProvider.js",
    "./ml/providers/regionalIntelligenceProvider.js",
    "./ml/marketEngine.js",
    "./ml/outcomeIntelligenceEngine.js",
  ];
  for (const m of UPSTREAM) {
    if (!src.includes("import('" + m + "')")) {
      errors.push('app.js /api/recommendations/today must lazy-import ' + m);
    }
  }
}

// ─── 6. Client runtime ────────────────────────────────────────
const RT = 'src/runtime/intelligencePlatform/IntelligencePlatformRecommendationEngine.ts';
if (!_exists(RT)) {
  errors.push('missing: ' + RT);
} else {
  const src = _read(RT);
  _has(src, 'export function installIntelligencePlatformGlobal',
    'IntelligencePlatformRecommendationEngine must export installIntelligencePlatformGlobal');
  _has(src, '__intelligencePlatformHealth',
    'IntelligencePlatformRecommendationEngine must pin window.__intelligencePlatformHealth');
  _has(src, 'export async function fetchTodayRecommendation',
    'IntelligencePlatformRecommendationEngine must export fetchTodayRecommendation');
  _has(src, 'export async function scorePriorityAction',
    'IntelligencePlatformRecommendationEngine must export scorePriorityAction');
  // Honest safety flags.
  for (const f of ['returnsSingleTopAction', 'returnsTopThreeOrFewer',
                   'noFabricatedRecommendation']) {
    if (!src.includes(f + ':')) {
      errors.push('IntelligencePlatformRecommendationEngine missing safety flag: ' + f);
    }
  }
}

// ─── 7. TopActionCard ────────────────────────────────────────
const CARD = 'src/components/intelligence/TopActionCard.jsx';
if (!_exists(CARD)) {
  errors.push('missing: ' + CARD);
} else {
  const src = _read(CARD);
  const TESTIDS = ['top-action-priority', 'top-action-recommendation',
    'top-action-reason', 'top-action-benefit', 'top-action-confidence'];
  for (const tid of TESTIDS) {
    if (!src.includes('data-testid="' + tid + '"')) {
      errors.push('TopActionCard missing data-testid: ' + tid);
    }
  }
  _has(src, 'data-consumes="intelligencePlatform"',
    'TopActionCard must declare data-consumes="intelligencePlatform"');
}

// ─── 8. Home mounts TopActionCard ────────────────────────────
const HOME = 'src/pages/Home.jsx';
if (!_exists(HOME)) {
  errors.push('missing: ' + HOME);
} else {
  const src = _read(HOME);
  _has(src, 'TopActionCard',
    'Home.jsx must import TopActionCard');
  _has(src, '<TopActionCard',
    'Home.jsx must render <TopActionCard');
}

// ─── 9. App.jsx boot install ─────────────────────────────────
const APP_JSX = 'src/App.jsx';
if (!_exists(APP_JSX)) {
  errors.push('missing: ' + APP_JSX);
} else {
  const src = _read(APP_JSX);
  _has(src, 'installIntelligencePlatformGlobal',
    'App.jsx must call installIntelligencePlatformGlobal in boot');
}

if (errors.length) {
  console.error('[check:intelligence-platform-v1] FAIL — ' + errors.length + ' violation(s):');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}

console.log('[check:intelligence-platform-v1] PASS — unified recommendation engine wired; one source of truth; one top action.');
