/**
 * recentFarms.js — tracks the last N farm IDs the user
 * switched to, for the Multi-Farm Switcher §6 quick-switch row.
 *
 *   markFarmAccessed(farmId)
 *     • Bumps farmId to the front of the recent list. Idempotent
 *       within the same minute (dedupes re-mounts of the same
 *       view).
 *
 *   getRecentFarmIds({ exclude?, limit? })
 *     • Returns up to `limit` recent farm IDs, newest first,
 *       optionally excluding the supplied id (typically the
 *       active one).
 *
 *   clearRecentFarms()
 *     • Test seam + privacy hook.
 *
 * Storage: `farroway:recent_farms` = JSON array of
 *   { id: string, ts: number }   sorted newest first
 *
 * Capped at MAX_ROWS so a runaway switch loop can't fill the
 * tab quota. The richer `useProfile` store stays the source of
 * truth for current/active farm + the full farm list — this
 * module only adds the "what did I touch most recently" facet
 * that the spec calls for.
 *
 * Strict-rule audit
 *   • Never throws — quota / private-mode / corrupt JSON
 *     degrade to no-op.
 *   • SSR-safe (every storage call is feature-checked).
 *   • Pure read APIs return arrays, never null.
 */

const KEY = 'farroway:recent_farms';
const MAX_ROWS = 10;
// Idempotency window — a re-mount of the same farm view within
// 60 seconds doesn't re-bump the ts. Cheap dedup.
const DEDUP_WINDOW_MS = 60 * 1000;

function _readAll() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch { return []; }
}

function _writeAll(rows) {
  try {
    if (typeof localStorage === 'undefined') return false;
    const trimmed = Array.isArray(rows) ? rows.slice(0, MAX_ROWS) : [];
    localStorage.setItem(KEY, JSON.stringify(trimmed));
    return true;
  } catch { return false; }
}

/**
 * Bump farmId to the front of the recent list. Idempotent
 * within DEDUP_WINDOW_MS so a re-render doesn't churn the
 * ordering.
 */
export function markFarmAccessed(farmId) {
  if (!farmId) return null;
  const id = String(farmId);
  const now = Date.now();
  const rows = _readAll();
  const head = rows[0];
  if (head && head.id === id && Number.isFinite(head.ts)
      && (now - head.ts) < DEDUP_WINDOW_MS) {
    return rows;                              // already at top, recent
  }
  const next = [{ id, ts: now }];
  for (const r of rows) {
    if (!r || !r.id) continue;
    if (r.id === id) continue;                // dedupe by id
    next.push(r);
  }
  _writeAll(next);
  return next;
}

/**
 * Read up to `limit` recent farm IDs newest-first. Anonymous
 * `exclude` arg drops the supplied id from the result so the
 * caller can render "recent farms (excluding the active one)".
 */
export function getRecentFarmIds({ exclude = null, limit = 3 } = {}) {
  const ex = exclude ? String(exclude) : null;
  const rows = _readAll();
  const out = [];
  for (const r of rows) {
    if (!r || !r.id) continue;
    if (ex && r.id === ex) continue;
    out.push(r.id);
    if (out.length >= limit) break;
  }
  return out;
}

/** Test seam + privacy reset. */
export function clearRecentFarms() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(KEY);
  } catch { /* ignore */ }
}

export const _internal = Object.freeze({
  KEY, MAX_ROWS, DEDUP_WINDOW_MS,
  _readAll, _writeAll,
});

export default { markFarmAccessed, getRecentFarmIds, clearRecentFarms };
