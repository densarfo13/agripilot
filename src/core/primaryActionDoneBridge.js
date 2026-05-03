/**
 * primaryActionDoneBridge.js — single-listener glue between the
 * FirstActionGate's `farroway:primaryActionDone` window event
 * and the existing `streakEngine.recordTaskCompleted()` /
 * `dailyTaskCompletion.recordTaskCompletion()` writers.
 *
 * Why a bridge module
 * ───────────────────
 * The gate fires a CustomEvent on Done. Two existing engines want
 * to know:
 *   • streakEngine — bumps the streak count + lastCompletedDate
 *   • dailyTaskCompletion — increments today's completed-tasks
 *     log under the spec's daily-progress contract
 *
 * A bridge module avoids hard-importing those engines into the
 * gate (which would fight the "no duplicate systems" rule when
 * other call sites already mark tasks done elsewhere). It also
 * keeps the gate UI-pure.
 *
 * Idempotency
 * ───────────
 * The streak engine itself dedupes per-day via its
 * `farroway_last_completed_date` key; firing this bridge twice on
 * the same day is a no-op. Daily-progress logging is also
 * keyed per-day. Listeners can therefore run unconditionally.
 *
 * Init
 * ────
 *   import { initPrimaryActionDoneBridge } from '...';
 *   initPrimaryActionDoneBridge();   // call once at app boot
 *
 * The init function returns the unsubscribe handle so HMR reloads
 * don't double-bind. Wired in main.jsx alongside the other
 * boot-time helpers.
 */

import { recordTaskCompleted } from './streakEngine.js';
// Daily-progress writer is optional — the streak engine is the
// canonical "task done today" signal. If the project later
// exposes a separate progress-counter, plug it in here without
// the gate having to know.
let _bound = false;
let _unbind = null;

export function initPrimaryActionDoneBridge() {
  if (_bound) return _unbind;
  if (typeof window === 'undefined') return () => {};
  const handler = (_e) => {
    try { recordTaskCompleted(); }
    catch { /* never propagate from a window listener */ }
  };
  try { window.addEventListener('farroway:primaryActionDone', handler); }
  catch { return () => {}; }
  _bound = true;
  _unbind = () => {
    try { window.removeEventListener('farroway:primaryActionDone', handler); }
    catch { /* ignore */ }
    _bound = false;
    _unbind = null;
  };
  return _unbind;
}
