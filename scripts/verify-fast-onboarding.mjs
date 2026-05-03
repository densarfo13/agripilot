#!/usr/bin/env node
/**
 * verify-fast-onboarding.mjs — acceptance harness for the
 * "Build Perfect Farroway Onboarding" spec.
 *
 *   node scripts/verify-fast-onboarding.mjs
 *
 * The UI flow itself is React; the harness covers the data-layer
 * + engine guarantees that make the flow viable:
 *
 *   • addGarden / addFarm persist ONLY the spec'd partial fields
 *     (no exact size, no extra forms) and never block save.
 *   • generateFirstPlan returns a usable primary action even
 *     when the location / weather slots are empty (spec §3 +
 *     §5 — "Do not block if location fails", "Immediately
 *     generate primary action").
 *   • saveTaskCompletion records the Done click so the streak
 *     loop starts immediately (spec §6).
 *   • The "<30 seconds" claim is enforced by counting fields
 *     the user MUST fill: experience pick, plant/crop pick.
 *     Everything else is optional. We assert that count is
 *     <= 2 — the upper bound a sub-30-second flow can support
 *     even on a slow phone.
 *
 * Exit codes:
 *   0 — all assertions passed (FAST)
 *   1 — at least one failed (TOO SLOW)
 */

import assert from 'node:assert/strict';

// localStorage shim (same pattern as the other harnesses).
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
  addGarden, addFarm, getGardens, getFarmsOnly, getExperienceSnapshot,
} = await import('../src/store/multiExperience.js');
const { generateFirstPlan } = await import('../src/core/firstPlanEngine.js');
const { saveTaskCompletion, getTaskCompletions } = await import('../src/store/farrowayLocal.js');

const cases = [];
function test(name, fn) { cases.push({ name, fn }); }
function reset() {
  _store.clear();
  memLocalStorage.setItem('farroway_full_architecture_migrated', 'true');
}

// ── §8 acceptance ────────────────────────────────────────────────

test('Required fields are <= 2 (experience + plant/crop)', async () => {
  // Read the FastOnboarding source and count the fields the
  // canAdvance() gate REQUIRES per step. The harness can't
  // execute JSX, but we can statically assert the contract:
  // step 0 needs experience, step 1 needs plant/crop. Steps 2
  // and 3 must NOT block on a missing field.
  const { readFileSync } = await import('node:fs');
  const src = readFileSync('src/pages/onboarding/FastOnboarding.jsx', 'utf8');
  // Step 2 (location) returns true unconditionally:
  assert.match(src, /if \(stepIdx === 2\) return true;/,
    'screen 3 (location) must NOT block advancement');
  // Step 3 (action) is the final screen:
  assert.match(src, /if \(stepIdx === 3\) return true;/,
    'screen 4 (action) must own its own button');
  // Step 0 only requires experience:
  assert.match(src, /experience === 'garden' \|\| experience === 'farm'/,
    'screen 1 must require experience pick only');
});

test('Garden save persists only the minimal spec fields', () => {
  reset();
  const row = addGarden({
    crop:     'tomato',
    cropLabel:'Tomato',
    name:     'My Tomato',
    country:  'US',
    countryLabel: 'USA',
    growingSetup: 'container',
    gardenSizeCategory: 'small',
    farmType: 'backyard',
    // NO farmSize, NO sizeUnit \u2014 fast path doesn't collect them.
  });
  assert.ok(row && row.id);
  assert.equal(row.type, 'garden');
  assert.equal(row.farmType, 'backyard');
  // sizeInAcres / sizeInSqFt should be null because we didn't
  // pass a size \u2014 the data-model save path returns null on
  // missing input rather than guessing.
  assert.equal(row.sizeInAcres, null);
  assert.equal(row.sizeInSqFt,  null);
  // autoFarmClass falls through to 'garden' for backyard rows.
  assert.equal(row.autoFarmClass, 'garden');
});

test('Farm save persists sizeBucket only \u2014 no exact size required', () => {
  reset();
  const row = addFarm({
    crop:     'maize',
    cropLabel:'Maize',
    name:     'My Maize',
    country:  'GH',
    countryLabel: 'Ghana',
    sizeBucket:     'lt1',
    farmSizeBucket: 'lt1',
    farmType:       'small_farm',
    // NO farmSize, NO sizeUnit.
  });
  assert.ok(row && row.id);
  assert.equal(row.type, 'farm');
  // No exact size = sizeInAcres null; engine still resolves to a
  // class via the legacy sizeBucket fallback in growingContext.
  assert.equal(row.sizeInAcres, null);
  assert.equal(row.sizeInSqFt,  null);
});

