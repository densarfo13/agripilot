/**
 * eventBus — tiny pub/sub for orchestration events.
 *
 *   import { emit, subscribe } from 'src/orchestration/events';
 *
 *   const off = subscribe('scan_completed', (event) => {
 *     // Re-render Today's recommendation in response.
 *   });
 *
 *   emit({ type: 'scan_completed', source: 'scan',
 *          payload: { category: 'yellowing' } });
 *   // → mirrored into eventStore + every subscriber called.
 *
 * STRICT-RULE AUDIT
 *   • Pure JS — no React, no DOM imports.
 *   • Listeners are wrapped so a single buggy subscriber can't
 *     break siblings (try/catch around each call).
 *   • SSR-safe — module-level state stays empty until first
 *     `subscribe` is called.
 *   • `emit` always mirrors to eventStore so a late-mounting
 *     subscriber can replay via `getRecentEvents`.
 */

import { EVENT_TYPE_SET } from './eventTypes.js';
import { appendEvent } from './eventStore.js';

// Map<type, Set<listener>>. We keep the wildcard listeners
// in the special key '*' so callers can subscribe to every
// event without enumerating types.
const _listeners = new Map();
const WILDCARD = '*';

function _bucket(type) {
  let set = _listeners.get(type);
  if (!set) {
    set = new Set();
    _listeners.set(type, set);
  }
  return set;
}

/**
 * Subscribe to a typed event. Returns an unsubscribe function
 * the caller stores and invokes from a `useEffect` cleanup.
 *
 * @param {string} type     — one of EVENT_TYPE.* or '*' for all
 * @param {function} listener
 * @returns {function} unsubscribe
 */
export function subscribe(type, listener) {
  if (typeof listener !== 'function') return () => {};
  const key = (type === WILDCARD || EVENT_TYPE_SET.has(type)) ? type : null;
  if (!key) return () => {};
  _bucket(key).add(listener);
  // Idempotent unsubscribe — calling twice is a no-op.
  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    try { _bucket(key).delete(listener); }
    catch { /* swallow */ }
  };
}

/**
 * Emit an event. Validates against the type allow-list (rejects
 * unknown types). Mirrors to the persistent ring buffer + invokes
 * every subscriber wrapped in try/catch so a buggy listener
 * never breaks a sibling.
 *
 * Returns the stored event (with id + timestamp filled in) so
 * the caller can pass it on to other systems.
 *
 * @param {object} event — partial event; type is required
 * @returns {object|null}
 */
export function emit(event) {
  if (!event || typeof event !== 'object' || !event.type) return null;
  const stored = appendEvent(event);
  if (!stored) return null;

  // Typed listeners first, then wildcard.
  for (const fn of _bucket(stored.type)) {
    try { fn(stored); } catch { /* swallow per-listener */ }
  }
  for (const fn of _bucket(WILDCARD)) {
    try { fn(stored); } catch { /* swallow per-listener */ }
  }
  return stored;
}

/**
 * Test helper — drop every subscription. Production code should
 * never call this; tests use it between cases to start clean.
 */
export function _resetBus() {
  _listeners.clear();
}

const _module = { subscribe, emit, _resetBus };
export default _module;
