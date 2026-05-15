/**
 * extensionNoisePermanent.test.js — verifies the permanent fix
 * for the cornhusk / tabs:outgoing.message.ready / extension
 * "Failed to construct URL" console spam shown in the production
 * screenshots.
 *
 * Hardening verified:
 *   1. New noise patterns catch every shape the screenshots show:
 *        - bare "cornhusk" (comma-separated form)
 *        - bare "shared-service"
 *        - "No Listener: tabs:outgoing.message.ready"
 *        - "Failed to construct 'URL': Invalid url:" from
 *          extension context
 *   2. console.error + console.warn wrappers still suppress
 *      matched noise + pass real Farroway logs through
 *   3. NEW: window.onerror wrapper suppresses extension errors
 *      that bypass console.error entirely
 *   4. NEW: window.onunhandledrejection wrapper suppresses
 *      "Uncaught (in promise) Error: No Listener:" lines
 *   5. install/uninstall is idempotent and restores ALL
 *      handlers (console + onerror + onunhandledrejection)
 *   6. main.jsx auto-installs the filter at boot (source guard)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  isExtensionNoise,
  installExtensionNoiseFilter,
  uninstallExtensionNoiseFilter,
  getFilteredCount,
  _resetExtensionNoiseFilter,
} from '../../../src/lib/console/extensionNoiseFilter.js';

const ROOT = resolve(process.cwd(), '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

beforeEach(() => {
  _resetExtensionNoiseFilter();
});

afterEach(() => {
  uninstallExtensionNoiseFilter();
});

// ─── 1. New patterns match the production screenshots ───────

describe('isExtensionNoise — production screenshot shapes', () => {
  it('matches bare "cornhusk" (comma-separated console output)', () => {
    expect(isExtensionNoise(['cornhusk, shared-service, error:'])).toBe(true);
  });

  it('matches bare "shared-service" token', () => {
    expect(isExtensionNoise(['shared-service: outgoing.message'])).toBe(true);
  });

  it('matches "No Listener: tabs:outgoing.message.ready"', () => {
    expect(isExtensionNoise(['Uncaught (in promise) Error: No Listener: tabs:outgoing.message.ready']))
      .toBe(true);
  });

  it('matches "Failed to construct URL: Invalid url:" from extensions', () => {
    expect(isExtensionNoise(['cornhusk, shared-service, error: TypeError: Failed to construct \'URL\': Invalid URLInvalid url:']))
      .toBe(true);
  });

  it('matches the Uncaught Error variant', () => {
    expect(isExtensionNoise(['Uncaught (in promise) Error: Uncaught Error: No Listener: tabs:outgoing.message.ready']))
      .toBe(true);
  });
});

describe('isExtensionNoise — Farroway logs still pass through', () => {
  it('does NOT match Farroway tagged logs', () => {
    expect(isExtensionNoise(['[FARROWAY_SCAN] camera_permission_denied'])).toBe(false);
    expect(isExtensionNoise(['[HOME_FARM_HYDRATION]', { farmsCount: 1 }])).toBe(false);
    expect(isExtensionNoise(['[SCAN_INFERENCE_RESPONSE]', { ok: true }])).toBe(false);
    expect(isExtensionNoise(['[FARROWAY_RUNTIME]', { kind: 'image_fallback' }])).toBe(false);
  });

  it('does NOT match a Farroway-thrown URL error (no extension token)', () => {
    expect(isExtensionNoise([new TypeError("Failed to construct 'URL': Invalid URL")]))
      .toBe(false);
  });

  it('does NOT match a 404 GET line on our own asset', () => {
    expect(isExtensionNoise(['GET https://farroway.app/assets/realism/heroes/africa-sunrise-farm.jpeg 404 (Not Found)']))
      .toBe(false);
  });
});

// ─── 2 + 3. Install hardens console + global handlers ──────

describe('installExtensionNoiseFilter — wraps console + global handlers', () => {
  it('console.error suppresses extension noise + lets real logs through', () => {
    const seen = [];
    const origError = console.error;
    console.error = (...a) => seen.push(['error', ...a]);
    installExtensionNoiseFilter();
    console.error('Real farroway error: something failed');
    console.error('cornhusk, shared-service, error: TypeError');
    console.error('Uncaught (in promise) Error: No Listener: tabs:outgoing.message.ready');
    expect(seen.length).toBe(1);
    expect(seen[0][1]).toContain('Real farroway error');
    expect(getFilteredCount()).toBeGreaterThanOrEqual(2);
    uninstallExtensionNoiseFilter();
    console.error = origError;
  });

  it('wraps window.onerror + returns true to suppress extension errors', () => {
    globalThis.window = globalThis.window || {};
    const original = globalThis.window.onerror;
    installExtensionNoiseFilter();
    const result = globalThis.window.onerror(
      'Uncaught Error: No Listener: tabs:outgoing.message.ready',
      'VM1668_vendor.js',
      159,
      0,
      new Error('No Listener'),
    );
    expect(result).toBe(true); // suppressed
    expect(getFilteredCount()).toBeGreaterThanOrEqual(1);
    uninstallExtensionNoiseFilter();
    expect(globalThis.window.onerror).toBe(original);
  });

  it('wraps window.onunhandledrejection + prevents extension reasons', () => {
    globalThis.window = globalThis.window || {};
    const original = globalThis.window.onunhandledrejection;
    installExtensionNoiseFilter();
    let prevented = false;
    const fakeEvent = {
      reason: new Error('Uncaught Error: No Listener: tabs:outgoing.message.ready'),
      preventDefault: () => { prevented = true; },
    };
    globalThis.window.onunhandledrejection(fakeEvent);
    expect(prevented).toBe(true);
    expect(getFilteredCount()).toBeGreaterThanOrEqual(1);
    uninstallExtensionNoiseFilter();
    expect(globalThis.window.onunhandledrejection).toBe(original);
  });

  it('wraps onunhandledrejection lets a real Farroway rejection through', () => {
    globalThis.window = globalThis.window || {};
    installExtensionNoiseFilter();
    let prevented = false;
    const fakeEvent = {
      reason: new Error('refresh_failed: 401'),
      preventDefault: () => { prevented = true; },
    };
    // The handler should NOT preventDefault on a Farroway error.
    globalThis.window.onunhandledrejection(fakeEvent);
    expect(prevented).toBe(false);
    uninstallExtensionNoiseFilter();
  });
});

describe('installExtensionNoiseFilter — install/uninstall hygiene', () => {
  it('idempotent — installing twice is safe', () => {
    expect(installExtensionNoiseFilter()).toBe(true);
    expect(installExtensionNoiseFilter()).toBe(true);
    expect(() => uninstallExtensionNoiseFilter()).not.toThrow();
  });

  it('restores ALL handlers (console + onerror + onunhandledrejection)', () => {
    globalThis.window = globalThis.window || {};
    const origConsoleError = console.error;
    const origConsoleWarn  = console.warn;
    const origOnError      = globalThis.window.onerror;
    const origOnRejection  = globalThis.window.onunhandledrejection;
    installExtensionNoiseFilter();
    expect(console.error).not.toBe(origConsoleError);
    expect(globalThis.window.onerror).not.toBe(origOnError);
    uninstallExtensionNoiseFilter();
    expect(console.error).toBe(origConsoleError);
    expect(console.warn).toBe(origConsoleWarn);
    expect(globalThis.window.onerror).toBe(origOnError);
    expect(globalThis.window.onunhandledrejection).toBe(origOnRejection);
  });
});

// ─── 6. main.jsx auto-installs the filter at boot ──────────

describe('main.jsx — installs the noise filter at boot', () => {
  const mainSrc = read('src/main.jsx');

  it('statically imports installExtensionNoiseFilter', () => {
    expect(mainSrc).toMatch(/import \{ installExtensionNoiseFilter \} from '\.\/lib\/console\/extensionNoiseFilter\.js'/);
  });

  it('calls installExtensionNoiseFilter() at module top level', () => {
    expect(mainSrc).toMatch(/installExtensionNoiseFilter\(\)/);
  });

  it('install call sits BEFORE any React mount logic', () => {
    const installIdx = mainSrc.indexOf('installExtensionNoiseFilter()');
    const reactMountIdx = mainSrc.indexOf('createRoot');
    expect(installIdx).toBeGreaterThan(-1);
    if (reactMountIdx > -1) {
      expect(installIdx).toBeLessThan(reactMountIdx);
    }
  });
});
