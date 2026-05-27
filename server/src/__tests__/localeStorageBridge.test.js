/**
 * localeStorageBridge.test.js — production stabilization §7/§8.
 *
 * Contract:
 *   • Bridges 5 competing locale-storage keys onto one canonical key.
 *   • Read order: canonical → manual pin → legacy snake → legacy long → i18nextLng.
 *   • Write mirrors to every legacy key so old readers don't regress.
 *   • Never throws; SSR-safe.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  LOCALE_KEYS, LEGACY_LOCALE_KEYS,
  readBridgedLocale, writeBridgedLocale, auditLocaleStorage,
} from '../../../src/i18n/localeStorageBridge.js';

function _stubLocalStorage() {
  if (typeof globalThis.localStorage === 'undefined') {
    const _store = new Map();
    globalThis.localStorage = {
      getItem:    (k) => _store.has(k) ? _store.get(k) : null,
      setItem:    (k, v) => _store.set(k, String(v)),
      removeItem: (k) => _store.delete(k),
      clear:      () => _store.clear(),
      get length() { return _store.size; },
      key: (i) => Array.from(_store.keys())[i] || null,
    };
  } else {
    try { globalThis.localStorage.clear(); } catch { /* swallow */ }
  }
}

beforeEach(() => { _stubLocalStorage(); });

describe('LOCALE_KEYS registry', () => {
  it('exposes the 5 documented keys', () => {
    expect(LOCALE_KEYS.CANONICAL).toBe('farroway:lang');
    expect(LOCALE_KEYS.MANUAL_PIN).toBe('farroway:lang:manual');
    expect(LOCALE_KEYS.LEGACY_SNAKE).toBe('farroway_lang');
    expect(LOCALE_KEYS.LEGACY_LONG).toBe('farroway_language');
    expect(LOCALE_KEYS.I18NEXT).toBe('i18nextLng');
  });

  it('LEGACY_LOCALE_KEYS only lists the 3 legacy mirrors', () => {
    expect(LEGACY_LOCALE_KEYS.length).toBe(3);
    expect(LEGACY_LOCALE_KEYS).not.toContain(LOCALE_KEYS.CANONICAL);
    expect(LEGACY_LOCALE_KEYS).not.toContain(LOCALE_KEYS.MANUAL_PIN);
  });
});

describe('readBridgedLocale — fallback order', () => {
  it('returns DEFAULT_LOCALE when no keys are set', () => {
    expect(readBridgedLocale()).toBe('en');
  });

  it('reads from the canonical key first', () => {
    localStorage.setItem(LOCALE_KEYS.CANONICAL, 'tw');
    localStorage.setItem(LOCALE_KEYS.LEGACY_SNAKE, 'fr');
    expect(readBridgedLocale()).toBe('tw');
  });

  it('falls through to manual-pin when canonical is missing', () => {
    localStorage.setItem(LOCALE_KEYS.MANUAL_PIN, 'ha');
    expect(readBridgedLocale()).toBe('ha');
  });

  it('falls through to legacy snake when canonical + manual missing', () => {
    localStorage.setItem(LOCALE_KEYS.LEGACY_SNAKE, 'sw');
    expect(readBridgedLocale()).toBe('sw');
  });

  it('falls through to legacy long', () => {
    localStorage.setItem(LOCALE_KEYS.LEGACY_LONG, 'hi');
    expect(readBridgedLocale()).toBe('hi');
  });

  it('falls through to i18nextLng', () => {
    localStorage.setItem(LOCALE_KEYS.I18NEXT, 'fr');
    expect(readBridgedLocale()).toBe('fr');
  });

  it('normalizes region suffixes (en-US → en)', () => {
    localStorage.setItem(LOCALE_KEYS.CANONICAL, 'en-US');
    expect(readBridgedLocale()).toBe('en');
  });

  it('returns DEFAULT_LOCALE on unsupported codes', () => {
    localStorage.setItem(LOCALE_KEYS.CANONICAL, 'xx');
    localStorage.setItem(LOCALE_KEYS.LEGACY_SNAKE, 'yy');
    expect(readBridgedLocale()).toBe('en');
  });
});

describe('writeBridgedLocale — mirror writes', () => {
  it('writes to canonical AND manual-pin AND every legacy key', () => {
    writeBridgedLocale('tw');
    expect(localStorage.getItem(LOCALE_KEYS.CANONICAL)).toBe('tw');
    expect(localStorage.getItem(LOCALE_KEYS.MANUAL_PIN)).toBe('tw');
    expect(localStorage.getItem(LOCALE_KEYS.LEGACY_SNAKE)).toBe('tw');
    expect(localStorage.getItem(LOCALE_KEYS.LEGACY_LONG)).toBe('tw');
    expect(localStorage.getItem(LOCALE_KEYS.I18NEXT)).toBe('tw');
  });

  it('coerces unsupported codes to en', () => {
    writeBridgedLocale('xx');
    expect(localStorage.getItem(LOCALE_KEYS.CANONICAL)).toBe('en');
  });

  it('handles region suffixes', () => {
    writeBridgedLocale('fr-CA');
    expect(localStorage.getItem(LOCALE_KEYS.CANONICAL)).toBe('fr');
  });

  it('returns the normalized code written', () => {
    expect(writeBridgedLocale('hi')).toBe('hi');
    expect(writeBridgedLocale('xx')).toBe('en');
  });
});

describe('auditLocaleStorage — drift detection', () => {
  it('reports allKeysAgree=true when no keys are set', () => {
    const a = auditLocaleStorage();
    expect(a.allKeysAgree).toBe(true);
    expect(a.conflictingKeys.length).toBe(0);
  });

  it('reports allKeysAgree=true when all keys are the same locale', () => {
    writeBridgedLocale('tw');
    const a = auditLocaleStorage();
    expect(a.allKeysAgree).toBe(true);
  });

  it('reports drift when keys disagree', () => {
    localStorage.setItem(LOCALE_KEYS.CANONICAL, 'tw');
    localStorage.setItem(LOCALE_KEYS.LEGACY_SNAKE, 'fr');
    const a = auditLocaleStorage();
    expect(a.allKeysAgree).toBe(false);
    expect(a.conflictingKeys.length).toBe(2);
  });

  it('returns bridged = readBridgedLocale()', () => {
    writeBridgedLocale('sw');
    expect(auditLocaleStorage().bridged).toBe('sw');
  });

  it('returns supported=true for known locale', () => {
    writeBridgedLocale('ha');
    expect(auditLocaleStorage().supported).toBe(true);
  });

  it('reports the canonical locale count', () => {
    expect(auditLocaleStorage().knownLocaleCount).toBe(6);
  });
});

describe('SSR-safety', () => {
  it('never throws when localStorage is undefined', () => {
    const ls = globalThis.localStorage;
    delete globalThis.localStorage;
    try {
      expect(() => readBridgedLocale()).not.toThrow();
      expect(() => writeBridgedLocale('tw')).not.toThrow();
      expect(() => auditLocaleStorage()).not.toThrow();
      expect(readBridgedLocale()).toBe('en');
    } finally {
      globalThis.localStorage = ls;
    }
  });
});
