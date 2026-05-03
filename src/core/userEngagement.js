/**
 * userEngagement.js — derives a simple monetisation-ready
 * engagement level from existing local activity stores.
 *
 *   import {
 *     getEngagement, recordDayActive,
 *   } from '../core/userEngagement.js';
 *
 *   recordDayActive();              // call once per Home open
 *   const e = getEngagement();
 *   //  → {
 *   //      daysActive,              // distinct days the user has opened the app
 *   //      actionsCompleted,        // userMemory.completedTasksCount
 *   //      scanCount,               // userMemory.scanCount
 *   //      engagementLevel,         // 'new' | 'engaged' | 'power'
 *   //      lastActiveDate,          // 'YYYY-MM-DD' or null
 *   //    }
 *
 * Why a wrapper, not a new store
 * ──────────────────────────────
 * Strict rule from every prior session: **no duplicate systems.**
 *   • `actionsCompleted`, `scanCount`, `lastActiveDate` already live
 *     on `userMemory.getUserMemory()`.
 *   • `daysActive` is the only signal not already exposed; this
 *     module persists a single counter under a clearly-namespaced
 *     localStorage key + bumps it ONCE per calendar day.
 *
 * Engagement-level rules (Monetisation §1)
 * ────────────────────────────────────────
 *   new      — < 3 days active OR < 5 actions completed
 *   engaged  — 3 ≤ days < 7 OR 5 ≤ actions < 25
 *   power    — ≥ 7 days active AND ≥ 25 actions completed
 *
 * The bands are picked so the "engaged" tier maps directly to the
 * paywall §2 trigger ("user completes 3–5 days") without forcing
 * an exact threshold on the call site. Tunable from one place.
 *
 * Privacy + safety
 *   • Never throws. Storage failures degrade to "new" + 0 days.
 *   • All keys namespaced under `farroway_*` so the existing
 *     `clearFarrowayActivityData()` helper sweeps them on opt-out.
 */

// userMemory is the canonical rollup of completedTasksCount /
// scanCount / lastHealthyFeedback / lastActiveDate. This module
// is a thin derivation layer on top — it never writes back to
// userMemory, so the import has no circular-dep risk.
import { getUserMemory } from './userMemory.js';
// Freemium spec §3 — STREAK_3_DAY trigger reads streakDays off
// the engagement snapshot. Source is the retention store; lookup
// is wrapped in try/catch so an SSR / private-mode failure
// degrades cleanly to streakDays=0 (the trigger then no-ops).
import { getRetentionState } from '../lib/retention/streakStore.js';

const DAYS_KEY            = 'farroway_days_active_count';
const LAST_DAY_STAMP_KEY  = 'farroway_days_active_stamp';

const ENGAGED_DAYS_MIN  = 3;
const ENGAGED_ACTS_MIN  = 5;
const POWER_DAYS_MIN    = 7;
const POWER_ACTS_MIN    = 25;

function _todayDate() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

function _readNum(key, fallback = 0) {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch { return fallback; }
}

function _writeNum(key, n) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, String(n));
  } catch { /* ignore */ }
}

function _readStr(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch { return null; }
}

function _writeStr(key, v) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, String(v));
  } catch { /* ignore */ }
}

/**
 * Bump the daily-active counter ONCE per calendar day. Idempotent
 * across multiple Home opens within the same day.
 *
 * @returns {{ bumped: boolean, daysActive: number }}
 */
export function recordDayActive() {
  const today = _todayDate();
  const stamped = _readStr(LAST_DAY_STAMP_KEY);
  if (stamped === today) {
    return { bumped: false, daysActive: _readNum(DAYS_KEY, 0) };
  }
  const next = _readNum(DAYS_KEY, 0) + 1;
  _writeNum(DAYS_KEY, next);
  _writeStr(LAST_DAY_STAMP_KEY, today);
  return { bumped: true, daysActive: next };
}

/**
 * Derive the engagement snapshot. Pure read — does NOT bump the
 * day counter (call recordDayActive() separately on Home mount).
 *
 * @returns {{
 *   daysActive: number,
 *   actionsCompleted: number,
 *   scanCount: number,
 *   engagementLevel: 'new'|'engaged'|'power',
 *   lastActiveDate: string|null,
 * }}
 */
export function getEngagement() {
  let actionsCompleted = 0;
  let scanCount        = 0;
  let lastActiveDate   = null;
  // Pull from the existing userMemory rollup. Wrapped in
  // try/catch — getUserMemory itself never throws but a
  // pathological event-store payload could surface NaN reads;
  // we want to fall through to "new" cleanly.
  try {
    const m = getUserMemory();
    if (m && typeof m === 'object') {
      actionsCompleted = Number(m.completedTasksCount || m.completedTasks || 0) || 0;
      scanCount        = Number(m.scanCount || 0) || 0;
      lastActiveDate   = m.lastActiveDate || null;
    }
  } catch { /* memory store unavailable — fall through with zeros */ }

  const daysActive = _readNum(DAYS_KEY, 0);

  // Freemium §3 — surface the consecutive-day streak so the
  // STREAK_3_DAY paywall trigger has the signal it needs without
  // asking call sites to import streakStore directly. Defaults
  // to 0 on any storage / parse failure.
  let streakDays = 0;
  try {
    const r = getRetentionState();
    if (r && Number.isFinite(r.streakDays)) streakDays = r.streakDays;
  } catch { /* ignore */ }

  let engagementLevel = 'new';
  if (daysActive >= POWER_DAYS_MIN && actionsCompleted >= POWER_ACTS_MIN) {
    engagementLevel = 'power';
  } else if (daysActive >= ENGAGED_DAYS_MIN || actionsCompleted >= ENGAGED_ACTS_MIN) {
    engagementLevel = 'engaged';
  }
  return { daysActive, actionsCompleted, scanCount, streakDays, engagementLevel, lastActiveDate };
}

export const _internal = Object.freeze({
  DAYS_KEY, LAST_DAY_STAMP_KEY,
  ENGAGED_DAYS_MIN, ENGAGED_ACTS_MIN,
  POWER_DAYS_MIN, POWER_ACTS_MIN,
  _todayDate,
});
