/**
 * useDailyHabit — React hook for the FEATURE_DAILY_HABIT layer.
 *
 * Composes the three habit store modules into a single hook that
 * Home (and any other surface) can consume with one import.
 *
 *   const {
 *     today,           // 'YYYY-MM-DD' — current calendar day
 *     streak,          // number — effective streak count (0 if lapsed)
 *     completedToday,  // boolean — true if farmer marked task done today
 *     markDone,        // () → void — idempotent; increments streak once/day
 *     reminderPref,    // { enabled: boolean, preferredTime: string|null }
 *     updateReminderPref, // ({ enabled?, preferredTime? }) → void
 *   } = useDailyHabit();
 *
 * STATE MODEL
 * ───────────
 *   • All state is derived from localStorage on first render — no fetch,
 *     no async, no blocking.
 *   • `markDone()` writes two localStorage keys atomically (task date +
 *     streak), then re-reads both so state stays consistent with storage.
 *   • Cross-tab / cross-component sync: subscribes to the
 *     `farroway:dailyHabitChanged` CustomEvent. A completion in one tab
 *     updates the streak chip in any sibling surface without a parent
 *     re-render.
 *   • Date change detection: `completedToday` is derived by comparing the
 *     stored completion date with the current calendar date at READ TIME.
 *     If the user opens the app on a new day, `completedToday` is
 *     automatically false — no cleanup write needed.
 *
 * RULES
 * ─────
 *   • All hooks declared unconditionally (rules-of-hooks safe).
 *   • No API calls. No blocking render.
 *   • Never throws — every store read is already guarded.
 *   • SSR-safe (stores guard typeof localStorage / window).
 */

import { useCallback, useEffect, useState } from 'react';
import {
  computeEffectiveStreak,
  recordCompletion,
  todayIsoDate,
  HABIT_CHANGE_EVENT,
} from '../lib/habit/streakStore.js';
import {
  hasCompletedToday,
  markTaskCompletedDate,
} from '../lib/habit/dailyTaskReset.js';
import {
  getReminderPref,
  setReminderPref as _setReminderPref,
} from '../lib/habit/reminderPrefStore.js';

export default function useDailyHabit() {
  // Stable today string — recalculated on each render but stored
  // as state so the component doesn't re-render from it.
  const [today] = useState(() => todayIsoDate());

  // Derived from localStorage on first render. No async.
  const [completedToday, setCompletedToday] = useState(
    () => hasCompletedToday(today),
  );
  const [streak, setStreak] = useState(
    () => computeEffectiveStreak(today),
  );
  const [reminderPref, setReminderPrefState] = useState(
    () => getReminderPref(),
  );

  // Cross-tab + cross-component sync.
  // The change event is dispatched by both streakStore and
  // reminderPrefStore so we re-read all state on any mutation.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    function _refresh() {
      // Re-read today fresh in case time crossed midnight.
      const t = todayIsoDate();
      setCompletedToday(hasCompletedToday(t));
      setStreak(computeEffectiveStreak(t));
      setReminderPrefState(getReminderPref());
    }

    try {
      window.addEventListener(HABIT_CHANGE_EVENT, _refresh);
      // Cross-tab: storage events fire when another tab writes.
      window.addEventListener('storage', _refresh);
    } catch { /* swallow */ }

    return () => {
      try {
        window.removeEventListener(HABIT_CHANGE_EVENT, _refresh);
        window.removeEventListener('storage', _refresh);
      } catch { /* swallow */ }
    };
  }, []);

  /**
   * Mark today's task as done. Idempotent — calling twice on the same
   * calendar day is a no-op (streak increments at most once per day).
   */
  const markDone = useCallback(() => {
    const t = todayIsoDate(); // re-read in case midnight passed
    if (hasCompletedToday(t)) return; // already done today

    // Write both stores.
    markTaskCompletedDate(t);
    const newStreak = recordCompletion(t);

    // Sync local React state.
    setCompletedToday(true);
    setStreak(newStreak);
  }, []);

  /**
   * Persist a reminder preference update. No push/SMS/email is wired —
   * this only saves the preference for future delivery channels to read.
   */
  const updateReminderPref = useCallback(({ enabled, preferredTime } = {}) => {
    const saved = _setReminderPref({ enabled, preferredTime });
    setReminderPrefState(saved);
  }, []);

  return {
    today,
    streak,
    completedToday,
    markDone,
    reminderPref,
    updateReminderPref,
  };
}
