/**
 * dailyTaskCompletion.js — localStorage-backed completion log
 * for actions emitted by the daily intelligence engine.
 *
 *   markActionDone(farmId, action)  → adds an entry
 *   getCompletionsToday(farmId)     → array of today's entries
 *   getCompletedActionIdsToday(farmId) → array of ids only
 *
 * Strict-rule audit
 *   • No engine modifications — completion entries are SCOPED
 *     to the daily-intelligence flow ('source: daily_intelligence')
 *     so they don't pollute the existing task store.
 *   • Capped at 200 entries per farm (rolling).
 */

const PREFIX = 'farroway:dailyCompletion:';
const MAX = 200;

function safeStorage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch { return null; }
}

function key(farmId) { return `${PREFIX}${farmId}`; }

function safeRead(farmId) {
  const ls = safeStorage();
  if (!ls || !farmId) return [];
  try {
    const raw = ls.getItem(key(farmId));
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

function safeWrite(farmId, list) {
  const ls = safeStorage();
  if (!ls || !farmId) return false;
  try { ls.setItem(key(farmId), JSON.stringify(list)); return true; }
  catch { return false; }
}

function uuid() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch { /* swallow */ }
  return 'dc_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now();
}

function todayKey(d = new Date()) {
  // YYYY-MM-DD in the user's timezone — matches how the daily
  // card thinks about "today".
  try {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch { return ''; }
}

/**
 * markActionDone — record a completion. No-op when farmId or
 * action is missing.
 */
export function markActionDone(farmId, action) {
  if (!farmId || !action || !action.id) return null;
  const list = safeRead(farmId);
  const entry = {
    id:         uuid(),
    farmId,
    actionId:   action.id,
    actionType: action.actionType || 'inspect',
    completedAt: (() => { try { return new Date().toISOString(); } catch { return ''; } })(),
    dayKey:     todayKey(),
    source:     'daily_intelligence',
  };
  list.push(entry);
  while (list.length > MAX) list.shift();
  safeWrite(farmId, list);
  return entry;
}

/**
 * getCompletionsToday — every completion logged today.
 */
export function getCompletionsToday(farmId) {
  if (!farmId) return [];
  const today = todayKey();
  return safeRead(farmId).filter((e) => e && e.dayKey === today);
}

/**
 * getCompletedActionIdsToday — fast lookup for the action
 * generator's de-duplication step.
 */
export function getCompletedActionIdsToday(farmId) {
  return getCompletionsToday(farmId).map((e) => e.actionId);
}

/**
 * Admin / test helper.
 */
export function clearCompletions(farmId) {
  const ls = safeStorage();
  if (!ls || !farmId) return;
  try { ls.removeItem(key(farmId)); } catch { /* ignore */ }
}

export const _internal = Object.freeze({ PREFIX, MAX });
