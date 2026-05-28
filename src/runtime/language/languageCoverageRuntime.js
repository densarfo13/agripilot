/**
 * languageCoverageRuntime.js — Wave 8 RUNTIME language coverage audit.
 *
 *   import {
 *     installLanguageCoverage, getLanguageCoverageSnapshot,
 *   } from 'src/runtime/language/languageCoverageRuntime.js';
 *
 * What this is
 * ────────────
 *   Runtime-side language coverage observer. The build-time check
 *   `scripts/check-translations.mjs` (existing) audits the JSON
 *   files; this runtime layer measures the LIVE coverage by
 *   inspecting:
 *
 *     1. the resolved locale (from src/i18n/localeStorageBridge.js)
 *     2. tSafe miss counts (existing telemetry inside the i18n
 *        layer) — every tSafe call that fell back to its English
 *        default counts as a coverage gap
 *     3. column-pack load state (which columns are loaded for the
 *        current locale)
 *
 *   The diagnostic surfaces this as `__languageHealth()` so QA can
 *   verify in DevTools that the active locale has the coverage the
 *   build-time gates assert.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • Read-only. No mutation of i18n state.
 *   • No PII; only locale codes + counters.
 */

const RUNTIME_VERSION = 'language-coverage-runtime-v1';

const SUPPORTED_LOCALES = Object.freeze([
  'en', 'fr', 'sw', 'ha', 'tw', 'hi',
]);

const _state = {
  installed:      false,
  installedAt:    null,
  activeLocale:   null,
  tSafeMisses:    0,
  tSafeHits:      0,
  fallbackByKey:  new Map(), // key → count of fallback hits
  columnPacks:    new Set(), // 'core' | 'overlays' | 'col-<lang>'
};

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
const _now = () => _safe(() => new Date().toISOString(), '');
const _hasWindow = () => { try { return typeof window !== 'undefined'; } catch { return false; } };

/**
 * Public API for the i18n layer to report a tSafe call outcome.
 * Called from inside tSafe.js when it resolves a key.
 *
 *   @param {string} key       — translation key (no PII)
 *   @param {'hit'|'miss'} kind
 */
export function reportTSafeOutcome(key, kind) {
  if (kind === 'hit') {
    _state.tSafeHits += 1;
  } else {
    _state.tSafeMisses += 1;
    if (typeof key === 'string' && key) {
      _state.fallbackByKey.set(key,
        (_state.fallbackByKey.get(key) || 0) + 1);
    }
  }
}

/**
 * Mark a column pack as loaded. Called by the i18n column loader.
 */
export function markColumnPackLoaded(packId) {
  if (typeof packId === 'string' && packId) {
    _state.columnPacks.add(packId);
  }
}

export function setActiveLocale(locale) {
  if (typeof locale === 'string' && locale) {
    _state.activeLocale = locale;
  }
}

/**
 * Install. Idempotent. Reads the active locale from the existing
 * locale bridge AND registers reportTSafeOutcome as tSafe's
 * coverage reporter so every translation lookup feeds the meter.
 */
export function installLanguageCoverage() {
  if (_state.installed) {
    return Object.freeze({ ok: true, alreadyInstalled: true });
  }
  // Detect active locale from bridged storage.
  _safe(() => {
    if (!_hasWindow() || !window.localStorage) return;
    const key = window.localStorage.getItem('farroway:lang')
      || window.localStorage.getItem('farroway_lang')
      || window.localStorage.getItem('i18nextLng');
    if (key && SUPPORTED_LOCALES.includes(key.slice(0, 2))) {
      _state.activeLocale = key.slice(0, 2);
    }
  }, null);
  // RC1 — register coverage reporter on tSafe via dynamic import
  // so the language runtime doesn't pull tSafe into its own module
  // graph at load time (avoids any circular-import surprise).
  _safe(() => {
    import('../../i18n/tSafe.js').then((mod) => {
      if (mod && typeof mod.setCoverageReporter === 'function') {
        mod.setCoverageReporter(reportTSafeOutcome);
      }
    }).catch(() => { /* never block install */ });
  }, null);
  _state.installed = true;
  _state.installedAt = _now();
  return Object.freeze({
    ok: true,
    activeLocale: _state.activeLocale,
  });
}

export function getLanguageCoverageSnapshot() {
  const totalSeen = _state.tSafeHits + _state.tSafeMisses;
  const hitRate = totalSeen === 0 ? null
    : _state.tSafeHits / totalSeen;
  // Top 20 missed keys for QA prioritization.
  const topMissed = Array.from(_state.fallbackByKey.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([key, count]) => Object.freeze({ key, count }));
  return Object.freeze({
    runtimeVersion:   RUNTIME_VERSION,
    installed:        _state.installed,
    installedAt:      _state.installedAt,
    activeLocale:     _state.activeLocale,
    supportedLocales: SUPPORTED_LOCALES,
    tSafeHits:        _state.tSafeHits,
    tSafeMisses:      _state.tSafeMisses,
    hitRate,
    coveragePct:      hitRate == null ? null : Math.round(hitRate * 100),
    columnPacksLoaded: Array.from(_state.columnPacks),
    topMissedKeys:    Object.freeze(topMissed),
    healthy:          hitRate == null
      ? null
      : hitRate >= 0.80,
  });
}

export function _resetForTests() {
  _state.installed = false;
  _state.installedAt = null;
  _state.activeLocale = null;
  _state.tSafeMisses = 0;
  _state.tSafeHits = 0;
  _state.fallbackByKey.clear();
  _state.columnPacks.clear();
}
