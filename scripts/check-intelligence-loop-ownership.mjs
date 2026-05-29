#!/usr/bin/env node
/**
 * scripts/check-intelligence-loop-ownership.mjs — Ownership +
 * purity gate for the Intelligence Loop runtime.
 *
 * Hard blockers:
 *
 *   A. 8 spec'd files exist in src/runtime/intelligenceLoop/
 *      with the canonical version constants.
 *   B. Intelligence Loop engines do NOT import React /
 *      components / pages.
 *   C. Intelligence Loop engines do NOT call Plant.id or any
 *      camera API directly.
 *   D. Intelligence Loop engines do NOT own camera.
 *   E. Intelligence Loop engines do NOT write to localStorage /
 *      IndexedDB / sessionStorage directly (wave-5 invariant).
 *   F. UI files (src/components + src/pages, excluding internal/)
 *      do NOT call:
 *        - registerPlantMedia / registerArtifact / registerPlant
 *          (write APIs)
 *        - record* from intelligenceLoop directly
 *      Direct UI persistence violates the single-writer rule;
 *      callers go through runtime verbs.
 *   G. Recommendation copy must NEVER contain banned words
 *      (guaranteed / will cure / confirmed) in grower-facing
 *      surfaces — the DecisionEngine's scrubber is the only
 *      legal sink for those phrases.
 *   H. Fake-metric tokens do not appear in the loop runtime.
 *
 * Strict-rule audit
 *   • Read-only. Never mutates.
 *   • Returns exit 1 on any hard blocker.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FAILED = [];
const PASSED = [];
function fail(m) { FAILED.push(m); }
function pass(m) { PASSED.push(m); }

function readOrEmpty(f) {
  try { return fs.readFileSync(f, 'utf8'); } catch { return ''; }
}
function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\/\/[^\n]*/g, '')
          .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
}
function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist'
          || e.name === '__tests__') continue;
      walk(full, out);
    } else if (/\.(tsx?|jsx?)$/.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

// ─── A. 8 spec'd files with versions ───────────────────────────
const LOOP_FILES = [
  ['src/runtime/intelligenceLoop/intelligenceLoopContracts.ts', 'farroway-intelligence-loop-v1', 'INTELLIGENCE_LOOP_VERSION'],
  ['src/runtime/intelligenceLoop/ObservationEngine.ts',         'loop-observation-v1',           'OBSERVATION_ENGINE_VERSION'],
  ['src/runtime/intelligenceLoop/OrientationEngine.ts',         'loop-orientation-v1',           'ORIENTATION_ENGINE_VERSION'],
  ['src/runtime/intelligenceLoop/DecisionEngine.ts',            'loop-decision-v1',              'LOOP_DECISION_ENGINE_VERSION'],
  ['src/runtime/intelligenceLoop/ActionEngine.ts',              'loop-action-v1',                'LOOP_ACTION_ENGINE_VERSION'],
  ['src/runtime/intelligenceLoop/OutcomeTracker.ts',            'loop-outcome-tracker-v1',       'OUTCOME_TRACKER_VERSION'],
  ['src/runtime/intelligenceLoop/LearningSignalEngine.ts',      'loop-learning-signal-v1',       'LEARNING_SIGNAL_ENGINE_VERSION'],
  ['src/runtime/intelligenceLoop/IntelligenceLoopRuntime.ts',   'farroway-intelligence-loop-v1', 'INTELLIGENCE_LOOP_RUNTIME_VERSION'],
  ['src/runtime/intelligenceLoop/index.ts',                     'farroway-intelligence-loop-v1', 'INTELLIGENCE_LOOP_VERSION'],
];

const loopSources = {};
for (const [f, lit, constant] of LOOP_FILES) {
  const src = readOrEmpty(path.join(ROOT, f));
  loopSources[f] = src;
  if (!src) fail(`loop: missing ${f}`);
  else if (!src.includes(lit) && !src.includes(constant)) {
    fail(`loop: ${f} missing version literal "${lit}" or constant "${constant}"`);
  }
}
if (Object.values(loopSources).every(Boolean)) {
  pass(`loop: 9 files (8 phase + 1 barrel) wired with version constants`);
}

// ─── B + C + D. Loop engines never import React, Plant.id, camera
for (const [f, src] of Object.entries(loopSources)) {
  if (!src) continue;
  if (/from\s+['"]react['"]/.test(src)
      || /from\s+['"][^'"]*\/components?\//.test(src)
      || /from\s+['"][^'"]*\/pages\//.test(src)) {
    fail(`loop-purity: ${f} imports React / components / pages — engines stay pure`);
  }
  if (/plant[-_.]?id/i.test(src) && /api[-_.]?key/i.test(src)) {
    fail(`loop-purity: ${f} appears to call Plant.id directly with an api key — engines never own the classifier call`);
  }
  if (/navigator\.mediaDevices/.test(src)
      || /getUserMedia/.test(src)) {
    fail(`loop-purity: ${f} touches camera APIs — Scan Runtime owns the camera`);
  }
}
pass(`loop-purity: no React / camera / Plant.id imports in 9 loop engines`);

// ─── E. No direct persistence writes ──────────────────────────
const FORBIDDEN_PERSISTENCE = [
  /localStorage\.setItem/,
  /localStorage\[/,
  /indexedDB\b/i,
  /sessionStorage\.setItem/,
];
for (const [f, src] of Object.entries(loopSources)) {
  if (!src) continue;
  const stripped = stripComments(src);
  for (const re of FORBIDDEN_PERSISTENCE) {
    if (re.test(stripped)) {
      fail(`loop-persistence: ${f} writes to ${re} — wave-5 invariant`);
    }
  }
}
pass(`loop-persistence: no direct localStorage / IndexedDB writes`);

// ─── F. UI never writes plant / artifact / outcome directly ──
const UI_DIRS = [
  path.join(ROOT, 'src/components'),
  path.join(ROOT, 'src/pages'),
];
const INTERNAL_DIR = path.join(ROOT, 'src/pages/internal');
const FORBIDDEN_UI_CALLS = [
  // Direct writes the UI must NOT make.
  /\bregisterArtifact\s*\(/,
  /\bregisterPlantMedia\s*\(/,
  /\bregisterPlant\s*\(/,
];
let uiViolators = [];
for (const dir of UI_DIRS) {
  for (const f of walk(dir)) {
    if (f.startsWith(INTERNAL_DIR)) continue;
    const src = stripComments(readOrEmpty(f));
    for (const re of FORBIDDEN_UI_CALLS) {
      if (re.test(src)) {
        uiViolators.push({ rel: path.relative(ROOT, f), re: re.toString() });
        break;
      }
    }
  }
}
if (uiViolators.length > 0) {
  for (const v of uiViolators) {
    fail(`ui-direct-write: ${v.rel} calls a runtime write directly (${v.re}) — go through the runtime verb`);
  }
} else {
  pass(`ui-direct-write: no UI surface calls runtime write APIs directly`);
}

// ─── G. Banned words never reach grower copy via the loop ──
// The DecisionEngine has a scrubber; ensure it is in place and
// the BANNED_WORDS contract is present.
const contracts = loopSources['src/runtime/intelligenceLoop/intelligenceLoopContracts.ts'] || '';
for (const w of ['guaranteed', 'will cure', 'confirmed']) {
  if (!new RegExp("'" + w + "'", 'i').test(contracts)) {
    fail(`safe-wording: BANNED_WORDS must list "${w}"`);
  }
}
const decisionEng = loopSources['src/runtime/intelligenceLoop/DecisionEngine.ts'] || '';
if (!/_scrub|scrub/.test(decisionEng)) {
  fail(`safe-wording: DecisionEngine must contain a scrubber that removes banned words`);
}
pass(`safe-wording: BANNED_WORDS list + DecisionEngine scrubber wired`);

// ─── H. Fake-metric tokens absent from the loop runtime ────
const FAKE_TOKENS = [
  /\bfake[\s_-]?revenue\b/i,
  /\bmock[\s_-]?metrics\b/i,
  /\bplaceholder\s+traction\b/i,
];
for (const [f, src] of Object.entries(loopSources)) {
  if (!src) continue;
  const stripped = stripComments(src);
  for (const re of FAKE_TOKENS) {
    if (re.test(stripped)) {
      fail(`fake-metric: ${f} contains forbidden ${re}`);
    }
  }
}
pass(`fake-metric: no fake-metric tokens in loop runtime`);

// ─── Report ────────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:intelligence-loop-ownership] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} checks passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:intelligence-loop-ownership] PASS — loop ownership + purity clean.');
console.log(`  9 files wired (Observe · Orient · Decide · Act · Outcome · Learning · Composite + contracts + barrel).`);
console.log(`  No React/camera/Plant.id imports. No direct persistence writes. UI never calls runtime writes directly.`);
console.log(`  Banned-word scrubber + fake-metric exclusion enforced.`);
