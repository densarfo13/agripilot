#!/usr/bin/env node
/**
 * verify-data-model.mjs — one-shot acceptance harness for the
 * "Fix Farroway Data Model Properly" spec.
 *
 *   node scripts/verify-data-model.mjs
 *
 * Walks through every "Acceptance test" line from §9 of the spec
 * and asserts the new core modules behave as required. No
 * mocha/vitest dependency — uses node:assert/strict so any CI
 * runner can invoke it.
 *
 * Exit codes:
 *   0  — all assertions passed (DATA MODEL STABLE)
 *   1  — at least one assertion failed (NEED FIXES)
 */

import assert from 'node:assert/strict';

import {
  convertToAcres, convertToSqFt, normalizeSizeInput, SQFT_PER_ACRE,
} from '../src/core/unitUtils.js';
import {
  classifyGrowingContext, autoFarmClassToEngineKey,
} from '../src/core/farmClassifier.js';
import {
  validateGrowingContext,
} from '../src/core/contextValidation.js';
import { generateDailyPlan } from '../src/core/dailyPlanEngine.js';
import { formatFarmSize } from '../src/utils/formatDisplay.js';

const cases = [];
function test(name, fn) {
  cases.push({ name, fn });
}

// ── §9 acceptance ────────────────────────────────────────────────

test('4,356,000 sq ft converts to ~100 acres', () => {
  const acres = convertToAcres(4_356_000, 'sqft');
  // Allow ±0.0005 acre slack — the conversion uses the exact
  // m² factor; 4,356,000 sqft → 100 acres exactly.
  assert.ok(Math.abs(acres - 100) < 0.001,
    `expected ~100, got ${acres}`);
  // Cross-check: 100 acres → 4,356,000 sq ft
  assert.equal(convertToSqFt(100, 'acres'), 4_356_000);
  // Constant matches spec §1
  assert.equal(SQFT_PER_ACRE, 43_560);
});

test('100 acres becomes large_farm', () => {
  const cls = classifyGrowingContext({
    activeExperience: 'farm',
    sizeInAcres:      100,
  });
  assert.equal(cls, 'large_farm');
});

test('farm flow no longer shows Backyard / Home as farm type', () => {
  // A farm-experience save with farmType='backyard' should
  // auto-correct: validation reports the autoFarmClass.
  const v = validateGrowingContext({
    activeExperience: 'farm',
    exactSize:        100,
    unit:             'acres',
    farmType:         'backyard',
  });
  assert.ok(v.ok, 'validation should pass on a 100-acre farm');
  // 100 acres + farm experience + backyard → must auto-correct
  // to large_farm; backyard MUST NOT survive into the patch.
  assert.equal(v.autoCorrect.farmType, 'large_farm');
  assert.equal(v.autoFarmClass,        'large_farm');
});

test('invalid size <= 0 blocks save', () => {
  const v = validateGrowingContext({
    activeExperience: 'farm',
    exactSize:        0,
    unit:             'acres',
  });
  assert.equal(v.ok, false);
  assert.ok(v.blocking.some((b) => b.code === 'NON_POSITIVE'),
    'expected NON_POSITIVE blocking code');
});

test('NaN blocks save', () => {
  const v = validateGrowingContext({
    activeExperience: 'farm',
    exactSize:        Number('not a number'),  // NaN
    unit:             'acres',
  });
  assert.equal(v.ok, false);
  assert.ok(v.blocking.some((b) => b.code === 'NAN'),
    'expected NAN blocking code');
});

test('huge sq ft shows warning (LARGE_SQFT_LIKELY_ACRES)', () => {
  const v = validateGrowingContext({
    activeExperience: 'farm',
    exactSize:        4_356_000,
    unit:             'sqft',
  });
  assert.ok(v.ok, 'a huge sqft value should NOT block, only warn');
  assert.ok(v.warnings.some((w) => w.code === 'LARGE_SQFT_LIKELY_ACRES'),
    'expected LARGE_SQFT_LIKELY_ACRES warning');
});

