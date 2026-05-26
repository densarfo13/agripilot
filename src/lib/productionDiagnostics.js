/**
 * productionDiagnostics.js — single canonical diagnostic +
 * recovery hook surface for the production-incident play.
 *
 *   import { installProductionDiagnostics } from
 *     'src/lib/productionDiagnostics.js';
 *   installProductionDiagnostics();
 *
 *   // From DevTools, any device, any environment:
 *   window.__farrowayBuild()        — build + runtime SHA
 *   window.__languageTrace()        — locale + leaks
 *   window.__forceLocaleReload()    — drop columns + re-fetch
 *   window.__clearScanSession()     — end active scan + wipe persist
 *   window.__rebuildPreview()       — restore preview from session
 *   window.__forceAssetRefresh()    — purge caches + hard reload
 *   window.__clearSWCaches()        — kill service worker + caches
 *
 * Why a single module
 * ───────────────────
 *   The previous diagnostic surface was scattered across four files
 *   (scanDebugOverlay, i18nStateDevHook, scanBuildStamp, the i18n
 *   dev console). When a field operator reports "scan broken on
 *   iPhone" we need ONE call they can paste into DevTools that
 *   dumps everything we need — build SHA, deployed locales,
 *   active scan session, preview state, language state, cached
 *   chunks, persisted records. That's `window.__farrowayBuild()`.
 *
 *   Recovery hooks complement the diagnostics: when the report
 *   is "still seeing English / preview gone", the operator (or
 *   the user) can paste `__forceAssetRefresh()` and get a clean
 *   slate without uninstalling the PWA.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • Idempotent — installs each hook once.
 *   • Snapshots carry NO PII; just structural state.
 */

import {
  LOCALE_CODES, LOCALE_STORAGE_KEY, SUPPORTED_LOCALES,
} from '../i18n/supportedLocales.ts';
import { safeUrl } from './safeUrl.js';

function _safe(fn, fallback) {
  try { return fn(); } catch { return fallback; }
}

// ─── Build identity ──────────────────────────────────────

/**
 * Pull every flavor of build identifier the bundle was stamped
 * with. Most are set at build time (Vite env vars); a couple come
 * from runtime (window globals).
 */
export function readBuildIdentity() {
  return _safe(() => {
    const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};
    const win = (typeof window !== 'undefined') ? window : {};
    return {
      gitSha:          env.VITE_RAILWAY_GIT_COMMIT_SHA
                      || env.VITE_COMMIT_SHA
                      || win.__FARROWAY_COMMIT_SHA
                      || null,
      buildId:         env.VITE_BUILD_ID
                      || env.VITE_SCAN_BUILD_SHA
                      || win.__SCAN_BUILD_SHA__
                      || null,
      buildVersion:    win.__FARROWAY_BUILD_VERSION || null,
      buildTimestamp:  env.VITE_BUILD_TIMESTAMP || null,
      mode:            env.MODE || env.NODE_ENV || 'production',
      sentryRelease:   env.VITE_SENTRY_RELEASE || null,
    };
  }, {});
}

/**
 * Probe which locale columns have been merged into the shared T
 * dictionary. Best-effort — if T isn't reachable, returns 'unknown'.
 */
function _probeLoadedLocaleChunks() {
  return _safe(() => {
    // Late binding so this module's import graph stays light. The
    // T module is lazy-imported by every screen; if it hasn't been
    // imported yet we report empty.
    let T = null;
    try { T = require('../i18n/translations.js').default; }
    catch { T = null; }
    if (!T || typeof T !== 'object') return 'unknown';
    const PROBES = ['common.back', 'nav.scan', 'common.continue'];
    const loaded = [];
    for (const code of LOCALE_CODES) {
      const hit = PROBES.some((k) =>
        T[k] && typeof T[k][code] === 'string' && T[k][code]);
      if (hit) loaded.push(code);
    }
    return loaded;
  }, 'unknown');
}

function _readPersisted(key) {
  return _safe(() => {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  }, null);
}

function _readHtmlLang() {
  return _safe(() => {
    if (typeof document === 'undefined') return null;
    return document.documentElement && document.documentElement.getAttribute('lang');
  }, null);
}

function _readActiveSession() {
  return _safe(() => {
    // Late-require so this module doesn't fail to load when the
    // scan session manager isn't available (tests / SSR).
    const m = require('../core/scan/scanSessionManager.js');
    return (m && typeof m.getActiveSession === 'function') ? m.getActiveSession() : null;
  }, null);
}

