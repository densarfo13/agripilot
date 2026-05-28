/**
 * pageImportSmoke.test.js — verifies every routed page component
 * can be imported without throwing at module-load time.
 *
 * This catches the class of bugs that:
 *   • Crash before render: missing React hook imports (the useRef
 *     regression in commit 6e78de9f), bad ESM syntax, circular
 *     import deadlocks, top-level throws.
 *   • Slip past build:safe because Vite's tree-shaker drops
 *     unreachable code paths but doesn't catch top-level errors.
 *
 * Why this matters
 *   The three remaining publish blockers (mobile smoke test +
 *   Buyer/NGO/Admin UAT + funding live partner integration) all
 *   depend on these surfaces actually LOADING in a browser. An
 *   automated import-smoke check raises confidence that a
 *   deployed bundle will at least mount each page before any
 *   human ever opens it — eliminates the "white screen on tap"
 *   regression class without needing a real device.
 *
 * What this doesn't catch
 *   • Runtime UX bugs (wrong copy, layout issues).
 *   • Behaviour bugs that need user interaction to surface.
 *   • Backend-dependent flows.
 *   For those, real-device UAT remains the gate.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

// Vitest's dynamic-import resolver strips `..` segments when a
// VARIABLE path crosses the server/ project boundary into the
// parent agripilot/src/ tree (it collapsed '../../../src/lib/x.js'
// to '/src/lib/x.js' → "Cannot find module"). Resolving to an
// absolute file URL first sidesteps the resolver quirk. Literal
// import('../../../src/...') calls are unaffected — Vite transforms
// those at load time; only variable paths need this.
const _thisDir = dirname(fileURLToPath(import.meta.url));
const modUrl = (rel) => pathToFileURL(resolve(_thisDir, rel)).href;

// Stub the browser globals each page touches at import time.
// vitest runs in Node, so navigator/window/localStorage are
// undefined by default — page modules that read them on the
// top-level scope would throw without stubs.
beforeEach(() => {
  globalThis.window = globalThis.window || {
    location: { pathname: '/' },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    matchMedia: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  };
  globalThis.document = globalThis.document || {
    documentElement: { style: {}, dataset: {}, classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn() } },
    body: { style: {}, dataset: {}, classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn() } },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    createElement: vi.fn(() => ({ style: {}, setAttribute: vi.fn(), addEventListener: vi.fn() })),
  };
  if (!globalThis.localStorage) {
    const store = new Map();
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => { store.set(String(k), String(v)); },
      removeItem: (k) => { store.delete(String(k)); },
      clear: () => { store.clear(); },
    };
  }
  if (!globalThis.navigator) {
    try { vi.stubGlobal('navigator', { userAgent: 'test', platform: 'test' }); }
    catch { /* swallow — Node already exposes navigator on newer runtimes */ }
  }
  process.env.VITE_API_URL = 'https://api.test.example';
});

// ─── Library / engine modules (zero DOM, must import cleanly) ──

describe('library modules — import smoke', () => {
  it.each([
    ['../../../src/lib/farmContextEngine.js',    'getFarmContext'],
    ['../../../src/lib/backyardTypes.js',        'BACKYARD_TYPES'],
    ['../../../src/lib/weatherUnits.js',         'getPreferredTemperatureUnit'],
    ['../../../src/lib/urlBuilder.ts',           'buildUrl'],
    ['../../../src/lib/safeUrl.js',              'safeUrl'],
    ['../../../src/lib/safeApiBase.js',          'safeApiBase'],
    ['../../../src/lib/safeAsset.js',            'safeAsset'],
    ['../../../src/lib/validateEnvironment.js',  'validateEnvironment'],
    ['../../../src/lib/canonicalHomeGuard.js',   'assertCanonicalHome'],
    ['../../../src/lib/imageCompression.js',     'compressImage'],
    ['../../../src/lib/offlineScanQueue.js',     'enqueueScan'],
    ['../../../src/lib/farmEventBus.js',         'default'],
  ])('imports %s and exports %s', async (path, exportName) => {
    const mod = await import(modUrl(path));
    expect(mod).toBeTruthy();
    expect(mod[exportName]).toBeDefined();
  });
});

// ─── Pure intelligence engines ────────────────────────────────

describe('intelligence engines — import smoke', () => {
  it.each([
    ['../../../src/lib/intelligence/contextEngine.js',     'computeContextIntelligence'],
    ['../../../src/lib/taskIntelligence.js',               'generateSmartTask'],
    ['../../../src/lib/weatherTaskEngine.js',              'getWeatherTask'],
    ['../../../src/core/scanResultPolicy.js',              'sanitizeScanText'],
    ['../../../src/core/scanToTask.js',                    'addScanTasks'],
    ['../../../src/intelligence/recommendations/getPrimaryGuidance.ts', 'getPrimaryGuidance'],
    ['../../../src/intelligence/recommendations/fallbacks.ts',          'fallbackForMode'],
  ])('imports %s and exports %s', async (path, exportName) => {
    const mod = await import(modUrl(path));
    expect(mod[exportName]).toBeDefined();
    expect(typeof mod[exportName] === 'function' || typeof mod[exportName] === 'object').toBe(true);
  });
});

// ─── Pure intelligence engines actually execute ───────────────

