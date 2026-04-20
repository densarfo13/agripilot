/**
 * taskEngineCore.test.js — contract for the task intelligence
 * layer under src/core/taskEngine/.
 *
 * Covers: stageTaskMap, priorityScorer, taskGenerator,
 * stage progression, and §16 dev assertions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  STAGE, FLAG, ACTION_TYPE,
  tasksForStage, taskByCode, stageGateCodes,
} from '../../../src/core/taskEngine/stageTaskMap.js';
import { scoreTaskPriority, scoreAll } from '../../../src/core/taskEngine/priorityScorer.js';
import {
  generateFarmTasks, recomputeAfterCompletion,
  selectPrimaryTask, shouldAdvanceStage,
} from '../../../src/core/taskEngine/taskGenerator.js';
import {
  assertNoGenericWhenContextExists, assertSinglePrimary,
  assertPrimaryExists, assertCompletedNotPrimary,
  assertRebuildAfterCompletion, assertWeatherNotDominant,
  assertEngineReturnedPayload,
} from '../../../src/core/taskEngine/taskDevAssertions.js';

// ─── stageTaskMap ────────────────────────────────────────────
describe('stageTaskMap', () => {
  it('exposes six canonical stages', () => {
    expect(Object.values(STAGE).sort()).toEqual(
      ['early_growth', 'harvest', 'land_prep', 'maintain', 'planting', 'post_harvest']);
  });

  it('tasksForStage returns only that stage', () => {
    const prep = tasksForStage(STAGE.LAND_PREP);
    expect(prep.length).toBeGreaterThan(0);
    for (const t of prep) expect(t.stage).toBe(STAGE.LAND_PREP);
  });

  it('stageGateCodes yields the gate list for each stage', () => {
    const landPrep = stageGateCodes(STAGE.LAND_PREP);
    expect(landPrep.sort()).toEqual(['clear_land', 'prepare_ridges', 'source_planting_materials']);
    const planting = stageGateCodes(STAGE.PLANTING);
    expect(planting).toContain('plant_crop');
  });

  it('taskByCode returns an independent clone', () => {
    const a = taskByCode('clear_land');
    const b = taskByCode('clear_land');
    expect(a.code).toBe('clear_land');
    expect(a).not.toBe(b);  // different object identity
  });

  it('taskByCode returns null for unknown code', () => {
    expect(taskByCode('bogus')).toBeNull();
  });
});

// ─── priorityScorer ──────────────────────────────────────────
describe('priorityScorer', () => {
  it('base priority survives when no context', () => {
    const t = taskByCode('clear_land');
    expect(scoreTaskPriority(t, {})).toBe(t.priority);
  });

  it('rain-soon boosts check_drainage', () => {
    const t = taskByCode('check_drainage');
    const baseline = scoreTaskPriority(t, {});
    const rainy    = scoreTaskPriority(t, { weather: { rainExpectedSoon: true } });
    expect(rainy).toBeGreaterThan(baseline);
  });

  it('heavy rain boosts protect_harvest_if_rain hard', () => {
    const t = taskByCode('protect_harvest_if_rain');
    const baseline = scoreTaskPriority(t, {});
    const heavy    = scoreTaskPriority(t, { weather: { heavyRainExpected: true } });
    expect(heavy - baseline).toBeGreaterThanOrEqual(30);
  });

  it('wet soil pushes plant_crop down and verify_soil_ready up', () => {
    const plant   = taskByCode('plant_crop');
    const verify  = taskByCode('verify_soil_ready');
    const land = { wetSoil: true, landCleared: true };
    const pScore = scoreTaskPriority(plant,  { landProfile: land, currentStage: STAGE.PLANTING });
    const vScore = scoreTaskPriority(verify, { landProfile: land, currentStage: STAGE.PLANTING });
    expect(vScore).toBeGreaterThan(pScore);
  });

  it('uncleared land during planting reroutes to clear_land', () => {
    const clear = taskByCode('clear_land');
    const plant = taskByCode('plant_crop');
    const land = { landCleared: false };
    const cScore = scoreTaskPriority(clear, { landProfile: land, currentStage: STAGE.PLANTING });
    const pScore = scoreTaskPriority(plant, { landProfile: land, currentStage: STAGE.PLANTING });
    expect(cScore).toBeGreaterThan(pScore);
  });

  it('very stale freshness softens priority', () => {
    const t = taskByCode('check_pests');
    const fresh = scoreTaskPriority(t, {});
    const stale = scoreTaskPriority(t, { freshness: 'very_stale' });
    expect(stale).toBeLessThan(fresh);
  });

  it('stage alignment gives small bonus', () => {
    const t = taskByCode('clear_land');
    const inStage  = scoreTaskPriority(t, { currentStage: STAGE.LAND_PREP });
    const outStage = scoreTaskPriority(t, { currentStage: STAGE.MAINTAIN });
    expect(inStage).toBeGreaterThan(outStage);
  });

  it('scoreAll does not mutate input tasks', () => {
    const input = tasksForStage(STAGE.LAND_PREP);
    const scored = scoreAll(input, { currentStage: STAGE.LAND_PREP });
    expect(input[0]).not.toHaveProperty('score');
    expect(scored[0]).toHaveProperty('score');
  });
});

// ─── generateFarmTasks ───────────────────────────────────────
describe('generateFarmTasks', () => {
  const farm = {
    id: 'f1', cropType: 'cassava', countryCode: 'GH',
    stage: STAGE.LAND_PREP,
  };

  it('returns structured tasks (LocalizedPayload-ready)', () => {
    const out = generateFarmTasks({ farm });
    expect(out.primary).toBeTruthy();
    expect(out.primary.titleKey).toMatch(/^task\./);
    expect(out.primary.id).toContain('f1:');
    expect(typeof out.primary.code).toBe('string');
    expect(Array.isArray(out.supporting)).toBe(true);
  });

  it('cassava + land_prep + rain expected → check_drainage becomes primary', () => {
    const out = generateFarmTasks({
      farm, weather: { rainExpectedSoon: true },
      landProfile: { landCleared: true },
    });
    expect(out.primary.code).toBe('check_drainage');
  });

  it('wet soil blocks plant_crop from being primary during planting', () => {
    const out = generateFarmTasks({
      farm: { ...farm, stage: STAGE.PLANTING },
      landProfile: { landCleared: true, wetSoil: true },
    });
    expect(out.primary.code).not.toBe('plant_crop');
    expect(out.primary.code).toBe('verify_soil_ready');
  });

  it('uncleared land during planting reroutes to clear_land', () => {
    const out = generateFarmTasks({
      farm: { ...farm, stage: STAGE.PLANTING },
      landProfile: { landCleared: false },
    });
    expect(out.primary.code).toBe('clear_land');
  });

  it('exactly one primary task is flagged', () => {
    const out = generateFarmTasks({ farm });
    const count = out.all.filter((t) => t.isPrimary).length;
    expect(count).toBe(1);
  });

  it('supporting tasks are sorted by score desc', () => {
    const out = generateFarmTasks({
      farm, weather: { rainExpectedSoon: true },
      landProfile: { landCleared: true },
    });
    for (let i = 0; i < out.supporting.length - 1; i++) {
      expect(out.supporting[i].score).toBeGreaterThanOrEqual(out.supporting[i + 1].score);
    }
  });

  it('supporting list is capped at 4', () => {
    const out = generateFarmTasks({ farm });
    expect(out.supporting.length).toBeLessThanOrEqual(4);
  });

  it('completed tasks never become primary', () => {
    const out = generateFarmTasks({
      farm,
      completedCodes: ['clear_land', 'prepare_ridges', 'remove_weeds',
                        'check_drainage', 'source_planting_materials'],
    });
    // Primary can still exist if there are other tasks; but if it does,
    // it must NOT be one of the completed codes.
    if (out.primary) expect(out.primary.completed).toBe(false);
  });

  it('fallback path: no context → safe fallback tasks with titleKey', () => {
    const out = generateFarmTasks({ farm: { id: null } });
    expect(out.primary).toBeTruthy();
    expect(out.primary.titleKey).toMatch(/^task\./);
  });

  it('engine never emits hardcoded strings — every returned task has titleKey', () => {
    const out = generateFarmTasks({ farm });
    for (const t of out.all) {
      expect(typeof t.titleKey).toBe('string');
      expect(t.titleKey).toMatch(/^task\./);
    }
  });

  it('result primary is frozen', () => {
    const out = generateFarmTasks({ farm });
    expect(Object.isFrozen(out.primary)).toBe(true);
  });
});

// ─── recomputeAfterCompletion ────────────────────────────────
describe('recomputeAfterCompletion', () => {
  const farm = { id: 'f1', cropType: 'cassava', stage: STAGE.LAND_PREP, countryCode: 'GH' };

  it('marks the completed task as done and picks a different primary', () => {
    const first = generateFarmTasks({ farm });
    const firstCode = first.primary.code;
    const after = recomputeAfterCompletion({ farm }, firstCode);
    expect(after.primary.completed).toBe(false);
    expect(after.primary.code).not.toBe(firstCode);
  });

  it('recentEvents are preserved across multiple completions', () => {
    let input = { farm, recentEvents: [] };
    const step1 = recomputeAfterCompletion(input, 'clear_land');
    // Pass through by carrying events forward.
    const step2 = recomputeAfterCompletion(
      { farm, recentEvents: [{ type: 'task_completed', code: 'clear_land', at: 1 }] },
      'prepare_ridges',
    );
    expect(step2.context.completedCount).toBeGreaterThanOrEqual(2);
  });
});

// ─── selectPrimaryTask ───────────────────────────────────────
describe('selectPrimaryTask', () => {
  it('returns null on empty', () => {
    expect(selectPrimaryTask([])).toBeNull();
    expect(selectPrimaryTask(null)).toBeNull();
  });
  it('ignores completed tasks', () => {
    const tasks = [
      { id: 'a', score: 90, completed: true },
      { id: 'b', score: 50, completed: false },
    ];
    expect(selectPrimaryTask(tasks).id).toBe('b');
  });
  it('returns the highest-scoring uncompleted task', () => {
    const tasks = [
      { id: 'a', score: 50, completed: false },
      { id: 'b', score: 80, completed: false },
      { id: 'c', score: 60, completed: false },
    ];
    expect(selectPrimaryTask(tasks).id).toBe('b');
  });
});

// ─── shouldAdvanceStage ──────────────────────────────────────
describe('shouldAdvanceStage', () => {
  const farm = { id: 'f1', stage: STAGE.LAND_PREP };

  it('returns null when gates are not all complete', () => {
    expect(shouldAdvanceStage({ farm, completedCodes: ['clear_land'] })).toBeNull();
  });

  it('returns next stage once every gate task is complete', () => {
    expect(shouldAdvanceStage({
      farm,
      completedCodes: ['clear_land', 'prepare_ridges', 'source_planting_materials'],
    })).toBe(STAGE.PLANTING);
  });

  it('reads completions from recentEvents when codes not passed', () => {
    const events = [
      { type: 'task_completed', code: 'clear_land' },
      { type: 'task_completed', code: 'prepare_ridges' },
      { type: 'task_completed', code: 'source_planting_materials' },
    ];
    expect(shouldAdvanceStage({ farm, recentEvents: events })).toBe(STAGE.PLANTING);
  });

  it('returns null for post_harvest (cycle end)', () => {
    const f = { id: 'f1', stage: STAGE.POST_HARVEST };
    expect(shouldAdvanceStage({
      farm: f,
      completedCodes: ['store_crop'],
    })).toBeNull();
  });
});

// ─── §16 dev assertions ──────────────────────────────────────
describe('§16 dev assertions', () => {
  let warnSpy;
  beforeEach(() => {
    globalThis.window = globalThis.window || {};
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => { warnSpy.mockRestore(); });

  it('assertNoGenericWhenContextExists silent with no generics', () => {
    assertNoGenericWhenContextExists(true, [{ code: 'clear_land' }]);
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it('assertNoGenericWhenContextExists warns when scan_crop_issue leaks in', () => {
    assertNoGenericWhenContextExists(true, [{ code: 'scan_crop_issue' }]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
  it('assertNoGenericWhenContextExists silent without farm context', () => {
    assertNoGenericWhenContextExists(false, [{ code: 'scan_crop_issue' }]);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('assertSinglePrimary silent on one primary', () => {
    assertSinglePrimary([{ isPrimary: true }, { isPrimary: false }]);
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it('assertSinglePrimary warns on 2+ primaries', () => {
    assertSinglePrimary([{ isPrimary: true }, { isPrimary: true }]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('assertPrimaryExists warns when none selected but incompletes exist', () => {
    assertPrimaryExists(null, [{ completed: false }]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
  it('assertPrimaryExists silent when all tasks are completed', () => {
    assertPrimaryExists(null, [{ completed: true }]);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('assertCompletedNotPrimary warns on completed primary', () => {
    assertCompletedNotPrimary({ completed: true, id: 'x' });
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('assertRebuildAfterCompletion warns when primary id did not change', () => {
    assertRebuildAfterCompletion(true, 'f1:clear_land', 'f1:clear_land');
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('assertWeatherNotDominant warns when weather > primary weight', () => {
    assertWeatherNotDominant(10, 5);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    assertWeatherNotDominant(5, 10);
    expect(warnSpy).toHaveBeenCalledTimes(1); // unchanged
  });

  it('assertEngineReturnedPayload warns on raw strings', () => {
    assertEngineReturnedPayload('Prepare your land');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    assertEngineReturnedPayload({ titleKey: 'task.x' });
    expect(warnSpy).toHaveBeenCalledTimes(1); // silent on valid
  });
});
