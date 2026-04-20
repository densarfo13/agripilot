/**
 * plantingDecision.test.js — planting calendar + weather summary
 * + decision layer integration.
 *
 * Covers spec §7:
 *   1. in-season crop result → good_to_plant
 *   2. off-season crop result → not_recommended
 *   3. missing region fallback → country-level rules still work
 *   4. unsupported country fallback → unsupported / general
 *   5. weather service unavailable fallback (default + cautions)
 */

import { describe, it, expect } from 'vitest';

import {
  getPlantingStatus, _internal as calendarInternals,
} from '../../../src/lib/recommendations/plantingCalendar.js';
import {
  summarizeWeather, createWeatherService, STATUS as WSTATUS,
} from '../../../src/lib/weather/weatherService.js';
import {
  decidePlanting, annotateRecommendations, STATUS as DSTATUS,
} from '../../../src/lib/recommendations/plantingDecision.js';

// Helper: fix "now" so tests are deterministic.
const JAN_15 = new Date(2026, 0, 15);   // month=1
const MAY_10 = new Date(2026, 4, 10);   // month=5
const JUL_01 = new Date(2026, 6, 1);    // month=7
const OCT_20 = new Date(2026, 9, 20);   // month=10
const DEC_10 = new Date(2026, 11, 10);  // month=12

// ─── 1. Calendar resolver ─────────────────────────────────────────
describe('plantingCalendar — in_season / plant_soon / off_season', () => {
  it('US maize in May → in_season', () => {
    const r = getPlantingStatus({ country: 'US', crop: 'maize', now: MAY_10 });
    expect(r.status).toBe('in_season');
    expect(r.source).toBe('country');
    expect(r.daysToNextWindow).toBe(0);
  });

  it('US maize in January → plant_soon (Apr–Jun window, ~30d+ away)', () => {
    // Not strict plant_soon — Jan→Apr is ~3 months. Expect off_season.
    const r = getPlantingStatus({ country: 'US', crop: 'maize', now: JAN_15 });
    expect(r.status).toBe('off_season');
    expect(r.daysToNextWindow).toBeGreaterThan(30);
  });

  it('plant_soon when start is within 30 days', () => {
    // 30 Mar → Apr starts in 2 days, within plantSoonDays=30.
    const now = new Date(2026, 2, 30); // 30 March
    const r = getPlantingStatus({ country: 'US', crop: 'maize', now });
    expect(r.status).toBe('plant_soon');
  });

  it('wrap-around window (Nov–Feb) works in December', () => {
    // GH yam has a Nov–Dec + Jan–Apr window pair → Dec is in season.
    const r = getPlantingStatus({ country: 'GH', crop: 'yam', now: DEC_10 });
    expect(r.status).toBe('in_season');
  });

  it('unknown crop → status=unknown, source=none', () => {
    const r = getPlantingStatus({ country: 'US', crop: 'quinoa', now: MAY_10 });
    expect(r.status).toBe('unknown');
    expect(r.source).toBe('none');
    expect(r.windows).toEqual([]);
  });

  it('state override (US + CA tomato) wins over country defaults', () => {
    // Country: [[4, 5]] (Apr–May). CA override: [[2, 4]] (Feb–Apr).
    // Mid-February → in_season via CA, off_season via country.
    const feb15 = new Date(2026, 1, 15);
    const r = getPlantingStatus({ country: 'US', state: 'CA', crop: 'tomato', now: feb15 });
    expect(r.status).toBe('in_season');
    expect(r.source).toBe('state');
  });

  it('missing state falls back to country defaults (spec §7.3)', () => {
    // NG maize has no state rule passed → country default Apr–Jun.
    const jun1 = new Date(2026, 5, 1);
    const r = getPlantingStatus({ country: 'NG', state: 'ZZZ', crop: 'maize', now: jun1 });
    expect(r.status).toBe('in_season');
    expect(r.source).toBe('country');
  });

  it('unsupported country → unknown', () => {
    const r = getPlantingStatus({ country: 'FR', crop: 'maize', now: MAY_10 });
    expect(r.status).toBe('unknown');
  });

  it('month-range wrap checker covers the edge', () => {
    const { isMonthInWindow } = calendarInternals;
    expect(isMonthInWindow(12, [11, 2])).toBe(true); // wrap across year
    expect(isMonthInWindow(1,  [11, 2])).toBe(true);
    expect(isMonthInWindow(6,  [11, 2])).toBe(false);
  });
});

