/**
 * userMemory.js — derived personal-memory state for the data
 * moat (Data Moat Layer §4).
 *
 *   import { getUserMemory } from '../core/userMemory.js';
 *
 *   const m = getUserMemory();
 *   // → {
 *   //     completedTasksCount,
 *   //     skippedTasksCount,
 *   //     scanCount,
 *   //     lastHealthyFeedback,    'looks_healthy' | 'not_sure' | 'getting_worse' | null
 *   //     lastIssueType,
 *   //     lastWateringAdvice,
 *   //     lastActiveDate,
 *   //   }
 *
 * Why a separate module
 * ─────────────────────
 * The dailyPlanEngine + Home card both want a tiny rollup of
 * "what has this user been doing" so they can adapt the plan
 * (simplify watering tasks if often skipped, encourage on
 * streaks, raise risk on "getting worse" feedback). Putting
 * the rollup in eventStore would muddy its append-only
 * contract; putting it inline in DailyPlanCard would force
 * every consumer to recompute. This module is the single
 * derived view both surfaces read.
 *
 * Storage
 * ───────
 * Reads from `farroway_events` (canonical event log) +
 * `farroway_health_feedback` (the outcome-feedback store).
 * No additional persistence layer here — userMemory is a
 * pure function of those two stores. We DO offer a tiny
 * cached snapshot at `farroway_user_memory` so future
 * surfaces (background tasks, sync workers) can read the
 * derived view without scanning the full event log; the
 * cache is regenerated on-demand by getUserMemory() and
 * is never the source of truth.
 *
 * Strict-rule audit
 *   • Pure derivation outside the localStorage I/O.
 *   • Never throws. Bad input falls through to the empty
 *     memory shape (all counters 0, last* fields null).
 *   • SSR-safe.
 *   • Privacy: never reads any personal field other than
 *     what's already on the events themselves.
 */

import { getEvents, summarizeEvents } from './eventStore.js';
import { aggregateRecentFeedback } from './healthFeedbackStore.js';

const USER_MEMORY_CACHE_KEY = 'farroway_user_memory';

/** Empty shape — returned when there's nothing to derive. */
const EMPTY_MEMORY = Object.freeze({
  completedTasksCount: 0,
  skippedTasksCount:   0,
  scanCount:           0,
  lastHealthyFeedback: null,
  lastIssueType:       null,
  lastWateringAdvice:  null,
  lastActiveDate:      null,
});

function _safeWriteCache(memory) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(USER_MEMORY_CACHE_KEY, JSON.stringify({
      ...memory,
      _cachedAt: Date.now(),
    }));
  } catch { /* swallow */ }
}

/**
 * getUserMemory() → memory object.
 *
 * Reads + aggregates the canonical event log into the spec
 * shape. Never throws. Returns a fresh object on every call
 * so callers can safely mutate the result without affecting
 * the cache.
 */
export function getUserMemory() {
  try {
    const events = getEvents();
    if (!Array.isArray(events) || events.length === 0) {
      return { ...EMPTY_MEMORY };
    }
    const summary = summarizeEvents(events);

    const completedTasksCount = summary.byName['task_completed'] || 0;
    const skippedTasksCount   = summary.byName['task_skipped']   || 0;
    const scanCount           = (summary.byName['scan_started']   || 0)
                              + (summary.byName['scan_completed'] || 0);

    // Walk newest-first to find the last "interesting" facts.
    // Stops at the first hit per facet so we don't iterate the
    // full log when only the most recent answer matters.
    let lastHealthyFeedback = null;
    let lastIssueType       = null;
    let lastWateringAdvice  = null;
    let lastActiveDate      = null;
    for (let i = events.length - 1; i >= 0; i -= 1) {
      const e = events[i];
      if (!e || !e.name) continue;
      if (lastActiveDate == null && typeof e.timestamp === 'number') {
        lastActiveDate = new Date(e.timestamp).toISOString().slice(0, 10);
      }
      const p = e.payload || {};
      if (lastHealthyFeedback == null && e.name === 'health_feedback_submitted') {
        // Map the legacy 3-option vocabulary onto the spec's
        // 3-option vocabulary so both shapes resolve.
        const v = p.healthFeedback || p.feedback;
        if (v === 'yes' || v === 'looks_healthy')   lastHealthyFeedback = 'looks_healthy';
        else if (v === 'no' || v === 'getting_worse') lastHealthyFeedback = 'getting_worse';
        else if (v === 'not_sure')                   lastHealthyFeedback = 'not_sure';
      }
      if (lastIssueType == null && e.name === 'scan_completed') {
        lastIssueType = p.issueType || p.disease || p.diagnosis || null;
      }
      if (lastWateringAdvice == null && e.name === 'task_completed') {
        // Heuristic: the watering task's title contains the
        // word "water". We capture the title verbatim so the
        // engine can echo it ("Last time, you watered when…").
        const title = String(p.taskTitle || p.title || '').trim();
        if (/water/i.test(title)) lastWateringAdvice = title;
      }
      if (lastHealthyFeedback != null
          && lastIssueType != null
          && lastWateringAdvice != null
          && lastActiveDate != null) {
        break;
      }
    }

    const memory = {
      completedTasksCount,
      skippedTasksCount,
      scanCount,
      lastHealthyFeedback,
      lastIssueType,
      lastWateringAdvice,
      lastActiveDate,
    };
    // Best-effort cache write so background readers can pick
    // up the derived view without re-scanning.
    _safeWriteCache(memory);
    return memory;
  } catch {
    return { ...EMPTY_MEMORY };
  }
}

/**
 * encouragementMessage(memory?) → { key, fallback } | null.
 *
 * Spec §4 — surfaces a lightweight message based on the
 * user's recent activity. The dailyPlanEngine + Home card
 * call this and route through tSafe so the message
 * translates per locale. Returns null when no message
 * applies (the card stays calm).
 *
 * Order of preference:
 *   1. lastHealthyFeedback === 'getting_worse'
 *      → "Last time, you said it's getting worse. Let's check today."
 *   2. lastHealthyFeedback === 'looks_healthy'
 *      → "Last time, you said it looked healthy. Keep it up."
 *   3. completedTasksCount >= 3 in the last 7d
 *      → "You've checked your plants 3 days this week."
 *   4. else null.
 */
export function encouragementMessage(memory) {
  const m = (memory && typeof memory === 'object') ? memory : getUserMemory();
  if (!m) return null;

  if (m.lastHealthyFeedback === 'getting_worse') {
    return {
      key:      'memory.encourage.gettingWorse',
      fallback: 'Last time, you said it\u2019s getting worse \u2014 a quick check today helps.',
    };
  }
  if (m.lastHealthyFeedback === 'looks_healthy') {
    return {
      key:      'memory.encourage.healthy',
      fallback: 'Last time, your plant looked healthy. Keep it up.',
    };
  }
  // Completion streak — recent 7-day window via aggregator.
  try {
    const recent = aggregateRecentFeedback(7);
    const completed = m.completedTasksCount || 0;
    if (completed >= 3 || (recent && recent.total >= 3)) {
      return {
        key:      'memory.encourage.consistent',
        fallback: 'You\u2019ve checked your plants several days this week.',
      };
    }
  } catch { /* swallow — fall through to null */ }
  return null;
}

/**
 * resetUserMemory() — wipes the local cache only. Use the
 * top-level clearFarrowayActivityData (in analytics.js) to
 * wipe everything.
 */
export function resetUserMemory() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(USER_MEMORY_CACHE_KEY);
  } catch { /* swallow */ }
}

export default { getUserMemory, encouragementMessage, resetUserMemory };
