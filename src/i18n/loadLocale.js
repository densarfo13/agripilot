/**
 * loadLocale.js — locale-by-locale lazy loader.
 *
 * Pilot-readiness audit, Part 2: ship locale dictionaries via
 * dynamic import() so the app does not pay for non-English
 * dictionaries on first paint. English (en) is bundled eagerly
 * as the always-available fallback; tw/ha/hi/fr/sw are loaded
 * on demand and cached.
 *
 * This module is intentionally self-contained:
 *   • No Suspense, no React boundaries — Home keeps rendering.
 *   • No localStorage clear, no cache invalidation cascade.
 *   • No throw-on-miss; missing locales degrade to English.
 *   • Reentrant: parallel calls share the same in-flight promise.
 *
 * Coexists with jsonLocaleLoader.js, which still emits a static
 * overlay for the canonical T table (used by hardcoded keys).
 * This loader feeds the *additional* lazy dictionaries used by
 * components that opt into runtime lookups via tSafe().
 */

// English ships in the main bundle so that the app NEVER blocks
// on a network/dynamic-import miss. Anything else is a code-split.
import enDict from './locales/en.json';

const SUPPORTED_LOCALES = ['en', 'tw', 'ha', 'hi', 'fr', 'sw'];

// Resolved dictionaries keyed by locale code.
const _loaded = Object.create(null);
_loaded.en = enDict;

// In-flight import promises so concurrent loadLocale('tw') calls
// share a single network/parse cost.
const _inflight = Object.create(null);

/**
 * Internal: dynamic import switch. Vite reads these specifiers
 * statically so each locale becomes its own chunk.
 */
function _importLocale(locale) {
  switch (locale) {
    case 'tw': return import('./locales/tw.json');
    case 'ha': return import('./locales/ha.json');
    case 'hi': return import('./locales/hi.json');
    case 'fr': return import('./locales/fr.json');
    case 'sw': return import('./locales/sw.json');
    case 'en': return Promise.resolve({ default: enDict });
    default:   return Promise.resolve({ default: null });
  }
}

/**
 * loadLocale(locale) → Promise<dictionary | null>
 *
 * Always resolves; never throws. Caches the resolved dictionary.
 * If the locale is unsupported or the import fails, resolves to
 * null and the caller is expected to fall back to English.
 */
export function loadLocale(locale) {
  const code = (locale || '').toString().toLowerCase();
  if (!code || !SUPPORTED_LOCALES.includes(code)) {
    return Promise.resolve(null);
  }
  if (_loaded[code]) return Promise.resolve(_loaded[code]);
  if (_inflight[code]) return _inflight[code];

  const p = _importLocale(code)
    .then((mod) => {
      const dict = mod && (mod.default || mod);
      if (dict && typeof dict === 'object') {
        _loaded[code] = dict;
      }
      return _loaded[code] || null;
    })
    .catch(() => null)
    .finally(() => { delete _inflight[code]; });

  _inflight[code] = p;
  return p;
}

/**
 * getLoadedDictionary(locale) → dictionary | null
 *
 * Synchronous accessor for already-resolved dictionaries.
 * Returns null when the locale has not been loaded yet — never
 * triggers a dynamic import. English is always loaded.
 */
export function getLoadedDictionary(locale) {
  const code = (locale || '').toString().toLowerCase();
  if (!code) return null;
  return _loaded[code] || null;
}

/**
 * ensureLocale(locale) → Promise<dictionary>
 *
 * Convenience wrapper that always resolves to a usable
 * dictionary: the requested locale if available, otherwise the
 * English fallback. Callers can `await ensureLocale(code)` and
 * trust the result is a real object.
 */
export async function ensureLocale(locale) {
  const dict = await loadLocale(locale);
  return dict || _loaded.en || enDict;
}

/**
 * For diagnostics / tests. Not part of the public lazy-load API.
 */
export function _listLoadedLocales() {
  return Object.keys(_loaded);
}

export const LOCALE_LAZY_LOADER_VERSION = 1;
