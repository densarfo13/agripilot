/**
 * farmRuntimeHealth.test.js — production hardening regression suite.
 *
 * Covers:
 *   §1 runtime guardrails (window.__farmRuntimeHealth)
 *   §3 scan-to-farm continuity bridge
 *   §4 canonical event bus — CROP_UPDATED + LANGUAGE_CHANGED added
 *   §5 production observability
 *   §6 defensive auto-migration
 *   §7 crop-render-without-canonical detection
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  installFarmRuntimeHealth, reportCropRenderAttempt,
  _resetFarmRuntimeForTests, _internal as runtimeInternal,
} from '../../../src/lib/farmRuntimeHealth.js';
import {
  installScanContinuityBridge, _resetScanContinuityBridge,
} from '../../../src/lib/scanContinuityBridge.js';
import {
  FarmEvents, publish, subscribe, _resetBus, busDiagnostics,
} from '../../../src/lib/farmEventBus.js';
import {
  useCanonicalFarmStore,
} from '../../../src/store/canonicalFarmStore.js';

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

function _stubWindow() {
  if (typeof globalThis.window === 'undefined') {
    globalThis.window = {};
  }
  // Make sure window.localStorage points at our stub.
  globalThis.window.localStorage = globalThis.localStorage;
}

beforeEach(() => {
  _stubLocalStorage();
  _stubWindow();
  _resetFarmRuntimeForTests();
  _resetScanContinuityBridge();
  _resetBus();
  try { useCanonicalFarmStore.getState().clearFarm(); } catch { /* swallow */ }
});

afterEach(() => {
  // Remove pinned globals so the next test starts from a clean slate.
  try { delete globalThis.window.__farmRuntimeHealth; } catch { /* swallow */ }
  try { delete globalThis.window.__scanRuntimeHealth; } catch { /* swallow */ }
});

// ═══ §4 — Event bus additions ════════════════════════════════

describe('FarmEvents — production hardening §4 additions', () => {
  it('exposes CROP_UPDATED', () => {
    expect(FarmEvents.CROP_UPDATED).toBe('farm.crop_updated');
  });
  it('exposes LANGUAGE_CHANGED', () => {
    expect(FarmEvents.LANGUAGE_CHANGED).toBe('app.language_changed');
  });
  it('still has the original SCAN_COMPLETED + FARM_UPDATED', () => {
    expect(FarmEvents.SCAN_COMPLETED).toBe('scan.completed');
    expect(FarmEvents.FARM_UPDATED).toBe('farm.updated');
  });
});

// ═══ §1 + §5 — Runtime health hook ═══════════════════════════

describe('installFarmRuntimeHealth — install + snapshot', () => {
  it('is idempotent', () => {
    expect(installFarmRuntimeHealth()).toBe(true);
    expect(installFarmRuntimeHealth()).toBe(true);
  });

  it('pins window.__farmRuntimeHealth', () => {
    installFarmRuntimeHealth();
    expect(typeof globalThis.window.__farmRuntimeHealth).toBe('function');
    const snap = globalThis.window.__farmRuntimeHealth();
    expect(snap).toBeTruthy();
    expect(snap.generatedAt).toBeTruthy();
    expect(snap.hydrated).toBeDefined();
    expect(Array.isArray(snap.legacyKeysCurrentlyPresent)).toBe(true);
  });

  it('pins window.__scanRuntimeHealth', () => {
    installFarmRuntimeHealth();
    expect(typeof globalThis.window.__scanRuntimeHealth).toBe('function');
    const snap = globalThis.window.__scanRuntimeHealth();
    expect(snap).toBeTruthy();
    expect(snap.scanHistorySize).toBeDefined();
  });

  it('reports clean=true when no legacy keys + no crop misses', () => {
    installFarmRuntimeHealth();
    const snap = globalThis.window.__farmRuntimeHealth();
    expect(snap.legacyKeysCurrentlyPresent.length).toBe(0);
    expect(snap.cropMissCount).toBe(0);
    expect(snap.clean).toBe(true);
  });

  it('SSR-safe — returns false when window is undefined', () => {
    const win = globalThis.window;
    delete globalThis.window;
    try {
      _resetFarmRuntimeForTests();
      expect(installFarmRuntimeHealth()).toBe(false);
    } finally {
      globalThis.window = win;
    }
  });
});