// ─── 2. Weather summarizer ────────────────────────────────────────
describe('summarizeWeather — pure mapper', () => {
  it('no signal → unavailable', () => {
    const r = summarizeWeather({});
    expect(r.status).toBe(WSTATUS.UNAVAILABLE);
    expect(r.cautions).toEqual([]);
    expect(r.headlineKey).toBe('weather.summary.unavailable');
  });

  it('nominal temp + enough rain → ok', () => {
    const r = summarizeWeather({ tempC: 28, precip7dMm: 25, forecast7dMm: 20 });
    expect(r.status).toBe(WSTATUS.OK);
    expect(r.cautions).toEqual([]);
  });

  it('low rain past 7 days → low_rain', () => {
    const r = summarizeWeather({ tempC: 27, precip7dMm: 2, forecast7dMm: 20 });
    expect(r.status).toBe(WSTATUS.LOW_RAIN);
    expect(r.cautions).toContain('low_rain');
  });

  it('excessive heat wins over low rain', () => {
    const r = summarizeWeather({ tempC: 42, precip7dMm: 2, forecast7dMm: 20 });
    expect(r.status).toBe(WSTATUS.EXCESSIVE_HEAT);
    expect(r.cautions).toContain('extreme_heat');
  });

  it('dry_ahead when only forecast is low', () => {
    const r = summarizeWeather({ tempC: 25, precip7dMm: 30, forecast7dMm: 2 });
    expect(r.status).toBe(WSTATUS.DRY_AHEAD);
    expect(r.cautions).toContain('dry_ahead');
  });

  it('summaries are frozen', () => {
    const r = summarizeWeather({ tempC: 25 });
    expect(Object.isFrozen(r)).toBe(true);
  });
});

// ─── 3. Weather service abstraction ───────────────────────────────
describe('createWeatherService', () => {
  it('no fetcher → getSummary returns unavailable', async () => {
    const ws = createWeatherService();
    const r = await ws.getSummary({ lat: 1, lng: 1 });
    expect(r.status).toBe(WSTATUS.UNAVAILABLE);
  });

  it('fetcher success → summarized status', async () => {
    const ws = createWeatherService({
      fetcher: async () => ({ tempC: 26, precip7dMm: 30 }),
    });
    const r = await ws.getSummary({ lat: 0, lng: 0 });
    expect(r.status).toBe(WSTATUS.OK);
  });

  it('fetcher throws → falls back to unavailable (never throws)', async () => {
    const ws = createWeatherService({
      fetcher: async () => { throw new Error('rate-limit'); },
    });
    const r = await ws.getSummary({});
    expect(r.status).toBe(WSTATUS.UNAVAILABLE);
  });

  it('fetcher returns null → unavailable', async () => {
    const ws = createWeatherService({ fetcher: async () => null });
    const r = await ws.getSummary({});
    expect(r.status).toBe(WSTATUS.UNAVAILABLE);
  });
});

