/**
 * src/i18n/languageStore.js — single language source of truth.
 *
 * Thin store over the existing canonical resolver (i18n/index.js:
 * getLanguage / setLanguage), NOT a replacement — it gives every
 * surface ONE read/write/subscribe API and documents the priority
 * chain in one place:
 *
 *   1. user explicit selection   (localStorage 'farroway:lang')
 *   2. user profile language     (farroway:user_profile.language)
 *   3. localStorage legacy        ('farroway_lang' / 'farroway_language')
 *   4. browser language           (navigator.language)
 *   5. English
 *
 * Strict-rule audit
 *   • SSR-safe. Never throws. No business-logic change.
 */

import { getLanguage, setLanguage } from './index.js';

export const SUPPORTED = Object.freeze(['en', 'tw', 'ha', 'fr', 'sw', 'hi']);
const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

export function getCurrentLanguage() {
  return _safe(() => getLanguage() || 'en', 'en');
}

/**
 * setCurrentLanguage(code) — persists through the resolver (which
 * mirrors localStorage + dispatches farroway:langchange) AND mirrors
 * to the logged-in user profile slot so it survives logout/login.
 */
export function setCurrentLanguage(code) {
  return _safe(() => {
    if (!SUPPORTED.includes(code)) return false;
    setLanguage(code);  // canonical writer: localStorage + langchange event
    // Profile mirror — persists across logout/login on the same device.
    _safe(() => {
      if (typeof localStorage === 'undefined') return;
      const raw = localStorage.getItem('farroway:user_profile')
        || localStorage.getItem('farroway_user');
      if (!raw) return;
      const p = JSON.parse(raw);
      if (p && typeof p === 'object') {
        p.language = code;
        localStorage.setItem('farroway:user_profile', JSON.stringify(p));
      }
    }, undefined);
    return true;
  }, false);
}

/** Subscribe to language changes. Returns an unsubscribe fn. */
export function subscribeLanguage(cb) {
  return _safe(() => {
    if (typeof window === 'undefined' || typeof cb !== 'function') return () => {};
    const handler = () => { _safe(() => cb(getCurrentLanguage()), undefined); };
    window.addEventListener('farroway:langchange', handler);
    return () => { _safe(() => window.removeEventListener('farroway:langchange', handler), undefined); };
  }, () => {});
}

/** Which slot the active language came from (diagnostic). */
export function languageSource() {
  return _safe(() => {
    const ls = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
    if (ls('farroway:lang')) return 'manual';
    const prof = _safe(() => {
      const raw = ls('farroway:user_profile') || ls('farroway_user');
      const p = raw ? JSON.parse(raw) : null;
      return p && (p.language || p.lang) ? (p.language || p.lang) : null;
    }, null);
    if (prof) return 'profile';
    if (ls('farroway_lang') || ls('farroway_language')) return 'localStorage';
    if (_safe(() => !!(navigator && navigator.language), false)) return 'browser';
    return 'default';
  }, 'default');
}
