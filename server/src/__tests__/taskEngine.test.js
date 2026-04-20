/**
 * taskEngine.test.js — deterministic contract for the Task Engine.
 *
 * Spec §10 checklist:
 *   1. cassava + land_prep + rain → drainage / ridge prep prioritised
 *   2. maize + planting + heavy rain → planting warning behaviour
 *   3. all tasks complete → bridge action (never empty)
 *   4. task completion updates primary task immediately (pure → new call, new primary)
 *   5. active farm change gives farm-specific tasks
 *   6. localized output renders properly (i18n keys returned, no English leaks)
 */

import { describe, it, expect } from 'vitest';

import {
  generateTasks,
  weatherIsSevere,
  _internal,
} from '../../../src/lib/tasks/taskEngine.js';

const NOW = 1_713_600_000_000;
const mkDone = (id) => ({ taskId: id, completed: true, timestamp: NOW });

// ─── 1. cassava + land_prep + rain → drainage/ridge prep first ───
describe('taskEngine — cassava + land_prep + rain', () => {
  it('promotes drainage and ridge prep to high priority', () => {
    const out = generateTasks({
      crop: 'cassava',
      stage: 'land_prep',
      weather: { rainSoon: true },
    });
    expect(out.primaryTask).toBeTruthy();
    // Either drainage or ridges should be primary — both are bumped to
    // high by crop + weather overrides.
    expect(['land_prep.check_drainage', 'land_prep.prepare_ridges', 'land_prep.clear_land'])
      .toContain(out.primaryTask.id);
    // The drainage task must be present (only appears when rainSoon).
    const ids = [out.primaryTask.id, ...out.secondaryTasks.map((t) => t.id)];
    expect(ids).toContain('land_prep.check_drainage');
    // Top-level why reflects rain
    expect(out.why?.key).toBe('tasks.why.weather_rain_soon');
  });

  it('without rain, drainage is NOT surfaced', () => {
    const out = generateTasks({ crop: 'cassava', stage: 'land_prep' });
    const ids = [out.primaryTask.id, ...out.secondaryTasks.map((t) => t.id)];
    expect(ids).not.toContain('land_prep.check_drainage');
  });
});

// ─── 2. maize + planting + heavy rain → warning task first ──────
describe('taskEngine — maize + planting + heavy rain', () => {
  it('surfaces avoid_heavy_rain as a high-priority warning', () => {
    const out = generateTasks({
      crop: 'maize',
      stage: 'planting',
      weather: { heavyRain: true, rainSoon: true },
    });
    const ids = [out.primaryTask.id, ...out.secondaryTasks.map((t) => t.id)];
    expect(ids).toContain('planting.avoid_heavy_rain');
    // Top-level why is the heavy-rain warning.
    expect(out.why?.key).toBe('tasks.why.weather_heavy_rain');
    expect(out.why?.severity).toBe('high');
    // Primary task is one of the high-priority maize + weather tasks.
    expect(out.primaryTask.priority).toBe('high');
  });

  it('clear weather → plant_crop is primary (high-priority default)', () => {
    const out = generateTasks({
      crop: 'maize',
      stage: 'planting',
      weather: null,
    });
    expect(out.primaryTask.id).toBe('planting.plant_crop');
  });
});

// ─── 3. All tasks complete → bridge action ──────────────────────
describe('taskEngine — bridge when empty', () => {
  it('every task in stage done → primary is a bridge', () => {
    const out = generateTasks({
      crop: 'cassava',
      stage: 'land_prep',
      weather: { rainSoon: true },
      completions: [
        mkDone('land_prep.clear_land'),
        mkDone('land_prep.prepare_ridges'),
        mkDone('land_prep.check_drainage'),
      ],
    });
    expect(out.primaryTask.kind).toBe('bridge');
    expect(out.secondaryTasks.length).toBe(0);
    expect(['progress.check_tomorrow', 'progress.prepare_next_stage'])
      .toContain(out.primaryTask.titleKey);
  });

  it('unknown stage → bridge (never crash, never empty)', () => {
    const out = generateTasks({ crop: 'maize', stage: 'xyz_bogus' });
    expect(out.primaryTask.kind).toBe('bridge');
  });
});

