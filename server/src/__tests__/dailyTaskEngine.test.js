/**
 * dailyTaskEngine.test.js — v1 daily task generator contract.
 *
 * Spec §8:
 *   1. crop-specific task generation
 *   2. stage-based task changes
 *   3. fallback when stage unknown
 *   4. fallback when crop unsupported (generic)
 *   5. farmer type hint propagation
 *   plus completions dedup, ordering, freeze, inferPlantingStatus.
 */

import { describe, it, expect } from 'vitest';

import {
  generateDailyTasks, getTopTask, resolveStage,
  SUPPORTED_STAGES, PLANTING_STATUS_TO_STAGE, _internal,
} from '../../../src/lib/tasks/dailyTaskEngine.js';

import {
  inferPlantingStatus, PLANTING_STATUSES,
  _internal as statusInternals,
} from '../../../src/lib/tasks/plantingStatus.js';

import { RULES as TASK_RULES } from '../../../src/config/dailyTaskRules.js';

// ─── 1. Stage + planting-status resolution ───────────────────────
describe('resolveStage', () => {
  it('explicit stage wins', () => {
    expect(resolveStage({ stage: 'harvest' })).toBe('harvest');
  });

  it('plantingStatus maps to stage when stage is missing', () => {
    expect(resolveStage({ plantingStatus: 'not_started' })).toBe('pre_planting');
    expect(resolveStage({ plantingStatus: 'planted' })).toBe('planting');
    expect(resolveStage({ plantingStatus: 'growing' })).toBe('early_growth');
    expect(resolveStage({ plantingStatus: 'near_harvest' })).toBe('harvest');
  });

  it('legacy synonyms (land_prep / maintain / flowering) are accepted', () => {
    expect(resolveStage({ stage: 'land_prep' })).toBe('pre_planting');
    expect(resolveStage({ stage: 'maintain' })).toBe('mid_growth');
    expect(resolveStage({ stage: 'flowering' })).toBe('mid_growth');
    expect(resolveStage({ stage: 'harvest_ready' })).toBe('harvest');
  });

  it('unknown stage + no planting status → safe default pre_planting', () => {
    expect(resolveStage({ stage: 'bogus' })).toBe('pre_planting');
    expect(resolveStage({})).toBe('pre_planting');
  });

  it('case-insensitive', () => {
    expect(resolveStage({ stage: 'HARVEST' })).toBe('harvest');
  });
});

// ─── 2. Crop-specific vs generic fallback (spec §8.1, §8.4) ──────
describe('generateDailyTasks — crop vs generic', () => {
  it('cassava + pre_planting surfaces the cassava-specific list', () => {
    const r = generateDailyTasks({ crop: 'cassava', stage: 'pre_planting' });
    expect(r.cropSource).toBe('crop');
    expect(r.today[0].id.startsWith('pre_planting.')).toBe(true);
    // Cassava list has prepare_ridges / source_cuttings — neither is in generic.
    const ids = [r.today[0].id, ...r.thisWeek.map((t) => t.id)];
    expect(ids.some((id) => id === 'pre_planting.prepare_ridges'
                          || id === 'pre_planting.source_cuttings')).toBe(true);
  });

  it('crop without specific rules falls back to generic list', () => {
    const r = generateDailyTasks({ crop: 'dragonfruit', stage: 'pre_planting' });
    expect(r.cropSource).toBe('generic');
    expect(r.today[0].id.startsWith('pre_planting.')).toBe(true);
  });

  it('no crop → generic', () => {
    const r = generateDailyTasks({ stage: 'pre_planting' });
    expect(r.cropSource).toBe('generic');
  });

  it('case-insensitive crop key', () => {
    const r = generateDailyTasks({ crop: 'CASSAVA', stage: 'pre_planting' });
    expect(r.cropSource).toBe('crop');
  });
});

