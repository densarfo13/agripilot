/**
 * dailyLoop.test.js — deterministic contract for the retention loop.
 *
 * Spec §12 checklist:
 *   1. streak increases on daily completion
 *   2. streak resets after a missed day
 *   3. returning same day shows "continue" message
 *   4. all-tasks-complete → next-day hint (never empty)
 *   5. missed-day message appears correctly
 *   6. offline persistence works (localStorage mock)
 *   7. streak is tied to the farmer locally (keyed store)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  toIsoDate,
  dayDiff,
  readLastVisit,
  touchLastVisit,
  getEffectiveStreak,
  resetStaleStreak,
  markTaskCompletedForStreak,
  getDailyEntryStatus,
  pickReinforcementKey,
  pickNextDayHint,
  computeDailyLoopFacts,
  _keys,
  _internal,
} from '../../../src/lib/loop/dailyLoop.js';

// ─── localStorage mock ─────────────────────────────────────────────
function installLocalStorage() {
  const map = new Map();
  globalThis.window = {
    localStorage: {
      getItem:    (k) => map.has(k) ? map.get(k) : null,
      setItem:    (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
    },
  };
  return map;
}

const D = (y, m, day, h = 10) => new Date(y, m - 1, day, h, 0, 0);

// ─── 0. Pure date helpers ──────────────────────────────────────────
describe('dailyLoop — date helpers', () => {
  it('toIsoDate formats YYYY-MM-DD', () => {
    expect(toIsoDate(D(2026, 4, 20))).toBe('2026-04-20');
    expect(toIsoDate('2026-01-02')).toBe('2026-01-02');
  });
  it('dayDiff returns whole-day deltas', () => {
    expect(dayDiff('2026-04-20', '2026-04-20')).toBe(0);
    expect(dayDiff('2026-04-20', '2026-04-21')).toBe(1);
    expect(dayDiff('2026-04-20', '2026-04-23')).toBe(3);
    expect(dayDiff(null, '2026-04-20')).toBeNull();
  });
});

// ─── 1. Streak increases on daily completion (spec §2) ─────────────
describe('streak', () => {
  beforeEach(() => { installLocalStorage(); });
  afterEach(()  => { delete globalThis.window; });

  it('first completion starts streak at 1', () => {
    const s = markTaskCompletedForStreak({ now: D(2026, 4, 20) });
    expect(s).toBe(1);
    expect(getEffectiveStreak({ now: D(2026, 4, 20) })).toBe(1);
  });

  it('same-day completion does NOT double-increment', () => {
    markTaskCompletedForStreak({ now: D(2026, 4, 20, 8) });
    const s = markTaskCompletedForStreak({ now: D(2026, 4, 20, 20) });
    expect(s).toBe(1);
  });

  it('completion on the next calendar day increments by 1', () => {
    markTaskCompletedForStreak({ now: D(2026, 4, 20) });
    const s = markTaskCompletedForStreak({ now: D(2026, 4, 21) });
    expect(s).toBe(2);
  });

  it('three days in a row → streak = 3', () => {
    markTaskCompletedForStreak({ now: D(2026, 4, 20) });
    markTaskCompletedForStreak({ now: D(2026, 4, 21) });
    const s = markTaskCompletedForStreak({ now: D(2026, 4, 22) });
    expect(s).toBe(3);
    expect(getEffectiveStreak({ now: D(2026, 4, 22) })).toBe(3);
  });

  // ─── 2. Streak resets after a missed day ─────────────────────
  it('missing a day lapses the effective streak (reports 0)', () => {
    markTaskCompletedForStreak({ now: D(2026, 4, 20) });
    markTaskCompletedForStreak({ now: D(2026, 4, 21) });
    // No completion on the 22nd. Open on the 23rd.
    expect(getEffectiveStreak({ now: D(2026, 4, 23) })).toBe(0);
  });

  it('resetStaleStreak wipes storage when a gap > 1 day occurred', () => {
    markTaskCompletedForStreak({ now: D(2026, 4, 20) });
    const changed = resetStaleStreak({ now: D(2026, 4, 23) });
    expect(changed).toBe(true);
    expect(getEffectiveStreak({ now: D(2026, 4, 23) })).toBe(0);
    // Next completion restarts at 1.
    const s = markTaskCompletedForStreak({ now: D(2026, 4, 23) });
    expect(s).toBe(1);
  });
});

// ─── 3. Returning same day / first visit / missed day (spec §1, §5) ─
describe('getDailyEntryStatus', () => {
  beforeEach(() => { installLocalStorage(); });
  afterEach(()  => { delete globalThis.window; });

  it('no lastVisit → firstVisitToday = true', () => {
    const s = getDailyEntryStatus({ now: D(2026, 4, 20) });
    expect(s.firstVisitToday).toBe(true);
    expect(s.messageKey).toBe('loop.first_visit_today');
    expect(s.missedDays).toBe(0);
  });

  it('lastVisit = today → continue_tasks', () => {
    touchLastVisit({ now: D(2026, 4, 20, 8) });
    const s = getDailyEntryStatus({ now: D(2026, 4, 20, 20) });
    expect(s.firstVisitToday).toBe(false);
    expect(s.messageKey).toBe('loop.continue_tasks');
  });

  it('lastVisit = yesterday → first_visit_today (no "missed")', () => {
    touchLastVisit({ now: D(2026, 4, 19) });
    const s = getDailyEntryStatus({ now: D(2026, 4, 20) });
    expect(s.firstVisitToday).toBe(true);
    expect(s.missedDays).toBe(0);
    expect(s.messageKey).toBe('loop.first_visit_today');
  });

  it('lastVisit 3 days ago → missed_day_message, missedDays = 2', () => {
    touchLastVisit({ now: D(2026, 4, 17) });
    const s = getDailyEntryStatus({ now: D(2026, 4, 20) });
    expect(s.firstVisitToday).toBe(true);
    expect(s.missedDays).toBe(2);
    expect(s.messageKey).toBe('loop.missed_day_message');
  });
});

// ─── 4. Next-day preview (spec §4) ────────────────────────────────
describe('pickNextDayHint', () => {
  it('picks the first incomplete secondary as tomorrow\'s hint', () => {
    const engine = {
      primaryTask:   { kind: 'task', id: 'p1', titleKey: 't.p1', whyKey: 'w.p1' },
      secondaryTasks:[
        { kind: 'task', id: 's1', titleKey: 't.s1', whyKey: 'w.s1' },
        { kind: 'task', id: 's2', titleKey: 't.s2', whyKey: 'w.s2' },
      ],
    };
    const hint = pickNextDayHint({ engineSnapshot: engine, completions: [] });
    expect(hint.kind).toBe('task');
    expect(hint.titleKey).toBe('t.s1');
  });

  it('falls back to bridge when nothing actionable remains', () => {
    const engine = {
      primaryTask:   { kind: 'bridge', titleKey: 'progress.prepare_next_stage' },
      secondaryTasks:[],
    };
    const hint = pickNextDayHint({ engineSnapshot: engine, completions: [] });
    expect(hint.kind).toBe('bridge');
    expect(hint.bridgeKey).toBe('progress.prepare_next_stage');
  });

  it('returns null when nothing at all is known', () => {
    expect(pickNextDayHint({ engineSnapshot: null })).toBeNull();
  });

  it('skips already-completed tasks', () => {
    const engine = {
      primaryTask:   { kind: 'task', id: 'p1', titleKey: 't.p1' },
      secondaryTasks:[
        { kind: 'task', id: 's1', titleKey: 't.s1' },
        { kind: 'task', id: 's2', titleKey: 't.s2' },
      ],
    };
    const hint = pickNextDayHint({
      engineSnapshot: engine,
      completions: [{ taskId: 's1', completed: true, timestamp: Date.now() }],
    });
    expect(hint.titleKey).toBe('t.s2');
  });
});

// ─── 5. Reinforcement messages (spec §6) ──────────────────────────
describe('pickReinforcementKey', () => {
  it('returns a known key from the catalog', () => {
    const key = pickReinforcementKey('anything');
    expect(_internal.REINFORCEMENT_KEYS).toContain(key);
  });
  it('same seed → same key (deterministic across renders)', () => {
    expect(pickReinforcementKey('task-42')).toBe(pickReinforcementKey('task-42'));
  });
});

// ─── 6. Offline persistence + computeDailyLoopFacts (spec §9) ─────
describe('computeDailyLoopFacts', () => {
  beforeEach(() => { installLocalStorage(); });
  afterEach(()  => { delete globalThis.window; });

  it('bundles streak + entry + dailyCompletionFlag in one shape', () => {
    touchLastVisit({ now: D(2026, 4, 19) });
    markTaskCompletedForStreak({ now: D(2026, 4, 19) });
    const facts = computeDailyLoopFacts({
      now: D(2026, 4, 20),
      completions: [
        { taskId: 't1', completed: true, timestamp: D(2026, 4, 20).getTime() },
      ],
    });
    expect(facts.today).toBe('2026-04-20');
    expect(facts.firstVisitToday).toBe(true);
    expect(facts.missedDays).toBe(0);
    expect(facts.streak).toBe(1);
    expect(facts.dailyCompletionFlag).toBe(true);
    expect(facts.completedToday).toBe(1);
  });

  it('reset-stale-streak runs so a 3-day gap reports streak = 0', () => {
    markTaskCompletedForStreak({ now: D(2026, 4, 17) });
    const facts = computeDailyLoopFacts({ now: D(2026, 4, 20) });
    expect(facts.streak).toBe(0);
    expect(facts.missedDays).toBe(0); // no prior visit was recorded here
  });

  it('degrades safely without localStorage', () => {
    delete globalThis.window;
    const facts = computeDailyLoopFacts({ now: D(2026, 4, 20) });
    expect(facts.streak).toBe(0);
    expect(facts.firstVisitToday).toBe(true);
    expect(Object.isFrozen(facts)).toBe(true);
  });
});

// ─── 7. Storage keys are namespaced under farroway.* ──────────────
describe('dailyLoop — storage namespace', () => {
  it('all keys live under farroway.*', () => {
    for (const v of Object.values(_keys)) {
      expect(v.startsWith('farroway.')).toBe(true);
    }
  });
});