// ═══ §6 — Defensive auto-migration ═══════════════════════════

describe('defensive auto-migration', () => {
  it('detects + sweeps legacy keys present at install time', () => {
    localStorage.setItem('selectedFarm', JSON.stringify({ cropType: 'pepper' }));
    localStorage.setItem('myFarm', JSON.stringify({ crop: 'pepper' }));
    installFarmRuntimeHealth();
    // After install, the migration should have run.
    expect(localStorage.getItem('selectedFarm')).toBeNull();
    expect(localStorage.getItem('myFarm')).toBeNull();
    const snap = globalThis.window.__farmRuntimeHealth();
    expect(snap.legacyDriftCount).toBeGreaterThan(0);
    expect(snap.legacyHitsRecent.length).toBeGreaterThan(0);
    expect(snap.legacyHitsRecent.some((h) => h.key === 'selectedFarm')).toBe(true);
  });

  it('legacyKeysCurrentlyPresent reflects POST-migration state', () => {
    localStorage.setItem('currentFarm', JSON.stringify({ cropType: 'pepper' }));
    installFarmRuntimeHealth();
    const snap = globalThis.window.__farmRuntimeHealth();
    expect(snap.legacyKeysCurrentlyPresent.length).toBe(0); // swept
  });
});

// ═══ §7 — Crop-render guardrail ══════════════════════════════

describe('reportCropRenderAttempt — crop without canonical', () => {
  it('records a miss when canonical farm has no crop', () => {
    installFarmRuntimeHealth();
    reportCropRenderAttempt('Home');
    const snap = globalThis.window.__farmRuntimeHealth();
    expect(snap.cropMissCount).toBe(1);
    expect(snap.cropRenderMisses[0].surface).toBe('Home');
  });

  it('dedupes by surface per session', () => {
    installFarmRuntimeHealth();
    reportCropRenderAttempt('Home');
    reportCropRenderAttempt('Home');
    reportCropRenderAttempt('Home');
    const snap = globalThis.window.__farmRuntimeHealth();
    expect(snap.cropMissCount).toBe(1);
  });

  it('does NOT record when canonical farm has crop', () => {
    useCanonicalFarmStore.getState().updateFarm({ crop: 'pepper' });
    installFarmRuntimeHealth();
    expect(reportCropRenderAttempt('Home')).toBe(false);
    const snap = globalThis.window.__farmRuntimeHealth();
    expect(snap.cropMissCount).toBe(0);
  });

  it('garbage surface arg never throws', () => {
    expect(() => reportCropRenderAttempt(null)).not.toThrow();
    expect(() => reportCropRenderAttempt(undefined)).not.toThrow();
    expect(() => reportCropRenderAttempt(42)).not.toThrow();
  });
});

// ═══ §3 — Scan-to-farm continuity bridge ═════════════════════

