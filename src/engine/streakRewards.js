/**
 * streakRewards.js — celebration + risk helpers on top of the
 * existing streak counter (`utils/streak.js`).
 *
 * Spec coverage (Daily streak system §4, §6)
 *   §4 reward + warning messages
 *   §6 milestones at 3, 7, 14 (extended to 30 for natural ladder)
 *
 *   getStreakSnapshot({ now? }) → {
 *     count:               number,    // current streak
 *     hadActivityToday:    boolean,
 *     atRisk:              boolean,   // streak ≥ 1, none today, after 4pm
 *     milestone:           3 | 7 | 14 | 30 | null,
 *     justCrossedMilestone: same | null  // only when this boot is the
 *                                          first to see the milestone
 *   }
 *
 * Storage
 *   farroway_streak_milestones_seen : Array<number> — milestones
 *                                     already celebrated (stops
 *                                     duplicate celebrations).
 *   farroway_streak_risk_anchor    : YYYY-MM-DD last warned —
 *                                     keeps the warning to once
 *                                     per local day.
 *
 * Strict-rule audit
 *   • Pure read for getSnapshot; never throws.
 *   • Side-effect helpers (`acknowledgeMilestone`,
 *     `acknowledgeRisk`) are explicit so the surface controls
 *     when stamps are written.
 *   • Reads streak via the canonical `utils/streak.js` so the
 *     state machine stays single-source.
 */

import { getStreak, hasMissedYesterday } from '../utils/streak.js';
import { hadActivityToday } from './engagementHistory.js';

export const MILESTONES = Object.freeze([3, 7, 14, 30]);
export const SEEN_MILESTONES_KEY = 'farroway_streak_milestones_seen';
export const RISK_ANCHOR_KEY     = 'farroway_streak_risk_anchor';

const RISK_AFTER_HOUR = 16;       // 4pm local

function _safeReadJsonArray(key) {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function _safeReadString(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch { return null; }
}

function _safeWrite(key, value) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, typeof value === 'string'
      ? value
      : JSON.stringify(value));
  } catch { /* swallow */ }
}

function _todayISO(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function _matchedMilestone(count) {
  for (let i = MILESTONES.length - 1; i >= 0; i -= 1) {
    if (count === MILESTONES[i]) return MILESTONES[i];
  }
  return null;
}

/** Pure read snapshot. Safe to call from a render. */
export function getStreakSnapshot({ now = new Date() } = {}) {
  let count = 0;
  try { count = getStreak(); } catch { count = 0; }

  let activityToday = false;
  try { activityToday = hadActivityToday(); } catch { activityToday = false; }

  const milestone = _matchedMilestone(count);
  const seen = _safeReadJsonArray(SEEN_MILESTONES_KEY);
  const justCrossedMilestone = milestone && !seen.includes(milestone)
    ? milestone : null;

  const hour = (() => {
    try { return now.getHours(); } catch { return 0; }
  })();
  const atRisk = count >= 1 && !activityToday && hour >= RISK_AFTER_HOUR;

  return {
    count,
    hadActivityToday: activityToday,
    atRisk,
    milestone,
    justCrossedMilestone,
    missedYesterday: (() => {
      try { return hasMissedYesterday(); } catch { return false; }
    })(),
  };
}

/**
 * Mark a milestone as seen so subsequent reads stop returning it
 * via `justCrossedMilestone`. Called by the celebration surface
 * when the user dismisses or after auto-fade.
 */
export function acknowledgeMilestone(milestone) {
  const m = Number(milestone);
  if (!MILESTONES.includes(m)) return null;
  const seen = _safeReadJsonArray(SEEN_MILESTONES_KEY);
  if (seen.includes(m)) return seen;
  const next = seen.concat(m);
  _safeWrite(SEEN_MILESTONES_KEY, next);
  return next;
}

/** Stamp the risk warning so it does not re-fire today. */
export function acknowledgeRisk({ now = new Date() } = {}) {
  _safeWrite(RISK_ANCHOR_KEY, _todayISO(now));
}

/** True when the risk banner has not been shown yet today. */
export function shouldShowRisk({ now = new Date() } = {}) {
  const stamp = _safeReadString(RISK_ANCHOR_KEY);
  return stamp !== _todayISO(now);
}

/** Test / admin helpers. */
export function _resetMilestoneStamps() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SEEN_MILESTONES_KEY);
      localStorage.removeItem(RISK_ANCHOR_KEY);
    }
  } catch { /* swallow */ }
}

export default {
  MILESTONES,
  SEEN_MILESTONES_KEY,
  RISK_ANCHOR_KEY,
  getStreakSnapshot,
  acknowledgeMilestone,
  acknowledgeRisk,
  shouldShowRisk,
};
