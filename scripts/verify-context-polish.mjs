#!/usr/bin/env node
/**
 * verify-context-polish.mjs — acceptance harness for the
 * "Polish Farm vs Garden Experience" spec.
 *
 *   node scripts/verify-context-polish.mjs
 *
 * Tests both the contextWords helper (vocab + icons + copy) and
 * the engine output (no vocabulary mixing) — the §8 acceptance
 * criteria. UI rendering is verified by Vite build + the
 * existing test suites; this harness owns the wording contract.
 *
 * Exit codes:
 *   0 — all assertions passed (POLISHED)
 *   1 — at least one failed (NEED FIXES)
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const {
  getContextWord, getContextLabel, getContextIcon,
  getContextEmptyState, getContextProgressLabel,
  _internal,
} = await import('../src/i18n/contextWords.js');
const { generateDailyPlan } = await import('../src/core/dailyPlanEngine.js');

const cases = [];
function test(name, fn) { cases.push({ name, fn }); }

// ── §1 context labeling ─────────────────────────────────────────

test('Garden label reads "\uD83C\uDF31 {Plant} Garden"', () => {
  assert.equal(getContextLabel({ type: 'garden', name: 'Tomato' }),
    '\uD83C\uDF31 Tomato Garden');
  assert.equal(getContextLabel({ type: 'garden', name: 'pepper' }),
    '\uD83C\uDF31 Pepper Garden');
  // Multi-word names get title-cased per word.
  assert.equal(getContextLabel({ type: 'garden', name: 'butter beans' }),
    '\uD83C\uDF31 Butter Beans Garden');
  // Missing name falls through to "My Garden".
  assert.equal(getContextLabel({ type: 'garden' }),
    '\uD83C\uDF31 My Garden');
});

test('Farm label reads "\uD83D\uDE9C {Crop} Farm"', () => {
  assert.equal(getContextLabel({ type: 'farm', name: 'Maize' }),
    '\uD83D\uDE9C Maize Farm');
  assert.equal(getContextLabel({ type: 'farm', name: 'cassava' }),
    '\uD83D\uDE9C Cassava Farm');
  assert.equal(getContextLabel({ type: 'farm' }),
    '\uD83D\uDE9C My Farm');
});

// ── §2 wording layer ────────────────────────────────────────────

test('Garden context uses plant vocabulary', () => {
  assert.equal(getContextWord('plant',    'garden'), 'plant');
  assert.equal(getContextWord('pot',      'garden'), 'pot');
  assert.equal(getContextWord('garden',   'garden'), 'garden');
  assert.equal(getContextWord('rows',     'garden'), 'pots');
  assert.equal(getContextWord('scouting', 'garden'), 'checking');
  assert.equal(getContextWord('field',    'garden'), 'pot');
});

test('Farm context uses crop vocabulary', () => {
  assert.equal(getContextWord('plant',    'farm'), 'crop');
  assert.equal(getContextWord('pot',      'farm'), 'row');
  assert.equal(getContextWord('garden',   'farm'), 'farm');
  assert.equal(getContextWord('rows',     'farm'), 'rows');
  assert.equal(getContextWord('scouting', 'farm'), 'scouting');
  assert.equal(getContextWord('field',    'farm'), 'field');
});

test('Shared vocabulary returns same word for both contexts', () => {
  assert.equal(getContextWord('soil',   'garden'), 'soil');
  assert.equal(getContextWord('soil',   'farm'),   'soil');
  assert.equal(getContextWord('water',  'garden'), 'water');
  assert.equal(getContextWord('water',  'farm'),   'water');
  assert.equal(getContextWord('leaves', 'garden'), 'leaves');
  assert.equal(getContextWord('leaves', 'farm'),   'leaves');
});

test('Unknown context collapses to safe farm fallback', () => {
  // Bad inputs shouldn't crash; fall back to farm vocabulary.
  assert.equal(getContextWord('plant', undefined),  'crop');
  assert.equal(getContextWord('plant', null),       'crop');
  assert.equal(getContextWord('plant', 'foo'),      'crop');
  assert.equal(getContextWord('plant', { type: 'unknown' }), 'crop');
});

test('Object-shaped context is resolved correctly', () => {
  // Pass a row-shaped object with a `type` field.
  assert.equal(getContextWord('plant', { type: 'garden' }), 'plant');
  assert.equal(getContextWord('plant', { type: 'farm'   }), 'crop');
  // Snapshot-shaped object with activeContextType.
  assert.equal(getContextWord('pot', { activeContextType: 'garden' }), 'pot');
  assert.equal(getContextWord('pot', { activeContextType: 'farm'   }), 'row');
});

// ── §5 progress labels ──────────────────────────────────────────

test('Garden progress label = "Plants checked today"', () => {
  assert.equal(getContextProgressLabel('garden'), 'Plants checked today');
});

test('Farm progress label = "Field inspection completed"', () => {
  assert.equal(getContextProgressLabel('farm'), 'Field inspection completed');
});

// ── §6 empty states ─────────────────────────────────────────────

test('Garden empty state = "Add a plant to get started"', () => {
  assert.equal(getContextEmptyState('garden'), 'Add a plant to get started');
});

test('Farm empty state = "Add your farm to begin tracking"', () => {
  assert.equal(getContextEmptyState('farm'), 'Add your farm to begin tracking');
});

test('AddFarmEmpty.jsx renders the spec §6 farm empty-state copy', () => {
  const src = readFileSync('src/components/farm/AddFarmEmpty.jsx', 'utf8');
  // Must call getContextEmptyState('farm') for the headline so the
  // copy stays in sync with the contextWords helper.
  assert.match(src, /getContextEmptyState\(['"]farm['"]\)/,
    'AddFarmEmpty must read the headline via getContextEmptyState');
});

test('ManageGardens.jsx renders the spec §6 garden empty-state copy', () => {
  const src = readFileSync('src/pages/ManageGardens.jsx', 'utf8');
  assert.match(src, /getContextEmptyState\(['"]garden['"]\)/,
    'ManageGardens must read the empty-state title via getContextEmptyState');
});

// ── §7 icons ────────────────────────────────────────────────────

test('Garden primary icon = \uD83C\uDF31', () => {
  assert.equal(getContextIcon('garden'), '\uD83C\uDF31');
  assert.equal(getContextIcon('garden', 'primary'), '\uD83C\uDF31');
});

test('Farm primary icon = \uD83D\uDE9C', () => {
  assert.equal(getContextIcon('farm'), '\uD83D\uDE9C');
  assert.equal(getContextIcon('farm', 'primary'), '\uD83D\uDE9C');
});

test('Icon palette returns 3 emoji per context (\u00a77)', () => {
  const garden = getContextIcon('garden', 'palette');
  assert.ok(Array.isArray(garden) && garden.length === 3,
    'garden palette must be a 3-emoji array');
  assert.deepEqual(garden, ['\uD83C\uDF31', '\uD83C\uDF3F', '\uD83E\uDEB4']);
  const farm = getContextIcon('farm', 'palette');
  assert.deepEqual(farm,   ['\uD83D\uDE9C', '\uD83C\uDF3E', '\uD83D\uDCCA']);
});

// ── §8 cross-context isolation (engine vocabulary audit) ────────

test('Garden plan never uses farm vocabulary (no "crop" / "field")', () => {
  for (const setup of ['container', 'raised_bed', 'ground', 'indoor_balcony']) {
    const plan = generateDailyPlan({
      type:  'garden',
      setup,
      cropOrPlant: 'tomato',
    });
    const blob = `${plan.priority} | ${plan.reason} | ${plan.tasks.join(' | ')}`;
    // Strict: no "crop" word and no "field" word in any garden output.
    assert.ok(!/\bcrop\b/i.test(blob),
      `garden setup "${setup}" leaked "crop": ${blob}`);
    assert.ok(!/\bfield\b/i.test(blob),
      `garden setup "${setup}" leaked "field": ${blob}`);
    assert.ok(!/\bscout\b/i.test(blob),
      `garden setup "${setup}" leaked "scout": ${blob}`);
  }
});

test('Farm plan never uses garden vocabulary (no "plant" / "pot")', () => {
  for (const cls of ['small_farm', 'medium_farm', 'large_farm']) {
    const plan = generateDailyPlan({
      type:          'farm',
      autoFarmClass: cls,
      cropOrPlant:   'maize',
    });
    const blob = `${plan.priority} | ${plan.reason} | ${plan.tasks.join(' | ')}`;
    // Allow "plants" only as a verb (e.g. "plants two seeds") would
    // be unusual; we lean strict on the noun form. The current rule
    // tables don't use either word, so any leak fails.
    assert.ok(!/\bplant\b/i.test(blob),
      `farm class "${cls}" leaked "plant": ${blob}`);
    assert.ok(!/\bpot\b/i.test(blob),
      `farm class "${cls}" leaked "pot": ${blob}`);
    assert.ok(!/\bbalcony\b/i.test(blob),
      `farm class "${cls}" leaked garden-only word "balcony": ${blob}`);
  }
});

test('Switching context changes vocabulary instantly', () => {
  // Spec §8: "Switching context changes tone immediately".
  // We assert that calling the helpers with garden vs farm
  // returns DIFFERENT strings for every divergent vocabulary
  // pair. No state, no cache \u2014 the helper is a pure function so
  // the switch is instantaneous by construction.
  const divergent = ['plant', 'pot', 'rows', 'scouting'];
  for (const k of divergent) {
    const g = getContextWord(k, 'garden');
    const f = getContextWord(k, 'farm');
    assert.notEqual(g, f, `word "${k}" must diverge between contexts`);
  }
});

// ── Internal contract sanity ────────────────────────────────────

test('contextWords _internal mappings are frozen (no accidental mutation)', () => {
  assert.ok(Object.isFrozen(_internal),
    '_internal must be frozen');
  assert.ok(Object.isFrozen(_internal.WORDS),
    'WORDS must be frozen');
  assert.ok(Object.isFrozen(_internal.EMPTY_STATES),
    'EMPTY_STATES must be frozen');
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
console.log(`Verdict: ${fail === 0 ? 'POLISHED' : 'NEED FIXES'}`);
console.log(`${pass} passed, ${fail} failed, ${cases.length} total.`);
if (fail > 0) process.exitCode = 1;