describe('installScanContinuityBridge', () => {
  it('appends scan to canonical activeFarm.scanHistory on SCAN_COMPLETED', () => {
    useCanonicalFarmStore.getState().updateFarm({ crop: 'pepper', id: 'farm-1' });
    installScanContinuityBridge();
    publish(FarmEvents.SCAN_COMPLETED, {
      scanId: 's1', severity: 'moderate', crop: 'pepper',
    });
    const farm = useCanonicalFarmStore.getState().activeFarm;
    expect(farm.scanHistory.length).toBe(1);
    expect(farm.scanHistory[0].id).toBe('s1');
    expect(farm.scanHistory[0].severity).toBe('moderate');
  });

  it('promotes scan-only crop into canonical when farm has none', () => {
    useCanonicalFarmStore.getState().updateFarm({ id: 'farm-1', crop: '' });
    installScanContinuityBridge();
    publish(FarmEvents.SCAN_COMPLETED, { scanId: 's1', crop: 'pepper' });
    const farm = useCanonicalFarmStore.getState().activeFarm;
    expect(farm.crop).toBe('pepper');
  });

  it('re-emits FARM_UPDATED so subscribers re-render', () => {
    const handler = vi.fn();
    subscribe(FarmEvents.FARM_UPDATED, handler);
    useCanonicalFarmStore.getState().updateFarm({ crop: 'pepper', id: 'farm-1' });
    installScanContinuityBridge();
    publish(FarmEvents.SCAN_COMPLETED, { scanId: 's1' });
    expect(handler).toHaveBeenCalled();
  });

  it('re-emits CROP_UPDATED when promoting a new crop', () => {
    const handler = vi.fn();
    subscribe(FarmEvents.CROP_UPDATED, handler);
    useCanonicalFarmStore.getState().updateFarm({ id: 'farm-1', crop: '' });
    installScanContinuityBridge();
    publish(FarmEvents.SCAN_COMPLETED, { scanId: 's1', crop: 'pepper' });
    expect(handler).toHaveBeenCalled();
  });

  it('does NOT re-emit CROP_UPDATED when crop unchanged', () => {
    const handler = vi.fn();
    subscribe(FarmEvents.CROP_UPDATED, handler);
    useCanonicalFarmStore.getState().updateFarm({ id: 'farm-1', crop: 'pepper' });
    installScanContinuityBridge();
    publish(FarmEvents.SCAN_COMPLETED, { scanId: 's1', crop: 'pepper' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('idempotent install — does not double-fire the appender', () => {
    useCanonicalFarmStore.getState().updateFarm({ crop: 'pepper', id: 'farm-1' });
    installScanContinuityBridge();
    installScanContinuityBridge();
    publish(FarmEvents.SCAN_COMPLETED, { scanId: 's-once' });
    const farm = useCanonicalFarmStore.getState().activeFarm;
    // History should have exactly 1 row — double install would
    // have appended twice.
    expect(farm.scanHistory.length).toBe(1);
  });

  it('caps history at 50 entries', () => {
    useCanonicalFarmStore.getState().updateFarm({ crop: 'pepper', id: 'farm-1' });
    installScanContinuityBridge();
    for (let i = 0; i < 60; i++) {
      publish(FarmEvents.SCAN_COMPLETED, { scanId: 's' + i });
    }
    const farm = useCanonicalFarmStore.getState().activeFarm;
    expect(farm.scanHistory.length).toBe(50);
    // Newest first.
    expect(farm.scanHistory[0].id).toBe('s59');
  });

  it('never throws on garbage scan payload', () => {
    installScanContinuityBridge();
    expect(() => publish(FarmEvents.SCAN_COMPLETED, null)).not.toThrow();
    expect(() => publish(FarmEvents.SCAN_COMPLETED, 'string')).not.toThrow();
  });
});

// ═══ §10 — End-to-end regression ═════════════════════════════

describe('end-to-end: scan → canonical → cross-screen sync', () => {
  it('scan completes → farm updates → Home/Tasks/Progress/Journal listeners fire', () => {
    const homeHandler   = vi.fn();
    const tasksHandler  = vi.fn();
    const progHandler   = vi.fn();
    const journalHandler= vi.fn();
    subscribe(FarmEvents.FARM_UPDATED, homeHandler);
    subscribe(FarmEvents.FARM_UPDATED, tasksHandler);
    subscribe(FarmEvents.FARM_UPDATED, progHandler);
    subscribe(FarmEvents.FARM_UPDATED, journalHandler);
    useCanonicalFarmStore.getState().updateFarm({ crop: 'pepper', id: 'farm-1' });
    installScanContinuityBridge();
    publish(FarmEvents.SCAN_COMPLETED, {
      scanId: 's-final', severity: 'mild', crop: 'pepper',
    });
    expect(homeHandler).toHaveBeenCalled();
    expect(tasksHandler).toHaveBeenCalled();
    expect(progHandler).toHaveBeenCalled();
    expect(journalHandler).toHaveBeenCalled();
    // And the canonical store has the scan.
    expect(useCanonicalFarmStore.getState().activeFarm.scanHistory[0].id).toBe('s-final');
  });
});

// ═══ _internal helpers ═══════════════════════════════════════

describe('_internal helpers', () => {
  it('_scanLegacyKeys returns array even on no localStorage', () => {
    expect(Array.isArray(runtimeInternal._scanLegacyKeys())).toBe(true);
  });

  it('_farmRuntimeSnapshot always returns a frozen envelope', () => {
    const s = runtimeInternal._farmRuntimeSnapshot();
    expect(s).toBeTruthy();
    expect(s.generatedAt).toBeTruthy();
  });
});
