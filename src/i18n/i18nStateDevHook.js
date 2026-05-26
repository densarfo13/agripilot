/**
 * i18nStateDevHook.js — pins `window.__i18nState()` for DevTools.
 *
 * Why this hook exists
 * ────────────────────
 *   "Only English shows in the picker." That bug was invisible from
 *   the outside; the user had no way to inspect which locale was
 *   active, what was persisted, what columns had loaded, or which
 *   pickers were rendering. This hook exposes all of that in one
 *   call so a field operator can dump state without us writing
 *   custom console glue every time.
 *
 *   import { installI18nStateHook } from 'src/i18n/i18nStateDevHook.js';
 *   installI18nStateHook();   // safe to call on every boot
 *
 *   // From DevTools:
 *   window.__i18nState()
 *
 * Output shape
 * ────────────
 *   {
 *     active:           'tw',
 *     persisted:        'tw',
 *     htmlLang:         'tw',
 *     storageKey:       'farroway:lang',
 *     supported:        [{ code, englishName, nativeName }],
 *     supportedCodes:   ['en','fr','sw','ha','tw','hi'],
 *     loadedColumns:    ['en','tw'],   // best-effort, see note
 *     pendingColumns:   [],
 *     buildSha:         '<window.__SCAN_BUILD_SHA__ or fallback>',
 *     timestamp:        '<ISO>',
 *   }
 *
 * `loadedColumns` is best-effort: it inspects `T[<canonical key>]`
 * for each locale to check whether the column merge has happened.
 * If T isn't reachable (some test envs strip dynamic imports) the
 * field is `unknown`.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe (no-ops when no window).
 *   • Idempotent — second install call is a no-op.
 *   • Snapshot carries NO PII — just structural i18n state.
 */

import {
  SUPPORTED_LOCALES, LOCALE_CODES, LOCALE_STORAGE_KEY, DEFAULT_LOCALE,
} from './supportedLocales.ts';

function _safe(fn, fallback) {
  try { return fn(); } catch { return fallback; }
}

function _readPersistedLocale() {
  return _safe(() => {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(LOCALE_STORAGE_KEY);
  }, null);
}

function _readHtmlLang() {
  return _safe(() => {
    if (typeof document === 'undefined') return null;
    return document.documentElement && document.documentElement.getAttribute('lang');
  }, null);
}

// Best-effort: probe a small set of canonical keys per locale to
// detect whether the column has been merged into T. Returns
// 'unknown' if T isn't reachable.
function _probeLoadedColumns() {
  return _safe(() => {
    // Dynamic require so this module stays SSR-safe and the dev
    // hook never blocks boot if translations.js fails to import.
    const T = require('./translations.js').default;
    if (!T || typeof T !== 'object') return 'unknown';
    const PROBES = ['common.back', 'nav.scan'];
    const loaded = [];
    for (const code of LOCALE_CODES) {
      const hit = PROBES.some((k) => T[k] && typeof T[k][code] === 'string' && T[k][code]);
      if (hit) loaded.push(code);
    }
    return loaded;
  }, 'unknown');
}

function _readBuildSha() {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    if (typeof window.__SCAN_BUILD_SHA__ === 'string') return window.__SCAN_BUILD_SHA__;
    if (typeof window.__FARROWAY_BUILD_VERSION === 'string') return window.__FARROWAY_BUILD_VERSION;
    return null;
  }, null);
}

/**
 * Build the snapshot. Exported separately so tests can call it
 * without going through the window install path.
 *
 * @param {{ activeOverride?: string }} [opts] — let tests pin
 *   the "active" value rather than relying on the resolver chain.
 */
export function buildI18nStateSnapshot(opts) {
  try {
    const o = (opts && typeof opts === 'object') ? opts : {};
    const persisted = _readPersistedLocale();
    const htmlLang  = _readHtmlLang();
    const active    = o.activeOverride || persisted || htmlLang || DEFAULT_LOCALE;
    return {
      active,
      persisted:      persisted || null,
      htmlLang:       htmlLang || null,
      storageKey:     LOCALE_STORAGE_KEY,
      supported:      SUPPORTED_LOCALES.map((l) => ({
        code: l.code, englishName: l.englishName, nativeName: l.nativeName,
      })),
      supportedCodes: [...LOCALE_CODES],
      loadedColumns:  _probeLoadedColumns(),
      buildSha:       _readBuildSha(),
      timestamp:      new Date().toISOString(),
    };
  } catch {
    return {
      active:         DEFAULT_LOCALE,
      persisted:      null,
      htmlLang:       null,
      storageKey:     LOCALE_STORAGE_KEY,
      supported:      [],
      supportedCodes: [],
      loadedColumns:  'unknown',
      buildSha:       null,
      timestamp:      new Date().toISOString(),
      error:          'snapshot_failed',
    };
  }
}

/**
 * Pin `window.__i18nState`. Idempotent; safe in production
 * (the snapshot carries no PII so we ship it unconditionally —
 * if leaking the locale list ever becomes a concern, gate this
 * call behind import.meta.env.DEV in the call site).
 */
export function installI18nStateHook() {
  try {
    if (typeof window === 'undefined') return false;
    if (window.__i18nState) return true;
    Object.defineProperty(window, '__i18nState', {
      value: function __i18nState() {
        const snap = buildI18nStateSnapshot();
        try { console.table(snap.supported); } catch { /* swallow */ }
        try { console.log('[i18nState]', snap); } catch { /* swallow */ }
        return snap;
      },
      writable:     false,
      configurable: false,
      enumerable:   true,
    });
    return true;
  } catch { return false; }
}

const _module = { buildI18nStateSnapshot, installI18nStateHook };
export default _module;
