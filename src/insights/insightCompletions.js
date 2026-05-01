/**
 * insightCompletions.js — local-first store of completed insight
 * actions.
 *
 * Spec coverage (Action-driven insights §5)
 *   • Mark insight as completed after action
 *
 * Storage
 *   farroway_insight_completed : Array<{
 *     id:          string,
 *     completedAt: ISO,
 *     actionKind:  string | null,
 *   }>
 *   Capped at 100 entries; entries older than 24h auto-expire on
 *   read so a completed insight quietly returns the next day if
 *   it still applies.
 *
 * Strict-rule audit
 *   • Never throws.
 *   • Works offline.
 *   • Idempotent on `id`: marking the same insight twice updates
 *     the timestamp without duplicating.
 *   • Emits `farroway:insight_completion_changed` so the digest
 *     re-renders without prop drilling.
 */

export const COMPLETIONS_KEY = 'farroway_insight_completed';
const MAX_ENTRIES = 100;
const TTL_MS = 24 * 60 * 60_000;          // 24 hours
const CHANGE_EVENT = 'farroway:insight_completion_changed';

function _safeRead() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(COMPLETIONS_KEY);
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
    localStorage.setItem(COMPLETIONS_KEY, JSON.stringify(trimmed));
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
    if (!r || !r.id) return false;
    const t = Date.parse(r.completedAt || '');
    if (!Number.isFinite(t)) return false;
    return (now - t) < TTL_MS;
  });
}

/** Stamp an insight as completed. */
export function markInsightCompleted(id, { actionKind = null } = {}) {
  const insightId = String(id || '').trim();
  if (!insightId) return null;
  const now = new Date().toISOString();
  const fresh = _fresh(_safeRead());
  const filtered = fresh.filter((r) => r.id !== insightId);
  const stored = { id: insightId, completedAt: now, actionKind };
  filtered.push(stored);
  _safeWrite(filtered);
  _emit();
  return stored;
}

/** Set of insight ids completed in the last 24 hours. */
export function getCompletedInsightIds() {
  const fresh = _fresh(_safeRead());
  return new Set(fresh.map((r) => r.id));
}

/** Test / admin helper. */
export function _resetInsightCompletions() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(COMPLETIONS_KEY);
    }
  } catch { /* swallow */ }
  _emit();
}

export const INSIGHT_COMPLETION_CHANGED_EVENT = CHANGE_EVENT;

export default {
  COMPLETIONS_KEY,
  INSIGHT_COMPLETION_CHANGED_EVENT,
  markInsightCompleted,
  getCompletedInsightIds,
};
