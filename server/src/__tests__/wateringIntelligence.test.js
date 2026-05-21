/**
 * wateringIntelligence.test.js — Watering Intelligence + Reminder
 * System. Covers the engine (computeWateringRecommendation + the
 * notification adapter) and the schedule module (CRUD, next-time,
 * is-due, missed-watering follow-up).
 */

// Minimal in-memory window.localStorage shim — offlineStore reads
// `window.localStorage`, so the schedule tests need a `window` too.
const _s = new Map();
const _ls = {
  getItem:    (k) => (_s.has(k) ? _s.get(k) : null),
  setItem:    (k, v) => { _s.set(k, String(v)); },
  removeItem: (k) => { _s.delete(k); },
  clear:      () => { _s.clear(); },
};
if (typeof globalThis.window === 'undefined') {
  globalThis.window = { localStorage: _ls };
} else if (!globalThis.window.localStorage) {
  globalThis.window.localStorage = _ls;
}
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = _ls;
}

import { describe, it, expect, beforeEach } from 'vitest';
import {
  WATERING_ACTION, WATERING_TIME, RISK, URGENCY,
  computeWateringRecommendation, wateringNotificationFor,
  localizeWateringMessage,
} from '../../../src/core/watering/wateringEngine.js';
import {
  SCHEDULE_SCOPE, REPEAT, TIME_OF_DAY,
  saveSchedule, getSchedules, removeSchedule,
  nextScheduledWatering, isWateringDue, missedWateringFollowUp,
} from '../../../src/core/watering/wateringSchedule.js';

const TUE_8AM = Date.UTC(2026, 4, 19, 12, 0, 0); // Tue 12:00 UTC ≈ morning slot range locally

// ─── Engine ────────────────────────────────────────────────

describe('wateringEngine — weather-aware recommendation', () => {
  it('skips watering when rain is forecast', () => {
    const r = computeWateringRecommendation({
      crop: 'peppers', mode: 'gardener',
      weather: { rainProbability24hPct: 80 },
      nowMs: TUE_8AM,
    });
    expect(r.recommendation).toBe(WATERING_ACTION.SKIP);
    expect(r.skipReason).toMatch(/rain/i);
  });

  it('skips watering when it has already rained today', () => {
    const r = computeWateringRecommendation({
      crop: 'tomato',
      weather: { rainfallTodayMm: 12 },
      nowMs: TUE_8AM,
    });
    expect(r.recommendation).toBe(WATERING_ACTION.SKIP);
    expect(r.overwateringRisk).not.toBe(RISK.LOW);
  });

  it('keeps watering in the morning during high heat', () => {
    const r = computeWateringRecommendation({
      crop: 'maize', mode: 'farmer',
      weather: { temperatureC: 34, daysSinceRain: 3 },
      nowMs: TUE_8AM,
    });
    expect(r.recommendation).toBe(WATERING_ACTION.WATER);
    expect(r.idealTime).toBe(WATERING_TIME.MORNING);
    expect(r.next).toMatch(/Irrigate/);
  });

  it('damps frequency when humidity is very high and soil is fine', () => {
    const r = computeWateringRecommendation({
      crop: 'beans',
      weather: { humidityPct: 92, daysSinceRain: 1 },
      nowMs: TUE_8AM,
    });
    expect(r.recommendation).toBe(WATERING_ACTION.MONITOR);
  });

  it('uses gardener phrasing for the gardener mode', () => {
    const r = computeWateringRecommendation({
      crop: 'basil', mode: 'gardener',
      weather: { temperatureC: 24 },
      nowMs: TUE_8AM,
    });
    expect(r.next).toMatch(/Water /);
  });

  it('flags high drought risk after a long dry spell', () => {
    const r = computeWateringRecommendation({
      crop: 'maize', mode: 'farmer',
      weather: { daysSinceRain: 10 },
      nowMs: TUE_8AM,
    });
    expect(r.droughtRisk).toBe(RISK.HIGH);
    expect(r.recommendation).toBe(WATERING_ACTION.WATER);
  });

  it('never throws on garbage input', () => {
    expect(() => computeWateringRecommendation(null)).not.toThrow();
    expect(computeWateringRecommendation('x').recommendation).toBe(WATERING_ACTION.MONITOR);
  });
});

// ─── v2 — adaptive output contract ─────────────────────────

