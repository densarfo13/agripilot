/**
 * eventBus.js — typed pub/sub bus for Runtime OS Layer v1.
 *
 *   import { emit, on, off, EVENT } from 'src/core/runtime/eventBus.js';
 *
 *   const unsubscribe = on(EVENT.SCAN_COMPLETED, (payload) => {
 *     runOrchestrator(payload);
 *   });
 *   emit(EVENT.SCAN_COMPLETED, { scanId, confidence });
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A small in-process pub/sub layer with a CLOSED event vocabulary.
 *   Intelligence modules subscribe to events here; pages emit events
 *   when something happens. No more page-to-page direct calls.
 *
 *   It is NOT the DOM event system (the existing `runtimeEventBus.js`
 *   wraps window.addEventListener for safe DOM events — keep that
 *   for browser-side events like `farroway:langchange`). THIS bus is
 *   for intra-app messages (`scan_completed`, `disease_detected`).
 *
 *   It is NOT the runtime STORE either — events fire on transitions;
 *   the store holds the current snapshot. Pair them: emit an event,
 *   subscribers (one of which is the store-updater) react.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 *   • Handlers are isolated — one throwing handler does not stop
 *     others from running.
 *   • Closed event vocabulary — `emit('typo')` is a no-op (with
 *     a one-shot dev warning). Prevents typo-driven event drift.
 */

export const EVENT = Object.freeze({
  CROP_ADDED:                'crop_added',
  CROP_UPDATED:              'crop_updated',
  WEATHER_CHANGED:           'weather_changed',
  SCAN_COMPLETED:            'scan_completed',
  DISEASE_DETECTED:          'disease_detected',
  TASK_COMPLETED:            'task_completed',
  TASK_SKIPPED:              'task_skipped',
  FARM_OPENED:               'farm_opened',
  OFFLINE_SYNC_COMPLETE:     'offline_sync_complete',
  MARKETPLACE_PRICE_CHANGED: 'marketplace_price_changed',
  SUPPLIER_ALERT:            'supplier_alert',
  IRRIGATION_DETECTED:       'irrigation_detected',
  HARVEST_READY:             'harvest_ready',
  LANGUAGE_CHANGED:          'language_changed',
  RECOMMENDATION_ACKNOWLEDGED: 'recommendation_acknowledged',
});

const _VALID = new Set(Object.values(EVENT));
const _subs = Object.create(null);
const _warnedTypos = new Set();

function _isDev() {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) return true;
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') return true;
  } catch { /* swallow */ }
  return false;
}

function _warnTypo(event) {
  if (!_isDev()) return;
  if (_warnedTypos.has(event)) return;
  _warnedTypos.add(event);
  try {
    // eslint-disable-next-line no-console
    console.warn('[eventBus] Unknown event "' + String(event) + '" — emit() is a no-op.');
  } catch { /* ignore */ }
}

/**
 * Emit an event to every subscriber. Unknown events are dropped
 * with a one-shot dev warning.
 *
 * @param {string} event
 * @param {any} [payload]
 * @returns {boolean} true if at least one subscriber ran
 */
export function emit(event, payload) {
  try {
    if (!_VALID.has(event)) { _warnTypo(event); return false; }
    const subs = _subs[event];
    if (!subs || subs.size === 0) return false;
    // Snapshot first — a handler that mutates the set during
    // iteration must not affect this call's dispatch.
    let delivered = false;
    for (const fn of Array.from(subs)) {
      try { fn(payload); delivered = true; }
      catch { /* never let one handler break others */ }
    }
    return delivered;
  } catch { return false; }
}

/**
 * Subscribe to an event. Returns an unsubscribe function. Unknown
 * events return a no-op unsubscribe (and warn once in dev).
 *
 * @param {string} event
 * @param {(payload: any) => void} handler
 */
export function on(event, handler) {
  try {
    if (!_VALID.has(event)) { _warnTypo(event); return () => {}; }
    if (typeof handler !== 'function') return () => {};
    if (!_subs[event]) _subs[event] = new Set();
    _subs[event].add(handler);
    return () => off(event, handler);
  } catch { return () => {}; }
}

/**
 * Unsubscribe a handler. Equivalent to calling the unsubscribe
 * function returned by on().
 */
export function off(event, handler) {
  try {
    if (!_VALID.has(event)) return false;
    const subs = _subs[event];
    if (!subs) return false;
    return subs.delete(handler);
  } catch { return false; }
}

/**
 * Count current subscribers — useful for the admin diagnostics
 * surface ("how many listeners on scan_completed?").
 */
export function subscriberCount(event) {
  try {
    if (!_VALID.has(event)) return 0;
    const subs = _subs[event];
    return subs ? subs.size : 0;
  } catch { return 0; }
}

/** Test-only reset. */
export function _resetEventBusForTests() {
  for (const k of Object.keys(_subs)) delete _subs[k];
  _warnedTypos.clear();
}

const _module = { EVENT, emit, on, off, subscriberCount, _resetEventBusForTests };
export default _module;
