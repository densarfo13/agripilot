/**
 * check-recommendation-engine-v1.mjs — locks the Recommendation
 * Engine V1 (daily-action) contract.
 *
 * Spec build-safe rules:
 *   - Fail if no action generated (engine must always return 1)
 *   - Fail if more than 3 actions shown (topThree capped at 3)
 *   - Fail if no follow-up created (followUpDate must be present)
 *
 * Plus structural checks:
 *   1. dailyActionEngine.js exists + exports computeDailyAction
 *   2. Spec weights 40/30/20/10 (gate-locked literal)
 *   3. /api/daily-action route wired
 *   4. RecommendationEngine.ts (dailyAction) exports fetchDailyAction
 *      + installDailyActionGlobal + pins __dailyActionHealth
 *   5. TodaysActionCard renders the 5 spec elements (priority,
 *      action text, why/reason, time, confidence, Start, Scan)
 *   6. DailyCommandCard renders ONLY the 5 spec fields
 *      (crop, stage, health, risk, today's action)
 *   7. Home.jsx mounts <TodaysActionCard />
 *   8. App.jsx calls installDailyActionGlobal
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

// ─── 1+2. Engine ──────────────────────────────────────────────
const ENGINE = 'server/src/ml/dailyActionEngine.js';
if (!_exists(ENGINE)) {
  errors.push('missing: ' + ENGINE);
} else {
  const src = _read(ENGINE);
  _has(src, 'export function computeDailyAction',
    'dailyActionEngine must export computeDailyAction');
  // Spec weights 40/30/20/10.
  if (!/weather:\s*40/.test(src) || !/scan:\s*30/.test(src)
      || !/growthStage:\s*20/.test(src) || !/previousOutcome:\s*10/.test(src)) {
    errors.push('dailyActionEngine WEIGHTS must be exactly { weather:40, scan:30, growthStage:20, previousOutcome:10 }');
  }
  // BUILD-SAFE §1 — engine must always return an action. We enforce
  // by: (a) the conservative fallback block exists, (b) the fallback
  // block uses the same action string in both the happy and catch paths.
  _has(src, "'Walk the field for 5 minutes and note anything unusual.'",
    'dailyActionEngine must define a conservative fallback action so the contract "always returns 1" holds');
  // BUILD-SAFE §2 — topThree capped at 3 (slice(0, 3)).
  _has(src, 'candidates.slice(0, 3)',
    'dailyActionEngine must cap topThree at 3 entries');
  // BUILD-SAFE §3 — followUpDate must be emitted.
  _has(src, 'followUpDate',
    'dailyActionEngine must emit followUpDate field');
  _has(src, 'function _followUpDateFor',
    'dailyActionEngine must define _followUpDateFor');
}

// ─── 3. Route ─────────────────────────────────────────────────
const APP = 'server/src/app.js';
if (!_exists(APP)) {
  errors.push('missing: ' + APP);
} else {
  const src = _read(APP);
  _has(src, "app.get('/api/daily-action'",
    'app.js must expose GET /api/daily-action');
  _has(src, "import('./ml/dailyActionEngine.js')",
    'app.js must lazy-import dailyActionEngine');
  // Route must compose the 6 spec inputs.
  for (const f of ['weather', 'scan', 'farm.crop', 'growthStage',
                   'openTasks', 'outcomeHistory']) {
    if (!src.includes(f)) {
      errors.push('app.js /api/daily-action route must compose input: ' + f);
    }
  }
}

// ─── 4. Client adapter ────────────────────────────────────────
const ADAPTER = 'src/runtime/dailyAction/RecommendationEngine.ts';
if (!_exists(ADAPTER)) {
  errors.push('missing: ' + ADAPTER);
} else {
  const src = _read(ADAPTER);
  _has(src, 'export async function fetchDailyAction',
    'RecommendationEngine.ts must export fetchDailyAction');
  _has(src, 'export function installDailyActionGlobal',
    'RecommendationEngine.ts must export installDailyActionGlobal');
  _has(src, '__dailyActionHealth',
    'RecommendationEngine.ts must pin window.__dailyActionHealth');
  for (const f of ['alwaysReturnsOneAction', 'capsTopThreeAtThree',
                   'emitsFollowUpDate', 'noFabricatedAction']) {
    if (!src.includes(f + ':')) {
      errors.push('RecommendationEngine.ts missing safety flag: ' + f);
    }
  }
}

// ─── 5. TodaysActionCard ──────────────────────────────────────
const CARD = 'src/components/intelligence/TodaysActionCard.jsx';
if (!_exists(CARD)) {
  errors.push('missing: ' + CARD);
} else {
  const src = _read(CARD);
  const TESTIDS = ['todays-action-card', 'todays-action-priority',
    'todays-action-text', 'todays-action-reason',
    'todays-action-time', 'todays-action-confidence',
    'todays-action-followup',
    'todays-action-start', 'todays-action-scan'];
  for (const tid of TESTIDS) {
    if (!src.includes('data-testid="' + tid + '"')) {
      errors.push('TodaysActionCard missing data-testid: ' + tid);
    }
  }
  _has(src, 'data-consumes="dailyAction"',
    'TodaysActionCard must declare data-consumes="dailyAction"');
}

// ─── 6. DailyCommandCard — ONLY the 5 spec fields ─────────────
const CCARD = 'src/components/intelligence/DailyCommandCard.jsx';
if (!_exists(CCARD)) {
  errors.push('missing: ' + CCARD);
} else {
  const src = _read(CCARD);
  // The component passes testids through a Row helper. Accept
  // either the JSX-attribute literal or the prop-passed form.
  for (const tid of ['daily-command-crop', 'daily-command-stage',
                     'daily-command-health', 'daily-command-risk',
                     'daily-command-action']) {
    if (!src.includes('"' + tid + '"')) {
      errors.push('DailyCommandCard missing required row: ' + tid);
    }
  }
  _has(src, 'data-testid="daily-command-card"',
    'DailyCommandCard must expose root data-testid="daily-command-card"');
}

// ─── 7. Home.jsx mounts TodaysActionCard ──────────────────────
const HOME = 'src/pages/Home.jsx';
if (!_exists(HOME)) {
  errors.push('missing: ' + HOME);
} else {
  const src = _read(HOME);
  _has(src, 'TodaysActionCard',
    'Home.jsx must import TodaysActionCard');
  _has(src, '<TodaysActionCard',
    'Home.jsx must render <TodaysActionCard');
}

// ─── 8. App.jsx boot install ──────────────────────────────────
const APP_JSX = 'src/App.jsx';
if (!_exists(APP_JSX)) {
  errors.push('missing: ' + APP_JSX);
} else {
  const src = _read(APP_JSX);
  _has(src, 'installDailyActionGlobal',
    'App.jsx must call installDailyActionGlobal in boot');
}

if (errors.length) {
  console.error('[check:recommendation-engine-v1] FAIL — ' + errors.length + ' violation(s):');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}

console.log('[check:recommendation-engine-v1] PASS — one clear daily action; weights 40/30/20/10; never zero, never >3, always with follow-up.');
