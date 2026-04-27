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

const NOOP = () => { /* teardown noop */ };

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

  return Object.freeze({ missed, streak, today, teardown });
}
