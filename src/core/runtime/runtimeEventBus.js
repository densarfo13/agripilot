/**
 * runtimeEventBus.js — safe listener-registration helpers.
 *
 *   import { safeOn, safeOff, registerSafeRejectionHandler }
 *     from 'src/core/runtime/runtimeEventBus.js';
 *
 * What it is — and is NOT
 * ───────────────────────
 *   Tiny pure-ish helpers that wrap `addEventListener` /
 *   `removeEventListener` so listener handlers can never crash the
 *   page. Also exposes a one-shot `window.onunhandledrejection`
 *   installer that swallows the noisy "tabs:outgoing.message.ready"
 *   class of cross-extension errors without hiding genuine bugs.
 *
 *   It does NOT replace `farmEventBus` (typed pub/sub for farm
 *   events) and it does NOT silence errors — it logs them through
 *   `safeRuntimeLogger`.
 *
 * Strict-rule audit
 *   • Never throws. SSR-safe (guards `window` + `addEventListener`).
 */

import { safeLog } from './safeRuntimeLogger.js';

// Tracks (target, type, wrappedHandler) per (originalHandler) so we
// can correctly remove a wrapped listener on cleanup.
const _wrapped = new WeakMap();

function _isEventTarget(t) {
  return t && typeof t.addEventListener === 'function'
    && typeof t.removeEventListener === 'function';
}

/**
 * Register a listener. The handler is wrapped so a thrown
 * exception (sync) or a rejected promise (async) is captured,
 * not propagated. Idempotent — registering the SAME handler twice
 * on the same target+type is a no-op.
 *
 * Returns an unregister function (the canonical "cleanup" pattern).
 *
 * @param {EventTarget} target
 * @param {string} type
 * @param {Function} handler
 * @param {object|boolean} [options]
 * @returns {() => void}  call to unregister
 */
export function safeOn(target, type, handler, options) {
  try {
    if (!_isEventTarget(target) || typeof handler !== 'function' || !type) {
      return () => {};
    }
    // Idempotency: if we already wrapped this handler for this
    // target+type, return the existing unregister.
    let existing = _wrapped.get(handler);
    if (existing && existing.target === target && existing.type === type) {
      return existing.off;
    }

    const wrapped = function _wrappedHandler(event) {
      try {
        const result = handler(event);
        if (result && typeof result.then === 'function') {
          result.catch((err) => safeLog.captureAsync(err, { source: type }));
        }
      } catch (err) {
        safeLog.capture(err, { source: type });
      }
    };

    try { target.addEventListener(type, wrapped, options); }
    catch (err) { safeLog.capture(err, { source: 'safeOn:add' }); return () => {}; }

    const off = () => {
      try { target.removeEventListener(type, wrapped, options); }
      catch { /* swallow — best effort */ }
      _wrapped.delete(handler);
    };

    _wrapped.set(handler, { target, type, off });
    return off;
  } catch {
    return () => {};
  }
}

/**
 * Unregister a listener previously registered via `safeOn`. Safe
 * to call multiple times.
 */
export function safeOff(target, type, handler) {
  try {
    const existing = _wrapped.get(handler);
    if (existing && existing.target === target && existing.type === type) {
      existing.off();
      return true;
    }
    // Fall back: try a plain removeEventListener for handlers
    // registered outside this module.
    if (_isEventTarget(target) && typeof handler === 'function') {
      target.removeEventListener(type, handler);
    }
    return false;
  } catch { return false; }
}

// Reason strings we recognise as harmless cross-extension noise.
// These come from browser extensions (e.g. background pages) and
// have no relevance to the app — swallow them so the console stays
// readable AND so they don't appear as "Uncaught (in promise)".
const NOISY_REASONS = Object.freeze([
  /tabs:outgoing\.message\.ready/i,
  /no listener/i,
  /the message port closed/i,
  /could not establish connection/i,
  /extension context invalidated/i,
]);

function _isNoisy(reason) {
  try {
    const text = (reason && (reason.message || String(reason))) || '';
    for (const re of NOISY_REASONS) {
      if (re.test(text)) return true;
    }
    return false;
  } catch { return false; }
}

let _rejectionInstalled = false;

/**
 * Install a global `unhandledrejection` handler that:
 *   • silently filters the recognised cross-extension noise classes,
 *   • routes everything else through `safeRuntimeLogger`,
 *   • never calls `event.preventDefault()` on a real app rejection
 *     (so the dev tools still see it).
 *
 * Idempotent — repeated calls are a no-op.
 */
export function registerSafeRejectionHandler() {
  try {
    if (_rejectionInstalled) return true;
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
      return false;
    }
    window.addEventListener('unhandledrejection', (event) => {
      try {
        const reason = event && event.reason;
        if (_isNoisy(reason)) {
          // Known noisy extension rejection — suppress quietly so it
          // doesn't flood the console.
          if (typeof event.preventDefault === 'function') event.preventDefault();
          safeLog.throttledNoise('extension_noise');
          return;
        }
        safeLog.captureAsync(reason, { source: 'unhandledrejection' });
      } catch { /* never re-throw out of the rejection handler */ }
    });
    _rejectionInstalled = true;
    return true;
  } catch { return false; }
}

/** Test hook — reset the singleton flag. */
export function _resetForTests() {
  _rejectionInstalled = false;
}

const _module = { safeOn, safeOff, registerSafeRejectionHandler };
export default _module;