function _readScanHistoryCount() {
  return _safe(() => {
    const m = require('../core/scan/scanSessionManager.js');
    if (!m || typeof m.getScanHistory !== 'function') return 0;
    const h = m.getScanHistory();
    return Array.isArray(h) ? h.length : 0;
  }, 0);
}

function _detectDevice() {
  return _safe(() => {
    if (typeof navigator === 'undefined') return {};
    const ua = String(navigator.userAgent || '');
    const standalone = (typeof navigator !== 'undefined' && navigator.standalone === true)
      || (typeof window !== 'undefined' && window.matchMedia
          && window.matchMedia('(display-mode: standalone)').matches);
    return {
      userAgent:  ua.slice(0, 240),
      platform:   navigator.platform || 'unknown',
      standalone: !!standalone,
      online:     typeof navigator.onLine === 'boolean' ? navigator.onLine : null,
      language:   navigator.language || null,
    };
  }, {});
}

/**
 * Build the unified diagnostic snapshot.
 */
export function buildBuildDiagnostic() {
  return _safe(() => {
    const id = readBuildIdentity();
    const win = (typeof window !== 'undefined') ? window : {};
    return {
      gitSha:              id.gitSha,
      buildId:             id.buildId,
      buildVersion:        id.buildVersion,
      buildTimestamp:      id.buildTimestamp,
      mode:                id.mode,
      sentryRelease:       id.sentryRelease,
      deployedAt:          win.__FARROWAY_DEPLOYED_AT || null,
      localeVersion:       win.__FARROWAY_LOCALE_VERSION || null,
      scanVersion:         win.__SCAN_BUILD_SHA__ || null,
      serviceWorkerVersion: _probeServiceWorker(),
      runtimeEnvironment:  _detectDevice(),
      locale: {
        active:        _readHtmlLang() || _readPersisted(LOCALE_STORAGE_KEY) || 'en',
        persisted:     _readPersisted(LOCALE_STORAGE_KEY) || null,
        supportedCodes:[...LOCALE_CODES],
        loadedChunks:  _probeLoadedLocaleChunks(),
      },
      scan: {
        activeSession:    _readActiveSession(),
        scanHistorySize:  _readScanHistoryCount(),
      },
      timestamp:           new Date().toISOString(),
    };
  }, { error: 'snapshot_failed', timestamp: new Date().toISOString() });
}

function _probeServiceWorker() {
  return _safe(() => {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) return 'unsupported';
    const reg = navigator.serviceWorker.controller;
    if (!reg) return 'none';
    return reg.scriptURL || 'unknown_url';
  }, 'unknown');
}

// ─── Language trace ──────────────────────────────────────

/**
 * Walk the rendered DOM and count text nodes that look like raw
 * English while a non-English locale is active. Best-effort —
 * heuristic only.
 */
function _scanDomForEnglishLeaks() {
  return _safe(() => {
    if (typeof document === 'undefined') return { count: 0, samples: [] };
    const ENGLISH_PHRASES = [
      /^Save\s/i, /^Cancel\s/i, /^Continue\s/i, /^Back\s/i, /^Retry\s/i,
      /^Loading/i, /^Photo\b/i, /^Camera\b/i, /^Analyzing\b/i,
    ];
    const html = document.documentElement;
    if (!html) return { count: 0, samples: [] };
    const lang = (html.getAttribute('lang') || '').toLowerCase();
    if (!lang || lang.startsWith('en')) return { count: 0, samples: [], note: 'active_locale_is_english' };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    const samples = [];
    let count = 0;
    let node = walker.nextNode();
    let scanned = 0;
    while (node && scanned < 2000) {
      const text = String(node.nodeValue || '').trim();
      if (text && text.length > 2 && text.length < 80) {
        for (const re of ENGLISH_PHRASES) {
          if (re.test(text)) {
            count++;
            if (samples.length < 8) {
              const parent = node.parentNode;
              const tag = parent && parent.tagName ? parent.tagName.toLowerCase() : 'unknown';
              samples.push({ text, tag });
            }
            break;
          }
        }
      }
      scanned++;
      node = walker.nextNode();
    }
    return { count, samples, scanned };
  }, { count: 0, samples: [], error: 'dom_scan_failed' });
}

