/**
 * atomicLocaleSwitch.js — preload-then-flip locale switching.
 *
 *   import { setLanguageAtomic, awaitLocaleReady }
 *     from 'src/i18n/atomicLocaleSwitch.js';
 *
 *   // Caller (e.g. the language picker):
 *   await setLanguageAtomic('tw');
 *
 *   // Boot path that needs to wait for the persisted locale:
 *   await awaitLocaleReady();
 *
 * Why this exists
 * ───────────────
 *   The existing `setLanguage(code)` in src/i18n/index.js dispatches
 *   `farroway:langchange` synchronously, BEFORE the lazy column
 *   chunk for `code` has finished loading. That produces a
 *   visible "partial English" window — the UI flips to the new
 *   locale, but every key that lives in the column file
 *   (~90% of strings) still resolves to its English fallback for
 *   the first render. A second event fires once the column
 *   arrives, which re-renders with full coverage — but on a slow
 *   network or a cold cache the user sees English for 1-3 seconds.
 *
 *   Atomic switch: await the column load (and any future locale
 *   asset — i18next bundle, crop dictionary) BEFORE flipping the
 *   active locale. The UI never shows a half-translated frame.
 *
 *   Composition with the existing system:
 *     • `setLanguageAtomic(code)` is the new entry point. It
 *       awaits, then calls the legacy `setLanguage(code)` — so
 *       every existing event subscriber keeps working.
 *     • `awaitLocaleReady()` lets the boot path block until the
 *       persisted locale's column is in `T`. Useful for SSR-like
 *       hydration paths that want zero-flash.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws.
 *   • SSR-safe — no window / document access in the await path.
 *   • Cancellation-safe: a second setLanguageAtomic('hi') while
 *     a setLanguageAtomic('fr') is in-flight cancels the fr
 *     resolve (the user moved on). The fr promise still resolves
 *     to a verdict but doesn't dispatch the legacy event.
 */

import { isSupportedLocale, normalizeLocale } from './supportedLocales.ts';

// Late-resolved imports — keeps this module SSR-light. The two
// modules below have side effects (window listeners, persisted
// read) we don't want to drag into a test process unless needed.
function _loadColumn(code) {
  try {
    // Dynamic import keeps this module's eager footprint small.
    return import('./columnLoader.js').then((m) => {
      if (m && typeof m.loadColumn === 'function') return m.loadColumn(code);
      return false;
    }).catch(() => false);
  } catch { return Promise.resolve(false); }
}

function _legacySetLanguage(code) {
  try {
    return import('./index.js').then((m) => {
      try { if (m && typeof m.setLanguage === 'function') m.setLanguage(code); }
      catch { /* swallow */ }
    }).catch(() => undefined);
  } catch { return Promise.resolve(); }
}

function _isColumnLoaded(code) {
  try {
    // Synchronous probe — columnLoader exports a cheap read.
    // We require()-style here only when the module is already in
    // the cache; otherwise we fall through to the async loader.
    if (typeof require === 'function') {
      const mod = require('./columnLoader.js');
      if (mod && typeof mod.isColumnLoaded === 'function') return mod.isColumnLoaded(code);
    }
  } catch { /* swallow */ }
  return false;
}

// ─── Cancellation token ─────────────────────────────────────

let _activeSwitchToken = 0;

// Subscribers for atomic state changes (dev surfaces, telemetry).
const _subscribers = new Set();
function _emit(payload) {
  const enriched = Object.freeze({ ...payload, timestamp: Date.now() });
  for (const fn of _subscribers) {
    try { fn(enriched); } catch { /* swallow */ }
  }
  // Also dispatch a DOM event so unrelated surfaces can subscribe
  // without a direct import.
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('farroway:atomicLocaleSwitch', { detail: enriched }));
    }
  } catch { /* swallow */ }
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Switch the active locale ATOMICALLY — preload the column then
 * flip, so the UI never renders a partially-translated frame.
 *
 * @param {string} input  — any locale code; normalised internally
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs=5000]  — max wait for the column
 *   to arrive. After timeout we flip anyway so a network stall
 *   doesn't permanently stick the user on the old locale.
 * @returns {Promise<{ok:boolean, code:string, stale?:boolean,
 *                    timedOut?:boolean, reason?:string}>}
 */
