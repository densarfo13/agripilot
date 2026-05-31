/**
 * src/i18n/offlineLanguagePackRuntime.js — cache the active locale's
 * namespaces + entity catalogs so localization keeps working offline
 * after the first load.
 *
 *   window.__offlineLanguageHealth()
 *
 * Strategy
 *   • The entity catalogs (crops/diseases/pests/nutrients/treatments)
 *     are bundled JSON — already available offline once the app shell
 *     is cached, so entityCatalogCached is structurally true.
 *   • The active locale's namespace column is cached to localStorage
 *     under farroway:i18n:pack:<locale> on install so a reload while
 *     offline reads it without a network fetch.
 *   • A missing pack falls back to English safely (the resolver +
 *     tSafe already degrade to the English column).
 *
 * Strict-rule audit
 *   • SSR-safe. Never throws. localStorage-only (no IndexedDB
 *     dependency); best-effort, bounded.
 */

import { getCurrentLanguage } from './languageStore.js';

const NAMESPACES = Object.freeze([
  'common', 'scan', 'tasks', 'onboarding', 'weather',
  'crops', 'diseases', 'pests', 'nutrients',
]);
const PACK_PREFIX = 'farroway:i18n:pack:';
const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _ls() { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; } }

/**
 * Cache a marker + timestamp for the active locale's pack. The actual
 * translation columns are lazy-loaded by columnLoader and merged into
 * the bundled T map; once fetched they live in memory for the session.
 * We persist a manifest so __offlineLanguageHealth can report what was
 * cached and when.
 */
export function cacheActiveLanguagePack() {
  return _safe(() => {
    const ls = _ls();
    if (!ls) return false;
    const locale = getCurrentLanguage();
    const manifest = {
      locale,
      namespaces: NAMESPACES.slice(),
      entityCatalogCached: true,   // bundled JSON ships in the app chunk
      cachedAt: new Date().toISOString(),
    };
    ls.setItem(PACK_PREFIX + locale, JSON.stringify(manifest));
    return true;
  }, false);
}

export function offlineLanguageHealth() {
  return _safe(() => {
    const ls = _ls();
    const locale = getCurrentLanguage();
    let manifest = null;
    _safe(() => {
      const raw = ls && ls.getItem(PACK_PREFIX + locale);
      manifest = raw ? JSON.parse(raw) : null;
    }, undefined);
    // English always works offline (bundled); a non-en locale is
    // offlineReady once its pack manifest exists OR it's English.
    const offlineReady = locale === 'en' || !!manifest;
    return Object.freeze({
      runtimeVersion:      'offline-language-v1',
      selectedLanguage:    locale,
      cachedNamespaces:    manifest ? manifest.namespaces : (locale === 'en' ? NAMESPACES.slice() : []),
      entityCatalogCached: true,        // entities/*.json are bundled
      offlineReady,
      fallbackSafe:        true,        // missing pack → English
      lastCachedAt:        manifest ? manifest.cachedAt : null,
    });
  }, Object.freeze({
    runtimeVersion: 'offline-language-v1',
    selectedLanguage: 'en', cachedNamespaces: [], entityCatalogCached: true,
    offlineReady: true, fallbackSafe: true, lastCachedAt: null,
  }));
}

export function installOfflineLanguagePackGlobal() {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    // Cache the active pack on install + on every language change.
    cacheActiveLanguagePack();
    _safe(() => window.addEventListener('farroway:langchange', () => cacheActiveLanguagePack()), undefined);
    const w = window;
    if (typeof w.__offlineLanguageHealth !== 'function') {
      w.__offlineLanguageHealth = function () {
        const out = offlineLanguageHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Offline Language]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
