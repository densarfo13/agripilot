/**
 * dailyLoop.js — boot-time composer for the engagement loop.
 *
 * Runs the 4-step daily loop in the right order:
 *   1. Capture missed-day signal BEFORE the streak math overwrites
 *      its anchor.
 *   2. Mark today's check-in flag.
 *   3. Update the streak counter.
 *   4. Schedule the soft reminder (6h-later nudge).
 *
 * Returns a snapshot consumers can mount into a component:
 *   {
 *     missed:   boolean,        // showed banner-worthy gap?
 *     streak:   number,         // today's streak after update
 *     today:    string,         // Date.toDateString() value
 *     teardown: () => void,     // clear pending reminder timer
 *   }
 *
 * Strict rules respected:
 *   * lightweight    - 4 small ops, no async work
 *   * works offline  - localStorage only, no network
 *   * never throws   - every step swallowed individually
 *   * idempotent     - safe to call on every mount of App.jsx
 */

import { hasCheckedInToday, markCheckedIn, getTodayKey } from './dailyCheckin.js';
import { updateStreak, getStreak, hasMissedYesterday } from './streak.js';
import { scheduleReminder } from './reminder.js';
// Passive labeling - boot-time, idempotent inside a local day.
// Harvests low-confidence labels from the existing event stream
// so the trainer has weak negatives to balance the dataset.
import { runPassiveLabeling } from '../data/passiveLabeler.js';
// NGO Onboarding spec \u00a78 follow-up \u2014 day2/day7 return-day
// scheduler. Reads the retention store's firstVisitISO + a
// once-fired stamp so the events fire EXACTLY once per
// device, the first time the user lands on day 2 or day 7
// after their first visit.
import { getRetentionState } from '../lib/retention/streakStore.js';
import { trackEvent } from '../core/analytics.js';

const NOOP = () => { /* teardown noop */ };

// NGO Onboarding spec \u00a78 follow-up \u2014 once-fired stamps for
// the day2_return / day7_return events. We use simple boolean
// localStorage flags rather than scanning the event log so a
// large pilot doesn't pay an O(N) read on every boot.
const DAY2_RETURN_STAMP_KEY = 'farroway_day2_return_fired';
const DAY7_RETURN_STAMP_KEY = 'farroway_day7_return_fired';

function _stampFired(key) {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(key) === 'true';
  } catch { return false; }
}

function _stampMark(key) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, 'true');
  } catch { /* swallow */ }
}

/**
 * Days between two ISO `YYYY-MM-DD` keys, computed at local
 * midnight to avoid DST drift. Returns null when either side
 * is malformed.
 */
function _daysBetween(fromIso, toIso) {
  if (!fromIso || !toIso) return null;
  const parse = (k) => {
    const [y, m, d] = String(k).split('-').map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
    return new Date(y, m - 1, d).getTime();
  };
  const a = parse(fromIso);
  const b = parse(toIso);
  if (a == null || b == null) return null;
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

/**
 * Fire the day2_return / day7_return events once each, the
 * first time the user lands on day-2 or day-7 from their
 * first visit. Idempotent: subsequent boots see the stamp
 * and skip the trackEvent call.
 *
 * Side effect: writes the once-fired stamp keys to
 * localStorage. Reads the retention store's firstVisitISO.
 * The retention store itself stamps firstVisitISO inside
 * recordVisit() (called by the existing daily-loop chain
 * elsewhere); if it isn't set yet (very first boot), this
 * function no-ops gracefully.
 */
function _fireReturnDayEvents() {
  let firstVisitISO = null;
  try {
    const state = getRetentionState();
    firstVisitISO = state && state.firstVisitISO ? state.firstVisitISO : null;
  } catch { /* swallow */ }
  if (!firstVisitISO) return;
  const today = getTodayKey();
  const days  = _daysBetween(firstVisitISO, today);
  if (days == null) return;
  // Day 2 = exactly two calendar days after the first visit.
  // We allow >= 2 (rather than == 2) so a user who skipped
  // day 2 and lands on day 3 still gets the event fired
  // ONCE (the stamp prevents re-fires).
  if (days >= 2 && !_stampFired(DAY2_RETURN_STAMP_KEY)) {
    try {
      trackEvent('day2_return', {
        firstVisitISO,
        daysSinceFirstVisit: days,
      });
    } catch { /* swallow */ }
    _stampMark(DAY2_RETURN_STAMP_KEY);
  }
  if (days >= 7 && !_stampFired(DAY7_RETURN_STAMP_KEY)) {
    try {
      trackEvent('day7_return', {
        firstVisitISO,
        daysSinceFirstVisit: days,
      });
    } catch { /* swallow */ }
    _stampMark(DAY7_RETURN_STAMP_KEY);
  }
}

/**
 * initDailyLoop({ schedule = true } = {})
 *   -> { missed, streak, today, teardown }
 *
 * `schedule` controls whether the 6-hour reminder timer is armed.
 * Tests pass `false` so they don't leak timers.
 */
export function initDailyLoop({ schedule = true } = {}) {
  const today = getTodayKey();

  // 1. Read the missed-day signal BEFORE updateStreak overwrites
  //    its anchor. After updateStreak runs, the anchor will be
  //    today and hasMissedYesterday() would always return false.
  let missed = false;
  try { missed = hasMissedYesterday(); } catch { /* keep false */ }

  // 2. Stamp today's check-in (idempotent within the day).
  if (!hasCheckedInToday()) {
    try { markCheckedIn(); } catch { /* swallow */ }
  }

  // 3. Update the streak. Idempotent same-day; advances on
  //    consecutive-day boots; resets to 1 on a gap.
  let streak = 0;
  try { streak = updateStreak(); }
  catch { try { streak = getStreak(); } catch { /* keep 0 */ } }

  // 4. Arm the reminder. scheduleReminder is itself idempotent
  //    across re-mounts; passing schedule:false skips the arm.
  let teardown = NOOP;
  if (schedule) {
    try { teardown = scheduleReminder() || NOOP; }
    catch { teardown = NOOP; }
  }

  // 5. Run the passive labeler. Idempotent within a local day
  //    (its own ledger). Never blocks - we don't await; the
  //    function is sync + cheap (O(N) over events).
  try { runPassiveLabeling(); }
  catch { /* swallow - passive labeling is best-effort */ }

  // 6. NGO Onboarding spec \u00a78 follow-up \u2014 fire day2_return /
  //    day7_return events once each, the first time the user
  //    lands on day 2 or day 7 from their first visit. The
  //    helper reads the retention store's firstVisitISO +
  //    once-fired stamps; idempotent on subsequent boots.
  try { _fireReturnDayEvents(); }
  catch { /* swallow \u2014 must never block the loop */ }

  return Object.freeze({ missed, streak, today, teardown });
}