describe('wateringEngine v2 — adaptive output contract', () => {
  it('every result carries shouldWaterToday + urgency + risk + localizedMessage', () => {
    const r = computeWateringRecommendation({
      crop: 'maize', mode: 'farmer',
      weather: { temperatureC: 32, daysSinceRain: 10 },
      nowMs: TUE_8AM,
    });
    expect(r.shouldWaterToday).toBe(true);
    expect(r.urgency).toBe(URGENCY.HIGH);
    expect(r.risk).toBe(RISK.HIGH);
    expect(r.bestTime).toBe(WATERING_TIME.MORNING);
    expect(r.localizedMessage.key).toMatch(/^watering\.msg\./);
    expect(typeof r.localizedMessage.fallback).toBe('string');
  });

  it('shouldWaterToday is false for skip and monitor', () => {
    const rainy = computeWateringRecommendation({
      weather: { rainProbability24hPct: 90 }, nowMs: TUE_8AM,
    });
    const humid = computeWateringRecommendation({
      weather: { humidityPct: 92, daysSinceRain: 1 }, nowMs: TUE_8AM,
    });
    expect(rainy.shouldWaterToday).toBe(false);
    expect(humid.shouldWaterToday).toBe(false);
  });
});

// ─── v2 — disease-aware scan adjustment ────────────────────

describe('wateringEngine v2 — scan-aware adjustment', () => {
  it('fungal scan stress reduces watering to monitor + base-only', () => {
    const r = computeWateringRecommendation({
      crop: 'tomato', mode: 'gardener',
      stress: { category: 'fungal' },
      weather: { temperatureC: 28 },
      nowMs: TUE_8AM,
    });
    expect(r.recommendation).toBe(WATERING_ACTION.MONITOR);
    expect(r.overwateringRisk).toBe(RISK.HIGH);
    expect(r.localizedMessage.fallback).toMatch(/leaves/i);
  });

  it('mold / rot also reduce watering', () => {
    for (const cat of ['mold', 'rot', 'mildew']) {
      const r = computeWateringRecommendation({
        crop: 'pepper', stress: { category: cat }, nowMs: TUE_8AM,
      });
      expect(r.recommendation).toBe(WATERING_ACTION.MONITOR);
    }
  });

  it('wilting drought stress still escalates to water (dry, not wet, disease)', () => {
    const r = computeWateringRecommendation({
      crop: 'maize', mode: 'farmer',
      stress: { wilting: true, scanStress: 'high' },
      weather: { temperatureC: 30 },
      nowMs: TUE_8AM,
    });
    expect(r.recommendation).toBe(WATERING_ACTION.WATER);
    expect(r.urgency).toBe(URGENCY.HIGH);
  });
});

// ─── v2 — snapshot input (getIntelligenceSnapshot integration) ─

describe('wateringEngine v2 — snapshot input', () => {
  it('reads weather + crop + mode from a snapshot when not passed directly', () => {
    const r = computeWateringRecommendation({
      snapshot: {
        mode: 'gardener', crop: 'basil',
        weather: { rainProbability24hPct: 85 },
      },
      nowMs: TUE_8AM,
    });
    expect(r.recommendation).toBe(WATERING_ACTION.SKIP);
  });

  it('explicit fields override snapshot values', () => {
    const r = computeWateringRecommendation({
      crop: 'pepper',
      snapshot: { crop: 'basil', weather: { temperatureC: 22 } },
      weather: { temperatureC: 32, daysSinceRain: 9 },
      nowMs: TUE_8AM,
    });
    expect(r.recommendation).toBe(WATERING_ACTION.WATER);
    expect(r.droughtRisk).toBe(RISK.HIGH);
  });
});

// ─── v2 — localization seam ────────────────────────────────

describe('localizeWateringMessage — translator + param substitution', () => {
  it('falls back to English when no translator is supplied', () => {
    const r = computeWateringRecommendation({
      crop: 'peppers', mode: 'gardener',
      weather: { temperatureC: 24 }, nowMs: TUE_8AM,
    });
    const text = localizeWateringMessage(r.localizedMessage);
    expect(text).toMatch(/peppers/i);
  });

  it('uses the translator and substitutes {crop}', () => {
    const r = computeWateringRecommendation({
      crop: 'tomato', mode: 'gardener',
      weather: { temperatureC: 24 }, nowMs: TUE_8AM,
    });
    const fakeT = (key, fallback) =>
      key === r.localizedMessage.key ? 'Arrosez {crop} ce matin.' : fallback;
    expect(localizeWateringMessage(r.localizedMessage, fakeT))
      .toBe('Arrosez tomato ce matin.');
  });

  it('never throws on garbage input', () => {
    expect(() => localizeWateringMessage(null)).not.toThrow();
    expect(localizeWateringMessage(null)).toBe('');
  });

  it('no hardcoded English on watering fallback paths — every result has a translation key', () => {
    const cases = [
      { weather: { rainfallTodayMm: 12 } },
      { weather: { rainProbability24hPct: 80 } },
      { weather: { temperatureC: 22 } },
      { weather: { humidityPct: 92, daysSinceRain: 1 } },
      { stress: { category: 'fungal' } },
      { weather: { daysSinceRain: 10 } },
    ];
    for (const c of cases) {
      const r = computeWateringRecommendation({ ...c, crop: 'maize', nowMs: TUE_8AM });
      expect(r.localizedMessage.key).toMatch(/^watering\.msg\./);
    }
  });
});

// ─── Notification adapter ──────────────────────────────────