test('review displays clean size', () => {
  // Acres path
  assert.equal(formatFarmSize({ exactSize: 100, unit: 'acres' }), '100 acres');
  // Sqft path with acres preview
  const big = formatFarmSize({
    exactSize:   4_356_000,
    unit:        'sqft',
    sizeInAcres: 100,
  });
  assert.ok(big.startsWith('4,356,000 sq ft'),
    `expected leading "4,356,000 sq ft", got "${big}"`);
  assert.ok(/\u2248100 acres/.test(big),
    `expected "≈100 acres" preview, got "${big}"`);
  // Bucket-only path
  assert.equal(formatFarmSize({ sizeCategory: 'small' }),  'Small farm');
  assert.equal(formatFarmSize({ sizeCategory: 'medium' }), 'Medium farm');
  assert.equal(formatFarmSize({ sizeCategory: 'large' }),  'Large farm');
  // Empty path
  assert.equal(formatFarmSize({}), 'Not specified');
});

test('decision engine receives autoFarmClass', () => {
  // Same crop, same weather — only the class changes. The plan
  // priority text must shift between small / medium / large.
  const small = generateDailyPlan({
    type:          'farm',
    autoFarmClass: 'small_farm',
    cropOrPlant:   'maize',
  });
  const large = generateDailyPlan({
    type:          'farm',
    autoFarmClass: 'large_farm',
    cropOrPlant:   'maize',
  });
  assert.notEqual(small.priority, large.priority,
    'autoFarmClass must change the engine priority');
  // Small + medium + large all return at least one task.
  assert.ok(Array.isArray(small.tasks) && small.tasks.length > 0);
  assert.ok(Array.isArray(large.tasks) && large.tasks.length > 0);
  // Engine key adapter sanity-check
  assert.equal(autoFarmClassToEngineKey('small_farm'),  'small');
  assert.equal(autoFarmClassToEngineKey('medium_farm'), 'medium');
  assert.equal(autoFarmClassToEngineKey('large_farm'),  'large');
  assert.equal(autoFarmClassToEngineKey('unknown_farm'),'unknown');
  assert.equal(autoFarmClassToEngineKey('garden'),      'unknown');
});

test('app does not crash if size missing (safety fallback)', () => {
  // No size at all — engine still returns a valid plan.
  const plan = generateDailyPlan({
    type: 'farm',
    cropOrPlant: 'maize',
  });
  assert.ok(plan && typeof plan === 'object');
  assert.equal(typeof plan.priority, 'string');
  assert.ok(plan.priority.length > 0);
  assert.ok(Array.isArray(plan.tasks));
  // Validation also returns ok=true with autoFarmClass=unknown_farm
  // when size is omitted.
  const v = validateGrowingContext({
    activeExperience: 'farm',
  });
  assert.equal(v.ok, true);
  assert.equal(v.autoFarmClass, 'unknown_farm');
});

test('garden and farm data do not mix', () => {
  // Garden classifier never returns a farm class.
  assert.equal(classifyGrowingContext({
    activeExperience: 'garden',
    sizeInAcres:      100,  // huge garden — still 'garden'
  }), 'garden');
  // Farm classifier never returns 'garden'.
  const farmCls = classifyGrowingContext({
    activeExperience: 'farm',
    sizeInAcres:      0.1,
  });
  assert.notEqual(farmCls, 'garden');
  // Garden warning fires when size suggests a farm.
  const v = validateGrowingContext({
    activeExperience: 'garden',
    exactSize:        2,
    unit:             'acres',
  });
  assert.ok(v.warnings.some((w) => w.code === 'LARGE_FOR_GARDEN'),
    'expected LARGE_FOR_GARDEN warning on a 2-acre garden');
});

// ── Driver ───────────────────────────────────────────────────────
let pass = 0;
let fail = 0;
const failures = [];
for (const c of cases) {
  try {
    c.fn();
    pass++;
    console.log(`\u2713 ${c.name}`);
  } catch (err) {
    fail++;
    failures.push({ name: c.name, err });
    console.error(`\u2717 ${c.name}\n   ${err && err.message ? err.message : err}`);
  }
}

console.log('');
console.log(`Verdict: ${fail === 0 ? 'DATA MODEL STABLE' : 'NEED FIXES'}`);
console.log(`${pass} passed, ${fail} failed, ${cases.length} total.`);
if (fail > 0) {
  process.exitCode = 1;
}
