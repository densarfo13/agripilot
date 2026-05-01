/**
 * homeTaskState.js — local-first per-day stamps for the Home
 * task hero ("done" + "skipped" actions).
 *
 * Spec coverage (Home task action-driven §3, §4, §7)
 *   §3 "Mark as done"
 *   §4 "Skip for now"
 *   §7 completion feedback / progress update
 *
 * Storage
 *   farroway_home_task_state : Array<{
 *     key:        string,         // stable hash of title+message
 *     status:     'done' | 'skipped',
 *     stampedAt:  ISO,
 *     taskTitle?: string,         // captured for audit only
 *   }>
 *   Capped at 60 entries; entries older than 24h auto-expire on
 *   read so a "skipped" task quietly returns the next day.
 *
 * Strict-rule audit
 *   • Never throws.
 *   • Works offline.
 *   • Idempotent on `key`: a re-stamp updates the timestamp + status
 *     without duplicating.
 *   • Emits `farroway:home_task_state_changed`.
 */

export const HOME_TASK_STATE_KEY = 'farroway_home_task_state';
const MAX_ENTRIES = 60;
const TTL_MS = 24 * 60 * 60_000;
const CHANGE_EVENT = 'farroway:home_task_state_changed';

function _safeRead() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(HOME_TASK_STATE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function _safeWrite(rows) {
  try {
    if (typeof localStorage === 'undefined') return;
    const trimmed = rows.length > MAX_ENTRIES
      ? rows.slice(rows.length - MAX_ENTRIES)
      : rows;
    localStorage.setItem(HOME_TASK_STATE_KEY, JSON.stringify(trimmed));
  } catch { /* swallow */ }
}

function _emit() {
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new Event(CHANGE_EVENT));
    }
  } catch { /* swallow */ }
}

function _fresh(rows, now = Date.now()) {
  return (rows || []).filter((r) => {
    if (!r || !r.key) return false;
    const t = Date.parse(r.stampedAt || '');
    if (!Number.isFinite(t)) return false;
    return (now - t) < TTL_MS;
  });
}

/**
 * Stable hash from a recommendation's title + message so we can
 * stamp without depending on a server-supplied id.
 */
export function taskKeyFor(rec) {
  if (!rec) return '';
  const seed = `${String(rec.title || '').trim()}|${String(rec.message || '').trim()}`;
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = ((h << 5) - h) + seed.charCodeAt(i);
    h |= 0;
  }
  return `htask_${(h >>> 0).toString(36)}`;
}

export function markHomeTask(rec, status) {
  const key = taskKeyFor(rec);
  if (!key) return null;
  const fresh = _fresh(_safeRead());
  const alreadyDone = fresh.some((r) => r.key === key && r.status === 'done');
  const filtered = fresh.filter((r) => r.key !== key);
  const resolvedStatus = status === 'done' ? 'done' : 'skipped';
  const stored = {
    key,
    status: resolvedStatus,
    stampedAt: new Date().toISOString(),
    taskTitle: String(rec?.title || '').slice(0, 80),
  };
  filtered.push(stored);
  _safeWrite(filtered);

  // Daily streak system §1: a "done" Mark-as-done tap counts
  // toward the user's daily completion just like an engagement
  // task. Idempotent same-day via the canonical streak helper —
  // a re-tap on a row already done within 24h won't double-bump.
  if (resolvedStatus === 'done' && !alreadyDone) {
    (async () => {
      try {
        const mod = await import('../../utils/streak.js');
        if (mod && typeof mod.updateStreak === 'function') {
          mod.updateStreak();
        }
      } catch { /* swallow */ }
    })();
  }

  _emit();
  return stored;
}

export function getHomeTaskStateMap() {
  const fresh = _fresh(_safeRead());
  const map = new Map();
  for (const r of fresh) map.set(r.key, r.status);
  return map;
}

export function _resetHomeTaskState() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(HOME_TASK_STATE_KEY);
    }
  } catch { /* swallow */ }
  _emit();
}

export const HOME_TASK_STATE_CHANGED_EVENT = CHANGE_EVENT;

export default {
  HOME_TASK_STATE_KEY,
  HOME_TASK_STATE_CHANGED_EVENT,
  taskKeyFor,
  markHomeTask,
  getHomeTaskStateMap,
};
