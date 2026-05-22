/**
 * cropLifecycle.test.js — Full Crop/Plant Lifecycle Intelligence.
 * Verifies the duration registry, the harvest-window honesty rules,
 * stage-based tasks, weather/scan integration, and the mode-aware
 * lifecycle snapshot.
 */

import { describe, it, expect } from 'vitest';
import {
  KNOWN_CROPS, getDurationDays, estimateHarvestWindow,
} from '../../../src/core/lifecycle/cropDurationRegistry.js';
import {
  LIFECYCLE_STAGE, computeLifecycleSnapshot,
} from '../../../src/core/lifecycle/cropLifecycleEngine.js';

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