export function buildLanguageTrace() {
  return _safe(() => {
    const persisted = _readPersisted(LOCALE_STORAGE_KEY);
    const htmlLang  = _readHtmlLang();
    const active    = persisted || htmlLang || 'en';
    const loaded    = _probeLoadedLocaleChunks();
    const staleCandidates = (Array.isArray(loaded) && active !== 'en')
      ? loaded.filter((c) => c !== 'en' && c !== active)
      : [];
    const leakScan = _scanDomForEnglishLeaks();
    return {
      currentLocale:    active,
      persisted,
      htmlLang,
      loadedChunks:     loaded,
      staleChunks:      staleCandidates,
      supportedLocales: SUPPORTED_LOCALES.map((l) => ({
        code: l.code, englishName: l.englishName, nativeName: l.nativeName,
      })),
      rawEnglishLeaks:  leakScan.count,
      leakSamples:      leakScan.samples || [],
      domScanned:       leakScan.scanned || 0,
      timestamp:        new Date().toISOString(),
    };
  }, { error: 'trace_failed', timestamp: new Date().toISOString() });
}

// ─── Recovery hooks ──────────────────────────────────────

/**
 * Drop the persisted locale + force every column to re-load. The
 * caller still needs to dispatch a `farroway:langchange` event for
 * subscribers to re-render.
 */
export function forceLocaleReload() {
  return _safe(() => {
    if (typeof localStorage !== 'undefined') {
      try { localStorage.removeItem(LOCALE_STORAGE_KEY); } catch { /* swallow */ }
      try { localStorage.removeItem('farroway:voiceLang'); } catch { /* swallow */ }
      try { localStorage.removeItem('farroway_lang'); } catch { /* swallow */ }
      try { localStorage.removeItem('farroway_language'); } catch { /* swallow */ }
    }
    // Trigger a re-load by reload — Vite will re-import column
    // chunks fresh. This is the heavy hammer; a softer alternative
    // (just dispatching langchange) is also fine but doesn't drop
    // truly stale chunks.
    if (typeof window !== 'undefined' && window.location && typeof window.location.reload === 'function') {
      try {
        window.dispatchEvent(new CustomEvent('farroway:langchange', { detail: { reason: 'force_locale_reload' } }));
      } catch { /* swallow */ }
      try { window.location.reload(); } catch { /* swallow */ }
    }
    return true;
  }, false);
}

/**
 * Tear down the active scan session + wipe its persisted record.
 * Useful when the user sees a stuck scan they can't dismiss.
 */
export function clearScanSession() {
  return _safe(() => {
    const m = require('../core/scan/scanSessionManager.js');
    if (m && typeof m.endSession === 'function') m.endSession();
    try {
      const img = require('../core/scan/stableScanImageStore.js');
      if (img && typeof img.clearScanImage === 'function') img.clearScanImage();
    } catch { /* swallow */ }
    return true;
  }, false);
}

/**
 * Restore the preview from the persisted session record. Useful
 * after a navigation that lost the scan UI state but kept the
 * persisted record.
 */
export function rebuildPreview() {
  return _safe(() => {
    const m = require('../core/scan/scanSessionManager.js');
    if (!m || typeof m.restorePersistedSession !== 'function') return null;
    const rec = m.restorePersistedSession();
    if (!rec) return null;
    // The actual rendering of the preview happens in the Scan
    // surface — what we return here is the rehydrated record so a
    // caller can inspect or re-stage it. Surface components can
    // subscribe via the `farroway:scanPreviewRestored` event we
    // dispatch below.
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('farroway:scanPreviewRestored', { detail: rec }));
      }
    } catch { /* swallow */ }
    return rec;
  }, null);
}

/**
 * Purge every cache the browser is willing to expose, then hard
 * reload. This is the "nuclear option" — call it when a user
 * reports seeing stale assets that don't go away with a refresh.
 */
export async function forceAssetRefresh() {
  await _clearAllBrowserCaches();
  return _safe(() => {
    if (typeof window !== 'undefined' && window.location) {
      try {
        // bypass cache by appending a unique query param + using
        // location.replace so back button doesn't return to stale.
        // safeUrl returns null on any malformed input — fall back
        // to a hard reload in that case.
        const u = safeUrl(window.location.href);
        if (u) {
          u.searchParams.set('_refresh', String(Date.now()));
          window.location.replace(u.toString());
        } else {
          window.location.reload();
        }
      } catch { /* swallow */ }
    }
    return true;
  }, false);
}

/**
 * Standalone cache purge (no reload). Useful as a building block.
 */