// ─── 3. Stage-based task changes (spec §8.2) ─────────────────────
describe('generateDailyTasks — stage ladder', () => {
  it('each supported stage returns at least one task', () => {
    for (const stage of SUPPORTED_STAGES) {
      const r = generateDailyTasks({ stage });
      expect(r.today.length + r.thisWeek.length).toBeGreaterThan(0);
      expect(r.stage).toBe(stage);
    }
  });

  it('harvest stage surfaces readiness / tools / labour', () => {
    const r = generateDailyTasks({ stage: 'harvest' });
    const ids = [...r.today, ...r.thisWeek].map((t) => t.id);
    expect(ids).toContain('harvest.check_readiness');
  });

  it('post_harvest surfaces dry_and_store / record_yield', () => {
    const r = generateDailyTasks({ stage: 'post_harvest' });
    const ids = [...r.today, ...r.thisWeek].map((t) => t.id);
    expect(ids).toContain('post.dry_and_store');
    expect(ids).toContain('post.record_yield');
  });

  it('mid_growth falls back to today even when rules only have this_week items', () => {
    // Back-fill: the top upcoming task should appear in "today".
    const r = generateDailyTasks({ stage: 'mid_growth' });
    expect(r.today.length).toBeGreaterThan(0);
  });
});

// ─── 4. Fallback when stage unknown (spec §8.3) ──────────────────
describe('generateDailyTasks — stage-unknown fallback', () => {
  it('unknown stage + no planting status → pre_planting generic', () => {
    const r = generateDailyTasks({ stage: 'weird' });
    expect(r.stage).toBe('pre_planting');
    expect(r.cropSource).toBe('generic');
    expect(r.today.length).toBeGreaterThan(0);
  });
});

// ─── 5. Farmer-type hint propagation (spec §8.5) ─────────────────
describe('generateDailyTasks — farmer type', () => {
  it('propagates farmerType onto each task', () => {
    const r = generateDailyTasks({ stage: 'planting', farmerType: 'new' });
    for (const t of r.today) expect(t.farmerTypeHint).toBe('new');
  });

  it('rejects invalid farmerType silently', () => {
    const r = generateDailyTasks({ stage: 'planting', farmerType: 'nonsense' });
    expect(r.farmerType).toBeNull();
  });

  it('does not affect which tasks surface', () => {
    const a = generateDailyTasks({ stage: 'planting' });
    const b = generateDailyTasks({ stage: 'planting', farmerType: 'existing' });
    expect(a.today.map((t) => t.id)).toEqual(b.today.map((t) => t.id));
  });
});

