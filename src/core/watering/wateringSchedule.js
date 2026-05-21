/**
 * wateringSchedule.js — manual watering schedules with weather
 * adaptation and missed-watering follow-up.
 *
 *   import { saveSchedule, getSchedules, nextScheduledWatering,
 *            isWateringDue, missedWateringFollowUp }
 *     from 'src/core/watering/wateringSchedule.js';
 *
 * What it is
 * ──────────
 *   The user-set side of the watering layer:
 *     • simple CRUD over a small list of schedules (daily / weekly
 *       / custom days; morning / evening times; farm / garden /
 *       crop scope);
 *     • `nextScheduledWatering()` / `isWateringDue()` pure time
 *       math the UI + reminder loop can call;
 *     • `missedWateringFollowUp()` — one calm follow-up per missed
 *       slot, never a repeating spam loop.
 *
 *   Persistence delegates to `offlineStore` so schedules survive
 *   offline and sync with the rest of the offline data.
 *
 * Strict-rule audit
 *   • Never throws. SSR-safe (offlineStore guards localStorage).
 */

import {
  saveOffline, getOffline, OFFLINE_KEYS,
} from '../offline/offlineStore.js';

// Storage key — registered alongside the canonical OFFLINE_KEYS;
// we fall back to the literal when the key isn't yet in the enum,
// so this module works against older offlineStore versions too.
const STORE_KEY = OFFLINE_KEYS.WATERING_SCHEDULES || 'watering_schedules';

export const SCHEDULE_SCOPE = Object.freeze({
  FARM:   'farm',
  GARDEN: 'garden',
  CROP:   'crop',
});

export const REPEAT = Object.freeze({
  DAILY:  'daily',
  WEEKLY: 'weekly',
  CUSTOM: 'custom',
});

export const TIME_OF_DAY = Object.freeze({
  MORNING: 'morning',
  EVENING: 'evening',
});

const TIME_HOURS = Object.freeze({ morning: 7, evening: 18 });