export function setLanguageAtomic(input, opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};
  const timeoutMs = Number(o.timeoutMs) > 0 ? Number(o.timeoutMs) : 5000;
  const code = normalizeLocale(input);
  const myToken = ++_activeSwitchToken;

  _emit({ event: 'start', code });

  return (async () => {
    try {
      if (!isSupportedLocale(code)) {
        return { ok: false, code, reason: 'unsupported_locale' };
      }
      // Already loaded — fast path, no wait, immediate flip.
      if (_isColumnLoaded(code)) {
        if (myToken !== _activeSwitchToken) {
          return { ok: false, code, stale: true, reason: 'superseded' };
        }
        await _legacySetLanguage(code);
        _emit({ event: 'flip', code, source: 'cache_hit' });
        return { ok: true, code };
      }
      // Race the column load against the timeout.
      let timedOut = false;
      const loadP = _loadColumn(code);
      const timeoutP = new Promise((resolve) => setTimeout(() => {
        timedOut = true;
        resolve(false);
      }, timeoutMs));
      const verdict = await Promise.race([loadP, timeoutP]);

      // Re-check token — the user may have picked a different
      // language while we awaited. Don't flip if so.
      if (myToken !== _activeSwitchToken) {
        _emit({ event: 'superseded', code });
        return { ok: false, code, stale: true, reason: 'superseded' };
      }
      // Flip regardless of timeout — the lazy-load path will
      // re-merge once the column eventually arrives, and a
      // permanent "stuck on English" state would be worse than
      // a brief partial render.
      await _legacySetLanguage(code);
      _emit({
        event:     timedOut ? 'flip_timeout' : 'flip',
        code,
        source:    verdict ? 'column_loaded' : (timedOut ? 'timeout' : 'load_failed'),
      });
      return Object.freeze({
        ok:       !!verdict || timedOut,  // we still flipped; ok reflects "user-visible result"
        code,
        timedOut,
      });
    } catch (err) {
      _emit({ event: 'error', code, reason: (err && err.message) || 'exception' });
      return { ok: false, code, reason: (err && err.message) || 'exception' };
    }
  })();
}

/**
 * Boot helper — resolves once the persisted locale's column is
 * merged into T. Use BEFORE the first render that needs to be
 * locale-clean (e.g. share previews, server-rendered emails that
 * inherit the user's locale).
 *
 * @param {object} [opts]
 * @param {string} [opts.code]            — locale to wait for; if
 *   omitted, reads the persisted locale via the resolver.
 * @param {number} [opts.timeoutMs=3000]  — short-circuit timeout.
 * @returns {Promise<boolean>}            — true on column-loaded
 *   success, false on timeout or unsupported locale.
 */
export async function awaitLocaleReady(opts) {
  try {
    const o = (opts && typeof opts === 'object') ? opts : {};
    const timeoutMs = Number(o.timeoutMs) > 0 ? Number(o.timeoutMs) : 3000;
    let code = o.code;
    if (!code) {
      try {
        const m = await import('./index.js');
        code = (m && typeof m.getLanguage === 'function') ? m.getLanguage() : 'en';
      } catch { code = 'en'; }
    }
    code = normalizeLocale(code);
    if (code === 'en') return true; // English is bundled
    if (_isColumnLoaded(code)) return true;
    let timedOut = false;
    const loadP = _loadColumn(code);
    const timeoutP = new Promise((resolve) => setTimeout(() => {
      timedOut = true;
      resolve(false);
    }, timeoutMs));
    const verdict = await Promise.race([loadP, timeoutP]);
    return !!verdict && !timedOut;
  } catch { return false; }
}

/**
 * Subscribe to atomic-switch lifecycle events. Returns an
 * unsubscribe.
 */
export function subscribeAtomicLocaleSwitch(fn) {
  if (typeof fn !== 'function') return () => {};
  _subscribers.add(fn);
  return () => _subscribers.delete(fn);
}

/** Test-only — reset module state. */
export function _resetForTests() {
  _activeSwitchToken = 0;
  _subscribers.clear();
}

const _module = {
  setLanguageAtomic, awaitLocaleReady, subscribeAtomicLocaleSwitch,
  _resetForTests,
};
export default _module;
