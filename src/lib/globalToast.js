/**
 * globalToast.js — module-singleton toast queue + React hook.
 *
 *   import { showToast } from './lib/globalToast.js';
 *
 *   showToast('Nice — you\u2019re on track', 'success');
 *
 * Why this exists alongside components/intelligence/Toast.jsx
 *   `useToast` from intelligence/Toast.jsx is per-instance —
 *   each component using the hook gets its own queue. The May
 *   2026 task-completion spec needs a SINGLE app-wide queue
 *   that any non-React caller (e.g. taskActions.completeTask)
 *   can enqueue toasts into without owning a component handle.
 *
 * API
 *   showToast(message, type='info', durationMs=3500)
 *   useGlobalToasts()  →  React hook returning current queue
 *   dismissToast(id)
 *
 * Strict-rule audit
 *   • Pure ESM. Never throws.
 *   • Cap of 3 active toasts — older ones drop FIFO.
 *   • Auto-dismiss timer per toast; no global ticker.
 */

import { useSyncExternalStore } from 'react';

const DEFAULT_DURATION_MS = 3500;
const MAX_QUEUE = 3;

let _queue = [];
let _idCounter = 0;
const _listeners = new Set();
const _timers = new Map();

function _notify() {
  for (const l of _listeners) {
    try { l(); } catch { /* never propagate */ }
  }
}

/**
 * showToast(message, type='info', durationMs?) — fire-and-forget.
 * Returns the new toast id.
 */
export function showToast(message, type = 'info', durationMs = DEFAULT_DURATION_MS) {
  const id = ++_idCounter;
  const safeType = (type === 'success' || type === 'error'
                 || type === 'info'    || type === 'warning')
    ? type : 'info';
  const safeMessage = typeof message === 'string' ? message.slice(0, 200) : '';
  const next = [..._queue, { id, message: safeMessage, type: safeType, at: Date.now() }];
  _queue = next.length > MAX_QUEUE ? next.slice(next.length - MAX_QUEUE) : next;
  _notify();

  const ms = (typeof durationMs === 'number' && durationMs > 0) ? durationMs : DEFAULT_DURATION_MS;
  const t = setTimeout(() => { dismissToast(id); }, ms);
  _timers.set(id, t);

  return id;
}

export function dismissToast(id) {
  const t = _timers.get(id);
  if (t) { clearTimeout(t); _timers.delete(id); }
  if (!_queue.some((x) => x.id === id)) return;
  _queue = _queue.filter((x) => x.id !== id);
  _notify();
}

export function clearToasts() {
  for (const t of _timers.values()) { try { clearTimeout(t); } catch { /* swallow */ } }
  _timers.clear();
  _queue = [];
  _notify();
}

// ─── React hook ──────────────────────────────────────────────

function _subscribe(listener) {
  _listeners.add(listener);
  return () => { _listeners.delete(listener); };
}
function _getSnapshot() { return _queue; }

export function useGlobalToasts() {
  return useSyncExternalStore(_subscribe, _getSnapshot, _getSnapshot);
}

// Test hooks.
export const _internal = Object.freeze({
  DEFAULT_DURATION_MS,
  MAX_QUEUE,
  _resetForTests: () => {
    for (const t of _timers.values()) { try { clearTimeout(t); } catch { /* swallow */ } }
    _timers.clear();
    _queue = [];
    _idCounter = 0;
    _listeners.clear();
  },
});

export default { showToast, dismissToast, clearToasts, useGlobalToasts };
