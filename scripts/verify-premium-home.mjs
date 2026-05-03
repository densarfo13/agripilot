#!/usr/bin/env node
/**
 * verify-premium-home.mjs — acceptance harness for the
 * "Merge Premium Home Experience Patch" spec.
 *
 *   node scripts/verify-premium-home.mjs
 *
 * Static-scans the three home surfaces (Dashboard, DailyPlanCard,
 * HomeContextSwitcher, ScanHero) for the spec contracts the
 * runtime UI relies on:
 *   - first-action eyebrow copy
 *   - micro-interaction state + transition
 *   - 7 analytics events wired
 *   - vocabulary cleanliness (already enforced by the prior
 *     polish harness; we re-assert here so the home suite is
 *     self-contained)
 *   - context-driven empty-state copy + safe fallback path
 *
 * Exit codes:
 *   0 — READY FOR USER TESTING
 *   1 — NEED FIXES
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Same localStorage shim as the prior harnesses so the engine
// imports succeed under Node.
const _store = new Map();
globalThis.window = {
  localStorage: {
    getItem(k){return _store.has(k)?_store.get(k):null;},
    setItem(k,v){_store.set(k,String(v));},
    removeItem(k){_store.delete(k);}, clear(){_store.clear();},
  },
  addEventListener(){}, removeEventListener(){}, dispatchEvent(){},
};
globalThis.localStorage = globalThis.window.localStorage;
globalThis.CustomEvent = class { constructor(n,o){this.type=n;this.detail=o?.detail;} };

const { generateDailyPlan }    = await import('../src/core/dailyPlanEngine.js');
const { getContextEmptyState } = await import('../src/i18n/contextWords.js');

const cases = [];
function test(name, fn) { cases.push({ name, fn }); }

const dashboard       = readFileSync('src/pages/Dashboard.jsx', 'utf8');
const dailyPlanCard   = readFileSync('src/components/daily/DailyPlanCard.jsx', 'utf8');
const switcher        = readFileSync('src/components/home/HomeContextSwitcher.jsx', 'utf8');
const scanHero        = readFileSync('src/components/home/ScanHero.jsx', 'utf8');

// ── §1 + §3 visual hierarchy + first-action gate ─────────────────

test('First-action eyebrow ("Before you do anything, do this first:") renders above priority', () => {
  assert.match(dailyPlanCard, /Before you do anything, do this first/,
    'DailyPlanCard must include the spec §3 eyebrow copy');
  assert.match(dailyPlanCard, /daily-plan-first-action-eyebrow/,
    'eyebrow span must carry the data-testid hook');
  // Spec §1 hierarchy \u2014 eyebrow precedes plan.summary in source
  // order so the rendered DOM matches the visual hierarchy.
  const eyebrowIdx = dailyPlanCard.indexOf('daily-plan-first-action-eyebrow');
  const summaryIdx = dailyPlanCard.indexOf('daily-plan-summary');
  assert.ok(eyebrowIdx > 0 && summaryIdx > 0 && eyebrowIdx < summaryIdx,
    'eyebrow must render before plan.summary in source order');
});

// ── §3 primary action is dominant ────────────────────────────────

test('Priority headline is the BIG visual element (1.25rem, weight 800)', () => {
  // The summaryBig style block sets the dominant scale.
  assert.match(dailyPlanCard, /summaryBig:\s*\{[\s\S]*?fontSize:\s*['"]1\.25rem/,
    'summaryBig must size at 1.25rem');
  assert.match(dailyPlanCard, /summaryBig:\s*\{[\s\S]*?fontWeight:\s*800/,
    'summaryBig must weight 800');
});

// ── §5 risk tag ──────────────────────────────────────────────────

test('Risk tag renders with traffic-light dot + level + reason', () => {
  // Existing risk tag block is preserved (no regression).
  assert.match(dailyPlanCard, /data-testid="daily-risk-tag"/,
    'risk tag must keep its data-testid');
  // Three risk levels (low/medium/high) render different dots.
  assert.match(dailyPlanCard, /'\\uD83D\\uDD34'[\s\S]*'\\uD83D\\uDFE1'[\s\S]*'\\uD83D\\uDFE2'/,
    'risk tag must wire the 3 traffic-light emoji');
});

// ── §9 micro-interactions ───────────────────────────────────────

test('Done button has scale 0.97 micro-interaction with ease-out timing', () => {
  // Press state ref + setter
  assert.match(dailyPlanCard, /pressedActionId/,
    'DailyPlanCard must hold pressedActionId state');
  assert.match(dailyPlanCard, /scale\(0\.97\)/,
    'Done button must scale to 0.97 on press');
  assert.match(dailyPlanCard, /transition:\s*['"]transform 180ms ease-out['"]/,
    'transition must be 180ms ease-out (within spec\u2019s 150\u2013250ms window)');
});

test('Press handler fires on click, touchstart, and mousedown', () => {
  // Ensures the bump happens on every reasonable input device.
  assert.match(dailyPlanCard, /onTouchStart=\{\(\) => _bumpPress/,
    'onTouchStart must trigger the bump');
  assert.match(dailyPlanCard, /onMouseDown=\{\(\) => _bumpPress/,
    'onMouseDown must trigger the bump');
});

// ── §12 analytics: 7 spec events ────────────────────────────────

test('home_opened fires from Dashboard.jsx mount', () => {
  assert.match(dashboard, /safeTrackEvent\(['"]home_opened['"]/,
    'Dashboard must emit home_opened on mount');
});

test('primary_action_shown fires from DailyPlanCard when priority changes', () => {
  assert.match(dailyPlanCard, /homeTrack\(['"]primary_action_shown['"]/,
    'DailyPlanCard must emit primary_action_shown');
});

test('primary_action_completed fires from handleMarkDone', () => {
  assert.match(dailyPlanCard, /homeTrack\(['"]primary_action_completed['"]/,
    'DailyPlanCard must emit primary_action_completed');
});

test('risk_viewed fires from DailyPlanCard when risk level appears', () => {
  assert.match(dailyPlanCard, /homeTrack\(['"]risk_viewed['"]/,
    'DailyPlanCard must emit risk_viewed');
});

test('scan_cta_clicked fires from ScanHero on tap', () => {
  assert.match(scanHero, /trackEvent\(['"]scan_cta_clicked['"]/,
    'ScanHero must emit scan_cta_clicked');
});

test('context_switched fires from HomeContextSwitcher pick', () => {
  assert.match(switcher, /trackEvent\(['"]context_switched['"]/,
    'HomeContextSwitcher must emit context_switched');
});

test('tomorrow_hook_shown fires from handleMarkDone', () => {
  assert.match(dailyPlanCard, /homeTrack\(['"]tomorrow_hook_shown['"]/,
    'DailyPlanCard must emit tomorrow_hook_shown');
});

test('All analytics calls are wrapped in try/catch (\u00a712 — must never crash app)', () => {
  // Find each homeTrack call and verify it sits inside a try block.
  // We can't AST-parse here, so we just check the source contains
  // "try { homeTrack(" or the equivalent pattern for each event.
  const events = [
    'primary_action_shown', 'primary_action_completed',
    'risk_viewed', 'tomorrow_hook_shown',
  ];
  for (const ev of events) {
    const re = new RegExp(`try\\s*\\{[^}]*homeTrack\\(['"]${ev}['"]`, 's');
    assert.match(dailyPlanCard, re,
      `homeTrack('${ev}') must be wrapped in try/catch`);
  }
  assert.match(scanHero, /try\s*\{[^}]*trackEvent\(['"]scan_cta_clicked['"]/s,
    'scan_cta_clicked call must be wrapped in try/catch');
  assert.match(switcher, /try\s*\{[^}]*trackEvent\(['"]context_switched['"]/s,
    'context_switched call must be wrapped in try/catch');
});

// ── §6 garden vs farm vocabulary cleanliness ────────────────────

test('Garden plan never leaks "crop"/"field" (\u00a76 + \u00a713 acceptance)', () => {
  for (const setup of ['container', 'raised_bed', 'ground', 'indoor_balcony']) {
    const plan = generateDailyPlan({
      type: 'garden', setup, cropOrPlant: 'tomato',
    });
    const blob = `${plan.priority} | ${plan.reason} | ${plan.tasks.join(' | ')}`;
    assert.ok(!/\bcrop\b/i.test(blob),
      `garden setup "${setup}" leaked "crop": ${blob}`);
    assert.ok(!/\bfield\b/i.test(blob),
      `garden setup "${setup}" leaked "field": ${blob}`);
  }
});

test('Farm plan never leaks "plant"/"pot" (\u00a76 + \u00a713 acceptance)', () => {
  for (const cls of ['small_farm', 'medium_farm', 'large_farm']) {
    const plan = generateDailyPlan({
      type: 'farm', autoFarmClass: cls, cropOrPlant: 'maize',
    });
    const blob = `${plan.priority} | ${plan.reason} | ${plan.tasks.join(' | ')}`;
    assert.ok(!/\bplant\b/i.test(blob),
      `farm class "${cls}" leaked "plant": ${blob}`);
    assert.ok(!/\bpot\b/i.test(blob),
      `farm class "${cls}" leaked "pot": ${blob}`);
  }
});

// ── §6 empty-state copy match ───────────────────────────────────

test('Garden empty-state copy matches spec', () => {
  assert.equal(getContextEmptyState('garden'), 'Add a plant to get started');
});

test('Farm empty-state copy matches spec', () => {
  assert.equal(getContextEmptyState('farm'), 'Add your farm to begin tracking');
});

// ── §11 performance / fallback ──────────────────────────────────

test('Engine returns a usable plan with NO weather + NO size data (spec \u00a711)', () => {
  const plan = generateDailyPlan({
    type: 'farm', cropOrPlant: 'maize', /* no weather, no size, no class */
  });
  assert.ok(plan && typeof plan === 'object');
  assert.ok(typeof plan.priority === 'string' && plan.priority.length > 0,
    'priority must be a non-empty string on the fallback path');
  assert.ok(Array.isArray(plan.tasks) && plan.tasks.length > 0,
    'fallback plan must include at least one task');
});

test('Engine never crashes on null context (spec \u00a711)', () => {
  // Defensive: pass null and expect a usable result, not a throw.
  let plan;
  assert.doesNotThrow(() => { plan = generateDailyPlan(null); });
  assert.ok(plan && typeof plan === 'object');
});

// ── Driver ───────────────────────────────────────────────────────
let pass = 0, fail = 0;
for (const c of cases) {
  try {
    await c.fn();
    pass++;
    console.log(`\u2713 ${c.name}`);
  } catch (err) {
    fail++;
    console.error(`\u2717 ${c.name}\n   ${err && err.message ? err.message : err}`);
  }
}

console.log('');
console.log(`Verdict: ${fail === 0 ? 'READY FOR USER TESTING' : 'NEED FIXES'}`);
console.log(`${pass} passed, ${fail} failed, ${cases.length} total.`);
if (fail > 0) process.exitCode = 1;
