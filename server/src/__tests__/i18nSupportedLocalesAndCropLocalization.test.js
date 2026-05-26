/**
 * i18nSupportedLocalesAndCropLocalization.test.js — verifies the
 * permanent language-picker + crop-localization primitives:
 *   • src/i18n/supportedLocales.ts
 *   • src/i18n/i18nStateDevHook.js
 *   • src/core/crops/cropLocalization.ts
 *   • src/core/crops/languageCropAuditDevTool.js
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  SUPPORTED_LOCALES, LOCALE_CODES, DEFAULT_LOCALE, LOCALE_STORAGE_KEY,
  isSupportedLocale, normalizeLocale, getSupportedLocale,
} from '../../../src/i18n/supportedLocales.ts';

import {
  buildI18nStateSnapshot, installI18nStateHook,
} from '../../../src/i18n/i18nStateDevHook.js';

import {
  getLocalizedCropName, getCropDisplayLabel, getLocalizedCropNameTable,
  listOverlayCropIds, resolveLocale,
} from '../../../src/core/crops/cropLocalization.ts';

import {
  buildLanguageCropAuditSnapshot, installLanguageCropAuditHook,
} from '../../../src/core/crops/languageCropAuditDevTool.js';

// ─── supportedLocales ────────────────────────────────────

describe('supportedLocales', () => {
  it('ships exactly the 6 launch locales in the canonical order', () => {
    expect(LOCALE_CODES).toEqual(['en', 'fr', 'sw', 'ha', 'tw', 'hi']);
  });

  it('each entry has code + englishName + nativeName', () => {
    for (const l of SUPPORTED_LOCALES) {
      expect(typeof l.code).toBe('string');
      expect(typeof l.englishName).toBe('string');
      expect(typeof l.nativeName).toBe('string');
      expect(l.englishName.length).toBeGreaterThan(0);
      expect(l.nativeName.length).toBeGreaterThan(0);
    }
  });

  it('SUPPORTED_LOCALES is frozen', () => {
    expect(Object.isFrozen(SUPPORTED_LOCALES)).toBe(true);
    expect(Object.isFrozen(SUPPORTED_LOCALES[0])).toBe(true);
  });

  it('DEFAULT_LOCALE is "en"', () => {
    expect(DEFAULT_LOCALE).toBe('en');
  });

  it('LOCALE_STORAGE_KEY exposes the canonical storage key', () => {
    expect(typeof LOCALE_STORAGE_KEY).toBe('string');
    expect(LOCALE_STORAGE_KEY.length).toBeGreaterThan(0);
  });

  it('isSupportedLocale narrows correctly', () => {
    expect(isSupportedLocale('en')).toBe(true);
    expect(isSupportedLocale('tw')).toBe(true);
    expect(isSupportedLocale('hi')).toBe(true);
    expect(isSupportedLocale('es')).toBe(false);     // not shipped
    expect(isSupportedLocale('')).toBe(false);
    expect(isSupportedLocale(null)).toBe(false);
    expect(isSupportedLocale(undefined)).toBe(false);
    expect(isSupportedLocale(42)).toBe(false);
  });

  it('normalizeLocale coerces region suffixes and falls back to en', () => {
    expect(normalizeLocale('en-US')).toBe('en');
    expect(normalizeLocale('fr_CA')).toBe('fr');
    expect(normalizeLocale('HI')).toBe('hi');
    expect(normalizeLocale('zh-Hans')).toBe('en');   // unsupported root
    expect(normalizeLocale('')).toBe('en');
    expect(normalizeLocale(null)).toBe('en');
    expect(normalizeLocale(undefined)).toBe('en');
    expect(normalizeLocale(42)).toBe('en');
  });

  it('getSupportedLocale returns the entry or undefined', () => {
    expect(getSupportedLocale('tw').nativeName).toBe('Twi');
    expect(getSupportedLocale('es')).toBeUndefined();
  });
});

// ─── i18nStateDevHook ────────────────────────────────────

describe('i18nStateDevHook', () => {
  beforeEach(() => { delete globalThis.window; });

  it('buildI18nStateSnapshot returns the documented shape', () => {
    const snap = buildI18nStateSnapshot();
    expect(typeof snap.active).toBe('string');
    expect(typeof snap.storageKey).toBe('string');
    expect(Array.isArray(snap.supported)).toBe(true);
    expect(snap.supportedCodes).toEqual(['en', 'fr', 'sw', 'ha', 'tw', 'hi']);
    expect(typeof snap.timestamp).toBe('string');
  });

  it('respects activeOverride for deterministic tests', () => {
    const snap = buildI18nStateSnapshot({ activeOverride: 'tw' });
    expect(snap.active).toBe('tw');
  });

  it('falls back to en when no signal is available', () => {
    const snap = buildI18nStateSnapshot();
    expect(snap.active).toBe('en');
  });

  it('installI18nStateHook pins window.__i18nState (idempotent)', () => {
    globalThis.window = {};
    expect(installI18nStateHook()).toBe(true);
    expect(typeof globalThis.window.__i18nState).toBe('function');
    // Second call is a no-op.
    expect(installI18nStateHook()).toBe(true);
    // SSR path — no window.
    delete globalThis.window;
    expect(installI18nStateHook()).toBe(false);
  });

  it('never throws on garbage input', () => {
    expect(() => buildI18nStateSnapshot(null)).not.toThrow();
    expect(() => buildI18nStateSnapshot('garbage')).not.toThrow();
    expect(() => installI18nStateHook()).not.toThrow();
  });
});

// ─── cropLocalization ────────────────────────────────────

describe('cropLocalization', () => {
  it('getLocalizedCropName resolves canonical overlay names', () => {
    // The Twi overlay is "Aburo" — partner-supplied.
    expect(getLocalizedCropName('maize', 'tw')).toBe('Aburo');
    expect(getLocalizedCropName('okra',  'ha')).toBe('Kubewa');
  });

  it('falls back to the canonical registry for non-overlay crops', () => {
    // cassava is in the registry but not the overlay — the
    // registry should still produce a localized name for ha.
    const name = getLocalizedCropName('cassava', 'ha');
    expect(typeof name).toBe('string');
    expect(name.length).toBeGreaterThan(0);
  });

  it('round-trips an unknown crop id', () => {
    expect(getLocalizedCropName('zzzz-unknown-zzzz', 'tw')).toBe('zzzz-unknown-zzzz');
  });

  it('returns empty string for empty input', () => {
    expect(getLocalizedCropName('', 'tw')).toBe('');
    expect(getLocalizedCropName(null, 'tw')).toBe('');
    expect(getLocalizedCropName(undefined, 'tw')).toBe('');
  });

  it('normalizes locale input (region suffix, casing)', () => {
    expect(getLocalizedCropName('maize', 'TW')).toBe('Aburo');
    expect(getLocalizedCropName('maize', 'tw-GH')).toBe('Aburo');
    // Unsupported locale falls back to en.
    expect(getLocalizedCropName('maize', 'zz')).toBe(getLocalizedCropName('maize', 'en'));
  });

  it('getCropDisplayLabel returns "—" for empty values', () => {
    expect(getCropDisplayLabel('', 'tw')).toBe('—');
    expect(getCropDisplayLabel(null, 'tw')).toBe('—');
  });

  it('getLocalizedCropNameTable returns one entry per supported locale', () => {
    const tbl = getLocalizedCropNameTable('maize');
    expect(Object.keys(tbl).sort()).toEqual(['en', 'fr', 'ha', 'hi', 'sw', 'tw']);
    expect(tbl.tw).toBe('Aburo');
    expect(tbl.ha).toBe('Masara');
  });

  it('listOverlayCropIds returns the partner-supplied subset', () => {
    const ids = listOverlayCropIds();
    expect(Array.isArray(ids)).toBe(true);
    expect(ids).toContain('maize');
    expect(ids).toContain('tomato');
    expect(ids).toContain('pepper');
  });

  it('resolveLocale matches normalizeLocale on supported codes', () => {
    expect(resolveLocale('tw')).toBe('tw');
    expect(resolveLocale('TW')).toBe('tw');
    expect(resolveLocale('zz')).toBe('en');
    expect(resolveLocale(null)).toBe('en');
  });

  it('never throws on garbage input', () => {
    expect(() => getLocalizedCropName({}, 'tw')).not.toThrow();
    expect(() => getCropDisplayLabel({}, 'tw')).not.toThrow();
    expect(() => getLocalizedCropNameTable('zzz')).not.toThrow();
  });
});

// ─── languageCropAuditDevTool ────────────────────────────

describe('languageCropAuditDevTool', () => {
  beforeEach(() => { delete globalThis.window; });

  it('buildLanguageCropAuditSnapshot returns the documented shape', () => {
    const snap = buildLanguageCropAuditSnapshot();
    expect(typeof snap.ok).toBe('boolean');
    expect(typeof snap.cropsChecked).toBe('number');
    expect(snap.cropsChecked).toBeGreaterThan(0);
    expect(snap.localesChecked).toBe(6);
    expect(Array.isArray(snap.localeSummary)).toBe(true);
    expect(snap.localeSummary).toHaveLength(6);
    expect(Array.isArray(snap.issues)).toBe(true);
    expect(typeof snap.generatedAt).toBe('string');
  });

  it('every localeSummary entry has the documented counters', () => {
    const snap = buildLanguageCropAuditSnapshot();
    for (const s of snap.localeSummary) {
      expect(typeof s.locale).toBe('string');
      expect(typeof s.total).toBe('number');
      expect(typeof s.missing).toBe('number');
      expect(typeof s.englishFallback).toBe('number');
      expect(typeof s.localized).toBe('number');
      expect(typeof s.coveragePct).toBe('number');
    }
  });

  it('English summary has 100% coverage by definition', () => {
    const snap = buildLanguageCropAuditSnapshot();
    const en = snap.localeSummary.find((s) => s.locale === 'en');
    expect(en).toBeTruthy();
    expect(en.coveragePct).toBe(100);
  });

  it('installLanguageCropAuditHook pins window.__languageCropAudit (idempotent)', () => {
    globalThis.window = {};
    expect(installLanguageCropAuditHook()).toBe(true);
    expect(typeof globalThis.window.__languageCropAudit).toBe('function');
    expect(installLanguageCropAuditHook()).toBe(true);
    delete globalThis.window;
    expect(installLanguageCropAuditHook()).toBe(false);
  });

  it('never throws on garbage state', () => {
    expect(() => buildLanguageCropAuditSnapshot()).not.toThrow();
    expect(() => installLanguageCropAuditHook()).not.toThrow();
  });
});