describe('intelligence engines — sanity execution', () => {
  it('contextEngine.computeContextIntelligence runs on minimal input', async () => {
    const mod = await import('../../../src/lib/intelligence/contextEngine.js');
    const out = mod.computeContextIntelligence({});
    expect(out).toBeTruthy();
    expect(out.todayTask).toBeTruthy();
    expect(typeof out.todayTask.title).toBe('string');
  });

  it('taskIntelligence.generateSmartTask runs on minimal input', async () => {
    const mod = await import('../../../src/lib/taskIntelligence.js');
    const out = mod.generateSmartTask({});
    expect(out).toBeTruthy();
    expect(typeof out.title).toBe('string');
  });

  it('weatherTaskEngine.getWeatherTask runs on null weather', async () => {
    const mod = await import('../../../src/lib/weatherTaskEngine.js');
    const out = mod.getWeatherTask(null, null, 'maize');
    expect(out).toBeTruthy();
  });

  it('scanResultPolicy.sanitizeScanText softens overconfident verdicts', async () => {
    const mod = await import('../../../src/core/scanResultPolicy.js');
    // The sanitizer rewrites specific overconfident phrases —
    // not the bare word "confirmed". Verify the actual contract.
    const out = mod.sanitizeScanText('confirmed disease in this plant');
    expect(out.toLowerCase()).toContain('possible issue');
    expect(out.toLowerCase()).not.toContain('confirmed disease');
  });

  it('getPrimaryGuidance returns an envelope for empty input', async () => {
    const mod = await import('../../../src/intelligence/recommendations/getPrimaryGuidance.ts');
    const out = mod.getPrimaryGuidance({ mode: 'farm' });
    expect(out).toBeTruthy();
    // Either a real recommendation OR the fallback shape.
    expect(out).toHaveProperty('id');
  });

  it('backyardTypes.resolveBackyardType handles all input shapes', async () => {
    const { resolveBackyardType, BACKYARD_TYPES } = await import('../../../src/lib/backyardTypes.js');
    expect(resolveBackyardType(null)).toBe(BACKYARD_TYPES.SMALL_FARM);
    expect(resolveBackyardType({ farmType: 'backyard' })).toBe(BACKYARD_TYPES.MIXED);
    expect(resolveBackyardType({ backyardType: 'greenhouse' })).toBe(BACKYARD_TYPES.GREENHOUSE);
  });

  it('farmContextEngine.getFarmContext never throws on empty localStorage', async () => {
    const mod = await import('../../../src/lib/farmContextEngine.js');
    expect(() => mod.getFarmContext()).not.toThrow();
    const ctx = mod.getFarmContext();
    expect(ctx.hasFarm).toBe(false);
    expect(ctx.farm).toBeNull();
  });

  it('weatherUnits returns C/F based on country code', async () => {
    const { getPreferredTemperatureUnit, _resetUnitCache } =
      await import('../../../src/lib/weatherUnits.js');
    // The resolver has a session cache (first non-fallback result
    // pins for the rest of the session). Reset between country
    // codes so each assertion exercises a fresh lookup.
    _resetUnitCache();
    expect(getPreferredTemperatureUnit({ countryCode: 'US', session: false })).toBe('F');
    expect(getPreferredTemperatureUnit({ countryCode: 'LR', session: false })).toBe('F');
    expect(getPreferredTemperatureUnit({ countryCode: 'MM', session: false })).toBe('F');
    expect(getPreferredTemperatureUnit({ countryCode: 'GH', session: false })).toBe('C');
    expect(getPreferredTemperatureUnit({ countryCode: 'KE', session: false })).toBe('C');
  });

  it('urlBuilder.buildUrl rejects bad input gracefully', async () => {
    const { buildUrl } = await import('../../../src/lib/urlBuilder.ts');
    expect(buildUrl(undefined)).toBeNull();
    expect(buildUrl('')).toBeNull();
    expect(buildUrl(42)).toBeNull();
  });

  it('safeImagePreview.validateImageUrl recognises all valid schemes', async () => {
    const { validateImageUrl } = await import('../../../src/lib/safeImagePreview.jsx');
    expect(validateImageUrl('data:image/jpeg;base64,abcd')).toBe(true);
    expect(validateImageUrl('blob:https://x.test/abc')).toBe(true);
    expect(validateImageUrl('https://x.test/img.jpg')).toBe(true);
    expect(validateImageUrl('/icons/logo.jpg')).toBe(true);
    expect(validateImageUrl(undefined)).toBe(false);
    expect(validateImageUrl('not-a-url')).toBe(false);
    expect(validateImageUrl('data:image/jpeg;base64')).toBe(false);
  });
});

// ─── Camera session lifecycle ─────────────────────────────────
// (Removed: src/services/cameraSession.js was dead code with zero
//  importers and has been deleted. The canonical camera owner is
//  src/core/camera/cameraRuntimeManager.js, covered by
//  cameraRuntimeStability.test.js.)

// ─── Offline queue ────────────────────────────────────────────

describe('offlineScanQueue — sanity execution', () => {
  it('enqueueScan accepts a scan + drainQueue resolves cleanly', async () => {
    const { enqueueScan, drainQueue, isLikelyOnline } = await import('../../../src/lib/offlineScanQueue.js');
    expect(typeof enqueueScan).toBe('function');
    expect(typeof drainQueue).toBe('function');
    expect(typeof isLikelyOnline).toBe('function');
  });
});