function _safeId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* fallthrough */ }
  return `sched_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

function _readList() {
  try {
    const entry = getOffline(STORE_KEY);
    const list = entry && Array.isArray(entry.data) ? entry.data : [];
    return list;
  } catch { return []; }
}

function _writeList(list) {
  try { saveOffline(STORE_KEY, Array.isArray(list) ? list : []); }
  catch { /* ignore */ }
}

function _normalize(s) {
  const scope = String(s?.scope || SCHEDULE_SCOPE.GARDEN).toLowerCase();
  const times = Array.isArray(s?.times) && s.times.length > 0
    ? s.times.filter((t) => t === TIME_OF_DAY.MORNING || t === TIME_OF_DAY.EVENING)
    : [TIME_OF_DAY.MORNING];
  const daysOfWeek = Array.isArray(s?.daysOfWeek) && s.daysOfWeek.length > 0
    ? s.daysOfWeek.map((d) => Number(d)).filter((d) => d >= 0 && d <= 6)
    : [0, 1, 2, 3, 4, 5, 6]; // 0=Sun … 6=Sat — default every day
  const repeat = String(s?.repeat || REPEAT.DAILY).toLowerCase();
  return {
    id:     s?.id || _safeId(),
    scope,
    cropId: s?.cropId || null,
    farmId: s?.farmId || null,
    crop:   s?.crop || null,
    times,
    daysOfWeek,
    repeat: [REPEAT.DAILY, REPEAT.WEEKLY, REPEAT.CUSTOM].includes(repeat) ? repeat : REPEAT.DAILY,
    mode:   String(s?.mode || '').toLowerCase() === 'farmer' ? 'farmer' : 'gardener',
  };
}

/**
 * Save (create or update) a schedule. Returns the normalised
 * stored shape — never throws.
 */
export function saveSchedule(schedule) {
  try {
    const norm = _normalize(schedule);
    const list = _readList();
    const idx = list.findIndex((s) => s && s.id === norm.id);
    if (idx >= 0) list[idx] = norm; else list.push(norm);
    _writeList(list);
    return norm;
  } catch {
    return null;
  }
}

/** Read all schedules. */
export function getSchedules() {
  return _readList().map(_normalize);
}

/** Remove a schedule by id. */
export function removeSchedule(id) {
  try {
    const list = _readList().filter((s) => s && s.id !== id);
    _writeList(list);
    return true;
  } catch { return false; }
}

function _nextOccurrence(schedule, nowMs) {
  const now = new Date(Number.isFinite(nowMs) ? nowMs : Date.now());
  const days = new Set(schedule.daysOfWeek);
  for (let offset = 0; offset < 8; offset++) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + offset);
    if (!days.has(candidate.getDay())) continue;
    for (const t of schedule.times) {
      const hour = TIME_HOURS[t] || 7;
      candidate.setHours(hour, 0, 0, 0);
      if (candidate.getTime() > now.getTime()) return candidate.getTime();
    }
  }
  return null;
}

/** ms timestamp of the next scheduled watering, or null. */
export function nextScheduledWatering(schedule, nowMs) {
  try {
    if (!schedule) return null;
    return _nextOccurrence(_normalize(schedule), nowMs);
  } catch { return null; }
}

/**
 * Is a watering currently due (within `toleranceMinutes` of a
 * scheduled slot for today)?
 */
export function isWateringDue(schedule, nowMs, toleranceMinutes) {
  try {
    if (!schedule) return false;
    const norm = _normalize(schedule);
    const now = new Date(Number.isFinite(nowMs) ? nowMs : Date.now());
    if (!norm.daysOfWeek.includes(now.getDay())) return false;
    const tol = Number.isFinite(toleranceMinutes) ? toleranceMinutes : 60;
    for (const t of norm.times) {
      const slot = new Date(now);
      slot.setHours(TIME_HOURS[t] || 7, 0, 0, 0);
      const diffMin = (now.getTime() - slot.getTime()) / 60000;
      if (diffMin >= 0 && diffMin <= tol) return true;
    }
    return false;
  } catch { return false; }
}

/**
 * One calm follow-up per missed slot. Returns `{ needsFollowUp,
 * hoursOverdue, message }`. `needsFollowUp` is true ONLY when:
 *   • a slot was due more than `graceHours` ago,
 *   • the last watering happened before that slot, AND
 *   • we have not already fired a follow-up for the same slot
 *     (caller passes the last follow-up timestamp).
 *
 * @param {object} args
 * @param {number} args.lastDueMs        the missed slot
 * @param {number|null} args.lastWateredAt   when the user last watered
 * @param {number|null} args.lastFollowUpAt  when we last reminded
 * @param {number} [args.nowMs]
 * @param {number} [args.graceHours]     default 2
 * @returns {object}
 */
export function missedWateringFollowUp(args) {
  try {
    const a = (args && typeof args === 'object') ? args : {};
    const now = Number.isFinite(a.nowMs) ? a.nowMs : Date.now();
    const lastDue = Number(a.lastDueMs);
    if (!Number.isFinite(lastDue)) return _noFollowUp();
    const grace = Number.isFinite(a.graceHours) ? a.graceHours : 2;
    const hoursOverdue = Math.max(0, (now - lastDue) / 3600000);
    if (hoursOverdue <= grace) return _noFollowUp(hoursOverdue);

    // Already watered after the slot → nothing to remind.
    if (Number.isFinite(a.lastWateredAt) && a.lastWateredAt >= lastDue) {
      return _noFollowUp(hoursOverdue);
    }
    // Already fired a follow-up for THIS slot → don't spam.
    if (Number.isFinite(a.lastFollowUpAt) && a.lastFollowUpAt >= lastDue) {
      return _noFollowUp(hoursOverdue);
    }
    const hrs = Math.round(hoursOverdue);
    return {
      needsFollowUp: true,
      hoursOverdue: hrs,
      message: hrs <= 6
        ? 'Looks like you missed today’s watering — a short check is enough.'
        : 'Watering is overdue — check the soil and water if it feels dry.',
    };
  } catch {
    return _noFollowUp();
  }
}

function _noFollowUp(hoursOverdue) {
  return {
    needsFollowUp: false,
    hoursOverdue:  Math.round(Number.isFinite(hoursOverdue) ? hoursOverdue : 0),
    message:       '',
  };
}

const _module = {
  SCHEDULE_SCOPE, REPEAT, TIME_OF_DAY,
  saveSchedule, getSchedules, removeSchedule,
  nextScheduledWatering, isWateringDue, missedWateringFollowUp,
};
export default _module;