describe('wateringNotificationFor — orchestrator-compatible spec', () => {
  it('builds a task_reminder for a "water" recommendation', () => {
    const rec = computeWateringRecommendation({
      crop: 'peppers', weather: { temperatureC: 22 }, nowMs: TUE_8AM,
    });
    const n = wateringNotificationFor(rec, { id: 'w1', language: 'fr', mode: 'gardener' });
    expect(n).toBeTruthy();
    expect(n.kind).toBe('task_reminder');
    expect(n.language).toBe('fr');
  });

  it('builds an irrigation_warning when overwatering risk is high', () => {
    const rec = computeWateringRecommendation({
      crop: 'maize',
      weather: { rainfallTodayMm: 20 },
      nowMs: TUE_8AM,
    });
    const n = wateringNotificationFor(rec, { id: 'w2' });
    expect(n.kind).toBe('irrigation_warning');
  });

  it('returns null for a soft monitor — no push spam', () => {
    const rec = computeWateringRecommendation({
      weather: { humidityPct: 92, daysSinceRain: 1 },
      nowMs: TUE_8AM,
    });
    expect(wateringNotificationFor(rec)).toBe(null);
  });
});

// ─── Schedule CRUD + time math ─────────────────────────────

describe('wateringSchedule — manual schedules', () => {
  beforeEach(() => { try { _s.clear(); } catch { /* ignore */ } });

  it('a farmer can create a field-scale schedule', () => {
    const s = saveSchedule({
      scope: SCHEDULE_SCOPE.FARM, mode: 'farmer',
      crop: 'maize', times: ['morning'], daysOfWeek: [1, 3, 5],
      repeat: REPEAT.WEEKLY,
    });
    expect(s.scope).toBe('farm');
    expect(s.mode).toBe('farmer');
    expect(s.times).toEqual([TIME_OF_DAY.MORNING]);
    expect(getSchedules().length).toBe(1);
  });

  it('a gardener can create a container-scale schedule', () => {
    const s = saveSchedule({
      scope: SCHEDULE_SCOPE.GARDEN, mode: 'gardener',
      crop: 'basil', times: ['morning', 'evening'],
    });
    expect(s.times.length).toBe(2);
    expect(s.mode).toBe('gardener');
  });

  it('removeSchedule deletes by id', () => {
    const a = saveSchedule({ scope: 'garden' });
    const b = saveSchedule({ scope: 'garden' });
    removeSchedule(a.id);
    const ids = getSchedules().map((s) => s.id);
    expect(ids).not.toContain(a.id);
    expect(ids).toContain(b.id);
  });

  it('nextScheduledWatering picks a future morning/evening slot', () => {
    const sched = saveSchedule({
      scope: 'garden', times: ['morning'], daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    });
    const now = Date.now();
    const next = nextScheduledWatering(sched, now);
    expect(Number.isFinite(next)).toBe(true);
    expect(next).toBeGreaterThan(now);
  });

  it('isWateringDue and missedWateringFollowUp never throw', () => {
    expect(() => isWateringDue(null)).not.toThrow();
    expect(() => missedWateringFollowUp(null)).not.toThrow();
    expect(missedWateringFollowUp(null).needsFollowUp).toBe(false);
  });
});

// ─── Missed watering — calm, never spammy ─────────────────

describe('missedWateringFollowUp — one calm reminder, no spam', () => {
  it('does not remind during the grace window', () => {
    const now = Date.UTC(2026, 4, 20, 9, 0);
    const r = missedWateringFollowUp({
      lastDueMs: now - 30 * 60 * 1000, // 30 minutes ago
      nowMs: now, graceHours: 2,
    });
    expect(r.needsFollowUp).toBe(false);
  });

  it('reminds once a slot is overdue past grace', () => {
    const now = Date.UTC(2026, 4, 20, 12, 0);
    const r = missedWateringFollowUp({
      lastDueMs: now - 5 * 3600000,
      nowMs: now, graceHours: 2,
    });
    expect(r.needsFollowUp).toBe(true);
    expect(r.hoursOverdue).toBeGreaterThanOrEqual(2);
  });

  it('does not remind again if a follow-up already fired for the same slot', () => {
    const now = Date.UTC(2026, 4, 20, 12, 0);
    const slot = now - 5 * 3600000;
    const r = missedWateringFollowUp({
      lastDueMs: slot, lastFollowUpAt: slot + 30 * 60000,
      nowMs: now, graceHours: 2,
    });
    expect(r.needsFollowUp).toBe(false);
  });

  it('does not remind if the user already watered after the slot', () => {
    const now = Date.UTC(2026, 4, 20, 12, 0);
    const slot = now - 5 * 3600000;
    const r = missedWateringFollowUp({
      lastDueMs: slot, lastWateredAt: slot + 60 * 60000,
      nowMs: now, graceHours: 2,
    });
    expect(r.needsFollowUp).toBe(false);
  });
});