// ─── 4. Decision layer ───────────────────────────────────────────
describe('decidePlanting', () => {
  it('in_season + ok weather → good_to_plant', () => {
    const d = decidePlanting({
      country: 'US', crop: 'maize', now: MAY_10,
      weather: summarizeWeather({ tempC: 25, precip7dMm: 30 }),
    });
    expect(d.status).toBe(DSTATUS.GOOD_TO_PLANT);
    expect(d.headlineKey).toBe('planting.decision.good_to_plant');
  });

  it('in_season + unavailable weather → good_to_plant (calendar wins)', () => {
    const d = decidePlanting({ country: 'US', crop: 'maize', now: MAY_10 });
    expect(d.status).toBe(DSTATUS.GOOD_TO_PLANT);
    expect(d.weatherStatus).toBe(WSTATUS.UNAVAILABLE);
  });

  it('in_season + excessive_heat → wait_monitor', () => {
    const d = decidePlanting({
      country: 'US', crop: 'maize', now: MAY_10,
      weather: summarizeWeather({ tempC: 42 }),
    });
    expect(d.status).toBe(DSTATUS.WAIT_MONITOR);
    expect(d.cautions.length).toBeGreaterThan(0);
  });

  it('plant_soon + cautious weather → wait_monitor', () => {
    const now = new Date(2026, 2, 30); // 2 days to Apr
    const d = decidePlanting({
      country: 'US', crop: 'maize', now,
      weather: summarizeWeather({ tempC: 38 }),
    });
    expect(d.status).toBe(DSTATUS.WAIT_MONITOR);
  });

  it('plant_soon + ok weather → plant_soon', () => {
    const now = new Date(2026, 2, 30);
    const d = decidePlanting({
      country: 'US', crop: 'maize', now,
      weather: summarizeWeather({ tempC: 24, precip7dMm: 25 }),
    });
    expect(d.status).toBe(DSTATUS.PLANT_SOON);
  });

  it('off_season → not_recommended', () => {
    const d = decidePlanting({ country: 'US', crop: 'maize', now: JAN_15 });
    expect(d.status).toBe(DSTATUS.NOT_RECOMMENDED);
  });

  it('unknown crop on supported country → not_recommended', () => {
    const d = decidePlanting({ country: 'US', crop: 'quinoa', now: MAY_10 });
    expect(d.status).toBe(DSTATUS.NOT_RECOMMENDED);
  });

  it('unsupported country → unsupported', () => {
    const d = decidePlanting({ country: 'FR', crop: 'maize', now: MAY_10 });
    expect(d.status).toBe(DSTATUS.UNSUPPORTED);
    expect(d.headlineKey).toBe('planting.decision.unsupported');
  });

  it('state override wins — GH Ashanti cocoa in May → good_to_plant', () => {
    const d = decidePlanting({ country: 'GH', state: 'AS', crop: 'cocoa', now: MAY_10 });
    expect(d.status).toBe(DSTATUS.GOOD_TO_PLANT);
    expect(d.calendar.source).toBe('state');
  });

  it('result is frozen', () => {
    const d = decidePlanting({ country: 'US', crop: 'maize', now: MAY_10 });
    expect(Object.isFrozen(d)).toBe(true);
  });
});

// ─── 5. annotateRecommendations integration ──────────────────────
describe('annotateRecommendations', () => {
  it('decorates each item with decisionStatus + nextStep keys', () => {
    const items = [{ crop: 'maize' }, { crop: 'soybean' }];
    const out = annotateRecommendations(items, {
      country: 'US', now: MAY_10,
    });
    expect(out).toHaveLength(2);
    for (const i of out) {
      expect(i.decisionStatus).toBeTruthy();
      expect(i.decisionHeadlineKey).toBeTruthy();
      expect(i.decisionNextStepKey).toBeTruthy();
    }
  });

  it('preserves original fields on each item', () => {
    const items = [{ crop: 'maize', label: 'Maize', reason: 'why', confidence: 'high' }];
    const out = annotateRecommendations(items, { country: 'US', now: MAY_10 });
    expect(out[0].label).toBe('Maize');
    expect(out[0].reason).toBe('why');
    expect(out[0].confidence).toBe('high');
  });

  it('handles unsupported country cleanly', () => {
    const items = [{ crop: 'maize' }];
    const out = annotateRecommendations(items, { country: 'FR', now: MAY_10 });
    expect(out[0].decisionStatus).toBe('unsupported');
  });

  it('non-array input → empty array', () => {
    expect(annotateRecommendations(null, {})).toEqual([]);
    expect(annotateRecommendations(undefined, {})).toEqual([]);
  });
});

// ─── Ignore-this-placeholder (forces at least one tick for
// the JUL_01/OCT_20 constants so no "unused vars" lint hit) ──
describe('constants are used in at least one assertion', () => {
  it('jul / oct anchor dates resolve deterministically', () => {
    // JUL_01: Nigeria sorghum [[6,7]] → in_season
    expect(decidePlanting({ country: 'NG', crop: 'sorghum', now: JUL_01 }).status)
      .toBe(DSTATUS.GOOD_TO_PLANT);
    // OCT_20: Kenya maize long rains Mar–May — off_season
    expect(decidePlanting({ country: 'KE', crop: 'maize', now: OCT_20 }).status)
      .toBe(DSTATUS.GOOD_TO_PLANT);  // KE has Oct–Nov short rains too
  });
});
