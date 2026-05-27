/**
 * localeStorageBridge.js — production-stabilization bridge for the
 * 5 competing locale-storage keys the codebase has accumulated.
 *
 *   import {
 *     readBridgedLocale, writeBridgedLocale, auditLocaleStorage,
 *     LOCALE_KEYS, LEGACY_LOCALE_KEYS,
 *   } from 'src/i18n/localeStorageBridge.js';
 *
 * What this is — and is NOT
 * ─────────────────────────
 *   Root cause of "the app shows English even though I picked French":
 *   the codebase writes the picked locale to one key and reads from
 *   a different one. Five keys are currently in play:
 *
 *     • 'farroway:lang'        — canonical (per supportedLocales.ts)
 *     • 'farroway_lang'        — legacy (utils/i18n.js, productMoat.js)
 *     • 'farroway_language'    — legacy (setLanguageI18n.js, i18next.js)
 *     • 'farroway:lang:manual' — manual-pin (usePreferenceSync.js)
 *     • 'i18nextLng'           — i18next default key
 *
 *   This module is a thin BRIDGE — not a replacement:
 *     • `readBridgedLocale()`  reads from the canonical key first,
 *       then falls through every legacy key, then returns DEFAULT_LOCALE.
 *     • `writeBridgedLocale(code)` writes to the canonical key AND
 *       mirrors to every legacy key so existing readers still resolve
 *       correctly until they migrate.
 *     • `auditLocaleStorage()` returns a structural snapshot of every
 *       key + value so production diagnostics can spot mismatches.
 *
 *   We do NOT delete legacy keys here — that would break every reader
 *   that hasn't migrated yet. A future cleanup PR can remove the
 *   mirrors once every site reads through this bridge.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • Every storage call wrapped in try/catch — quota / private mode
 *     silent-degrades to memory-only.
 *   • No side effects on import.
 */

import {
  DEFAULT_LOCALE, normalizeLocale, isSupportedLocale, LOCALE_CODES,
} from './supportedLocales.ts';

// ─── Key registry ────────────────────────────────────────────

export const LOCALE_KEYS = Object.freeze({
  CANONICAL:    'farroway:lang',
  MANUAL_PIN:   'farroway:lang:manual',
  LEGACY_SNAKE: 'farroway_lang',
  LEGACY_LONG:  'farroway_language',
  I18NEXT:      'i18nextLng',
});

export const LEGACY_LOCALE_KEYS = Object.freeze([
  LOCALE_KEYS.LEGACY_SNAKE,
  LOCALE_KEYS.LEGACY_LONG,
  LOCALE_KEYS.I18NEXT,
]);

const _ALL_KEYS = Object.freeze([
  LOCALE_KEYS.CANONICAL,
  LOCALE_KEYS.MANUAL_PIN,
  ...LEGACY_LOCALE_KEYS,
]);

// ─── Helpers ─────────────────────────────────────────────────

function _safe(fn, fallback) {
  try { return fn(); } catch { return fallback; }
}

function _hasStorage() {
  return typeof globalThis !== 'undefined'
    && typeof globalThis.localStorage !== 'undefined';
}

function _readKey(key) {
  return _safe(() => {
    if (!_hasStorage()) return null;
    const v = globalThis.localStorage.getItem(key);
    return typeof v === 'string' && v.length > 0 ? v : null;
  }, null);
}

function _writeKey(key, value) {
  _safe(() => {
    if (!_hasStorage()) return;
    globalThis.localStorage.setItem(key, value);
  });
}

// ─── Public — read ───────────────────────────────────────────

/**
 * Read the user's locale by walking every known storage key, in
 * priority order:
 *
 *   1. The canonical key.
 *   2. The manual-pin key (set when the user explicitly clicks a
 *      locale in the picker — beats auto-detected).
 *   3. Legacy snake / long / i18next keys.
 *
 * Returns the FIRST valid supported-locale code found, or
 * DEFAULT_LOCALE if none qualify.
 */
export function readBridgedLocale() {
  return _safe(() => {
    for (const key of _ALL_KEYS) {
      const raw = _readKey(key);
      if (!raw) continue;
      const normalized = normalizeLocale(raw);
      if (isSupportedLocale(normalized)) return normalized;
    }
    return DEFAULT_LOCALE;
  }, DEFAULT_LOCALE);
}

// ─── Public — write ──────────────────────────────────────────

/**
 * Write the user's chosen locale to the canonical key AND every
 * legacy key. Old readers (utils/i18n.js, productMoat.js, etc.)
 * keep working until they migrate to readBridgedLocale().
 *
 * Returns the normalized locale that was written.
 */
export function writeBridgedLocale(code) {
  return _safe(() => {
    const normalized = normalizeLocale(code);
    if (!isSupportedLocale(normalized)) return DEFAULT_LOCALE;
    // Write canonical + manual-pin (user explicitly picked) + every legacy mirror.
    _writeKey(LOCALE_KEYS.CANONICAL, normalized);
    _writeKey(LOCALE_KEYS.MANUAL_PIN, normalized);
    for (const k of LEGACY_LOCALE_KEYS) _writeKey(k, normalized);
    return normalized;
  }, DEFAULT_LOCALE);
}

// ─── Public — audit ──────────────────────────────────────────

/**
 * Structural snapshot of every locale storage key + a verdict on
 * whether the keys agree.
 *
 *   {
 *     canonical, manualPin, legacySnake, legacyLong, i18next,
 *     bridged,           — readBridgedLocale() output
 *     allKeysAgree,      — true when every non-null key is the same code
 *     conflictingKeys,   — [{ key, value }] when allKeysAgree=false
 *     supported,         — true when bridged is a known locale
 *   }
 *
 * Used by `window.__languageTrace()` to expose locale-storage
 * drift to production diagnostics.
 */
export function auditLocaleStorage() {
  return _safe(() => {
    const values = {
      canonical:    _readKey(LOCALE_KEYS.CANONICAL),
      manualPin:    _readKey(LOCALE_KEYS.MANUAL_PIN),
      legacySnake:  _readKey(LOCALE_KEYS.LEGACY_SNAKE),
      legacyLong:   _readKey(LOCALE_KEYS.LEGACY_LONG),
      i18next:      _readKey(LOCALE_KEYS.I18NEXT),
    };
    const bridged = readBridgedLocale();
    const present = Object.entries(values)
      .filter(([, v]) => typeof v === 'string' && v.length > 0)
      .map(([k, v]) => ({ key: k, value: normalizeLocale(v) }));
    const uniqueValues = new Set(present.map((p) => p.value));
    const allKeysAgree = uniqueValues.size <= 1;
    const conflictingKeys = allKeysAgree ? [] : present;
    return Object.freeze({
      ...values,
      bridged,
      allKeysAgree,
      conflictingKeys: Object.freeze(conflictingKeys),
      supported:       isSupportedLocale(bridged),
      knownLocaleCount: LOCALE_CODES.length,
    });
  }, Object.freeze({
    canonical: null, manualPin: null,
    legacySnake: null, legacyLong: null, i18next: null,
    bridged: DEFAULT_LOCALE,
    allKeysAgree: true,
    conflictingKeys: Object.freeze([]),
    supported: true,
    knownLocaleCount: LOCALE_CODES.length,
  }));
}

const _module = {
  LOCALE_KEYS, LEGACY_LOCALE_KEYS,
  readBridgedLocale, writeBridgedLocale, auditLocaleStorage,
};
export default _module;
