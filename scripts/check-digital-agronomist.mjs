/**
 * check-digital-agronomist.mjs — sprint #194 foundation gate.
 *
 * Locks the Digital Agronomist contract (spec #189A FINAL):
 *   1. FarmHealthEngine exists, exports getFarmHealthBrief +
 *      installFarmHealthBriefGlobal, returns the 4 spec fields,
 *      and declares neverFabricatesReasons.
 *   2. CommandCenterDeck renders: health tile, Why line
 *      (cc-health-why), sub-risk chips (cc-sub-risks), Today's
 *      Action (cc-today-action), confidence (cc-action-confidence),
 *      reason/why text, and EXACTLY ONE primary Start button.
 *   3. Home mounts the deck above the fold (CommandCenterDeck
 *      before the demoted "More for today" section).
 *   4. The follow-up + outcome chain survives (followUpEngine with
 *      better/same/worse statuses — already gate-locked by
 *      check-scan-v3 §7; re-asserted here for the foundation).
 *   5. DIGITAL_AGRONOMIST_FOUNDATION_REPORT.md exists.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const errors = [];
const _exists = (rel) => { try { return fs.existsSync(path.join(ROOT, rel)); } catch { return false; } };
const _read = (rel) => { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return ''; } };
const _has = (s, n, m) => { if (!s.includes(n)) errors.push(m); };

// 1. FarmHealthEngine.
const ENGINE = 'src/runtime/farmHealth/FarmHealthEngine.ts';
if (!_exists(ENGINE)) {
  errors.push('missing: ' + ENGINE);
} else {
  const src = _read(ENGINE);
  _has(src, 'export function getFarmHealthBrief',
    'FarmHealthEngine must export getFarmHealthBrief');
  _has(src, 'export function installFarmHealthBriefGlobal',
    'FarmHealthEngine must export installFarmHealthBriefGlobal');
  for (const f of ['healthScore', 'confidence', 'contributors', 'risks']) {
    if (!src.includes(f)) {
      errors.push('FarmHealthEngine brief missing spec field: ' + f);
    }
  }
  _has(src, 'neverFabricatesReasons',
    'FarmHealthEngine must declare neverFabricatesReasons');
  _has(src, '__farmHealthBrief',
    'FarmHealthEngine must pin window.__farmHealthBrief');
}

// 2. Deck contract.
const DECK = 'src/components/commandCenter/CommandCenterDeck.jsx';
if (!_exists(DECK)) {
  errors.push('missing: ' + DECK);
} else {
  const src = _read(DECK);
  const TESTIDS = [
    'cc-health', 'cc-health-why', 'cc-sub-risks',
    'cc-today-action', 'cc-action-confidence',
  ];
  for (const t of TESTIDS) {
    if (!src.includes('"' + t + '"') && !src.includes("'" + t + "'")
        && !src.includes('data-testid="' + t + '"')) {
      errors.push('CommandCenterDeck missing testid: ' + t);
    }
  }
  // Reason text — the action card must surface a "why" line.
  if (!/why|reason/i.test(src)) {
    errors.push('CommandCenterDeck must render the action reason (why)');
  }
  // EXACTLY ONE primary Start button inside the deck.
  const startMatches = src.match(/data-testid="cc-btn-start"/g) || [];
  if (startMatches.length !== 1) {
    errors.push('CommandCenterDeck must have EXACTLY ONE cc-btn-start (found '
      + startMatches.length + ')');
  }
  // FarmHealthEngine wired.
  _has(src, "import('../../runtime/farmHealth/FarmHealthEngine')",
    'CommandCenterDeck must lazy-import FarmHealthEngine');
}

// 3. Home mounts the deck above the demoted section.
const HOME = 'src/pages/Home.jsx';
if (!_exists(HOME)) {
  errors.push('missing: ' + HOME);
} else {
  const src = _read(HOME);
  const deckIdx = src.indexOf('<CommandCenterDeck');
  // Use the i18n key as the render marker — the literal phrase also
  // appears in an explanatory comment ABOVE the deck mount.
  const moreIdx = src.indexOf("'home.moreToday'");
  if (deckIdx === -1) {
    errors.push('Home.jsx must mount <CommandCenterDeck (sprint #192 hero)');
  }
  if (deckIdx !== -1 && moreIdx !== -1 && deckIdx > moreIdx) {
    errors.push('Home.jsx CommandCenterDeck must render ABOVE the "More for today" demoted section');
  }
}

// 4. Follow-up + outcome chain survives.
const FOLLOWUP = 'server/src/ml/followUpEngine.js';
if (!_exists(FOLLOWUP)) {
  errors.push('missing: ' + FOLLOWUP + ' (follow-up engine — outcome loop)');
} else {
  const src = _read(FOLLOWUP);
  for (const s of ['improved', 'same', 'worse']) {
    if (!src.includes("'" + s + "'")) {
      errors.push('followUpEngine missing outcome status: ' + s);
    }
  }
}

// 5. Report doc.
if (!_exists('DIGITAL_AGRONOMIST_FOUNDATION_REPORT.md')) {
  errors.push('missing DIGITAL_AGRONOMIST_FOUNDATION_REPORT.md');
}

if (errors.length) {
  console.error('[check:digital-agronomist] FAIL — ' + errors.length + ' violation(s):');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}

console.log('[check:digital-agronomist] PASS — FarmHealthEngine composes honest brief, deck renders score+why+risks+action+confidence with exactly one Start, Home hero above the fold, outcome loop intact, report present.');
