/**
 * notificationState — per-user action / dismissal memory for the
 * calm-intelligence notification system.
 *
 * Sits alongside notificationDeduplication. The dedup map answers
 * "did we deliver this kind:key recently?". This module answers
 * the OTHER half of trust-loop §9:
 *
 *   • user action taken — `markAction(dedupeKey)` records that the
 *     user actually engaged with the notification (tapped its CTA,
 *     opened the linked route). Subsequent runs treat the candidate
 *     as already-handled and suppress it for ACTION_SUPPRESS_HOURS.
 *
 *   • dismissed — `markDismissed(dedupeKey)` records an explicit
 *     "not now" gesture (swipe-away, dismiss button). Suppressed
 *     for DISMISSED_SUPPRESS_HOURS — longer than action-taken,
 *     because dismiss is a stronger negative signal.
 *
 * The engine calls `isSuppressed(dedupeKey, now)` before queuing a
 * candidate. Two state types compose: a candidate is suppressed if
 * EITHER timer is still inside its window.
 *
 * STORAGE
 *   Key: `farroway_notif_state_v1::<userId|__device>` — mirrors the
 *   per-user scoping convention used by notificationDeduplication
 *   so both modules respect the same auth boundary. Re-uses the
 *   same setActiveUserId() function — call it once per sign-in to
 *   route both modules to the right scope.
 *
 *   Value shape:
 *     { [dedupeKey]: { actionTakenAt?: ISO, dismissedAt?: ISO } }
 *
 *   Capped at MAX_TRACKED entries; oldest dropped first when
 *   exceeded. Survives reload + browser restart.
 *
 * SAFETY
 *   • Never throws on quota / private-mode / corrupt JSON.
 *   • SSR-safe (every storage call wrapped).
 *   • Pure read helpers stay side-effect-free.
 */

import { getActiveUserId } from './notificationDeduplication.js';

export const STATE_KEY     = 'farroway_notif_state_v1';
export const MAX_TRACKED   = 200;

// Suppression windows in milliseconds.
//   • Action-taken — 24 h. The user has shown intent, so we don't
//     nag again the same day. The orchestrator's own task-cooldown
//     covers the next-day check.
//   • Dismissed   — 72 h. A swipe-away is a stronger "leave me
//     alone" signal; respect it for 3 days. Calm wording means we
//     don't need shorter windows.
export const ACTION_SUPPRESS_HOURS    = 24;
export const DISMISSED_SUPPRESS_HOURS = 72;

const ACTION_MS    = ACTION_SUPPRESS_HOURS    * 60 * 60 * 1000;
const DISMISSED_MS = DISMISSED_SUPPRESS_HOURS * 60 * 60 * 1000;

function _storageKey() {
  const uid = getActiveUserId() || '__device';
  return `${STATE_KEY}::${uid}`;
}

function _read() {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(_storageKey());
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
  } catch { return {}; }
}

function _write(map) {
  try {
    if (typeof localStorage === 'undefined') return;
    const key = _storageKey();
    const entries = Object.entries(map);
    if (entries.length > MAX_TRACKED) {
      // Drop oldest by max(actionTakenAt, dismissedAt) — whichever
      // timestamp is most recent for the entry. Older entries fall
      // off the back so the active recent state is preserved.
      entries.sort((a, b) => {
        const at = Math.max(Date.parse(a[1]?.actionTakenAt || ''), Date.parse(a[1]?.dismissedAt || ''));
        const bt = Math.max(Date.parse(b[1]?.actionTakenAt || ''), Date.parse(b[1]?.dismissedAt || ''));
        return (Number.isFinite(at) ? at : 0) - (Number.isFinite(bt) ? bt : 0);
      });
      const trimmed = entries.slice(entries.length - MAX_TRACKED);
      const out = {};
      for (const [k, v] of trimmed) out[k] = v;
      localStorage.setItem(key, JSON.stringify(out));
      return;
    }
    localStorage.setItem(key, JSON.stringify(map));
  } catch { /* quota — non-fatal */ }
}

function _iso(when) {
  try {
    return (when instanceof Date) ? when.toISOString() : new Date().toISOString();
  } catch { return ''; }
}

// ─── Writes ──────────────────────────────────────────────────────

/**
 * Record that the user took the action on a notification (tapped
 * its CTA / opened the linked route). The dedupeKey is the
 * `${kind}:${key}` pair the engine puts on the envelope.
 */
export function markAction(dedupeKey, when = new Date()) {
  if (!dedupeKey) return;
  const map = _read();
  const prev = map[dedupeKey] || {};
  map[dedupeKey] = { ...prev, actionTakenAt: _iso(when) };
  _write(map);
}

/**
 * Record an explicit dismissal (swipe-away / X button).
 */
export function markDismissed(dedupeKey, when = new Date()) {
  if (!dedupeKey) return;
  const map = _read();
  const prev = map[dedupeKey] || {};
  map[dedupeKey] = { ...prev, dismissedAt: _iso(when) };
  _write(map);
}

// ─── Reads ───────────────────────────────────────────────────────

/**
 * Return the full state for `dedupeKey`, or null if no record.
 * Useful for diagnostics + UI hints.
 */
export function getState(dedupeKey) {
  if (!dedupeKey) return null;
  const map = _read();
  return map[dedupeKey] || null;
}

/**
 * True when a candidate should NOT be queued because the user
 * either acted on it within ACTION_SUPPRESS_HOURS or dismissed it
 * within DISMISSED_SUPPRESS_HOURS. Either timer is sufficient.
 *
 * @param {string} dedupeKey
 * @param {Date}   [now]
 * @returns {boolean}
 */
export function isSuppressed(dedupeKey, now = new Date()) {
  if (!dedupeKey) return false;
  const state = getState(dedupeKey);
  if (!state) return false;
  const t = (now instanceof Date) ? now.getTime() : Date.now();
  const act = Date.parse(state.actionTakenAt || '');
  if (Number.isFinite(act) && (t - act) < ACTION_MS) return true;
  const dis = Date.parse(state.dismissedAt || '');
  if (Number.isFinite(dis) && (t - dis) < DISMISSED_MS) return true;
  return false;
}

/**
 * Forget every recorded state for the active user scope — used by
 * tests + sign-out cleanup.
 */
export function clearAllState() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(_storageKey());
  } catch { /* swallow */ }
}

/**
 * Inspect the underlying store (test helper).
 */
export function _readStateMap() { return _read(); }

const _module = {
  STATE_KEY,
  MAX_TRACKED,
  ACTION_SUPPRESS_HOURS,
  DISMISSED_SUPPRESS_HOURS,
  markAction,
  markDismissed,
  getState,
  isSuppressed,
  clearAllState,
  _readStateMap,
};
export default _module;
