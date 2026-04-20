/**
 * languagesConfig.test.js — central config for supported languages.
 * Spec §8 checklist (1, 2, 3 — config + quick subset + dropdown list).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  LANGUAGES,
  DEFAULT_LANGUAGE,
  getQuickLanguages,
  getAllLanguages,
  isSupported,
  getLanguage,
} from '../../../src/config/languages.js';

import {
  SUPPORTED_LANGUAGES,
  resolveLanguage,
  confirmLanguage,
  detectBrowserLanguage,
  _keys,
} from '../../../src/lib/languageResolver.js';

// ─── Shared mocks ──────────────────────────────────────────────────
function installLocalStorage() {
  const map = new Map();
  globalThis.localStorage = {
    getItem:    (k) => map.has(k) ? map.get(k) : null,
    setItem:    (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear:      () => map.clear(),
  };
  globalThis.window = { localStorage: globalThis.localStorage, dispatchEvent: () => true };
  return map;
}

// ─── 1. Central config loads ───────────────────────────────────────
describe('LANGUAGES central config', () => {
  it('is frozen and entries have code / label / quick', () => {
    expect(Object.isFrozen(LANGUAGES)).toBe(true);
    for (const l of LANGUAGES) {
      expect(Object.isFrozen(l)).toBe(true);
      expect(typeof l.code).toBe('string');
      expect(typeof l.label).toBe('string');
      expect(typeof l.quick).toBe('boolean');
    }
  });

  it('default language is English', () => {
    expect(DEFAULT_LANGUAGE).toBe('en');
  });

  it('contains the spec\'s core codes (en, fr, hi, tw, es, pt)', () => {
    const codes = LANGUAGES.map((l) => l.code);
    for (const c of ['en', 'fr', 'hi', 'tw', 'es', 'pt']) {
      expect(codes).toContain(c);
    }
  });

  // ─── 2. Quick subset vs full list ────────────────────────────
  it('getQuickLanguages returns only quick entries', () => {
    const q = getQuickLanguages();
    expect(q.length).toBeGreaterThan(0);
    expect(q.every((l) => l.quick === true)).toBe(true);
    // The spec lists en/fr/hi/tw as the four core quick picks.
    const qCodes = q.map((l) => l.code);
    for (const c of ['en', 'fr', 'hi', 'tw']) expect(qCodes).toContain(c);
  });

  it('getAllLanguages returns every supported language', () => {
    const all = getAllLanguages();
    expect(all).toHaveLength(LANGUAGES.length);
    expect(all.length).toBeGreaterThan(getQuickLanguages().length);
  });

  it('isSupported is strict', () => {
    expect(isSupported('en')).toBe(true);
    expect(isSupported('pt')).toBe(true);
    expect(isSupported('xx')).toBe(false);
    expect(isSupported('')).toBe(false);
    expect(isSupported(null)).toBe(false);
  });

  it('getLanguage finds by code, null for unknown', () => {
    expect(getLanguage('en')?.label).toBe('English');
    expect(getLanguage('xx')).toBeNull();
  });
});

// ─── Back-compat view via resolver ─────────────────────────────────
describe('languageResolver.SUPPORTED_LANGUAGES', () => {
  it('derives hidden from !quick (back-compat)', () => {
    for (const l of SUPPORTED_LANGUAGES) {
      expect(l.hidden).toBe(!l.quick);
      expect(l.short).toBe(l.code.toUpperCase());
    }
  });
});

// ─── 4. navigator.language auto-detect (spec §3) ───────────────────
function setNavigator(lang) {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { language: lang, languages: [lang] },
  });
}

describe('detectBrowserLanguage', () => {
  afterEach(() => {
    try { Object.defineProperty(globalThis, 'navigator', { configurable: true, value: undefined }); }
    catch { /* ignore */ }
  });

  it('maps en-US → en',    () => { setNavigator('en-US'); expect(detectBrowserLanguage()).toBe('en'); });
  it('maps fr-FR → fr',    () => { setNavigator('fr-FR'); expect(detectBrowserLanguage()).toBe('fr'); });
  it('maps hi-IN → hi',    () => { setNavigator('hi-IN'); expect(detectBrowserLanguage()).toBe('hi'); });
  it('maps ak-GH → tw (Akan heuristic)', () => {
    setNavigator('ak-GH'); expect(detectBrowserLanguage()).toBe('tw');
  });
  it('unknown locale → null so resolver falls back to English', () => {
    setNavigator('zz-ZZ'); expect(detectBrowserLanguage()).toBeNull();
  });
});

// ─── 5/6. resolveLanguage chain + persistence ─────────────────────
describe('resolveLanguage / confirmLanguage', () => {
  beforeEach(() => { installLocalStorage(); });
  afterEach(()  => {
    delete globalThis.localStorage;
    delete globalThis.window;
    try { Object.defineProperty(globalThis, 'navigator', { configurable: true, value: undefined }); }
    catch { /* ignore */ }
  });

  it('no signals → DEFAULT_LANGUAGE', () => {
    expect(resolveLanguage()).toBe(DEFAULT_LANGUAGE);
  });

  it('browser locale is honoured when no manual pick', () => {
    setNavigator('fr-FR');
    expect(resolveLanguage()).toBe('fr');
  });

  it('manual pick wins over browser locale', () => {
    setNavigator('fr-FR');
    confirmLanguage('hi');
    expect(resolveLanguage()).toBe('hi');
  });

  it('unsupported code is rejected, state unchanged', () => {
    confirmLanguage('en');
    expect(confirmLanguage('xx')).toBe(false);
    expect(resolveLanguage()).toBe('en');
  });

  it('confirmLanguage writes the spec-canonical farroway.language key', () => {
    confirmLanguage('pt');
    expect(globalThis.localStorage.getItem(_keys.KEY_SPEC)).toBe('pt');
    // All legacy keys also written for back-compat.
    expect(globalThis.localStorage.getItem(_keys.KEY_LEGACY)).toBe('pt');
    expect(globalThis.localStorage.getItem(_keys.KEY_MANUAL)).toBe('pt');
  });

  it('KEY_SPEC equals "farroway.language"', () => {
    expect(_keys.KEY_SPEC).toBe('farroway.language');
  });

  it('fresh install with only the spec key rehydrates on next open', () => {
    globalThis.localStorage.setItem('farroway.language', 'es');
    expect(resolveLanguage()).toBe('es');
  });
});
