#!/usr/bin/env node
/**
 * verify-context-driven-ui.mjs — acceptance harness for the
 * "Make UI Context-Driven" spec.
 *
 *   node scripts/verify-context-driven-ui.mjs
 *
 * Covers the data-layer + static contract assertions that make
 * the UI work:
 *   • activeContextType reads correctly off a garden vs farm row
 *   • the BACKYARD_TABS list excludes Funding + Sell (§2)
 *   • the FARM_TABS list includes all 6 canonical tabs
 *   • BackyardGuard shows the spec'd empty-state copy (§6) instead
 *     of silently redirecting
 *   • switching active garden also flips the legacy active-farm
 *     pointer (§7 — context switch must reload Home/Tasks/Progress)
 *   • the decision engine produces a different plan for garden vs
 *     farm contexts (§3 + §4)
 *
 * Exit codes:
 *   0 — all assertions passed (CONTEXT-DRIVEN)
 *   1 — at least one failed (NEED FIXES)
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// localStorage shim.
const _store = new Map();
const memLocalStorage = {
  getItem(key)        { return _store.has(key) ? _store.get(key) : null; },
  setItem(key, value) { _store.set(key, String(value)); },
  removeItem(key)     { _store.delete(key); },
  clear()             { _store.clear(); },
};
globalThis.window = {
  localStorage: memLocalStorage,
  addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
};
globalThis.localStorage = memLocalStorage;
globalThis.CustomEvent = class { constructor(n, o) { this.type = n; this.detail = o?.detail; } };

const {
  addGarden, addFarm, switchExperience, EXPERIENCE,
  getExperienceSnapshot, setActiveGardenId,
} = await import('../src/store/multiExperience.js');
const { getActiveFarmId } = await import('../src/store/farrowayLocal.js');
const { generateDailyPlan } = await import('../src/core/dailyPlanEngine.js');

const cases = [];
function test(name, fn) { cases.push({ name, fn }); }
function reset() {
  _store.clear();
  memLocalStorage.setItem('farroway_full_architecture_migrated', 'true');
}

// ── §8 acceptance ────────────────────────────────────────────────

test('Garden context exposes activeContextType="garden"', () => {
  reset();
  addGarden({
    name: 'Garden', crop: 'tomato',
    country: 'US', farmSize: 100, sizeUnit: 'sqft',
  });
  const snap = getExperienceSnapshot();
  assert.equal(snap.activeContextType, 'garden');
  assert.equal(snap.activeExperience,  EXPERIENCE.GARDEN);
});

test('Farm context exposes activeContextType="farm"', () => {
  reset();
  addFarm({
    name: 'Farm', crop: 'maize',
    country: 'GH', farmSize: 5, sizeUnit: 'acres',
  });
  const snap = getExperienceSnapshot();
  assert.equal(snap.activeContextType, 'farm');
  assert.equal(snap.activeExperience,  EXPERIENCE.FARM);
});

test('Garden hides Funding + Sell (BottomTabNav BACKYARD_TABS \u2014 strict 4-tab)', () => {
  const src = readFileSync('src/components/farmer/BottomTabNav.jsx', 'utf8');
  // Pull the BACKYARD_TABS array body out of the source.
  const match = src.match(/const BACKYARD_TABS\s*=\s*\[([\s\S]*?)\];/);
  assert.ok(match, 'BACKYARD_TABS array must exist');
  const body = match[1];
  // Must NOT contain Funding (nav.funding) or Sell (nav.sell).
  assert.ok(!/nav\.funding/.test(body),
    'BACKYARD_TABS must NOT include nav.funding');
  assert.ok(!/nav\.sell/.test(body),
    'BACKYARD_TABS must NOT include nav.sell');
  // Must include the 4 canonical garden tabs.
  for (const k of ['nav.home', 'nav.myGrow', 'nav.tasks', 'nav.progress']) {
    assert.ok(body.includes(k),
      `BACKYARD_TABS must include ${k}`);
  }
  // Strict 4-tab subset \u2014 count the explicit `path:` declarations
  // (one per tab) so we catch any future drift.
  const pathCount = (body.match(/\bpath:\s*['"]/g) || []).length;
  assert.equal(pathCount, 4,
    `BACKYARD_TABS should have exactly 4 tabs; got ${pathCount}`);
});

test('Farm shows all 6 canonical tabs (BottomTabNav FARM_TABS)', () => {
  const src = readFileSync('src/components/farmer/BottomTabNav.jsx', 'utf8');
  const match = src.match(/const FARM_TABS\s*=\s*\[([\s\S]*?)\];/);
  assert.ok(match, 'FARM_TABS array must exist');
  const body = match[1];
  for (const k of ['nav.home', 'nav.myGrow', 'nav.tasks',
                   'nav.progress', 'nav.funding', 'nav.sell']) {
    assert.ok(body.includes(k),
      `FARM_TABS must include ${k}`);
  }
  const pathCount = (body.match(/\bpath:\s*['"]/g) || []).length;
  assert.equal(pathCount, 6,
    `FARM_TABS should have exactly 6 tabs; got ${pathCount}`);
});

test('BottomTabNav prefers activeContextType for the surface decision', () => {
  const src = readFileSync('src/components/farmer/BottomTabNav.jsx', 'utf8');
  // Must read activeContextType from useExperience().
  assert.match(src, /activeContextType/,
    'BottomTabNav must read activeContextType');
  // The garden branch is satisfied when activeContextType === "garden".
  assert.match(src, /activeContextType\s*===\s*['"]garden['"]/,
    'BottomTabNav must branch on activeContextType="garden"');
});

test('BackyardGuard renders friendly empty-state copy (\u00a76) instead of redirect', () => {
  const src = readFileSync('src/components/system/BackyardGuard.jsx', 'utf8');
  // Must render the spec'd copy.
  assert.match(src, /Funding is available for farms only/,
    'BackyardGuard must include §6 funding copy');
  assert.match(src, /Selling is available for farms only/,
    'BackyardGuard must include §6 sell copy');
  // Must accept the surface prop (funding | sell) so the same
  // wrapper drives both copies.
  assert.match(src, /surface\s*=\s*['"]default['"]/,
    'BackyardGuard must default surface to "default"');
  // Must surface a "+ Add a farm" CTA per §6.
  assert.match(src, /Add a farm/,
    'BackyardGuard must include "Add a farm" CTA');
  // Must NOT silently redirect on garden context \u2014 the spec
  // calls for an EMPTY STATE, not a bounce.
  // (We allow navigate('/home') for the secondary "Back to Home"
  // button, but the primary path must render an in-place card.)
  assert.match(src, /<main[\s\S]*data-testid=\{`context-empty-/,
    'BackyardGuard must render an in-place context-empty surface');
});

test('App.jsx threads surface prop into BackyardGuard mounts', () => {
  const src = readFileSync('src/App.jsx', 'utf8');
  assert.match(src, /<BackyardGuard surface="sell">/,
    '/sell route must pass surface="sell"');
  assert.match(src, /<BackyardGuard surface="funding">/,
    '/opportunities route must pass surface="funding"');
});

test('Switching active garden flips the legacy active-farm pointer (\u00a77)', () => {
  reset();
  // Set up: one garden, one farm, farm currently active.
  const garden = addGarden({
    name: 'Garden', crop: 'tomato',
    country: 'US', farmSize: 100, sizeUnit: 'sqft',
  });
  const farm = addFarm({
    name: 'Farm', crop: 'maize',
    country: 'GH', farmSize: 5, sizeUnit: 'acres',
  });
  // After both adds, addFarm pinned the farm.
  assert.equal(getActiveFarmId(), farm.id);

  // Switching to garden via setActiveGardenId must propagate to
  // the legacy active-farm pointer so useProfile.currentFarmId
  // (which the Tasks page + dashboard read) flips with the
  // context switch.
  const ok = setActiveGardenId(garden.id);
  assert.equal(ok, true);
  assert.equal(getActiveFarmId(), garden.id,
    'legacy activeFarmId must follow setActiveGardenId so Tasks/Home re-fetch');
});

test('Decision engine produces a garden plan vs a farm plan (\u00a73 + \u00a74)', () => {
  // Garden: setup-driven, plant vocabulary.
  const gardenPlan = generateDailyPlan({
    type:        'garden',
    setup:       'container',
    cropOrPlant: 'tomato',
  });
  assert.ok(gardenPlan.priority);
  assert.ok(/plant|pot|soil/i.test(gardenPlan.priority + ' ' + gardenPlan.tasks.join(' ')),
    `garden plan should mention plant/pot/soil: ${gardenPlan.priority}`);

  // Farm: size-driven, crop vocabulary.
  const farmPlan = generateDailyPlan({
    type:          'farm',
    autoFarmClass: 'small_farm',
    cropOrPlant:   'maize',
  });
  assert.ok(farmPlan.priority);
  assert.ok(/crop|field|leaves|leaf/i.test(farmPlan.priority + ' ' + farmPlan.tasks.join(' ')),
    `farm plan should mention crop/field/leaves: ${farmPlan.priority}`);

  // The two plans must NOT be identical \u2014 context drives content.
  assert.notEqual(gardenPlan.priority, farmPlan.priority);
});

test('Switching context: snapshot reflects new context immediately (\u00a77)', () => {
  reset();
  addGarden({
    name: 'Garden', crop: 'tomato',
    country: 'US', farmSize: 100, sizeUnit: 'sqft',
  });
  addFarm({
    name: 'Farm', crop: 'maize',
    country: 'GH', farmSize: 5, sizeUnit: 'acres',
  });

  // Pin farm \u2192 verify
  switchExperience(EXPERIENCE.FARM);
  let snap = getExperienceSnapshot();
  assert.equal(snap.activeContextType, 'farm');

  // Flip to garden \u2192 verify
  switchExperience(EXPERIENCE.GARDEN);
  snap = getExperienceSnapshot();
  assert.equal(snap.activeContextType, 'garden');
  assert.equal(snap.activeEntity?.type, 'garden');

  // Flip back \u2014 must be symmetric.
  switchExperience(EXPERIENCE.FARM);
  snap = getExperienceSnapshot();
  assert.equal(snap.activeContextType, 'farm');
  assert.equal(snap.activeEntity?.type, 'farm');
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
console.log(`Verdict: ${fail === 0 ? 'CONTEXT-DRIVEN' : 'NEED FIXES'}`);
console.log(`${pass} passed, ${fail} failed, ${cases.length} total.`);
if (fail > 0) process.exitCode = 1;
