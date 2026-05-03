#!/usr/bin/env node
/**
 * verify-farm-garden-ux.mjs — acceptance harness for the
 * "Design Farm vs Garden UX Properly" spec.
 *
 *   node scripts/verify-farm-garden-ux.mjs
 *
 * Tests the data-layer assertions (storage classification +
 * migration + decision-engine context) directly via Node — the
 * UI changes (My Grow tabs, Home dropdown) are smoke-verified
 * via Vite build + manual visual.
 *
 * Exit codes:
 *   0  — all assertions passed (READY FOR USER TESTING)
 *   1  — at least one assertion failed (NEED FIXES)
 */

import assert from 'node:assert/strict';

// localStorage shim (same as verify-garden-visibility.mjs).
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
globalThis.CustomEvent = class {
  constructor(name, opts) { this.type = name; this.detail = opts?.detail; }
};

const {
  addGarden, addFarm, switchExperience, EXPERIENCE,
  getGardens, getFarmsOnly, getExperienceSnapshot,
  isGarden, isFarm,
} = await import('../src/store/multiExperience.js');
const { migrateFarmGardenSplit, _shouldBeGarden }
  = await import('../src/store/migrateFarmGardenSplit.js');
const { generateDailyPlan } = await import('../src/core/dailyPlanEngine.js');

const cases = [];
function test(name, fn) { cases.push({ name, fn }); }

function reset() {
  _store.clear();
  memLocalStorage.setItem('farroway_full_architecture_migrated', 'true');
}

// ── §9 acceptance ────────────────────────────────────────────────

test('Backyard garden appears under Gardens', () => {
  reset();
  const row = addGarden({
    name: 'Pepper garden', crop: 'pepper',
    country: 'US', farmSize: 100, sizeUnit: 'sqft',
  });
  assert.ok(row && row.id);
  assert.equal(row.type, 'garden',
    'addGarden must stamp type="garden"');
  assert.equal(row.farmType, 'backyard');
  const gardens = getGardens();
  assert.ok(gardens.some((g) => g.id === row.id));
});

test('Farm appears under Farms', () => {
  reset();
  const row = addFarm({
    name: 'Maize farm', crop: 'maize',
    country: 'GH', farmSize: 5, sizeUnit: 'acres',
  });
  assert.ok(row && row.id);
  assert.equal(row.type, 'farm',
    'addFarm must stamp type="farm"');
  assert.notEqual(row.farmType, 'backyard');
  const farms = getFarmsOnly();
  assert.ok(farms.some((f) => f.id === row.id));
});

test('My Grow switcher works (snapshot exposes both partitions)', () => {
  reset();
  addGarden({
    name: 'Garden', crop: 'tomato',
    country: 'US', farmSize: 100, sizeUnit: 'sqft',
  });
  addFarm({
    name: 'Farm', crop: 'maize',
    country: 'GH', farmSize: 5, sizeUnit: 'acres',
  });
  const snap = getExperienceSnapshot();
  assert.equal(snap.hasGarden, true);
  assert.equal(snap.hasFarm,   true);
  assert.equal(snap.hasBoth,   true);
  assert.ok(Array.isArray(snap.farms)   && snap.farms.length   >= 1);
  assert.ok(Array.isArray(snap.gardens) && snap.gardens.length >= 1);
});

test('Home context switcher works (switching flips active context)', () => {
  reset();
  addGarden({
    name: 'Garden', crop: 'tomato',
    country: 'US', farmSize: 100, sizeUnit: 'sqft',
  });
  addFarm({
    name: 'Farm', crop: 'maize',
    country: 'GH', farmSize: 5, sizeUnit: 'acres',
  });
  // After both adds, addFarm pinned the farm as active.
  let snap = getExperienceSnapshot();
  assert.equal(snap.activeExperience,  EXPERIENCE.FARM);
  assert.equal(snap.activeContextType, 'farm');
  // Flip to garden
  switchExperience(EXPERIENCE.GARDEN);
  snap = getExperienceSnapshot();
  assert.equal(snap.activeExperience,  EXPERIENCE.GARDEN);
  assert.equal(snap.activeContextType, 'garden');
  // Active entity is the garden row
  assert.ok(snap.activeEntity);
  assert.equal(snap.activeEntity.type, 'garden');
});

test('Active garden shows plant wording (engine renders garden plan)', () => {
  reset();
  const garden = addGarden({
    name: 'Pepper garden', crop: 'pepper',
    country: 'US', farmSize: 50, sizeUnit: 'sqft',
    growingSetup: 'container',
  });
  assert.ok(garden && garden.type === 'garden');
  const plan = generateDailyPlan({
    type:        'garden',
    setup:       'container',
    cropOrPlant: 'pepper',
  });
  // Garden vocabulary — engine talks about plants/pots, not fields.
  assert.ok(/plant|pot|soil/i.test(plan.priority + ' ' + plan.tasks.join(' ')),
    'garden plan should mention plant/pot/soil');
  assert.ok(!/field/i.test(plan.priority),
    `garden plan must not say "field": ${plan.priority}`);
});