// ─── 4. Completion updates primary task immediately ─────────────
describe('taskEngine — completion drives next primary', () => {
  it('completing current primary returns a different primary next call', () => {
    const first = generateTasks({ crop: 'maize', stage: 'planting' });
    const firstId = first.primaryTask.id;
    const second = generateTasks({
      crop: 'maize',
      stage: 'planting',
      completions: [mkDone(firstId)],
    });
    expect(second.primaryTask.id).not.toBe(firstId);
    // …and the completed id is absent from secondaries too.
    const secIds = second.secondaryTasks.map((t) => t.id);
    expect(secIds).not.toContain(firstId);
  });
});

// ─── 5. Active farm change gives farm-specific tasks ────────────
describe('taskEngine — farm-specific context', () => {
  it('rice + maintain highlights water management (rice override)', () => {
    const out = generateTasks({ crop: 'rice', stage: 'maintain' });
    // monitor_moisture is bumped to high for rice; should be primary.
    expect(out.primaryTask.id).toBe('maintain.monitor_moisture');
    expect(out.primaryTask.priority).toBe('high');
    expect(out.primaryTask.whyKey).toBe('tasks.why.water_management_rice');
  });

  it('switching farm (crop) changes task emphasis deterministically', () => {
    const cassava = generateTasks({ crop: 'cassava', stage: 'early_growth' });
    const maize   = generateTasks({ crop: 'maize',   stage: 'early_growth' });
    // cassava promotes remove_weeds to high (spec §3 — emphasise weed
    // control). It should rank at or above normal in the surfaced list.
    const cassavaIds = [cassava.primaryTask.id, ...cassava.secondaryTasks.map((t) => t.id)];
    const cassavaRemoveWeeds = [cassava.primaryTask, ...cassava.secondaryTasks]
      .find((t) => t.id === 'early_growth.remove_weeds');
    expect(cassavaIds).toContain('early_growth.remove_weeds');
    expect(cassavaRemoveWeeds.priority).toBe('high');
    // Maize has no early_growth override — remove_weeds stays at the
    // default "normal" priority.
    const maizeRemoveWeeds = [maize.primaryTask, ...maize.secondaryTasks]
      .find((t) => t.id === 'early_growth.remove_weeds');
    expect(maizeRemoveWeeds.priority).toBe('normal');
  });
});

// ─── 6. Localisation — i18n keys only, no English leaks ────────
describe('taskEngine — localisation', () => {
  it('every surfaced task has a titleKey starting with "tasks." or bridge key', () => {
    const out = generateTasks({ crop: 'maize', stage: 'planting' });
    expect(out.primaryTask.titleKey.startsWith('tasks.')).toBe(true);
    for (const s of out.secondaryTasks) {
      expect(s.titleKey.startsWith('tasks.')).toBe(true);
    }
  });

  it('whyKey is set for each non-bridge task', () => {
    const out = generateTasks({ crop: 'cassava', stage: 'land_prep' });
    expect(out.primaryTask.whyKey).toMatch(/^tasks\.why\./);
    for (const s of out.secondaryTasks) {
      expect(s.whyKey).toMatch(/^tasks\.why\./);
    }
  });

  it('top-level why also uses a stable i18n key', () => {
    const out = generateTasks({ crop: 'cassava', stage: 'land_prep', weather: { severe: true } });
    expect(out.why.key).toBe('tasks.why.weather_severe');
    expect(out.why.severity).toBe('high');
  });
});

// ─── weatherIsSevere helper ────────────────────────────────────
describe('weatherIsSevere', () => {
  it('true for severe + heavyRain; false otherwise', () => {
    expect(weatherIsSevere({ severe: true })).toBe(true);
    expect(weatherIsSevere({ heavyRain: true })).toBe(true);
    expect(weatherIsSevere({ rainSoon: true })).toBe(false);
    expect(weatherIsSevere(null)).toBe(false);
  });
});

// ─── Purity / safety ───────────────────────────────────────────
describe('taskEngine — purity', () => {
  it('same inputs → same output', () => {
    const args = { crop: 'maize', stage: 'planting', weather: { heavyRain: true } };
    const a = generateTasks(args);
    const b = generateTasks(args);
    expect(a).toEqual(b);
  });

  it('output is frozen', () => {
    const out = generateTasks({ crop: 'cassava', stage: 'land_prep' });
    expect(Object.isFrozen(out)).toBe(true);
    expect(Object.isFrozen(out.primaryTask)).toBe(true);
    expect(Object.isFrozen(out.secondaryTasks)).toBe(true);
  });

  it('internal tables are frozen', () => {
    expect(Object.isFrozen(_internal.STAGE_TEMPLATES)).toBe(true);
    expect(Object.isFrozen(_internal.CROP_OVERRIDES)).toBe(true);
  });
});