export async function clearSWCaches() {
  return _clearAllBrowserCaches();
}

async function _clearAllBrowserCaches() {
  // 1. Service workers — kill every registration.
  try {
    if (typeof navigator !== 'undefined' && navigator.serviceWorker
        && typeof navigator.serviceWorker.getRegistrations === 'function') {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) {
        try { await r.unregister(); } catch { /* per-reg tolerate */ }
      }
    }
  } catch { /* swallow */ }
  // 2. CacheStorage — drop every named cache.
  try {
    if (typeof caches !== 'undefined' && typeof caches.keys === 'function') {
      const keys = await caches.keys();
      for (const k of keys) {
        try { await caches.delete(k); } catch { /* per-cache tolerate */ }
      }
    }
  } catch { /* swallow */ }
  // 3. localStorage — preserve auth, drop the rest related to us.
  try {
    if (typeof localStorage !== 'undefined') {
      const PRESERVE = new Set([
        'farroway_token', 'farroway_auth_token',
        'auth_token', 'access_token', 'token',
        'farroway:session_cache',
      ]);
      const keysToDrop = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (typeof k === 'string' && !PRESERVE.has(k)) keysToDrop.push(k);
      }
      for (const k of keysToDrop) {
        try { localStorage.removeItem(k); } catch { /* tolerate */ }
      }
    }
  } catch { /* swallow */ }
  // 4. sessionStorage — drop all.
  try { if (typeof sessionStorage !== 'undefined') sessionStorage.clear(); } catch { /* swallow */ }
  // 5. IndexedDB (best-effort: not enumerable on Safari, no-op there).
  try {
    if (typeof indexedDB !== 'undefined' && typeof indexedDB.databases === 'function') {
      const dbs = await indexedDB.databases();
      for (const d of (dbs || [])) {
        if (d && d.name) {
          try { indexedDB.deleteDatabase(d.name); } catch { /* tolerate */ }
        }
      }
    }
  } catch { /* swallow */ }
  return true;
}

// ─── Install ─────────────────────────────────────────────

/**
 * Pin every hook on `window`. Production-safe (snapshots are
 * PII-free); idempotent. Safe to call on every boot.
 */
export function installProductionDiagnostics() {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const define = (name, value) => {
      if (window[name]) return;
      try {
        Object.defineProperty(window, name, {
          value, writable: false, configurable: false, enumerable: true,
        });
      } catch { /* tolerate — some browsers freeze window */ }
    };
    define('__farrowayBuild', function __farrowayBuild() {
      const snap = buildBuildDiagnostic();
      try { console.log('[farrowayBuild]', snap); } catch { /* swallow */ }
      return snap;
    });
    define('__languageTrace', function __languageTrace() {
      const trace = buildLanguageTrace();
      try { console.log('[languageTrace]', trace); } catch { /* swallow */ }
      return trace;
    });
    define('__forceLocaleReload', forceLocaleReload);
    define('__clearScanSession', clearScanSession);
    define('__rebuildPreview',   rebuildPreview);
    define('__forceAssetRefresh',forceAssetRefresh);
    define('__clearSWCaches',    clearSWCaches);
    // Scan telemetry browser hook. Surfaces the event log from
    // localStorage so an operator can dump it without re-running
    // a scan. Strips large dataURL fields.
    define('__scanTelemetry', function __scanTelemetry() {
      let log = [];
      try {
        const m = require('../core/scan/scanTelemetry.js');
        if (m && typeof m.getScanEventLog === 'function') log = m.getScanEventLog();
      } catch { log = []; }
      try { console.table(log); } catch { /* swallow */ }
      return log;
    });
    define('__clearScanTelemetry', function __clearScanTelemetry() {
      try {
        const m = require('../core/scan/scanTelemetry.js');
        if (m && typeof m.clearScanEventLog === 'function') m.clearScanEventLog();
      } catch { /* swallow */ }
      return true;
    });
    // One-line greppable boot marker the user can search for in
    // their DevTools console output as "yes, the new diagnostics
    // are installed":
    try {
      console.log('[Farroway Diagnostics] Installed — try window.__farrowayBuild()');
    } catch { /* swallow */ }
    return true;
  }, false);
}

const _module = {
  buildBuildDiagnostic, buildLanguageTrace,
  forceLocaleReload, clearScanSession, rebuildPreview,
  forceAssetRefresh, clearSWCaches,
  installProductionDiagnostics,
};
export default _module;
