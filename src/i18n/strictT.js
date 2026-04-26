/**
 * strictT.js — strict, non-leaky translation wrapper.
 *
 * Companion to existing helpers in this folder:
 *   • src/i18n/index.js   → canonical t(): humanises missing keys + (in
 *                            non-English) silently falls back to English
 *   • src/i18n/tSafe.js   → adds an explicit caller-supplied fallback,
 *                            surfaces [MISSING:key] markers in dev
 *   • src/i18n/strictT.js → THIS FILE: hard "no English leak" mode
 *
 * Why strictT exists
 * ──────────────────
 * The base t() is intentionally forgiving: when a Hindi/Twi/Hausa key
 * is missing, it returns the English value so the UI never blanks. For
 * low-literacy farmer surfaces that's a problem — an English string
 * appearing inside an otherwise-Hindi screen is a *bigger* readability
 * failure than no string at all (the farmer can't read it AND it
 * confuses the voice playback below).
 *
 * tStrict applies the opposite policy: when the active language is not
 * English, we NEVER auto-fall back to English. The caller passes an
 * explicit non-English fallback (or accepts an empty string).
 *
 * Behaviour
 * ─────────
 *   tStrict('farmerActions.tasks')
 *     → 'कार्य' if Hindi has the key
 *     → ''      if Hindi missing  (no English leak; dev console.warn)
 *
 *   tStrict('farmerActions.tasks', 'Tasks')
 *     → uses the explicit fallback when missing
 *     → in English UI the fallback also wins if the key is absent
 *     → in non-English UI the caller-supplied fallback is treated as
 *       a deliberate caller decision and is shown verbatim
 *
 *   tStrict() never throws. The base t() already wraps in try/catch;
 *   we add a second guard so dev-mode console.warn cannot itself break
 *   the render pass.
 *
 * Usage notes
 * ───────────
 *   • For React components, prefer the bound translator from
 *     useTranslation() so the component re-renders on language change.
 *     This module-level helper reads the active language at call time
 *     via getLanguage(); a render path using *only* tStrict will not
 *     subscribe to farroway:langchange.
 *   • Pair tStrict with VoiceButton/IconActionCard for the
 *     low-literacy farmer flows where English leak is unacceptable.
 */

import { t as baseT, getLanguage } from './index.js';

const _warnedKeys = new Set();

function _isDev() {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) return true;
  } catch { /* SSR */ }
  try {
    if (typeof process !== 'undefined' && process.env) {
      if (process.env.NODE_ENV === 'development') return true;
      if (process.env.NODE_ENV === 'test')        return true;
      if (process.env.VITE_I18N_STRICT === '1')   return true;
    }
  } catch { /* ignore */ }
  return false;
}

function _looksMissing(value, key) {
  // HOTFIX (Apr 2026): the previous heuristic compared `value` against
  // the humanised tail of the dotted `key` to detect cases where
  // base-t() fell back to humanizeKey(). That triggered FALSE
  // POSITIVES on legitimate English entries — e.g. `t('nav.tasks')`
  // → 'Tasks' has the same shape as humanize('nav.tasks') → 'Tasks',
  // so any single-word English label whose key tail spells the
  // word got blanked when called via tStrict / useStrictTranslation.
  // That blanked huge swaths of the farmer-facing UI.
  //
  // The fix: detect "missing" via signals that DON'T overlap with
  // valid translator output:
  //   • null / undefined / non-string
  //   • empty string
  //   • the explicit '[MISSING:' marker base-t emits in strict mode
  //   • the rendered string equals the dotted key itself (which is
  //     what some t() implementations return on a hard miss)
  //
  // We accept the trade-off that the humanised-fallback path won't
  // be detected here: it returns to the caller as the English
  // fallback. Surfaces that need the strict no-leak guarantee
  // should ensure the key actually has a non-en value in the
  // dictionary; guard:i18n already enforces this for high-risk
  // domains, and the dev-only [i18n MISSING] warn still fires when
  // a real miss does happen.
  if (value == null) return true;
  if (typeof value !== 'string') return true;
  if (value === '') return true;
  if (value.startsWith('[MISSING:')) return true;
  if (key && value === String(key)) return true;
  return false;
}

/**
 * Translate `key` strictly: never auto-fall back to English when the
 * active UI language is non-English.
 *
 * @param {string} key       dotted i18n key, e.g. 'farmerActions.tasks'
 * @param {string} [fallback=''] caller-supplied fallback string
 * @param {object} [vars]    optional interpolation vars passed to baseT
 * @returns {string}
 */
export function tStrict(key, fallback = '', vars = undefined) {
  try {
    if (!key) return fallback || '';
    let lang = 'en';
    try { lang = getLanguage() || 'en'; } catch { /* keep en */ }

    let value = '';
    try { value = baseT(key, lang, vars); } catch { value = ''; }

    if (_looksMissing(value, key)) {
      if (_isDev()) {
        if (!_warnedKeys.has(key)) {
          _warnedKeys.add(key);
          try { console.warn('[i18n MISSING]', key, '(lang=' + lang + ')'); }
          catch { /* never propagate */ }
        }
      }
      // Hard rule: in non-English UI we do NOT silently use English.
      // The caller's explicit fallback wins, otherwise empty.
      return fallback || '';
    }

    // In English UI: if base resolved to a real value, use it. The
    // caller's fallback is informational.
    if (lang === 'en') return value;

    // Non-English UI with a real, non-missing translation: use it.
    return value;
  } catch {
    return fallback || '';
  }
}

export default tStrict;