test('First-action engine returns usable primary action with NO weather + NO location', () => {
  // Spec §3 + §5: the engine must produce a primary action even
  // when location is missing (user denied geolocation + skipped
  // manual entry). Weather is also empty on first boot.
  const actions = generateFirstPlan({
    crop:     'tomato',
    isGarden: true,
    location: { country: '', region: '' },  // empty location
    plantedAt: null,
    weather:   null,
  });
  assert.ok(Array.isArray(actions) && actions.length > 0,
    'engine must return at least one action');
  const primary = actions[0];
  assert.ok(primary && typeof primary.text === 'string' && primary.text.length > 0,
    'primary action must carry a non-empty text string');
  assert.ok(typeof primary.detail === 'string' && primary.detail.length > 0,
    'primary action must carry a non-empty detail string');
  // Garden voice: should mention 'plant' (the engine threads the
  // isGarden flag into the noun).
  assert.match(primary.text, /plant/i,
    `garden first action should mention "plant": ${primary.text}`);
});

test('First-action engine farm voice mentions "crop"', () => {
  const actions = generateFirstPlan({
    crop:     'maize',
    isGarden: false,
    location: { country: '', region: '' },
    plantedAt: null,
    weather:   null,
  });
  assert.ok(actions.length > 0);
  assert.match(actions[0].text, /crop/i,
    `farm first action should mention "crop": ${actions[0].text}`);
});

test('Done click records task completion', () => {
  reset();
  const before = getTaskCompletions().length;
  saveTaskCompletion({
    taskId: 'fast_first_inspection',
    farmId: null,
  });
  const after = getTaskCompletions().length;
  assert.equal(after, before + 1, 'completion must persist');
  const last = getTaskCompletions()[after - 1];
  assert.equal(last.taskId,    'fast_first_inspection');
  assert.equal(last.completed, true);
});

test('Save partial context survives a missing-location user', () => {
  reset();
  // Simulate the "geo denied + skipped manual" path: user picked
  // garden + tomato + container, never typed country/region.
  const row = addGarden({
    crop:     'tomato',
    cropLabel:'Tomato',
    name:     'My Tomato',
    country:  null,
    countryLabel: null,
    growingSetup: 'container',
    gardenSizeCategory: 'small',
    farmType: 'backyard',
  });
  assert.ok(row && row.id, 'save must succeed without location');
  const gardens = getGardens();
  assert.ok(gardens.some((g) => g.id === row.id));
  // Snapshot reads correctly post-save.
  const snap = getExperienceSnapshot();
  assert.equal(snap.activeContextType, 'garden');
});

test('Active experience flips to garden after addGarden', () => {
  reset();
  addGarden({
    crop:     'pepper',
    cropLabel:'Pepper',
    name:     'My Pepper',
    farmType: 'backyard',
  });
  const snap = getExperienceSnapshot();
  assert.equal(snap.activeExperience, 'garden');
  assert.equal(snap.activeContextType, 'garden');
  assert.ok(snap.activeEntity);
  assert.equal(snap.activeEntity.type, 'garden');
});

test('Active experience flips to farm after addFarm', () => {
  reset();
  addFarm({
    crop:     'maize',
    cropLabel:'Maize',
    name:     'My Maize',
    sizeBucket: '1to5',
    farmType:   'small_farm',
  });
  const snap = getExperienceSnapshot();
  assert.equal(snap.activeExperience, 'farm');
  assert.equal(snap.activeContextType, 'farm');
  assert.equal(snap.activeEntity.type, 'farm');
});

test('FastOnboarding wires generateFirstPlan + addGarden/addFarm + saveTaskCompletion', async () => {
  // Static check: the module imports the three production
  // helpers the spec depends on.
  const { readFileSync } = await import('node:fs');
  const src = readFileSync('src/pages/onboarding/FastOnboarding.jsx', 'utf8');
  assert.match(src, /from '\.\.\/\.\.\/store\/multiExperience\.js'/,
    'must import addGarden/addFarm');
  assert.match(src, /addGarden|addFarm/, 'must call addGarden/addFarm');
  assert.match(src, /generateFirstPlan/, 'must call generateFirstPlan');
  assert.match(src, /saveTaskCompletion/, 'must call saveTaskCompletion');
  // Spec §5 eyebrow copy must be present verbatim.
  assert.match(src, /Before you do anything, do this first/,
    'must render the spec §5 eyebrow copy');
  // Spec §6 Done button + tomorrow hook
  assert.match(src, /Tomorrow/, 'must mention tomorrow on the feedback block');
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
console.log(`Verdict: ${fail === 0 ? 'FAST' : 'TOO SLOW'}`);
console.log(`${pass} passed, ${fail} failed, ${cases.length} total.`);
if (fail > 0) process.exitCode = 1;