test('Active farm shows crop wording (engine renders farm plan)', () => {
  reset();
  const farm = addFarm({
    name: 'Maize farm', crop: 'maize',
    country: 'GH', farmSize: 5, sizeUnit: 'acres',
  });
  assert.ok(farm && farm.type === 'farm');
  const plan = generateDailyPlan({
    type:          'farm',
    autoFarmClass: 'small_farm',
    cropOrPlant:   'maize',
  });
  // Farm vocabulary — talks about crop/field/leaves, not pots.
  assert.ok(/crop|field|leaves|leaf/i.test(plan.priority + ' ' + plan.tasks.join(' ')),
    'farm plan should mention crop/field/leaves');
});

test('Scan uses correct active context (activeContextType drives type)', () => {
  reset();
  addGarden({
    name: 'Garden', crop: 'tomato',
    country: 'US', farmSize: 100, sizeUnit: 'sqft',
    growingSetup: 'raised_bed',
  });
  // Pin garden as active.
  let snap = getExperienceSnapshot();
  assert.equal(snap.activeContextType, 'garden');
  // Engine called with the snapshot's activeEntity should produce
  // a garden plan because the row's `type` is 'garden'.
  const plan = generateDailyPlan({
    type:        snap.activeContextType,
    setup:       snap.activeEntity?.growingSetup,
    cropOrPlant: snap.activeEntity?.crop,
  });
  assert.ok(plan && plan.priority);
  assert.ok(!/field/i.test(plan.priority),
    `scan/engine context ${plan.priority} should be garden-shaped`);
});

test('No garden is listed under Manage Farms (getFarmsOnly excludes type=garden)', () => {
  reset();
  const garden = addGarden({
    name: 'Garden', crop: 'tomato',
    country: 'US', farmSize: 100, sizeUnit: 'sqft',
  });
  const farm = addFarm({
    name: 'Farm', crop: 'maize',
    country: 'GH', farmSize: 5, sizeUnit: 'acres',
  });
  const farms = getFarmsOnly();
  assert.ok(!farms.some((f) => f.id === garden.id),
    'garden must NOT appear in getFarmsOnly()');
  assert.ok(farms.some((f) => f.id === farm.id));
  assert.ok(isGarden(garden));
  assert.ok(!isFarm(garden));
});

test('No farm is listed under Manage Gardens (getGardens excludes type=farm)', () => {
  reset();
  const garden = addGarden({
    name: 'Garden', crop: 'tomato',
    country: 'US', farmSize: 100, sizeUnit: 'sqft',
  });
  const farm = addFarm({
    name: 'Farm', crop: 'maize',
    country: 'GH', farmSize: 5, sizeUnit: 'acres',
  });
  const gardens = getGardens();
  assert.ok(!gardens.some((g) => g.id === farm.id),
    'farm must NOT appear in getGardens()');
  assert.ok(gardens.some((g) => g.id === garden.id));
  assert.ok(isFarm(farm));
  assert.ok(!isGarden(farm));
});

// ── §8 migration coverage ────────────────────────────────────────

test('§8 migration: legacy backyard-name farm reclassifies to garden', () => {
  reset();
  // Manually plant a legacy row that's tagged as 'small_farm'
  // (not backyard) but has 'home' in the name + sub-acre size.
  const legacy = {
    id: 'legacy_1',
    name: 'My home garden',
    farmType: 'small_farm',
    farmSize: 0.5,
    sizeUnit: 'acres',
    sizeInAcres: 0.5,
    crop: 'tomato',
    createdAt: Date.now(),
  };
  memLocalStorage.setItem('farroway.farms', JSON.stringify([legacy]));
  // Sentinel must NOT be set so the migration runs.
  memLocalStorage.removeItem('farroway_farm_garden_split_v1');

  // Predicate sanity-check.
  assert.equal(_shouldBeGarden(legacy), true);

  const summary = migrateFarmGardenSplit();
  assert.equal(summary.migrated, true, 'migration should run');
  assert.equal(summary.reclassified, 1, 'should reclassify exactly 1 row');

  const after = JSON.parse(memLocalStorage.getItem('farroway.farms'));
  assert.equal(after[0].farmType,      'backyard');
  assert.equal(after[0].type,          'garden');
  assert.equal(after[0].autoFarmClass, 'garden');
});

test('§8 migration: idempotent — second run is a no-op', () => {
  // First run already set the sentinel.
  const r2 = migrateFarmGardenSplit();
  assert.equal(r2.migrated,     false, 'second call must be a no-op');
  assert.equal(r2.reclassified, 0);
});

test('§8 migration: existing farm row stays as farm + gets type field', () => {
  reset();
  const legacy = {
    id: 'legacy_2',
    name: 'Maize plantation',
    farmType: 'commercial',
    farmSize: 100,
    sizeUnit: 'acres',
    sizeInAcres: 100,
    crop: 'maize',
    createdAt: Date.now(),
  };
  memLocalStorage.setItem('farroway.farms', JSON.stringify([legacy]));
  memLocalStorage.removeItem('farroway_farm_garden_split_v1');

  assert.equal(_shouldBeGarden(legacy), false);

  const summary = migrateFarmGardenSplit();
  assert.equal(summary.scanned, 1);
  // No reclassification, but type field gets stamped.
  const after = JSON.parse(memLocalStorage.getItem('farroway.farms'));
  assert.equal(after[0].farmType, 'commercial');
  assert.equal(after[0].type,     'farm');
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
