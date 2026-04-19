/**
 * closingGaps.test.js — locks in the closing-gaps patch against
 * the A–G acceptance criteria:
 *
 *   A. stale offline reduces confidence and softens wording
 *   B. low confidence + no conflict → no check-first
 *   C. low confidence + conflict + risky intent → check-first
 *   D. feedback event logs correctly
 *   E. region tone differs US vs Ghana
 *   F. returning user after 3 days → "back on track"
 *   G. no English leakage in Hindi mode for new keys
 *
 * Plus edge-case coverage for each helper.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  getFreshnessState, applyFreshnessWording,
  FRESHNESS, minutesAgo,
} from '../../../src/utils/freshnessState.js';
import {
  CONFIDENCE_REASONS, CONFLICT_REASONS, UNCERTAINTY_REASONS,
  hasConflictReason, hasUncertaintyReason, normalizeReasons,
} from '../../../src/utils/confidenceReasons.js';
import {
  defaultContinuity, getContinuityState, updateContinuityState,
  clearContinuityState, getMissedDays, isReturningInactive,
  isReminderVariant, shouldShowHarvestComplete, shouldAvoidIdenticalTitle,
  markTaskSeen, markTaskCompleted, markHarvestShown,
} from '../../../src/utils/farmerContinuity.js';
import {
  getCounters, recordTaskSeen, recordTaskCompleted, recordTaskSkipped,
  recordTaskFeedback, recalculateStreak, resetOutcomes,
} from '../../../src/utils/outcomeTracking.js';
import {
  CLOSING_GAPS_TRANSLATIONS, applyClosingGapsOverlay, interpolate,
} from '../../../src/i18n/closingGapsTranslations.js';
import {
  shouldUseCheckFirst,
} from '../services/today/taskConfidence.js';

// ─── tiny localStorage polyfill for the continuity + outcomes
// tests (Node/Vitest default doesn't ship one) ────────────────
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
const NOW  = new Date('2026-04-19T00:00:00Z').getTime();

// ─── A. FRESHNESS STATE ───────────────────────────────────
describe('freshness — stale offline reduces confidence + softens wording', () => {
  it('fresh when updated within 24h online', () => {
    expect(getFreshnessState({ lastUpdatedAt: NOW - 2 * HOUR, now: NOW }))
      .toBe(FRESHNESS.FRESH);
  });

  it('stale after 24h', () => {
    expect(getFreshnessState({ lastUpdatedAt: NOW - 26 * HOUR, now: NOW }))
      .toBe(FRESHNESS.STALE);
  });

  it('very_stale after 48h', () => {
    expect(getFreshnessState({ lastUpdatedAt: NOW - 60 * HOUR, now: NOW }))
      .toBe(FRESHNESS.VERY_STALE);
  });

  it('very_stale if offline + unknown age', () => {
    expect(getFreshnessState({ lastUpdatedAt: null, now: NOW, offline: true }))
      .toBe(FRESHNESS.VERY_STALE);
  });

  it('very_stale if offline AND more than 24h old', () => {
    expect(getFreshnessState({
      lastUpdatedAt: NOW - 26 * HOUR, now: NOW, offline: true,
    })).toBe(FRESHNESS.VERY_STALE);
  });

  it('applyFreshnessWording (fresh) is a no-op', () => {
    const payload = { title: 'Plant now', level: 'high' };
    expect(applyFreshnessWording(payload, FRESHNESS.FRESH)).toBe(payload);
  });

  it('applyFreshnessWording (stale) downgrades high → medium', () => {
    const out = applyFreshnessWording({ title: 'Plant now', level: 'high' },
      FRESHNESS.STALE);
    expect(out.level).toBe('medium');
  });

  it('applyFreshnessWording (very_stale) downgrades and attaches prefix', () => {
    const out = applyFreshnessWording({ title: 'Plant now', level: 'high' },
      FRESHNESS.VERY_STALE);
    expect(out.level).not.toBe('high');
    expect(out.confidenceLine).toBe('Based on your last update');
    expect(out.title).toMatch(/based on your last update/i);
  });

  it('applyFreshnessWording NEVER retains high confidence at very_stale', () => {
    const out = applyFreshnessWording({ level: 'high' }, FRESHNESS.VERY_STALE);
    expect(['medium', 'low']).toContain(out.level);
  });

  it('minutesAgo returns correct whole minutes', () => {
    expect(minutesAgo(NOW - 14 * 60 * 1000, NOW)).toBe(14);
    expect(minutesAgo(null, NOW)).toBeNull();
  });
});

// ─── B + C. CONFIDENCE REASONS + CHECK-FIRST GATING ──────
describe('confidence reasons — standardized enum + hasConflictReason', () => {
  it('hasConflictReason is true for conflict_land_vs_stage', () => {
    expect(hasConflictReason([CONFIDENCE_REASONS.CONFLICT_LAND_VS_STAGE])).toBe(true);
  });

  it('hasConflictReason is true for conflict_weather_vs_land', () => {
    expect(hasConflictReason([CONFIDENCE_REASONS.CONFLICT_WEATHER_VS_LAND])).toBe(true);
  });

  it('hasConflictReason is false for uncertainty-only reasons', () => {
    expect(hasConflictReason([
      CONFIDENCE_REASONS.WEAK_CAMERA_SIGNAL,
      CONFIDENCE_REASONS.STALE_OFFLINE_STATE,
      CONFIDENCE_REASONS.MISSING_LAND_DATA,
      CONFIDENCE_REASONS.MISSING_WEATHER_DATA,
    ])).toBe(false);
  });

  it('hasConflictReason tolerates null/undefined/non-array', () => {
    expect(hasConflictReason(null)).toBe(false);
    expect(hasConflictReason(undefined)).toBe(false);
    expect(hasConflictReason('conflict_land_vs_stage')).toBe(false);
  });

  it('hasUncertaintyReason flags weak-camera / stale / missing data', () => {
    expect(hasUncertaintyReason([CONFIDENCE_REASONS.WEAK_CAMERA_SIGNAL])).toBe(true);
    expect(hasUncertaintyReason([CONFIDENCE_REASONS.CONFLICT_LAND_VS_STAGE])).toBe(false);
  });

  it('normalizeReasons maps legacy aliases to standardized', () => {
    const input = ['conflict_planting_vs_wet_soil', 'camera_uncertain', 'stale_offline'];
    const out = normalizeReasons(input);
    expect(out).toContain(CONFIDENCE_REASONS.CONFLICT_LAND_VS_STAGE);
    expect(out).toContain(CONFIDENCE_REASONS.WEAK_CAMERA_SIGNAL);
    expect(out).toContain(CONFIDENCE_REASONS.STALE_OFFLINE_STATE);
  });

  it('normalizeReasons passes unknown reasons through unchanged', () => {
    const out = normalizeReasons(['stage_resolved', 'land_blocker_explicit']);
    expect(out).toContain('stage_resolved');
    expect(out).toContain('land_blocker_explicit');
  });

  it('normalizeReasons dedupes', () => {
    const out = normalizeReasons([
      'conflict_planting_vs_wet_soil',
      'conflict_land_vs_stage',
    ]);
    // After normalization both map to conflict_land_vs_stage →
    // deduped to one entry.
    expect(out).toEqual([CONFIDENCE_REASONS.CONFLICT_LAND_VS_STAGE]);
  });
});

describe('check-first gating — acceptance B + C', () => {
  it('B. low confidence + NO conflict → NO check-first', () => {
    expect(shouldUseCheckFirst({ intent: 'plant' },
      { level: 'low', reasons: [] })).toBe(false);
    expect(shouldUseCheckFirst({ intent: 'plant' },
      { level: 'low', reasons: [CONFIDENCE_REASONS.MISSING_WEATHER_DATA] })).toBe(false);
  });

  it('C. low confidence + conflict + risky intent → check-first', () => {
    expect(shouldUseCheckFirst({ intent: 'plant' },
      { level: 'low', reasons: [CONFIDENCE_REASONS.CONFLICT_LAND_VS_STAGE] }))
      .toBe(true);
    expect(shouldUseCheckFirst({ intent: 'drain' },
      { level: 'low', reasons: [CONFIDENCE_REASONS.CONFLICT_WEATHER_VS_LAND] }))
      .toBe(true);
  });

  it('low confidence + conflict but LOW-RISK intent → no check-first', () => {
    expect(shouldUseCheckFirst({ intent: 'scout' },
      { level: 'low', reasons: [CONFIDENCE_REASONS.CONFLICT_LAND_VS_STAGE] }))
      .toBe(false);
  });
});

// ─── D. FEEDBACK EVENT LOGGING ───────────────────────────
describe('feedback — event logs correctly', () => {
  beforeEach(() => installLocalStorage());

  it('recordTaskFeedback calls logEvent with the right shape', () => {
    const spy = vi.fn();
    recordTaskFeedback(
      { id: 't-1', stage: 'growing', cropId: 'maize' },
      { type: 'helpful' },
      { logEvent: spy, countryCode: 'GH' },
    );
    expect(spy).toHaveBeenCalledWith('task_feedback', expect.objectContaining({
      taskId: 't-1',
      type:   'helpful',
      reason: null,
      countryCode: 'GH',
      cropId: 'maize',
      stage:  'growing',
    }));
  });

  it('👎 with reason logs the reason code', () => {
    const spy = vi.fn();
    recordTaskFeedback(
      { id: 't-1' },
      { type: 'not_right', reason: 'doesnt_match' },
      { logEvent: spy },
    );
    expect(spy).toHaveBeenCalledWith('task_feedback', expect.objectContaining({
      type:   'not_right',
      reason: 'doesnt_match',
    }));
  });

  it('missing logEvent is safe (no throw)', () => {
    expect(() => recordTaskFeedback({ id: 't-1' }, { type: 'helpful' }))
      .not.toThrow();
  });
});

// ─── E. REGION TONE — US vs GHANA ────────────────────────
describe('region tone — temperate vs tropical wording', () => {
  const en = CLOSING_GAPS_TRANSLATIONS.en;

  it('tropical_manual keeps hand-prep wording', () => {
    expect(en['closing_gaps.region.tropical_manual.field_prep'])
      .toMatch(/hand/i);
  });

  it('temperate_mechanized avoids hand-tool language', () => {
    const s = en['closing_gaps.region.temperate_mechanized.field_prep'];
    expect(s).toBeTruthy();
    expect(s.toLowerCase()).not.toMatch(/\bby hand\b|\bhand preparation\b/);
  });

  it('monsoon_mixed field-prep is rain-aware', () => {
    expect(en['closing_gaps.region.monsoon_mixed.field_prep'])
      .toMatch(/rain/i);
  });

  it('temperate_mechanized row/equipment key exists', () => {
    expect(en['closing_gaps.region.temperate_mechanized.row_note'])
      .toMatch(/rows|equipment/i);
  });

  it('the three regional field-prep variants differ', () => {
    const a = en['closing_gaps.region.tropical_manual.field_prep'];
    const b = en['closing_gaps.region.monsoon_mixed.field_prep'];
    const c = en['closing_gaps.region.temperate_mechanized.field_prep'];
    expect(new Set([a, b, c]).size).toBe(3);
  });
});

// ─── F. RETURNING USER CONTINUITY ─────────────────────────
describe('continuity — returning user after 3 days', () => {
  beforeEach(() => {
    installLocalStorage();
    clearContinuityState();
  });

  it('defaultContinuity has null timestamps', () => {
    const c = defaultContinuity();
    expect(c.lastTaskId).toBeNull();
    expect(c.lastSeenAt).toBeNull();
  });

  it('getMissedDays returns 0 for fresh or first-time users', () => {
    expect(getMissedDays(null, NOW)).toBe(0);
    expect(getMissedDays({ lastSeenAt: NOW - 1 * HOUR }, NOW)).toBe(0);
  });

  it('F. missed 3+ days → isReturningInactive true', () => {
    expect(isReturningInactive({ lastSeenAt: NOW - 4 * DAY }, NOW)).toBe(true);
    expect(isReturningInactive({ lastSeenAt: NOW - 2 * DAY }, NOW)).toBe(false);
  });

  it('getMissedDays is exact (5 days)', () => {
    expect(getMissedDays({ lastSeenAt: NOW - 5 * DAY }, NOW)).toBe(5);
  });

  it('isReminderVariant: same task, next day, not completed → true', () => {
    const c = {
      lastTaskId: 't-plant',
      lastTaskTitle: 'Plant your tomatoes today',
      lastSeenAt: NOW - 26 * HOUR,     // yesterday
      lastCompletedAt: null,
    };
    expect(isReminderVariant('t-plant', c, NOW)).toBe(true);
  });

  it('isReminderVariant: same task, completed after last seen → false', () => {
    const c = {
      lastTaskId: 't-plant',
      lastSeenAt: NOW - 26 * HOUR,
      lastCompletedAt: NOW - 1 * HOUR,  // completed since last seen
    };
    expect(isReminderVariant('t-plant', c, NOW)).toBe(false);
  });

  it('isReminderVariant: different task → false', () => {
    const c = { lastTaskId: 't-other', lastSeenAt: NOW - 26 * HOUR };
    expect(isReminderVariant('t-plant', c, NOW)).toBe(false);
  });

  it('shouldShowHarvestComplete: harvest within last day, not yet shown → true', () => {
    const c = { lastHarvestShownAt: null };
    expect(shouldShowHarvestComplete(c, { harvestedAt: NOW - 2 * HOUR, now: NOW }))
      .toBe(true);
  });

  it('shouldShowHarvestComplete: already shown → false', () => {
    const c = { lastHarvestShownAt: NOW - 1 * HOUR };
    expect(shouldShowHarvestComplete(c, { harvestedAt: NOW - 2 * HOUR, now: NOW }))
      .toBe(false);
  });

  it('shouldShowHarvestComplete: harvest was >1 day ago → false (transitions)', () => {
    const c = { lastHarvestShownAt: null };
    expect(shouldShowHarvestComplete(c, { harvestedAt: NOW - 2 * DAY, now: NOW }))
      .toBe(false);
  });

  it('shouldAvoidIdenticalTitle: same title, next day → true', () => {
    const c = { lastTaskTitle: 'Plant tomatoes', lastSeenAt: NOW - 26 * HOUR };
    expect(shouldAvoidIdenticalTitle('Plant tomatoes', c, NOW)).toBe(true);
  });

  it('shouldAvoidIdenticalTitle: same day → false', () => {
    const c = { lastTaskTitle: 'Plant tomatoes', lastSeenAt: NOW - 2 * HOUR };
    expect(shouldAvoidIdenticalTitle('Plant tomatoes', c, NOW)).toBe(false);
  });

  it('markTaskSeen persists lastTaskId + title + timestamp', () => {
    markTaskSeen({ id: 't-plant', title: 'Plant rice' }, NOW);
    const c = getContinuityState();
    expect(c.lastTaskId).toBe('t-plant');
    expect(c.lastTaskTitle).toBe('Plant rice');
    expect(c.lastSeenAt).toBe(NOW);
  });

  it('markTaskCompleted stamps lastCompletedAt', () => {
    markTaskCompleted({ id: 't-plant' }, NOW);
    expect(getContinuityState().lastCompletedAt).toBe(NOW);
  });

  it('markHarvestShown blocks re-showing the same harvest', () => {
    markHarvestShown(NOW);
    expect(shouldShowHarvestComplete(getContinuityState(),
      { harvestedAt: NOW - 1 * HOUR, now: NOW })).toBe(false);
  });
});

// ─── G. NO ENGLISH LEAKAGE IN HINDI ──────────────────────
describe('localization — no English leakage for new keys', () => {
  const NEW_KEYS = [
    'closing_gaps.based_on_last_update',
    'closing_gaps.reconnect_to_refresh',
    'closing_gaps.lets_get_back_on_track',
    'closing_gaps.conditions_may_not_be_right',
    'closing_gaps.does_this_match_your_field',
    'closing_gaps.feedback.helpful',
    'closing_gaps.feedback.not_right',
    'closing_gaps.feedback.doesnt_match',
    'closing_gaps.feedback.already_did',
    'closing_gaps.feedback.not_clear',
    'closing_gaps.feedback.thanks',
  ];

  it.each(NEW_KEYS)('[hi] %s differs from English', (key) => {
    const en = CLOSING_GAPS_TRANSLATIONS.en[key];
    const hi = CLOSING_GAPS_TRANSLATIONS.hi[key];
    expect(en).toBeTruthy();
    expect(hi).toBeTruthy();
    expect(hi).not.toBe(en);
  });

  it('applyClosingGapsOverlay merges into an existing dictionary', () => {
    const dict = { en: { 'existing.key': 'v' }, hi: {} };
    applyClosingGapsOverlay(dict);
    expect(dict.en['existing.key']).toBe('v');
    expect(dict.en['closing_gaps.based_on_last_update']).toBe('Based on your last update');
    expect(dict.hi['closing_gaps.based_on_last_update']).toMatch(/आपके पिछले/);
  });

  it('interpolate substitutes {n}', () => {
    expect(interpolate('Updated {n} days ago', { n: 3 })).toBe('Updated 3 days ago');
  });

  it('every shipped locale has the core feedback keys', () => {
    const CORE = [
      'closing_gaps.feedback.helpful',
      'closing_gaps.feedback.not_right',
      'closing_gaps.feedback.thanks',
    ];
    for (const locale of Object.keys(CLOSING_GAPS_TRANSLATIONS)) {
      for (const k of CORE) {
        expect(CLOSING_GAPS_TRANSLATIONS[locale][k]).toBeTruthy();
      }
    }
  });
});

// ─── OUTCOME TRACKING COUNTERS ───────────────────────────
describe('outcome tracking — counters + streak + last-7', () => {
  beforeEach(() => {
    installLocalStorage();
    resetOutcomes();
  });

  it('empty state returns zeroed counters', () => {
    const c = getCounters(NOW);
    expect(c.tasks_completed_count).toBe(0);
    expect(c.tasks_skipped_count).toBe(0);
    expect(c.streak_days).toBe(0);
    expect(c.last7_completion_rate).toBeNull();
  });

  it('recordTaskCompleted increments + starts streak at 1', () => {
    recordTaskCompleted({ id: 't-1' }, { now: NOW });
    const c = getCounters(NOW);
    expect(c.tasks_completed_count).toBe(1);
    expect(c.streak_days).toBe(1);
  });

  it('completing on consecutive days grows the streak', () => {
    recordTaskCompleted({ id: 't-1' }, { now: NOW - 2 * DAY });
    recordTaskCompleted({ id: 't-1' }, { now: NOW - 1 * DAY });
    recordTaskCompleted({ id: 't-1' }, { now: NOW });
    expect(getCounters(NOW).streak_days).toBe(3);
  });

  it('missing a day resets the streak', () => {
    recordTaskCompleted({ id: 't-1' }, { now: NOW - 3 * DAY });
    recordTaskCompleted({ id: 't-1' }, { now: NOW });  // 3-day gap
    expect(getCounters(NOW).streak_days).toBe(1);
  });

  it('recalculateStreak breaks streak if no completion today/yesterday', () => {
    recordTaskCompleted({ id: 't-1' }, { now: NOW - 5 * DAY });
    recalculateStreak(NOW);
    expect(getCounters(NOW).streak_days).toBe(0);
  });

  it('last7_completion_rate is completed / (completed + skipped)', () => {
    recordTaskCompleted({ id: 't-1' }, { now: NOW - 1 * DAY });
    recordTaskCompleted({ id: 't-2' }, { now: NOW });
    recordTaskSkipped ({ id: 't-3' }, { now: NOW });
    const c = getCounters(NOW);
    expect(c.last7_completion_rate).toBeCloseTo(2 / 3, 2);
  });

  it('events older than 7 days are excluded from last7_completion_rate', () => {
    recordTaskCompleted({ id: 't-0' }, { now: NOW - 10 * DAY }); // out of window
    recordTaskSkipped ({ id: 't-1' }, { now: NOW });
    const c = getCounters(NOW);
    expect(c.last7_completion_rate).toBe(0);
  });

  it('recordTaskSeen forwards the event without touching counters', () => {
    const spy = vi.fn();
    recordTaskSeen({ id: 't-1', stage: 'growing' }, { logEvent: spy, now: NOW });
    expect(spy).toHaveBeenCalledWith('task_seen', expect.objectContaining({
      taskId: 't-1', stage: 'growing',
    }));
    expect(getCounters(NOW).tasks_completed_count).toBe(0);
  });

  it('recordTaskCompleted emits task_done through logEvent', () => {
    const spy = vi.fn();
    recordTaskCompleted({ id: 't-1' }, { logEvent: spy, now: NOW });
    expect(spy).toHaveBeenCalledWith('task_done', expect.objectContaining({
      taskId: 't-1',
    }));
  });
});

// ─── SAFETY — never break flow ───────────────────────────
describe('safety — helpers never throw on bad input', () => {
  it('getFreshnessState(null)', () => {
    expect(() => getFreshnessState(null)).not.toThrow();
    expect(() => getFreshnessState(undefined)).not.toThrow();
  });

  it('applyFreshnessWording(null)', () => {
    expect(applyFreshnessWording(null, FRESHNESS.VERY_STALE)).toBeNull();
  });

  it('hasConflictReason({})', () => {
    expect(hasConflictReason({})).toBe(false);
  });

  it('getContinuityState when localStorage is unavailable', () => {
    // Strip localStorage
    const prev = globalThis.window;
    globalThis.window = undefined;
    expect(() => getContinuityState()).not.toThrow();
    const c = getContinuityState();
    expect(c.lastTaskId).toBeNull();
    globalThis.window = prev;
  });
});