// ─── 6. Completion dedup + ordering + freeze ─────────────────────
describe('generateDailyTasks — contract', () => {
  it('completed tasks are dropped', () => {
    const r = generateDailyTasks({
      stage: 'pre_planting',
      completions: [
        { taskId: 'pre_planting.clear_land', completed: true, timestamp: Date.now() },
      ],
    });
    const ids = [...r.today, ...r.thisWeek].map((t) => t.id);
    expect(ids).not.toContain('pre_planting.clear_land');
  });

  it('results are frozen', () => {
    const r = generateDailyTasks({ stage: 'planting' });
    expect(Object.isFrozen(r)).toBe(true);
    expect(Object.isFrozen(r.today)).toBe(true);
    if (r.today.length > 0) expect(Object.isFrozen(r.today[0])).toBe(true);
  });

  it('titleKey / whyKey are i18n keys (no English in engine)', () => {
    const r = generateDailyTasks({ stage: 'planting' });
    for (const t of [...r.today, ...r.thisWeek]) {
      expect(t.titleKey).toMatch(/^daily\./);
      expect(t.whyKey).toMatch(/^daily\./);
    }
  });

  it('orders today → soon → this_week; priority tiebreak', () => {
    const r = generateDailyTasks({ stage: 'pre_planting' });
    // first "today" then "this_week" items.
    let seenWeek = false;
    for (const t of [...r.today, ...r.thisWeek]) {
      if (t.dueHint === 'this_week') seenWeek = true;
      if (seenWeek) expect(t.dueHint).not.toBe('today');
    }
  });

  it('SUPPORTED_STAGES matches the rules config keys', () => {
    for (const s of SUPPORTED_STAGES) expect(TASK_RULES[s]).toBeTruthy();
  });

  it('PLANTING_STATUS_TO_STAGE covers every status', () => {
    expect(Object.keys(PLANTING_STATUS_TO_STAGE).sort())
      .toEqual(['growing', 'near_harvest', 'not_started', 'planted'].sort());
  });

  it('getTopTask returns the first today-task or null', () => {
    expect(getTopTask({ stage: 'planting' })).toBeTruthy();
    const r = getTopTask({ stage: 'harvest', completions: [
      { taskId: 'harvest.check_readiness', completed: true, timestamp: Date.now() },
      { taskId: 'harvest.prepare_tools',   completed: true, timestamp: Date.now() },
    ]});
    // Only labour should be left, but it's this_week — back-fill moves it to today.
    expect(r).toBeTruthy();
    expect(r.id).toBe('harvest.plan_labour');
  });

  it('dueRank internal maps today < soon < this_week', () => {
    expect(_internal.dueRank('today')).toBe(0);
    expect(_internal.dueRank('soon')).toBe(1);
    expect(_internal.dueRank('this_week')).toBe(2);
    expect(_internal.dueRank('unknown')).toBe(3);
  });
});

// ─── 7. inferPlantingStatus ──────────────────────────────────────
describe('inferPlantingStatus', () => {
  it('explicit status wins', () => {
    expect(inferPlantingStatus({ plantingStatus: 'growing', cropStage: 'harvest' }))
      .toBe('growing');
  });

  it('stage → bucket', () => {
    expect(inferPlantingStatus({ cropStage: 'pre_planting' })).toBe('not_started');
    expect(inferPlantingStatus({ cropStage: 'planting' })).toBe('planted');
    expect(inferPlantingStatus({ cropStage: 'early_growth' })).toBe('growing');
    expect(inferPlantingStatus({ cropStage: 'harvest' })).toBe('near_harvest');
    expect(inferPlantingStatus({ cropStage: 'post_harvest' })).toBe('not_started');
  });

  it('legacy cycle stages supported', () => {
    expect(inferPlantingStatus({ cropStage: 'land_prep' })).toBe('not_started');
    expect(inferPlantingStatus({ cropStage: 'maintain' })).toBe('growing');
    expect(inferPlantingStatus({ cropStage: 'flowering' })).toBe('near_harvest');
    expect(inferPlantingStatus({ cropStage: 'harvest_ready' })).toBe('near_harvest');
  });

  it('plantedAt buckets by days elapsed', () => {
    const now = new Date(2026, 5, 1);
    const day0 = new Date(2026, 5, 1).getTime();
    const day60 = day0 - 60 * 86400000;
    const day180 = day0 - 180 * 86400000;
    expect(inferPlantingStatus({ plantedAt: day0, now })).toBe('planted');
    expect(inferPlantingStatus({ plantedAt: day60, now })).toBe('growing');
    expect(inferPlantingStatus({ plantedAt: day180, now })).toBe('near_harvest');
  });

  it('calendar fallback — in_season → planted', () => {
    // GH maize major Mar–May — May should be in_season.
    const r = inferPlantingStatus({
      country: 'GH', crop: 'maize', now: new Date(2026, 4, 15),
    });
    expect(r).toBe('planted');
  });

  it('default safe fallback is not_started', () => {
    expect(inferPlantingStatus({})).toBe('not_started');
  });

  it('PLANTING_STATUSES is the canonical list', () => {
    expect(PLANTING_STATUSES).toEqual(['not_started','planted','growing','near_harvest']);
    expect(Object.isFrozen(statusInternals.STAGE_TO_STATUS)).toBe(true);
  });
});
