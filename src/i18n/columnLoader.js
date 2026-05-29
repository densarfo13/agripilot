/**
 * columnLoader.js — lazy loader for non-default locale columns.
 *
 * Pairs with translations.js, which after the column-split refactor
 * boots with only the `en` column populated for every row of T.
 * This module dynamically imports src/i18n/columns/T-{locale}.js
 * and merges the result into the same T object so existing
 * consumers (t(), tSafe(), tStrict(), useTranslation(),
 * useScreenTranslator(), the 35 overlay merges in index.js) see
 * new translations in place with no API surface changes.
 *
 * Design properties:
 *   • Reentrant — concurrent loadColumn('fr') calls share the
 *     same in-flight promise; the column is parsed and merged
 *     exactly once per locale.
 *   • Cached — once loaded, a column never reloads. The mutation
 *     onto T is permanent for the page lifetime.
 *   • Non-throwing — a failed dynamic import (network error,
 *     missing chunk) resolves to `false`. Callers fall back to
 *     the English value via the existing t() resolver.
 *   • Canonical wins — when merging, OVERWRITES whatever value
 *     was previously in T[key][lang]. The overlay system in
 *     index.js (mergeManyOverlays) only fills empty slots, so
 *     this preserves the "translator-authored canonical values
 *     win over overlays" contract once the column arrives.
 *
 * Vite picks up these specific dynamic import strings statically
 * and code-splits each column into its own chunk (see manualChunks
 * in vite.config.js → i18n-col-{locale}).
 *
 * NOTE: this module is committed standalone in its own commit
 * BEFORE translations.js is replaced with the shim. Until the
 * cutover commit lands, this file is dead code — nothing imports
 * it. The standalone commit keeps the loader reviewable in
 * isolation and lets the cutover be a single small diff.
 */

import T from './translations.js';
import { isFeatureEnabled } from '../config/features.js';

// RC1 — Hindi gate. When enableHindiLocale is OFF the column chunk
// is never requested; the loader returns an empty {default:null}
// envelope so callers degrade to English seamlessly.
function _hindiEnabled() {
  try { return !!isFeatureEnabled('enableHindiLocale'); } catch { return false; }
}

const SUPPORTED = new Set(['en', 'fr', 'sw', 'ha', 'tw', 'hi']);
const DEFAULT_LOCALE = 'en';

// The English column is bundled with translations.js itself
// (it's the eagerly-imported column after the cutover), so it's
// always loaded.
const _loaded = new Set([DEFAULT_LOCALE]);
const _inflight = new Map();

// Per-(locale, kind) one-shot warning memo so the console
// stays quiet under steady-state operation.
const _warnedOnce = new Set();

function _warn(memoKey, ...args) {
  if (_warnedOnce.has(memoKey)) return;
  _warnedOnce.add(memoKey);
  try { console.warn('[i18n columnLoader]', ...args); }
  catch { /* never propagate */ }
}

// Dev-only verbose log. Surfaces the lazy-load lifecycle so an
// operator debugging "language switch shows English" can see
// exactly which import() resolved, how long it took, and how many
// keys were merged. No-op in production (Vite folds the env check).
function _debug(...args) {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug('[i18n columnLoader]', ...args);
    }
  } catch { /* swallow */ }
}

/**
 * Static-import switch so Vite can statically resolve each
 * specifier and emit a separate chunk per locale.
 *
 * Returns a Promise<{ default: Record<string,string> }>.
 */
function _importColumn(locale) {
  switch (locale) {
    case 'fr': return import('./columns/T-fr.js');
    case 'sw': return import('./columns/T-sw.js');
    case 'ha': return import('./columns/T-ha.js');
    case 'tw': return import('./columns/T-tw.js');
    case 'hi':
      // RC1 — Hindi is gated behind enableHindiLocale (currently OFF
      // because coverage is 54.3%). When the flag is off the
      // dynamic import is bypassed so the Hindi column chunk is
      // not requested at runtime. Files on disk are preserved.
      // The flag check uses the statically-imported predicate
      // at the top of this module.
      if (!_hindiEnabled()) {
        return Promise.resolve({ default: null });
      }
      return import('./columns/T-hi.js');
    case 'en':
      // English is part of translations.js post-cutover; explicit
      // no-op success so callers can always loadColumn('en').
      return Promise.resolve({ default: null });
    default:
      return Promise.reject(new Error('Unknown locale: ' + locale));
  }
}

/**
 * Merge a column dict into the shared T object. Canonical values
 * (from the column file) OVERWRITE whatever was previously in the
 * slot — overlay-supplied values lose to canonical ones, matching
 * the pre-refactor contract.
 */
function _mergeColumn(lang, dict) {
  if (!dict || typeof dict !== 'object') return 0;
  let n = 0;
  for (const key of Object.keys(dict)) {
    const v = dict[key];
    if (typeof v !== 'string' || v === '') continue;
    if (!T[key]) T[key] = {};
    T[key][lang] = v;
    n += 1;
  }
  return n;
}

/**
 * isColumnLoaded(locale) — true if the column is already merged
 * into T. Pure read; never triggers a fetch.
 */
export function isColumnLoaded(locale) {
  const code = (locale || '').toString().toLowerCase();
  return _loaded.has(code);
}

/**
 * loadColumn(locale) → Promise<boolean>
 *
 * Triggers (or joins) a load of the requested locale column
 * and merges it into T. Resolves to true on success, false on
 * any failure (unknown locale, network error, malformed module).
 *
 * Idempotent — subsequent calls for a loaded locale resolve
 * immediately to true without re-fetching.
 */
export function loadColumn(locale) {
  const code = (locale || '').toString().toLowerCase();
  if (!code || !SUPPORTED.has(code)) {
    _warn('unsupported:' + code, 'unsupported locale', code, '— falling back to English');
    return Promise.resolve(false);
  }
  if (_loaded.has(code)) {
    _debug('loadColumn cache hit:', code);
    return Promise.resolve(true);
  }
  if (_inflight.has(code)) {
    _debug('loadColumn in-flight join:', code);
    return _inflight.get(code);
  }

  const startedAt = Date.now();
  _debug('loadColumn START:', code, '→ import("./columns/T-' + code + '.js")');
  const promise = _importColumn(code)
    .then((mod) => {
      const dict = mod && (mod.default || mod);
      if (code === 'en') {
        // English column is already inlined into translations.js
        // post-cutover; mark loaded and return success without merging.
        _loaded.add(code);
        _debug('loadColumn en NOOP (eager)');
        return true;
      }
      if (!dict || typeof dict !== 'object') {
        _warn('badshape:' + code, 'column', code, 'has no usable default export');
        return false;
      }
      const mergedCount = _mergeColumn(code, dict);
      _loaded.add(code);
      _debug('loadColumn SUCCESS:', code,
        '|', mergedCount, 'keys merged',
        '|', (Date.now() - startedAt) + 'ms');
      return true;
    })
    .catch((err) => {
      _warn('importfail:' + code, 'column', code, 'failed to load:',
        err && err.message ? err.message : err);
      _debug('loadColumn FAIL:', code, '|', (Date.now() - startedAt) + 'ms', err);
      return false;
    })
    .finally(() => { _inflight.delete(code); });

  _inflight.set(code, promise);
  return promise;
}

/**
 * loadedLocales() — diagnostic. Returns the list of locales whose
 * column is currently merged into T.
 */
export function loadedLocales() {
  return Array.from(_loaded);
}

export const COLUMN_LOADER_VERSION = 1;
