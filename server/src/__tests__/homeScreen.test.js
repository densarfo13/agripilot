/**
 * homeScreen.test.js — behavioral contract for the Home fix.
 *
 * Covers the 13 spec sections by testing the pure helpers:
 *
 *   1. Home contract — 5 fixed regions, one dominant card
 *   2. state-aware welcome (priority order enforced)
 *   3. one dominant card rule (variant selection + why + CTA)
 *   4. state-first vs task-first display mode
 *   5. card copy rules (label, title, why, CTA, nextStep)
 *   6. why line always present
 *   7. next-step bridge for strong states
 *   8. progress line stays lightweight
 *  10. offline / stale safety (never high-conf; stale-safe variant)
 *  11. returning-user continuity (reminder variant)
 *  12. localization (no raw keys, Hindi round-trip)
 *  13. dev assertions flag violations
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  buildWelcomeMessage,
  resolveHomeDisplayMode,
  buildProgressLine,
  buildHomePayload,
  runHomeDevAssertions,
} from '../../../src/utils/home/index.js';
import { STATE_TYPES } from '../../../src/utils/farmerState/statePriority.js';
import { FRESHNESS } from '../../../src/utils/freshnessState.js';
import {
  HOME_TRANSLATIONS, applyHomeOverlay,
} from '../../../src/i18n/homeTranslations.js';
import { resolveFarmerState } from '../../../src/utils/farmerState/index.js';

function installLocalStorage() {
  const store = new Map();
  const fake = {
    getItem:    (k) => store.has(k) ? store.get(k) : null,
    setItem:    (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear:      () => store.clear(),
    key:        (i) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  };
  globalThis.window = { localStorage: fake };
  globalThis.localStorage = fake;
  return store;
}

const HOUR = 60 * 60 * 1000;
const DAY  = 24 * HOUR;
const NOW  = new Date('2026-04-19T09:00:00Z').getTime();
const MIDDAY = new Date('2026-04-19T13:00:00Z').getTime();

function makeT(locale = 'en') {
  const dict = HOME_TRANSLATIONS[locale] || {};
  return (key) => dict[key] || key;
}

function state(type, overrides = {}) {
  return {
    stateType: type,
    confidenceLevel: 'medium',
    staleData: false,
    titleFallback: overrides.titleFallback || null,
    subtitleFallback: overrides.subtitleFallback || null,
    whyFallback: overrides.whyFallback || null,
    nextFallback: overrides.nextFallback || null,
    titleKey: overrides.titleKey || null,
    subtitleKey: overrides.subtitleKey || null,
    whyKey: overrides.whyKey || null,
    nextKey: overrides.nextKey || null,
    ...overrides,
  };
}

// ─── 2. buildWelcomeMessage — state-aware ─────────────────
describe('buildWelcomeMessage — state priority', () => {
  const t = makeT('en');

  it('harvest_complete overrides time-of-day greeting', () => {
    const w = buildWelcomeMessage({
      name: 'Dennis',
      farmerState: state(STATE_TYPES.HARVEST_COMPLETE),
      t, now: NOW,
    });
    expect(w.line1).toBe('Harvest complete 🌾');
    expect(w.line2).toBe('Prepare your field for the next cycle');
  });

  it('returning_inactive renders "Welcome back, {name}"', () => {
    const w = buildWelcomeMessage({
      name: 'Dennis',
      farmerState: state(STATE_TYPES.RETURNING_INACTIVE),
      t, now: NOW,
    });
    expect(w.line1).toBe('Welcome back, Dennis');
    expect(w.line2).toBe('Let\u2019s get back on track');
  });

  it('stale_offline renders "Based on your last update"', () => {
    const w = buildWelcomeMessage({
      name: 'Dennis', staleData: true,
      farmerState: null, t, now: NOW,
    });
    expect(w.line1).toBe('Based on your last update');
    expect(w.line2).toBe('Check your field today');
  });

  it('first_use renders "Welcome, {name}"', () => {
    const w = buildWelcomeMessage({
      name: 'Dennis',
      farmerState: state(STATE_TYPES.FIRST_USE),
      t, now: NOW,
    });
    expect(w.line1).toBe('Welcome, Dennis');
    expect(w.line2).toBe('Let\u2019s set up your first crop');
  });

  it('active_cycle + rain ahead → time-of-day + rain subtitle', () => {
    const w = buildWelcomeMessage({
      name: 'Dennis',
      farmerState: state(STATE_TYPES.ACTIVE_CYCLE),
      weatherNow: { rainRisk: 'high', rainMmNext24h: 30 },
      t, now: NOW,
    });
    expect(w.line1).toBe('Good morning, Dennis');
    expect(w.line2).toMatch(/rain/i);
  });

  it('active_cycle + heat wave → heat-focused subtitle', () => {
    const w = buildWelcomeMessage({
      name: 'Dennis',
      farmerState: state(STATE_TYPES.ACTIVE_CYCLE),
      weatherNow: { heatRisk: 'high', tempHighC: 38 },
      t, now: NOW,
    });
    expect(w.line2).toMatch(/heat/i);
  });

  it('time-of-day changes with hour', () => {
    const morning = buildWelcomeMessage({
      name: 'A', farmerState: state(STATE_TYPES.ACTIVE_CYCLE),
      t, now: new Date('2026-04-19T08:00:00Z').getTime(),
    });
    const afternoon = buildWelcomeMessage({
      name: 'A', farmerState: state(STATE_TYPES.ACTIVE_CYCLE),
      t, now: new Date('2026-04-19T14:00:00Z').getTime(),
    });
    const evening = buildWelcomeMessage({
      name: 'A', farmerState: state(STATE_TYPES.ACTIVE_CYCLE),
      t, now: new Date('2026-04-19T20:00:00Z').getTime(),
    });
    expect(morning.line1).toMatch(/morning/i);
    expect(afternoon.line1).toMatch(/afternoon/i);
    expect(evening.line1).toMatch(/evening/i);
  });

  it('never emits an empty line2', () => {
    const w = buildWelcomeMessage({
      name: 'Dennis',
      farmerState: state(STATE_TYPES.ACTIVE_CYCLE),
      t, now: NOW,
    });
    expect(w.line2).toBeTruthy();
    expect(String(w.line2).trim().length).toBeGreaterThan(0);
  });

  it('null/empty input never throws', () => {
    expect(() => buildWelcomeMessage()).not.toThrow();
    expect(() => buildWelcomeMessage(null)).not.toThrow();
    const w = buildWelcomeMessage(null);
    expect(w.line1).toBeTruthy();
    expect(w.line2).toBeTruthy();
  });

  it('missing name falls back to localized "there"', () => {
    const w = buildWelcomeMessage({
      farmerState: state(STATE_TYPES.ACTIVE_CYCLE),
      t, now: NOW,
    });
    expect(w.line1).toMatch(/there/i);
  });

  it('Hindi round-trip renders Hindi header', () => {
    const t2 = makeT('hi');
    const w = buildWelcomeMessage({
      name: 'दीनेश',
      farmerState: state(STATE_TYPES.HARVEST_COMPLETE),
      t: t2, now: NOW,
    });
    expect(w.line1).toBe('फ़सल पूरी हुई 🌾');
    expect(w.line2).toBe('अगले चक्र के लिए खेत तैयार करें');
  });
});

// ─── 4. resolveHomeDisplayMode ────────────────────────────
describe('resolveHomeDisplayMode', () => {
  it('harvest_complete → state_first', () => {
    expect(resolveHomeDisplayMode(state(STATE_TYPES.HARVEST_COMPLETE,
      { confidenceLevel: 'high' }))).toBe('state_first');
  });

  it('blocked_by_land → task_first', () => {
    expect(resolveHomeDisplayMode(state(STATE_TYPES.BLOCKED_BY_LAND,
      { confidenceLevel: 'high' }))).toBe('task_first');
  });

  it('weather_sensitive → task_first', () => {
    expect(resolveHomeDisplayMode(state(STATE_TYPES.WEATHER_SENSITIVE,
      { confidenceLevel: 'high' }))).toBe('task_first');
  });

  it('returning_inactive → state_first', () => {
    expect(resolveHomeDisplayMode(state(STATE_TYPES.RETURNING_INACTIVE,
      { confidenceLevel: 'medium' }))).toBe('state_first');
  });

  it('active_cycle → task_first', () => {
    expect(resolveHomeDisplayMode(state(STATE_TYPES.ACTIVE_CYCLE,
      { confidenceLevel: 'high' }))).toBe('task_first');
  });

  it('LOW confidence flips any state to state_first', () => {
    expect(resolveHomeDisplayMode(state(STATE_TYPES.BLOCKED_BY_LAND,
      { confidenceLevel: 'low' }))).toBe('state_first');
  });

  it('null input defaults to state_first (safer)', () => {
    expect(resolveHomeDisplayMode(null)).toBe('state_first');
  });
});

// ─── 8. buildProgressLine — variants ──────────────────────
describe('buildProgressLine', () => {
  const t = makeT('en');

  it('all_done when done === total > 0', () => {
    const p = buildProgressLine({ done: 3, total: 3 }, t);
    expect(p.variant).toBe('all_done');
    expect(p.summary).toBe('All done for now');
  });

  it('in_progress shows "x of y"', () => {
    const p = buildProgressLine({ done: 2, total: 5 }, t);
    expect(p.variant).toBe('in_progress');
    expect(p.summary).toBe('2 of 5 done today');
  });

  it('on_track when total is unknown and done > 0', () => {
    const p = buildProgressLine({ done: 4, total: null }, t);
    expect(p.variant).toBe('on_track');
    expect(p.summary).toBe('On track');
  });

  it('empty when nothing queued', () => {
    const p = buildProgressLine({ done: 0, total: 0 }, t);
    expect(p.variant).toBe('empty');
    expect(p.summary).toBe('Nothing queued today');
  });

  it('never throws on invalid input', () => {
    expect(() => buildProgressLine()).not.toThrow();
    expect(() => buildProgressLine(null)).not.toThrow();
  });
});

// ─── 3 + 5 + 6. buildHomePayload — one-dominant-card contract ─
describe('buildHomePayload — dominant card + why always present', () => {
  const t = makeT('en');

  it('TASK-FIRST state (active_cycle) produces a task card with why + CTA', () => {
    const fs = resolveFarmerState({
      hasCompletedOnboarding: true, hasActiveCropCycle: true,
      cropProfile: { stage: 'growing', name: 'maize' },
      landProfile: { moisture: 'dry', cleared: true },
      weatherNow:  { rainRisk: 'low' },
    });
    const payload = buildHomePayload({
      farmerState: fs,
      task: { id: 't-1', title: 'Apply fertilizer now',
              why: 'Rain is coming later today',
              intent: 'fertilize',
              confidence: { level: 'medium' } },
      name: 'Dennis', t, now: MIDDAY,
      tasksTodayTotal: 6,
      counters: { tasks_completed_today: 4 },
    });
    expect(payload.displayMode).toBe('task_first');
    expect(payload.card.variant).toBe('task');
    expect(payload.card.title).toBe('Apply fertilizer now');
    expect(payload.card.why).toBe('Rain is coming later today');
    expect(payload.card.cta).toBe('Mark as done');
    expect(payload.card.nextStep).toBeNull();
    expect(payload.progress.summary).toBe('4 of 6 done today');
  });

  it('STATE-FIRST (harvest_complete) produces a state card with next-step bridge', () => {
    const fs = resolveFarmerState({
      hasJustCompletedHarvest: true,
      hasCompletedOnboarding: true, hasActiveCropCycle: true,
      cropProfile: { stage: 'harvest', name: 'maize' },
      landProfile: { cleared: true, moisture: 'dry' },
      weatherNow:  { rainRisk: 'low' },
      countryCode: 'GH',
    });
    const payload = buildHomePayload({
      farmerState: fs, name: 'Dennis', t, now: NOW,
    });
    expect(payload.displayMode).toBe('state_first');
    expect(payload.card.variant).toBe('state');
    expect(payload.card.title).toMatch(/Harvest complete/i);
    expect(payload.card.nextStep).toMatch(/prepare|next cycle/i);
    expect(payload.card.cta).toBe('Continue');
    expect(payload.card.why).toBeTruthy();
  });

  it('LOW-confidence task → "I checked" CTA + state_first display', () => {
    const fs = resolveFarmerState({
      cameraTask: { type: 'blurry' },
      hasCompletedOnboarding: true, hasActiveCropCycle: true,
      cropProfile: { stage: 'growing', name: 'maize' },
      landProfile: { moisture: 'dry' },
    });
    const payload = buildHomePayload({
      farmerState: fs, name: 'Dennis',
      task: { id: 't', title: 'Check before planting',
              why: 'Soil may still be wet',
              intent: 'plant', confidence: { level: 'low' } },
      t, now: NOW,
    });
    expect(fs.confidenceLevel).toBe('low');
    expect(payload.displayMode).toBe('state_first');
  });

  it('BLOCKED_BY_LAND is TASK-FIRST with why line present', () => {
    const fs = resolveFarmerState({
      cropProfile: { stage: 'planting', name: 'tomato' },
      landProfile: { moisture: 'wet', blocker: 'wet_soil', source: 'question' },
      hasCompletedOnboarding: true, hasActiveCropCycle: true,
      weatherNow: { rainRisk: 'low' },
    });
    const payload = buildHomePayload({
      farmerState: fs, name: 'Dennis',
      task: { id: 't', title: 'Wait before planting',
              why: 'Soil may still be too wet', intent: 'plant',
              confidence: { level: 'medium' } },
      t, now: NOW, tasksTodayTotal: 3, counters: { tasks_completed_today: 1 },
    });
    expect(payload.displayMode).toBe('task_first');
    expect(payload.card.variant).toBe('task');
    expect(payload.card.why).toBeTruthy();
    expect(payload.progress.summary).toBe('1 of 3 done today');
  });

  it('every payload has exactly ONE dominant card (object, not array)', () => {
    const fs = resolveFarmerState({
      hasCompletedOnboarding: true, hasActiveCropCycle: true,
      cropProfile: { stage: 'growing', name: 'maize' },
      landProfile: { moisture: 'dry', cleared: true },
      weatherNow:  { rainRisk: 'low' },
    });
    const payload = buildHomePayload({
      farmerState: fs, name: 'Dennis',
      task: { id: 't', title: 'X', why: 'Y', intent: 'water' },
      t, now: NOW,
    });
    expect(Array.isArray(payload.card)).toBe(false);
    expect(typeof payload.card).toBe('object');
    expect(payload.card.title).toBeTruthy();
  });
});

// ─── 7. next-step bridge enforcement ──────────────────────
describe('next-step bridge for strong states', () => {
  const t = makeT('en');

  it.each([
    STATE_TYPES.HARVEST_COMPLETE,
    STATE_TYPES.POST_HARVEST,
    STATE_TYPES.RETURNING_INACTIVE,
    STATE_TYPES.FIRST_USE,
    STATE_TYPES.FIELD_RESET,
  ])('%s payload includes a nextStep', (stateType) => {
    // Minimal fixture that reaches each state type.
    let ctx;
    switch (stateType) {
      case STATE_TYPES.HARVEST_COMPLETE:
        ctx = {
          hasJustCompletedHarvest: true,
          hasCompletedOnboarding: true, hasActiveCropCycle: true,
          cropProfile: { stage: 'harvest', name: 'maize' },
          landProfile: { cleared: true, moisture: 'dry' },
          weatherNow:  { rainRisk: 'low' },
        };
        break;
      case STATE_TYPES.POST_HARVEST:
        ctx = {
          hasCompletedOnboarding: true, hasActiveCropCycle: true,
          cropProfile: { stage: 'post_harvest', name: 'maize' },
          landProfile: { cleared: true, moisture: 'dry' },
        };
        break;
      case STATE_TYPES.RETURNING_INACTIVE:
        ctx = {
          missedDays: 5,
          hasCompletedOnboarding: true, hasActiveCropCycle: true,
          cropProfile: { stage: 'growing', name: 'maize' },
          landProfile: { moisture: 'dry' },
        };
        break;
      case STATE_TYPES.FIRST_USE:
        ctx = { hasCompletedOnboarding: false };
        break;
      case STATE_TYPES.FIELD_RESET:
        ctx = {
          hasCompletedOnboarding: true, hasActiveCropCycle: true,
          cropProfile: { stage: 'post_harvest', name: 'maize' },
          landProfile: { cleared: false, blocker: 'uncleared_land' },
        };
        break;
      default:
        ctx = {};
    }
    const fs = resolveFarmerState(ctx);
    const payload = buildHomePayload({
      farmerState: fs, name: 'Dennis', t, now: NOW,
    });
    expect(payload.card.nextStep).toBeTruthy();
  });
});

// ─── 10. offline / stale safety ───────────────────────────
describe('offline / stale safety', () => {
  const t = makeT('en');

  it('stale_offline produces a "stale_safe" card, never imperative', () => {
    const fs = resolveFarmerState({
      offlineState: { isOffline: true },
      lastUpdatedAt: Date.now() - 24 * HOUR,
      hasCompletedOnboarding: true, hasActiveCropCycle: true,
      cropProfile: { stage: 'growing', name: 'maize' },
      landProfile: { moisture: 'dry' },
    });
    const payload = buildHomePayload({
      farmerState: fs, name: 'Dennis', t, now: NOW,
    });
    expect(payload.card.variant).toBe('stale_safe');
    expect(payload.card.title).toBe('Check your field today');
    expect(payload.card.cta).toBe('Try again');
    expect(payload.card.confidenceLine).toBe('Based on your last update');
    expect(payload.card.level).toBe('low');
  });

  it('stale_safe card never has high-level wording', () => {
    const payload = buildHomePayload({
      freshness: FRESHNESS.VERY_STALE, name: 'Dennis', t, now: NOW,
    });
    expect(payload.card.variant).toBe('stale_safe');
    expect(payload.card.level).not.toBe('high');
  });

  it('stale_safe card has a "Based on your last update" confidence line', () => {
    const payload = buildHomePayload({
      freshness: FRESHNESS.VERY_STALE, name: 'Dennis', t, now: NOW,
    });
    expect(payload.card.confidenceLine).toBeTruthy();
  });

  it('completely empty input still produces a renderable safe card', () => {
    const payload = buildHomePayload({});
    expect(payload.card).toBeTruthy();
    expect(payload.card.title).toBeTruthy();
    expect(payload.welcome.line1).toBeTruthy();
  });
});

// ─── 11. returning-user continuity — reminder variant ────
describe('returning-user continuity — reminder variant', () => {
  beforeEach(() => installLocalStorage());
  const t = makeT('en');

  it('same task shown 26h ago + not completed → reminder label', () => {
    const fs = resolveFarmerState({
      hasCompletedOnboarding: true, hasActiveCropCycle: true,
      cropProfile: { stage: 'growing', name: 'maize' },
      landProfile: { moisture: 'dry', cleared: true },
      weatherNow:  { rainRisk: 'low' },
    });
    const continuity = {
      lastTaskId: 't-plant',
      lastTaskTitle: 'Plant tomatoes',
      lastSeenAt: NOW - 26 * HOUR,
      lastCompletedAt: null,
    };
    const payload = buildHomePayload({
      farmerState: fs, name: 'Dennis', continuity,
      task: { id: 't-plant', title: 'Plant tomatoes',
              why: 'Soil is ready', intent: 'plant' },
      t, now: NOW,
    });
    expect(payload.reminder).toBe(true);
    expect(payload.card.label).toBe('STILL ON YOUR LIST');
  });

  it('same task shown 1h ago → NOT reminder', () => {
    const continuity = {
      lastTaskId: 't-plant',
      lastTaskTitle: 'Plant tomatoes',
      lastSeenAt: NOW - 1 * HOUR,
      lastCompletedAt: null,
    };
    const payload = buildHomePayload({
      farmerState: null, name: 'Dennis', continuity,
      task: { id: 't-plant', title: 'Plant tomatoes',
              why: 'X', intent: 'plant' },
      t, now: NOW,
    });
    expect(payload.reminder).toBe(false);
  });
});

// ─── 12. localization — no raw keys ───────────────────────
describe('localization — no raw key leaks', () => {
  const t = makeT('en');

  it('all home payload strings are resolved', () => {
    const fs = resolveFarmerState({
      hasJustCompletedHarvest: true,
      hasCompletedOnboarding: true, hasActiveCropCycle: true,
      cropProfile: { stage: 'harvest', name: 'maize' },
      landProfile: { cleared: true, moisture: 'dry' },
      weatherNow:  { rainRisk: 'low' },
    });
    const payload = buildHomePayload({
      farmerState: fs, name: 'Dennis', t, now: NOW,
    });
    const strings = [
      payload.welcome.line1, payload.welcome.line2,
      payload.card.label, payload.card.title, payload.card.why,
      payload.card.cta, payload.card.nextStep,
      payload.progress.summary,
    ];
    for (const s of strings) {
      if (!s) continue;
      expect(s).not.toMatch(/^home\./);
      expect(s).not.toMatch(/^state\./);
      expect(s).not.toMatch(/^closing_gaps\./);
    }
  });

  it('applyHomeOverlay merges into existing dictionary', () => {
    const dict = { en: { 'other.key': 'v' }, hi: {} };
    applyHomeOverlay(dict);
    expect(dict.en['other.key']).toBe('v');
    expect(dict.en['home.welcome.good_morning_name']).toBe('Good morning, {name}');
    expect(dict.hi['home.welcome.welcome_back_name']).toMatch(/वापस स्वागत/);
  });

  it('core keys exist in every shipped locale', () => {
    const CORE = ['home.welcome.good_morning_name', 'home.card.label.today_task'];
    for (const locale of Object.keys(HOME_TRANSLATIONS)) {
      for (const k of CORE) {
        expect(HOME_TRANSLATIONS[locale][k]).toBeTruthy();
      }
    }
  });

  it('non-English welcome does not leak the English string', () => {
    for (const locale of Object.keys(HOME_TRANSLATIONS)) {
      if (locale === 'en') continue;
      const en = HOME_TRANSLATIONS.en['home.welcome.harvest_complete'];
      const other = HOME_TRANSLATIONS[locale]['home.welcome.harvest_complete'];
      if (!other) continue;
      expect(other).not.toBe(en);
    }
  });
});

// ─── 13. dev assertions ───────────────────────────────────
describe('homeDevAssertions', () => {
  it('flags missing why line', () => {
    const issues = runHomeDevAssertions({
      welcome: { line1: 'Good morning', line2: 'x' },
      displayMode: 'task_first',
      card: { title: 'X', why: '', cta: 'Go', variant: 'task' },
      progress: { summary: 'x', variant: 'empty' },
      state: null,
    });
    expect(issues).toContain('home_card_missing_why');
  });

  it('flags strong state without a next-step bridge', () => {
    const issues = runHomeDevAssertions({
      welcome: { line1: 'Harvest complete', line2: 'Next cycle' },
      displayMode: 'state_first',
      card: { title: 'Harvest complete', why: 'Done', cta: 'Continue',
              variant: 'state', nextStep: null },
      progress: { summary: 'x', variant: 'empty' },
      state: { stateType: STATE_TYPES.HARVEST_COMPLETE },
    });
    expect(issues).toContain('home_strong_state_missing_bridge');
  });

  it('flags stale state with high-confidence wording', () => {
    const issues = runHomeDevAssertions({
      welcome: { line1: 'Based on your last update', line2: 'Check field' },
      displayMode: 'state_first',
      card: { title: 'X', why: 'Y', cta: 'Z', variant: 'stale_safe', level: 'high' },
      progress: { summary: 'x', variant: 'empty' },
      state: { stateType: STATE_TYPES.STALE_OFFLINE, staleData: true },
    });
    expect(issues).toContain('home_stale_with_high_confidence');
  });

  it('flags empty welcome line2', () => {
    const issues = runHomeDevAssertions({
      welcome: { line1: 'Good morning', line2: '' },
      displayMode: 'task_first',
      card: { title: 'X', why: 'Y', cta: 'Z', variant: 'task' },
      progress: { summary: 'x', variant: 'empty' },
      state: null,
    });
    expect(issues).toContain('home_welcome_empty_line2');
  });

  it('flags raw i18n key leakage in title', () => {
    const issues = runHomeDevAssertions({
      welcome: { line1: 'Good morning', line2: 'Today' },
      displayMode: 'task_first',
      card: { title: 'home.card.stale_title', why: 'Y', cta: 'Z', variant: 'task' },
      progress: { summary: 'x', variant: 'empty' },
      state: null,
    });
    expect(issues).toContain('home_card_title_raw_key');
  });

  it('is silent for a well-formed payload', () => {
    const t = makeT('en');
    const fs = resolveFarmerState({
      hasJustCompletedHarvest: true,
      hasCompletedOnboarding: true, hasActiveCropCycle: true,
      cropProfile: { stage: 'harvest', name: 'maize' },
      landProfile: { cleared: true, moisture: 'dry' },
      weatherNow:  { rainRisk: 'low' },
    });
    const payload = buildHomePayload({
      farmerState: fs, name: 'Dennis', t, now: NOW,
    });
    expect(payload.devIssues).toEqual([]);
  });
});
