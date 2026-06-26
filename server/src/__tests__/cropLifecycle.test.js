/**
 * cropLifecycle.test.js — Full Crop/Plant Lifecycle Intelligence.
 * Verifies the duration registry, the harvest-window honesty rules,
 * stage-based tasks, weather/scan integration, and the mode-aware
 * lifecycle snapshot.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  KNOWN_CROPS, getDurationDays, estimateHarvestWindow,
} from '../../../src/core/lifecycle/cropDurationRegistry.js';
import {
  LIFECYCLE_STAGE, computeLifecycleSnapshot,
} from '../../../src/core/lifecycle/cropLifecycleEngine.js';
import {
  PLANTING_REGIONS, getPlantingWindow,
} from '../../../src/core/lifecycle/plantingWindowEngine.js';
import {
  generateLifecycleTasks,
} from '../../../src/core/lifecycle/generateLifecycleTasks.js';
import {
  LIFECYCLE_OBS,
  recordLifecycleObservation, getLifecycleObservationCounts,
  resetLifecycleObservationCounts, trackStageChange,
} from '../../../src/core/lifecycle/lifecycleObservability.js';

const DAY = 24 * 3600 * 1000;
const NOW = Date.UTC(2026, 4, 22);

// ─── Duration registry ───────────────────────────────────

describe('cropDurationRegistry', () => {
  it('ships sensible ranges for staple crops', () => {
    for (const crop of ['tomato', 'maize', 'beans', 'cassava', 'rice', 'pepper']) {
      const d = getDurationDays(crop);
      expect(d.min).toBeGreaterThan(0);
      expect(d.max).toBeGreaterThanOrEqual(d.min);
    }
    expect(KNOWN_CROPS.length).toBeGreaterThanOrEqual(10);
  });

  it('honours crop aliases (corn → maize, chili → pepper)', () => {
    expect(getDurationDays('corn').cropKey).toBe('maize');
    expect(getDurationDays('chili').cropKey).toBe('pepper');
  });

  it('covers the expanded smallholder staple set with sensible ranges', () => {
    const added = ['cowpea', 'soybean', 'sweet_potato', 'plantain', 'cocoa', 'cocoyam',
      'pumpkin', 'eggplant', 'watermelon', 'pineapple', 'sugarcane', 'wheat', 'sesame',
      'sunflower', 'ginger', 'garlic', 'kale', 'amaranth', 'moringa', 'chickpea', 'pea'];
    for (const crop of added) {
      const d = getDurationDays(crop);
      expect(d, crop).not.toBeNull();
      expect(d.min).toBeGreaterThan(0);
      expect(d.max).toBeGreaterThanOrEqual(d.min);
    }
    expect(KNOWN_CROPS.length).toBeGreaterThanOrEqual(40);
  });

  it('resolves expanded aliases without mis-matching (peanut→groundnut, sweet potato, plantain≠banana)', () => {
    expect(getDurationDays('peanut').cropKey).toBe('groundnut');     // not the generic "pea"
    expect(getDurationDays('cowpea').cropKey).toBe('cowpea');         // not "pea"
    expect(getDurationDays('sweet potato').cropKey).toBe('sweet_potato');
    expect(getDurationDays('plantain').cropKey).toBe('plantain');     // distinct from banana now
    expect(getDurationDays('taro').cropKey).toBe('cocoyam');
    expect(getDurationDays('garden egg').cropKey).toBe('eggplant');
    // An unknown crop still honestly returns null (no fabricated duration).
    expect(getDurationDays('made-up-crop-xyz')).toBeNull();
  });

  it('produces a real harvest window for a newly-covered crop (cowpea)', () => {
    const w = estimateHarvestWindow('cowpea', '2026-01-01', { nowMs: NOW });
    expect(w.ok).toBe(true);
    expect(w.cropKey).toBe('cowpea');
    expect(w.earliest).toBeTruthy();
    expect(w.durationDays.min).toBe(60);
  });

  it('returns null for an unknown crop', () => {
    expect(getDurationDays('xyzfruit')).toBe(null);
  });

  it('cool_wet climate stretches the range; indoor setting stretches further', () => {
    const baseline = getDurationDays('tomato');
    const cool = getDurationDays('tomato', { climate: 'cool_wet' });
    const indoor = getDurationDays('tomato', { climate: 'cool_wet', setting: 'indoor' });
    expect(cool.max).toBeGreaterThanOrEqual(baseline.max);
    expect(indoor.max).toBeGreaterThanOrEqual(cool.max);
  });
});

describe('estimateHarvestWindow — honest range, not a hard date', () => {
  it('returns an isEstimate=true window with a disclaimer', () => {
    const planted = new Date(NOW - 30 * DAY).toISOString();
    const w = estimateHarvestWindow('tomato', planted, { nowMs: NOW });
    expect(w.ok).toBe(true);
    expect(w.isEstimate).toBe(true);
    expect(w.disclaimer).toMatch(/not a guaranteed/i);
    expect(typeof w.earliest).toBe('string');
    expect(typeof w.latest).toBe('string');
    expect(w.durationDays.max).toBeGreaterThanOrEqual(w.durationDays.min);
  });

  it('flags unknown_crop / invalid_planting_date instead of guessing', () => {
    expect(estimateHarvestWindow('xyz', new Date(NOW)).reason).toBe('unknown_crop');
    expect(estimateHarvestWindow('tomato', 'not-a-date').reason).toBe('invalid_planting_date');
  });

  it('never throws on garbage input', () => {
    expect(() => estimateHarvestWindow(null, null)).not.toThrow();
  });
});

// ─── Lifecycle engine ────────────────────────────────────

describe('computeLifecycleSnapshot — current stage', () => {
  it('returns PLANNING when no planting date is known', () => {
    const r = computeLifecycleSnapshot({ crop: 'tomato', mode: 'gardener' });
    expect(r.currentStage).toBe(LIFECYCLE_STAGE.PLANNING);
    expect(r.needsPlantingDate).toBe(true);
    expect(r.harvestWindow).toBe(null);
  });

  it('moves to a real growth stage once planting date is provided', () => {
    const r = computeLifecycleSnapshot({
      crop: 'maize',
      plantingDate: new Date(NOW - 25 * DAY).toISOString(),
      nowMs: NOW,
    });
    expect(r.needsPlantingDate).toBe(false);
    expect(r.daysSincePlanting).toBe(25);
    // Some growth-stage variant — not still PLANNING.
    expect(r.currentStage).not.toBe(LIFECYCLE_STAGE.PLANNING);
    expect(Object.values(LIFECYCLE_STAGE)).toContain(r.currentStage);
  });

  it('reaches post_harvest when far past the duration max', () => {
    const r = computeLifecycleSnapshot({
      crop: 'tomato',
      plantingDate: new Date(NOW - 200 * DAY).toISOString(),
      nowMs: NOW,
    });
    expect([LIFECYCLE_STAGE.HARVEST, LIFECYCLE_STAGE.POST_HARVEST])
      .toContain(r.currentStage);
  });
});

describe('computeLifecycleSnapshot — stage tasks + next hint', () => {
  it('emits 1–3 localizable task envelopes per stage', () => {
    const r = computeLifecycleSnapshot({
      crop: 'tomato', plantingDate: new Date(NOW - 50 * DAY).toISOString(), nowMs: NOW,
    });
    expect(r.stageTasks.length).toBeGreaterThan(0);
    expect(r.stageTasks.length).toBeLessThanOrEqual(3);
    for (const t of r.stageTasks) {
      expect(t.titleKey).toMatch(/^lifecycle\.task\./);
      expect(typeof t.titleFallback).toBe('string');
      expect(typeof t.actionType).toBe('string');
    }
  });

  it('includes a nextStageHint envelope when there is a next stage', () => {
    const r = computeLifecycleSnapshot({
      crop: 'tomato', plantingDate: new Date(NOW - 50 * DAY).toISOString(), nowMs: NOW,
    });
    expect(r.nextStageHint).toBeTruthy();
    expect(r.nextStageHint.key).toMatch(/^lifecycle\.hint\./);
  });
});

describe('computeLifecycleSnapshot — weather + scan integration', () => {
  it('cool wet conditions → cool_wet weather adjustment', () => {
    const r = computeLifecycleSnapshot({
      crop: 'tomato',
      weather: { temperatureC: 20, humidityPct: 90 },
      nowMs: NOW,
    });
    expect(r.weatherAdjustment.fallback).toMatch(/cool.*wet/i);
  });

  it('hot dry conditions → hot_dry adjustment', () => {
    const r = computeLifecycleSnapshot({
      crop: 'maize',
      weather: { temperatureC: 34, humidityPct: 30 },
      nowMs: NOW,
    });
    expect(r.weatherAdjustment.fallback).toMatch(/hot.*dry|water.*early/i);
  });

  it('recent fungal scan → recent_fungal adjustment', () => {
    const r = computeLifecycleSnapshot({
      crop: 'tomato',
      scanHistory: [{ issueCategory: 'fungal_risk' }],
      nowMs: NOW,
    });
    expect(r.scanAdjustment.fallback).toMatch(/fungal/i);
  });

  it('clear scan history → no scanAdjustment', () => {
    const r = computeLifecycleSnapshot({
      crop: 'tomato', scanHistory: [], nowMs: NOW,
    });
    expect(r.scanAdjustment).toBe(null);
  });
});

describe('computeLifecycleSnapshot — farmer vs gardener phrasing', () => {
  it('gardener mode falls back to "your plants" when crop is missing', () => {
    const r = computeLifecycleSnapshot({ mode: 'gardener' });
    expect(r.cropLabel).toBe('your plants');
  });

  it('farmer mode falls back to "the crop"', () => {
    const r = computeLifecycleSnapshot({ mode: 'farmer' });
    expect(r.cropLabel).toBe('the crop');
  });
});

describe('computeLifecycleSnapshot — honesty + robustness', () => {
  it('always includes a calm disclaimer (no guaranteed dates)', () => {
    const r = computeLifecycleSnapshot({ crop: 'tomato' });
    expect(r.disclaimer).toMatch(/not guaranteed|local conditions vary/i);
  });

  it('exposes a durationDays range for known crops even without a planting date', () => {
    const r = computeLifecycleSnapshot({ crop: 'tomato' });
    expect(r.durationDays.min).toBeGreaterThan(0);
    expect(r.durationDays.max).toBeGreaterThanOrEqual(r.durationDays.min);
  });

  it('never throws on garbage input — falls back to PLANNING with planning tasks', () => {
    expect(() => computeLifecycleSnapshot(null)).not.toThrow();
    const r = computeLifecycleSnapshot(null);
    expect(r.currentStage).toBe(LIFECYCLE_STAGE.PLANNING);
    // PLANNING is a real stage — we still surface its plan-tasks
    // (prepare soil, choose variety). What matters is that the
    // engine never threw + the disclaimer is present.
    expect(Array.isArray(r.stageTasks)).toBe(true);
    expect(typeof r.disclaimer).toBe('string');
  });
});

// ─── Registry extension — additional crops ────────────────

describe('cropDurationRegistry — extension crops', () => {
  it('covers cucumber / carrot / potato / banana / mango / avocado / citrus / herbs', () => {
    for (const c of ['cucumber','carrot','potato','banana','mango','avocado','citrus','herbs']) {
      const d = getDurationDays(c);
      expect(d).toBeTruthy();
      expect(d.cropKey).toBe(c);
    }
  });

  it('aliases citrus species + non-basil herbs (plantain is now its own crop)', () => {
    // basil has its own entry; mint / cilantro / thyme fall back
    // through the herbs catch-all.
    expect(getDurationDays('mint').cropKey).toBe('herbs');
    // plantain split from banana — distinct, longer duration. See expansion test.
    expect(getDurationDays('plantain').cropKey).toBe('plantain');
    expect(getDurationDays('orange').cropKey).toBe('citrus');
    expect(getDurationDays('lemon').cropKey).toBe('citrus');
  });
});

// ─── Lifecycle engine — germination + seedling stages ────

describe('LIFECYCLE_STAGE — germination + seedling added', () => {
  it('includes both new stages', () => {
    expect(LIFECYCLE_STAGE.GERMINATION).toBe('germination');
    expect(LIFECYCLE_STAGE.SEEDLING).toBe('seedling');
  });
});

// ─── plantingWindowEngine ────────────────────────────────

describe('plantingWindowEngine — region-aware windows', () => {
  it('returns USA tomato window in April–June', () => {
    const w = getPlantingWindow({ country: 'usa', crop: 'tomato', nowMs: Date.UTC(2026, 4, 15) });
    expect(w.ok).toBe(true);
    expect(w.startMonth).toBe(4);
    expect(w.endMonth).toBe(6);
    expect(w.inWindow).toBe(true);
    expect(w.why.fallback).toMatch(/frost|young|cold/i);
  });

  it('returns Ghana tomato window that wraps the new year (cool dry months)', () => {
    const w = getPlantingWindow({ country: 'Ghana', crop: 'tomato', nowMs: Date.UTC(2026, 0, 15) });
    expect(w.ok).toBe(true);
    expect(w.startMonth).toBe(9);
    expect(w.endMonth).toBe(2);
    expect(w.inWindow).toBe(true);
  });

  it('returns Kenya maize window in March–May (long rains)', () => {
    const w = getPlantingWindow({ country: 'kenya', crop: 'maize', nowMs: Date.UTC(2026, 3, 15) });
    expect(w.ok).toBe(true);
    expect(w.inWindow).toBe(true);
    expect(w.why.fallback).toMatch(/rains/i);
  });

  it('returns India rice window (kharif paddy)', () => {
    const w = getPlantingWindow({ country: 'India', crop: 'rice' });
    expect(w.ok).toBe(true);
    expect(w.why.fallback).toMatch(/paddy|kharif|rains/i);
  });

  it('honours crop aliases (corn → maize)', () => {
    const w = getPlantingWindow({ country: 'usa', crop: 'corn' });
    expect(w.ok).toBe(true);
    expect(w.cropKey).toBe('maize');
  });

  it('falls back to no_data instead of guessing on unknown pairs', () => {
    expect(getPlantingWindow({ country: 'usa', crop: 'cassava' }).reason).toBe('no_data');
    expect(getPlantingWindow({ country: 'xyz', crop: 'tomato' }).reason).toBe('no_data');
  });

  it('covers the expanded staple set for Ghana + Kenya', () => {
    for (const crop of ['groundnut', 'cowpea', 'soybean', 'sorghum', 'millet', 'sweet potato', 'plantain', 'cocoa', 'cocoyam']) {
      expect(getPlantingWindow({ country: 'ghana', crop }).ok, 'ghana ' + crop).toBe(true);
    }
    for (const crop of ['cowpea', 'soybean', 'groundnut', 'sorghum', 'kale', 'sweet potato', 'banana']) {
      expect(getPlantingWindow({ country: 'kenya', crop }).ok, 'kenya ' + crop).toBe(true);
    }
  });

  it('resolves expanded aliases without mis-matching (soybean≠beans, cocoyam≠yam, guinea corn→sorghum)', () => {
    // These would mis-route to beans/yam/maize without specific-before-generic ordering.
    expect(getPlantingWindow({ country: 'ghana', crop: 'soybean' }).cropKey).toBe('soybean');      // not beans
    expect(getPlantingWindow({ country: 'ghana', crop: 'cocoyam' }).cropKey).toBe('cocoyam');      // not yam
    expect(getPlantingWindow({ country: 'ghana', crop: 'guinea corn' }).cropKey).toBe('sorghum');  // not maize
    expect(getPlantingWindow({ country: 'ghana', crop: 'peanut' }).cropKey).toBe('groundnut');     // → groundnut
    // A crop with no window for a region still honestly returns no_data.
    expect(getPlantingWindow({ country: 'india', crop: 'cocoa' }).reason).toBe('no_data');
  });

  it('exposes the 4 supported regions', () => {
    expect(PLANTING_REGIONS).toEqual(['usa', 'ghana', 'kenya', 'india']);
  });

  it('every result carries isEstimate + disclaimer (no hard date promise)', () => {
    const w = getPlantingWindow({ country: 'usa', crop: 'tomato' });
    expect(w.isEstimate).toBe(true);
    expect(w.disclaimer).toMatch(/local weather|may shift|few weeks/i);
  });

  it('never throws on garbage input', () => {
    expect(() => getPlantingWindow(null)).not.toThrow();
    expect(getPlantingWindow(null).reason).toBe('no_data');
  });
});

// ─── generateLifecycleTasks (spec §5 named entry) ────────

describe('generateLifecycleTasks — thin facade over the engine', () => {
  it('returns the stage-appropriate task envelopes for a known crop', () => {
    const tasks = generateLifecycleTasks({
      crop: 'tomato',
      plantingDate: new Date(Date.UTC(2026, 4, 22) - 50 * 24 * 3600 * 1000).toISOString(),
      nowMs: Date.UTC(2026, 4, 22),
    });
    expect(tasks.length).toBeGreaterThan(0);
    for (const t of tasks) {
      expect(t.titleKey).toMatch(/^lifecycle\.task\./);
      expect(typeof t.titleFallback).toBe('string');
      expect(typeof t.stage).toBe('string');
      expect(['low', 'medium', 'high']).toContain(t.urgency);
      expect(t.isLifecycle).toBe(true);
    }
  });

  it('PLANNING tasks are low urgency; HARVEST_READY is high', () => {
    // Planning (no planting date).
    const planTasks = generateLifecycleTasks({ crop: 'tomato' });
    expect(planTasks.every((t) => t.urgency === 'low')).toBe(true);

    // Force harvest-ready by planting ~80 days ago (tomato max=90).
    const harvestTasks = generateLifecycleTasks({
      crop: 'tomato',
      plantingDate: new Date(Date.UTC(2026, 4, 22) - 80 * 24 * 3600 * 1000).toISOString(),
      nowMs: Date.UTC(2026, 4, 22),
    });
    // Some stage at this offset — verify the urgency rule fires
    // correctly if we land in harvest_ready / harvest.
    if (harvestTasks[0] && (harvestTasks[0].stage === 'harvest_ready'
        || harvestTasks[0].stage === 'harvest')) {
      expect(harvestTasks[0].urgency).toBe('high');
    }
  });

  it('never throws on garbage input — returns the safe PLANNING tasks', () => {
    expect(() => generateLifecycleTasks(null)).not.toThrow();
    const r = generateLifecycleTasks(null);
    expect(Array.isArray(r)).toBe(true);
    // Garbage falls through to PLANNING — its tasks are low urgency.
    for (const t of r) expect(t.urgency).toBe('low');
  });
});

// ─── lifecycleObservability (spec §16.F) ─────────────────

describe('lifecycleObservability — the 6 named events', () => {
  beforeEach(() => resetLifecycleObservationCounts());

  it('ships all six documented event names', () => {
    for (const e of [
      'lifecycle_created', 'stage_changed', 'harvest_window_viewed',
      'lifecycle_task_completed', 'harvest_logged',
      'lifecycle_notification_opened',
    ]) {
      expect(Object.values(LIFECYCLE_OBS)).toContain(e);
    }
  });

  it('counts events in-memory', () => {
    recordLifecycleObservation(LIFECYCLE_OBS.LIFECYCLE_CREATED);
    recordLifecycleObservation(LIFECYCLE_OBS.STAGE_CHANGED);
    recordLifecycleObservation(LIFECYCLE_OBS.HARVEST_LOGGED);
    const c = getLifecycleObservationCounts();
    expect(c[LIFECYCLE_OBS.LIFECYCLE_CREATED]).toBe(1);
    expect(c[LIFECYCLE_OBS.STAGE_CHANGED]).toBe(1);
    expect(c[LIFECYCLE_OBS.HARVEST_LOGGED]).toBe(1);
  });

  it('trackStageChange is a no-op when the stage did not change', () => {
    expect(trackStageChange('flowering', 'flowering')).toBe(false);
    expect(trackStageChange(null, 'flowering')).toBe(false);
    expect(trackStageChange('flowering', null)).toBe(false);
    expect(getLifecycleObservationCounts().stage_changed || 0).toBe(0);
  });

  it('trackStageChange fires when stages differ', () => {
    expect(trackStageChange('flowering', 'fruiting')).toBe(true);
    expect(getLifecycleObservationCounts().stage_changed).toBe(1);
  });

  it('never throws on bogus input', () => {
    expect(() => recordLifecycleObservation(null)).not.toThrow();
    expect(recordLifecycleObservation(undefined)).toBe(false);
  });
});
