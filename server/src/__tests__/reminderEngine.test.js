/**
 * reminderEngine.test.js — deterministic contract for the daily
 * reminder system.
 *
 * Spec §11 checklist:
 *   1. due reminder shows once per day
 *   2. browser permission request is delayed until engagement
 *   3. missed-day reminder appears correctly
 *   4. risk / weather alerts override generic reminder
 *   5. settings persist after refresh
 *   6. reminder logic works offline
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  getSettings, updateSettings,
  evaluateReminder, isReminderDue, markReminderShown,
  didMissYesterday,
  shouldRequestBrowserPermission,
  REMINDER_KINDS, DEFAULT_SETTINGS, _internal,
} from '../../../src/lib/notifications/reminderEngine.js';

function installLocalStorage() {
  const map = new Map();
  globalThis.window = {
    localStorage: {
      getItem:    (k) => map.has(k) ? map.get(k) : null,
      setItem:    (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
    },
    dispatchEvent: () => true,
  };
  return map;
}

// Helper — fixed calendar days in local time so tests are reliable.
function atHM(date, h, m = 0) {
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}
const DAY_MS = 24 * 3600 * 1000;

// ─── 1. Settings roundtrip (spec §1, §11.5) ────────────────────
describe('reminderEngine — settings persistence', () => {
  beforeEach(() => { installLocalStorage(); });
  afterEach(()  => { delete globalThis.window; });

  it('defaults match spec §1', () => {
    const s = getSettings();
    expect(s.dailyReminderEnabled).toBe(true);
    expect(s.dailyReminderTime).toBe('07:00');
    expect(s.browserPushEnabled).toBe(false);
    expect(s.emailReminderEnabled).toBe(false);
    expect(s.criticalAlertsOnly).toBe(false);
    expect(s.lastReminderSentAt).toBeNull();
  });

  it('updateSettings merges & persists', () => {
    updateSettings({ dailyReminderTime: '08:30', emailReminderEnabled: true });
    const s = getSettings();
    expect(s.dailyReminderTime).toBe('08:30');
    expect(s.emailReminderEnabled).toBe(true);
    // Other defaults intact.
    expect(s.dailyReminderEnabled).toBe(true);
  });

  it('rejects malformed time, keeps previous', () => {
    updateSettings({ dailyReminderTime: '09:00' });
    updateSettings({ dailyReminderTime: 'not-a-time' });
    expect(getSettings().dailyReminderTime).toBe('09:00');
  });

  it('survives storage absence (offline / SSR)', () => {
    delete globalThis.window;
    const s = getSettings(); // no throw
    expect(s.dailyReminderEnabled).toBe(true);
    updateSettings({ dailyReminderEnabled: false }); // no throw
  });

  it('DEFAULT_SETTINGS is frozen', () => {
    expect(Object.isFrozen(DEFAULT_SETTINGS)).toBe(true);
  });
});

// ─── 2. isReminderDue / markReminderShown (spec §2, §11.1) ─────
describe('isReminderDue + markReminderShown', () => {
  beforeEach(() => { installLocalStorage(); });
  afterEach(()  => { delete globalThis.window; });

  it('not due before the configured time', () => {
    updateSettings({ dailyReminderTime: '09:00' });
    const now = atHM(new Date('2026-04-20T00:00:00'), 7, 30);
    expect(isReminderDue({ now })).toBe(false);
  });

  it('due at or after the configured time', () => {
    updateSettings({ dailyReminderTime: '07:00' });
    const now = atHM(new Date('2026-04-20T00:00:00'), 8, 0);
    expect(isReminderDue({ now })).toBe(true);
  });

  it('not due when dailyReminderEnabled=false', () => {
    updateSettings({ dailyReminderEnabled: false });
    const now = atHM(new Date('2026-04-20T00:00:00'), 10, 0);
    expect(isReminderDue({ now })).toBe(false);
  });

  it('only fires once per day — second call returns false', () => {
    updateSettings({ dailyReminderTime: '07:00' });
    const now = atHM(new Date('2026-04-20T00:00:00'), 8, 0);
    expect(isReminderDue({ now })).toBe(true);
    markReminderShown({ now });
    expect(isReminderDue({ now })).toBe(false);
  });

  it('rolls over next calendar day', () => {
    updateSettings({ dailyReminderTime: '07:00' });
    const day1 = atHM(new Date('2026-04-20T00:00:00'), 8, 0);
    expect(isReminderDue({ now: day1 })).toBe(true);
    markReminderShown({ now: day1 });

    const day2 = atHM(new Date('2026-04-21T00:00:00'), 8, 0);
    expect(isReminderDue({ now: day2 })).toBe(true);
  });
});

// ─── 3. Missed-day detection (spec §5, §11.3) ──────────────────
describe('didMissYesterday', () => {
  it('true when yesterday has no completions but older history exists', () => {
    const now = new Date('2026-04-20T08:00:00');
    const completions = [
      { taskId: 't1', completed: true, timestamp: now.getTime() - 3 * DAY_MS },
      // nothing yesterday, nothing today
    ];
    expect(didMissYesterday({ now, completions })).toBe(true);
  });

  it('false when the farmer worked today', () => {
    const now = new Date('2026-04-20T08:00:00');
    const completions = [
      { taskId: 't1', completed: true, timestamp: now.getTime() - 3 * DAY_MS },
      { taskId: 't2', completed: true, timestamp: now.getTime() },
    ];
    expect(didMissYesterday({ now, completions })).toBe(false);
  });

  it('false when the farmer worked yesterday', () => {
    const now = new Date('2026-04-20T08:00:00');
    const completions = [
      { taskId: 't1', completed: true, timestamp: now.getTime() - DAY_MS },
    ];
    expect(didMissYesterday({ now, completions })).toBe(false);
  });

  it('false for brand-new farmer (no history at all)', () => {
    const now = new Date('2026-04-20T08:00:00');
    expect(didMissYesterday({ now, completions: [] })).toBe(false);
  });
});

// ─── 4. evaluateReminder — precedence (spec §4, §6, §11.4) ─────
describe('evaluateReminder', () => {
  beforeEach(() => { installLocalStorage(); });
  afterEach(()  => { delete globalThis.window; });

  it('weather_severe wins over everything', () => {
    updateSettings({ dailyReminderTime: '07:00' });
    const now = atHM(new Date('2026-04-20T00:00:00'), 10, 0);
    const r = evaluateReminder({
      now,
      weather: { severe: true },
      completions: [{ taskId: 't', completed: true, timestamp: now.getTime() - 3 * DAY_MS }],
    });
    expect(r.show).toBe(true);
    expect(r.kind).toBe('weather_severe');
    expect(r.severity).toBe('critical');
  });

  it('risk_high (rainSoon) beats missed_day', () => {
    const now = atHM(new Date('2026-04-20T00:00:00'), 10, 0);
    const r = evaluateReminder({
      now,
      weather: { rainSoon: true },
      completions: [{ taskId: 't', completed: true, timestamp: now.getTime() - 3 * DAY_MS }],
    });
    expect(r.kind).toBe('risk_high');
    expect(r.severity).toBe('warning');
  });

  it('missed_day wins over daily when no weather / risk', () => {
    const now = atHM(new Date('2026-04-20T00:00:00'), 10, 0);
    const r = evaluateReminder({
      now,
      completions: [{ taskId: 't', completed: true, timestamp: now.getTime() - 3 * DAY_MS }],
    });
    expect(r.kind).toBe('missed_day');
  });

  it('daily reminder fires when nothing else and clock is past time', () => {
    updateSettings({ dailyReminderTime: '07:00' });
    const now = atHM(new Date('2026-04-20T00:00:00'), 10, 0);
    const r = evaluateReminder({ now, completions: [] });
    expect(r.show).toBe(true);
    expect(r.kind).toBe('daily');
  });

  it('criticalAlertsOnly suppresses daily + missed_day but NOT weather', () => {
    updateSettings({ criticalAlertsOnly: true });
    const now = atHM(new Date('2026-04-20T00:00:00'), 10, 0);
    // Missed day is suppressed
    const r1 = evaluateReminder({
      now,
      completions: [{ taskId: 't', completed: true, timestamp: now.getTime() - 3 * DAY_MS }],
    });
    expect(r1.show).toBe(false);
    // Weather still surfaces
    const r2 = evaluateReminder({ now, weather: { heavyRain: true } });
    expect(r2.show).toBe(true);
    expect(r2.kind).toBe('weather_severe');
  });

  it('show=false before reminder time when nothing else triggers', () => {
    updateSettings({ dailyReminderTime: '20:00' });
    const now = atHM(new Date('2026-04-20T00:00:00'), 10, 0);
    const r = evaluateReminder({ now, completions: [] });
    expect(r.show).toBe(false);
  });

  it('REMINDER_KINDS is stable', () => {
    expect(REMINDER_KINDS).toContain('daily');
    expect(REMINDER_KINDS).toContain('missed_day');
    expect(REMINDER_KINDS).toContain('risk_high');
    expect(REMINDER_KINDS).toContain('weather_severe');
    expect(Object.isFrozen(REMINDER_KINDS)).toBe(true);
  });
});

// ─── 5. Browser permission ask (spec §3, §11.2) ────────────────
describe('shouldRequestBrowserPermission', () => {
  beforeEach(() => { installLocalStorage(); });
  afterEach(()  => { delete globalThis.window; });

  it('false when we already asked', () => {
    updateSettings({ askedBrowserPermission: true });
    expect(shouldRequestBrowserPermission({
      events: [{ type: 'farm_created' }],
      permissionOverride: 'default',
    })).toBe(false);
  });

  it('false when permission is already granted / denied', () => {
    expect(shouldRequestBrowserPermission({
      events: [{ type: 'farm_created' }],
      permissionOverride: 'granted',
    })).toBe(false);
    expect(shouldRequestBrowserPermission({
      events: [{ type: 'farm_created' }],
      permissionOverride: 'denied',
    })).toBe(false);
  });

  it('true after a farm_created event', () => {
    expect(shouldRequestBrowserPermission({
      events: [{ type: 'farm_created' }],
      permissionOverride: 'default',
    })).toBe(true);
  });

  it('true after a task_completed event', () => {
    expect(shouldRequestBrowserPermission({
      events: [{ type: 'task_completed' }],
      permissionOverride: 'default',
    })).toBe(true);
  });

  it('true on second (or later) visit', () => {
    expect(shouldRequestBrowserPermission({
      events: [],
      secondVisitOrLater: true,
      permissionOverride: 'default',
    })).toBe(true);
  });

  it('false on the very first visit with no engagement', () => {
    expect(shouldRequestBrowserPermission({
      events: [],
      secondVisitOrLater: false,
      permissionOverride: 'default',
    })).toBe(false);
  });

  it('unsupported browsers → never ask', () => {
    expect(shouldRequestBrowserPermission({
      events: [{ type: 'farm_created' }],
      permissionOverride: 'unsupported',
    })).toBe(false);
  });
});

// ─── 6. Offline / safety ───────────────────────────────────────
describe('reminderEngine — offline safety', () => {
  beforeEach(() => { installLocalStorage(); });
  afterEach(()  => { delete globalThis.window; });

  it('evaluateReminder never throws on empty input', () => {
    expect(() => evaluateReminder()).not.toThrow();
    const r = evaluateReminder();
    expect(['daily', null, 'missed_day', 'risk_high', 'weather_severe']).toContain(r.kind);
  });

  it('internals expose helpers for test coverage', () => {
    expect(typeof _internal.toIsoDate).toBe('function');
    expect(typeof _internal.isAtOrAfterTime).toBe('function');
    expect(typeof _internal.pickWeatherKind).toBe('function');
    expect(_internal.STORAGE_KEY).toBe('farroway.notificationSettings');
  });
});
