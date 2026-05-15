/**
 * i18nDevAudit.test.js — Permanent Localization + Crop Mismatch
 * Fix §13.
 *
 * The spec asks for a single dev-console entry point:
 *
 *   window.__farrowayI18n.audit()   // [FARROWAY_I18N] report
 *   window.__farrowayI18n.clear()   // flush missing-key queue
 *   window.__farrowayI18n.lang()    // active-language snapshot
 *
 * src/i18n/devConsoleAudit.js is the thin DevTools façade that
 * consolidates the already-shipped audit surfaces (the missing-
 * translation queue, the active-language read, the <html lang>
 * mismatch check) behind that handle.
 *
 * Coverage:
 *   - runAudit() returns the documented report shape + never throws
 *   - getLanguageSnapshot() returns { lang, storageKey, docLang }
 *   - installI18nDevHandle() installs a frozen window.__farrowayI18n
 *   - install is idempotent + SSR-safe (no window → returns false)
 *   - the [FARROWAY_I18N] console prefix is the literal the spec
 *     mandates
 *   - main.jsx wires the dev-only install at boot
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  FARROWAY_I18N_TAG,
  LANG_STORAGE_KEY,
  runAudit,
  getLanguageSnapshot,
  installI18nDevHandle,
  _resetI18nDevHandle,
} from '../../../src/i18n/devConsoleAudit.js';

const ROOT = resolve(process.cwd(), '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

beforeEach(() => {
  _resetI18nDevHandle();
});

afterEach(() => {
  _resetI18nDevHandle();
});

// ─── 1. Constants ──────────────────────────────────────────

describe('devConsoleAudit — spec-mandated constants', () => {
  it('uses the literal [FARROWAY_I18N] console prefix', () => {
    expect(FARROWAY_I18N_TAG).toBe('[FARROWAY_I18N]');
  });

  it('uses the canonical language storage key the app actually writes', () => {
    // src/i18n/i18next.js reads + setLanguageI18n.js writes
    // 'farroway_language' — the audit must report the same key.
    expect(LANG_STORAGE_KEY).toBe('farroway_language');
  });
});

// ─── 1b. <html lang> sync ──────────────────────────────────

describe('i18next.js — keeps <html lang> in sync with the active language', () => {
  const i18nextSrc = read('src/i18n/i18next.js');

  it('sets document.documentElement.lang', () => {
    expect(i18nextSrc).toMatch(/document\.documentElement\.lang\s*=/);
  });

  it('syncs on boot for the saved language', () => {
    expect(i18nextSrc).toMatch(/syncDocumentLang\(savedLanguage\)/);
  });

  it('syncs on every i18next languageChanged event', () => {
    expect(i18nextSrc).toMatch(/i18n\.on\('languageChanged'/);
  });
});

// ─── 2. runAudit ───────────────────────────────────────────

describe('runAudit — structured report', () => {
  it('returns the documented report shape', () => {
    const report = runAudit();
    expect(report).toBeTruthy();
    expect(typeof report.activeLanguage).toBe('string');
    expect(typeof report.documentLang).toBe('string');
    expect(report.storageKey).toBe(LANG_STORAGE_KEY);
    expect(typeof report.mismatch).toBe('boolean');
    expect(report.missingTranslations).toBeTruthy();
    expect(typeof report.missingTranslations.count).toBe('number');
    expect(report.missingTranslations.byLang).toBeTruthy();
    expect(Array.isArray(report.notes)).toBe(true);
  });

  it('never throws even with no window / no localStorage', () => {
    expect(() => runAudit()).not.toThrow();
  });
});

// ─── 3. getLanguageSnapshot ────────────────────────────────

describe('getLanguageSnapshot', () => {
  it('returns { lang, storageKey, docLang }', () => {
    const snap = getLanguageSnapshot();
    expect(snap).toBeTruthy();
    expect(typeof snap.lang).toBe('string');
    expect(snap.storageKey).toBe(LANG_STORAGE_KEY);
    expect(typeof snap.docLang).toBe('string');
  });
});

// ─── 4. installI18nDevHandle ───────────────────────────────

describe('installI18nDevHandle', () => {
  it('SSR-safe — returns false when window is unavailable', () => {
    const hadWindow = 'window' in globalThis;
    const saved = globalThis.window;
    try {
      delete globalThis.window;
      expect(installI18nDevHandle()).toBe(false);
    } finally {
      if (hadWindow) globalThis.window = saved;
    }
  });

  it('installs a frozen window.__farrowayI18n handle', () => {
    globalThis.window = globalThis.window || {};
    expect(installI18nDevHandle()).toBe(true);
    const handle = globalThis.window.__farrowayI18n;
    expect(handle).toBeTruthy();
    expect(typeof handle.audit).toBe('function');
    expect(typeof handle.clear).toBe('function');
    expect(typeof handle.lang).toBe('function');
    expect(Object.isFrozen(handle)).toBe(true);
  });

  it('idempotent — installing twice is safe + returns true', () => {
    globalThis.window = globalThis.window || {};
    expect(installI18nDevHandle()).toBe(true);
    expect(installI18nDevHandle()).toBe(true);
  });

  it('the installed audit() returns the same report shape', () => {
    globalThis.window = globalThis.window || {};
    installI18nDevHandle();
    const report = globalThis.window.__farrowayI18n.audit();
    expect(report.storageKey).toBe(LANG_STORAGE_KEY);
    expect(typeof report.mismatch).toBe('boolean');
  });

  it('clear() never throws', () => {
    globalThis.window = globalThis.window || {};
    installI18nDevHandle();
    expect(() => globalThis.window.__farrowayI18n.clear()).not.toThrow();
  });

  it('_resetI18nDevHandle removes the window handle', () => {
    globalThis.window = globalThis.window || {};
    installI18nDevHandle();
    expect(globalThis.window.__farrowayI18n).toBeTruthy();
    _resetI18nDevHandle();
    expect(globalThis.window.__farrowayI18n).toBeUndefined();
  });
});

// ─── 5. main.jsx wiring ────────────────────────────────────

describe('main.jsx — installs the i18n dev handle at boot', () => {
  const mainSrc = read('src/main.jsx');

  it('statically imports installI18nDevHandle', () => {
    expect(mainSrc).toMatch(/import \{ installI18nDevHandle \} from '\.\/i18n\/devConsoleAudit\.js'/);
  });

  it('calls installI18nDevHandle() gated on import.meta.env.DEV', () => {
    expect(mainSrc).toMatch(/installI18nDevHandle\(\)/);
    const idx = mainSrc.indexOf('installI18nDevHandle()');
    const window = mainSrc.slice(Math.max(0, idx - 200), idx);
    expect(window).toMatch(/import\.meta\.env\.DEV/);
  });
});
