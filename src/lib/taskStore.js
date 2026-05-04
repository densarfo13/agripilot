/**
 * taskStore.js — single source of truth for "what tasks are
 * completed today" so Home / Tasks / Progress can all render
 * off the same state.
 *
 *   import { useTaskStore, markTaskDone, getTaskStats } from './lib/taskStore.js';
 *
 *   // In React:
 *   const { completedIds, count, isComplete } = useTaskStore();
 *
 *   // Anywhere (non-React):
 *   markTaskDone('task-123', { title: '...', category: '...' });
 *   const stats = getTaskStats();   // { count, total, completedIds }
 *
 * Why a separate store
 *   The existing useFarmerLoop owns server-driven state (task,
 *   weather, decision). This store owns the OPTIMISTIC layer —
 *   the moment the user taps "Mark as done", we flip the local
 *   flag instantly so every screen sees the change without a
 *   round-trip. Backend sync happens in parallel; the store is
 *   the source of truth for "is the user looking at a completed
 *   task right now?"
 *
 * Storage
 *   Persisted under `farroway_completed_today` with the date
 *   stamp; expires automatically when the user crosses midnight.
 *   Auth + onboarding keys are NEVER touched.
 *
 * Strict-rule audit
 *   • Synchronous reads via useSyncExternalStore.
 *   • Never throws.
 *   • Persisted state validates on load — malformed shapes
 *     collapse to an empty Set instead of crashing.
 */

import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'farroway_completed_today';

// In-memory cache. Persisted to localStorage on every mutation.
let _state = _readPersisted();

const _listeners = new Set();
function _notify() {
  for (const l of _listeners) {
    try { l(); } catch { /* never propagate */ }
  }
}

function _today() {
  const d = new Date();
  return d.getFullYear() + '-'
    + String(d.getMonth() + 1).padStart(2, '0') + '-'
    + String(d.getDate()).padStart(2, '0');
}

function _readPersisted() {
  if (typeof localStorage === 'undefined') {
    return _emptyState();
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return _emptyState();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return _emptyState();
    if (parsed.date !== _today()) return _emptyState();
    if (!Array.isArray(parsed.completedIds)) return _emptyState();
    return Object.freeze({
      date:         parsed.date,
      completedIds: new Set(parsed.completedIds.filter((s) => typeof s === 'string')),
      meta:         (parsed.meta && typeof parsed.meta === 'object') ? { ...parsed.meta } : {},
    });
  } catch { return _emptyState(); }
}

function _emptyState() {
  return Object.freeze({
    date:         _today(),
    completedIds: new Set(),
    meta:         {},
  });
}

function _persist() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      date:         _state.date,
      completedIds: Array.from(_state.completedIds),
      meta:         _state.meta,
    }));
  } catch { /* quota / private mode — tolerate */ }
}

// ─── Public API ─────────────────────────────────────────────

/**
 * markTaskDone(id, meta?) — optimistically marks a task complete.
 *
 *   • Idempotent — calling twice on the same id is a no-op.
 *   • Resets the date if midnight passed since last persist.
 *   • Returns the new completion count (cheap convenience).
 */
export function markTaskDone(id, meta = {}) {
  if (typeof id !== 'string' || !id) return _state.completedIds.size;
  // Roll over at midnight.
  if (_state.date !== _today()) {
    _state = _emptyState();
  }
  if (_state.completedIds.has(id)) return _state.completedIds.size;
  const nextSet = new Set(_state.completedIds);
  nextSet.add(id);
  const nextMeta = { ..._state.meta };
  if (meta && typeof meta === 'object') {
    nextMeta[id] = {
      title:    typeof meta.title === 'string' ? meta.title.slice(0, 200) : null,
      category: typeof meta.category === 'string' ? meta.category : null,
      at:       Date.now(),
    };
  }
  _state = Object.freeze({
    date:         _state.date,
    completedIds: nextSet,
    meta:         nextMeta,
  });
  _persist();
  _notify();
  return nextSet.size;
}

/**
 * unmarkTaskDone(id) — reverts an optimistic mark. Used when
 * the backend explicitly tells us the completion was rejected
 * (e.g. cross-user ownership), NOT when it just failed.
 */
export function unmarkTaskDone(id) {
  if (typeof id !== 'string' || !id) return;
  if (!_state.completedIds.has(id)) return;
  const nextSet = new Set(_state.completedIds);
  nextSet.delete(id);
  const nextMeta = { ..._state.meta };
  delete nextMeta[id];
  _state = Object.freeze({
    date:         _state.date,
    completedIds: nextSet,
    meta:         nextMeta,
  });
  _persist();
  _notify();
}

/** Pure read — returns a snapshot for tests and non-React callers. */
export function getTaskStats() {
  return {
    date:         _state.date,
    count:        _state.completedIds.size,
    completedIds: Array.from(_state.completedIds),
    meta:         { ..._state.meta },
  };
}

export function isTaskDone(id) {
  return typeof id === 'string' && _state.completedIds.has(id);
}

/** Manual reset — used by tests and the resetApp flow. */
export function resetTaskStore() {
  _state = _emptyState();
  _persist();
  _notify();
}

// ─── React hook ──────────────────────────────────────────────

function _subscribe(listener) {
  _listeners.add(listener);
  return () => { _listeners.delete(listener); };
}
function _getSnapshot() { return _state; }

export function useTaskStore() {
  const state = useSyncExternalStore(_subscribe, _getSnapshot, _getSnapshot);
  return {
    date:         state.date,
    completedIds: state.completedIds,
    count:        state.completedIds.size,
    meta:         state.meta,
    isComplete:   (id) => state.completedIds.has(id),
  };
}

// ─── Test hooks ──────────────────────────────────────────────
export const _internal = Object.freeze({
  STORAGE_KEY,
  _today,
  _resetForTests: () => {
    _state = _emptyState();
    _listeners.clear();
  },
});

export default {
  useTaskStore,
  markTaskDone,
  unmarkTaskDone,
  isTaskDone,
  getTaskStats,
  resetTaskStore,
};
