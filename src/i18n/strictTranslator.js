/**
 * strictTranslator.js — screen-level i18n completeness gate.
 *
 * Companion to:
 *   • src/i18n/index.js     — base t() (per-key English fallback)
 *   • src/i18n/tSafe.js     — caller-supplied fallback + [MISSING] marker
 *   • src/i18n/strictT.js   — per-key no-leak (returns '' if missing)
 *   • THIS FILE             — per-SCREEN: if any key on a screen is
 *                              missing in the active language, the
 *                              entire screen renders in English so the
 *                              user never sees a half-translated UI.
 *
 * Why this exists (final UI launch spec §1)
 * ─────────────────────────────────────────
 * Per-key fallback can produce a screen with five Hindi strings + one
 * English string. That's a worse user experience than just rendering
 * the whole screen in English: the eye snags on the leak, voice
 * playback below mismatches the on-screen text, and low-literacy
 * users get confused. The launch spec mandates ONE language per
 * screen — rather than mix.
 *
 * How to use
 * ──────────
 *   import { useScreenTranslator } from '../i18n/strictTranslator.js';
 *
 *   function HomePage() {
 *     const t = useScreenTranslator('home', [
 *       'home.greeting', 'home.tasks.title', 'home.tasks.markDone',
 *       // ...every key the screen renders
 *     ]);
 *     return <h1>{t('home.greeting')}</h1>;
 *   }
 *
 * If ANY listed key is missing in the active language, the hook
 * pins the entire screen to English for the lifetime of the
 * render. A single dev-only console.warn lists the missing keys
 * once per screen+lang pair so the gap can be filled later.
 *
 * Acceptance behaviour
 * ────────────────────
 *   • lang = en           → returns base t() unchanged.
 *   • lang = X, 0 missing → returns base t() in lang X.
 *   • lang = X, ≥1 miss   → returns base t('en') for every key.
 *   • Re-renders on `farroway:langchange` via useTranslation().
 *
 * Strict-rule audit
 *   • Pure-React module (hook + helper). No I/O.
 *   • Never throws. base t() and getLanguage() are both wrapped.
 *   • Idempotent — calling validateScreen() twice returns the
 *     same answer for the same (screen, keys, lang) tuple.
 */

import { useMemo } from 'react';
import { t as baseT, getLanguage } from './index.js';
import { useTranslation } from './index.js';

const _warnedScreens = new Set(); // Set<screenId|lang>

function _isDev() {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) return true;
  } catch { /* SSR */ }
  return false;
}

function _looksMissing(value, key) {
  if (value == null) return true;
  if (typeof value !== 'string') return true;
  if (value === '') return true;
  if (value.startsWith('[MISSING:')) return true;
  if (key && value === String(key)) return true;
  return false;
}

/**
 * validateScreen(screenId, keys, lang) → { ok, missing, lang }
 *
 * Pure helper: returns whether every key in `keys` resolves to
 * a non-missing value in `lang`. Useful for tests + the screen
 * hook below.
 */
export function validateScreen(screenId, keys, lang) {
  const out = { screenId: String(screenId || ''), lang, ok: true, missing: [] };
  if (!Array.isArray(keys) || keys.length === 0) return out;
  if (lang === 'en') return out;       // English is the source — trivially complete.
  for (const key of keys) {
    let v = '';
    try { v = baseT(key, lang); } catch { v = ''; }
    if (_looksMissing(v, key)) {
      out.ok = false;
      out.missing.push(key);
    }
  }
  return out;
}

/**
 * useScreenTranslator(screenId, keys) → tFn
 *
 * React hook. Returns a translator that:
 *   • renders the active language when every listed key resolves;
 *   • renders English for every key when ANY listed key is missing.
 *
 * Re-evaluates on language change (subscribes via useTranslation).
 *
 * @param {string} screenId — short identifier ('home', 'tasks', etc.)
 *                            used for dev-warn deduplication.
 * @param {string[]} keys   — every key the screen renders. Pass them
 *                            up-front so completeness can be checked
 *                            before the first paint.
 * @returns {(key: string, fallback?: string, vars?: object) => string}
 */
export function useScreenTranslator(screenId, keys) {
  // Subscribe so the hook re-evaluates on farroway:langchange.
  const { lang: ctxLang } = useTranslation();
  const lang = ctxLang || (() => { try { return getLanguage(); } catch { return 'en'; } })();

  const validation = useMemo(
    () => validateScreen(screenId, keys, lang),
    [screenId, lang, _stableKey(keys)],
  );

  // Dev-only: log missing keys once per (screen, lang).
  if (_isDev() && !validation.ok && validation.missing.length > 0) {
    const tag = `${screenId}|${lang}`;
    if (!_warnedScreens.has(tag)) {
      _warnedScreens.add(tag);
      try {
        // eslint-disable-next-line no-console
        console.warn(
          `[i18n SCREEN-FALLBACK] Screen "${screenId}" rendered in English (lang=${lang}); missing keys:`,
          validation.missing,
        );
      } catch { /* never propagate */ }
    }
  }

  const renderLang = validation.ok ? lang : 'en';

  return function t(key, fallback, vars) {
    try {
      let v = '';
      try { v = baseT(key, renderLang, vars); } catch { v = ''; }
      if (_looksMissing(v, key)) {
        // Even after the screen-level pin, individual keys can still
        // legitimately be missing (e.g. caller passed a dynamic key).
        // In that case use the caller's explicit fallback so the UI
        // doesn't blank out.
        return fallback != null ? String(fallback) : '';
      }
      return v;
    } catch {
      return fallback != null ? String(fallback) : '';
    }
  };
}

/** Stable identity for a list of strings — used to memoise validateScreen. */
function _stableKey(keys) {
  if (!Array.isArray(keys)) return '';
  return keys.join('|');
}

export default useScreenTranslator;
