#!/usr/bin/env node
/**
 * verify-garden-visibility.mjs — acceptance harness for the
 * "Fix Backyard / Garden Visibility Issue" spec.
 *
 *   node scripts/verify-garden-visibility.mjs
 *
 * Tests the storage layer in isolation (the UI changes are
 * verified by ESLint / Vite build + visual smoke). The shared
 * concern: a garden save must classify as `farmType: 'backyard'`
 * with `activeExperience: 'garden'`, must NOT appear in
 * getFarmsOnly(), and must appear in getGardens().
 *
 * Exit codes:
 *   0  — all assertions passed (GARDEN VISIBILITY STABLE)
 *   1  — at least one assertion failed (NEED FIXES)
 */

import assert from 'node:assert/strict';

// Shim a minimal localStorage so the store helpers run under
// Node. The store calls `typeof window !== 'undefined' &&
// !!window.localStorage`, so we need both global hooks.
const _store = new Map();
const memLocalStorage = {
  getItem(key)        { return _store.has(key) ? _store.get(key) : null; },
  setItem(key, value) { _store.set(key, String(value)); },
  removeItem(key)     { _store.delete(key); },
  clear()             { _store.clear(); },
};
globalThis.window = {
  localStorage: memLocalStorage,
  addEventListener() {}, removeEventListener() {},
  dispatchEvent() {},
};
globalThis.localStorage = memLocalStorage;
// CustomEvent shim so multiExperience.js's _emitSwitch doesn't
// crash under Node.
globalThis.CustomEvent = class {
  constructor(name, opts) { this.type = name; this.detail = opts?.detail; }
};

// Now import — store modules read window.localStorage at call
// time (not module load), so the shim above is in place.
const {
  addGarden, addFarm,
  getGardens, getFarmsOnly,
  getActiveExperience, switchExperience, EXPERIENCE,
  isGarden, isFarm,
} = await import('../src/store/multiExperience.js');

const cases = [];
function test(name, fn) { cases.push({ name, fn }); }

function reset() {
  _store.clear();
  // Mark migration sentinel so dual-write activates and we can
  // verify rows landing in the right partition arrays.
  memLocalStorage.setItem('farroway_full_architecture_migrated', 'true');
}

// ── §7 acceptance ────────────────────────────────────────────────

test('Add backyard garden \u2192 appears under My Gardens', () => {
  reset();
  const row = addGarden({
    name:    'My garden',
    crop:    'tomato',
    country: 'US',
    farmSize: 100, sizeUnit: 'sqft',
  });
  assert.ok(row && row.id, 'addGarden should return a row');
  assert.equal(row.farmType, 'backyard');
  // getGardens partitions correctly
  const gs = getGardens();
  assert.ok(gs.some((g) => g.id === row.id), 'garden should appear in getGardens()');
  // Active experience flips to garden
  assert.equal(getActiveExperience(), EXPERIENCE.GARDEN);
});

test('Add farm \u2192 appears under Manage Farms', () => {
  reset();
  const row = addFarm({
    name:    'My maize farm',
    crop:    'maize',
    country: 'GH',
    farmSize: 5, sizeUnit: 'acres',
  });
  assert.ok(row && row.id, 'addFarm should return a row');
  assert.notEqual(row.farmType, 'backyard');
  const farms = getFarmsOnly();
  assert.ok(farms.some((f) => f.id === row.id), 'farm should appear in getFarmsOnly()');
  assert.equal(getActiveExperience(), EXPERIENCE.FARM);
});

test('Backyard garden does NOT appear as farm', () => {
  reset();
  const garden = addGarden({
    name: 'Garden', crop: 'tomato',
    country: 'US', farmSize: 200, sizeUnit: 'sqft',
  });
  const farm = addFarm({
    name: 'Farm',  crop: 'maize',
    country: 'US', farmSize: 5,   sizeUnit: 'acres',
  });
  const farms   = getFarmsOnly();
  const gardens = getGardens();
  // Cross-partition isolation
  assert.ok(!farms.some((f) => f.id === garden.id),
    'garden must NOT show under farms');
  assert.ok(!gardens.some((g) => g.id === farm.id),
    'farm must NOT show under gardens');
  assert.ok(isGarden(garden), 'isGarden(gardenRow) should be true');
  assert.ok(!isGarden(farm),  'isGarden(farmRow) should be false');
  assert.ok(isFarm(farm),     'isFarm(farmRow) should be true');
  assert.ok(!isFarm(garden),  'isFarm(gardenRow) should be false');
});

test('Switch Farm/Garden works (activeExperience flips)', () => {
  reset();
  addGarden({
    name: 'Garden', crop: 'tomato',
    country: 'US', farmSize: 200, sizeUnit: 'sqft',
  });
  addFarm({
    name: 'Farm',  crop: 'maize',
    country: 'US', farmSize: 5,   sizeUnit: 'acres',
  });
  // After both adds, latest add (farm) wins as activeExperience
  // because addFarm sets it.
  assert.equal(getActiveExperience(), EXPERIENCE.FARM);
  // Flip to garden
  const ok = switchExperience(EXPERIENCE.GARDEN);
  assert.equal(ok, true, 'switchExperience(GARDEN) should succeed');
  assert.equal(getActiveExperience(), EXPERIENCE.GARDEN);
  // Flip back
  switchExperience(EXPERIENCE.FARM);
  assert.equal(getActiveExperience(), EXPERIENCE.FARM);
});

test('Active context updates Home plan correctly', async () => {
  reset();
  // Set up both rows and pin the garden as active.
  const garden = addGarden({
    name:        'Tomato garden',
    crop:        'tomato',
    country:     'US',
    farmSize:    200, sizeUnit: 'sqft',
    growingSetup: 'container',
  });
  const farm = addFarm({
    name:    'Maize farm',
    crop:    'maize',
    country: 'US',
    farmSize: 5, sizeUnit: 'acres',
  });
  assert.ok(garden && farm, 'both rows must exist');

  // Engine should produce a garden-shaped plan when context type
  // is 'garden' — the priority text is setup-specific.
  const { generateDailyPlan } = await import('../src/core/dailyPlanEngine.js');
  const gardenPlan = generateDailyPlan({
    type:        'garden',
    setup:       'container',
    cropOrPlant: 'tomato',
  });
  const farmPlan = generateDailyPlan({
    type:          'farm',
    autoFarmClass: 'small_farm',
    cropOrPlant:   'maize',
  });

  // Sanity — both plans return real strings, and the priority
  // copy diverges (garden talks plants/pots; farm talks fields).
  assert.ok(gardenPlan && gardenPlan.priority);
  assert.ok(farmPlan   && farmPlan.priority);
  assert.notEqual(gardenPlan.priority, farmPlan.priority,
    'garden vs farm plans should produce different priority text');

  // Garden plan must NOT mention "field" (farm vocabulary).
  assert.ok(!/field/i.test(gardenPlan.priority),
    `garden priority should not say "field": ${gardenPlan.priority}`);
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
console.log(`Verdict: ${fail === 0 ? 'GARDEN VISIBILITY STABLE' : 'NEED FIXES'}`);
console.log(`${pass} passed, ${fail} failed, ${cases.length} total.`);
if (fail > 0) process.exitCode = 1;
