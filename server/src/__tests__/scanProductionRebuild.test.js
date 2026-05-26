/**
 * scanProductionRebuild.test.js — verifies the four primitives
 * shipped for the Scan Production Rebuild:
 *   • src/core/scan/mobileCameraLifecycle.js
 *   • src/i18n/atomicLocaleSwitch.js
 *   • src/core/scan/scanLifecycleStateMachine.js (spec aliases)
 *   • src/core/scan/scanDiagnosticsBridge.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  installMobileCameraLifecycle,
  uninstallMobileCameraLifecycle,
  subscribeMobileCameraLifecycle,
  forceRehydrateCamera,
  getMobileCameraLifecycleSnapshot,
  _internal as cameraLifecycleInternal,
} from '../../../src/core/scan/mobileCameraLifecycle.js';

import {
  setLanguageAtomic, awaitLocaleReady, subscribeAtomicLocaleSwitch,
  _resetForTests as resetAtomicLocale,
} from '../../../src/i18n/atomicLocaleSwitch.js';

import {
  LIFECYCLE_STATE, LIFECYCLE_STATE_SPEC,
  toSpecState, fromSpecState,
} from '../../../src/core/scan/scanLifecycleStateMachine.js';

import {
  installScanDiagnosticsBridge,
  uninstallScanDiagnosticsBridge,
  getScanDiagnosticsBridgeSnapshot,
} from '../../../src/core/scan/scanDiagnosticsBridge.js';

// ─── Common test stubs ──────────────────────────────────

function _stubDom() {
  const listeners = new Map();
  globalThis.document = {
    visibilityState: 'visible',
    addEventListener: (type, fn) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener: (type, fn) => {
      if (listeners.has(type)) listeners.get(type).delete(fn);
    },
    _fire: (type, evObj) => {
      if (!listeners.has(type)) return;
      for (const fn of listeners.get(type)) {
        try { fn(evObj || { type }); } catch { /* swallow */ }
      }
    },
  };
  const winListeners = new Map();
  globalThis.window = {
    addEventListener: (type, fn) => {
      if (!winListeners.has(type)) winListeners.set(type, new Set());
      winListeners.get(type).add(fn);
    },
    removeEventListener: (type, fn) => {
      if (winListeners.has(type)) winListeners.get(type).delete(fn);
    },
    dispatchEvent: (ev) => {
      if (!winListeners.has(ev.type)) return true;
      for (const fn of winListeners.get(ev.type)) {
        try { fn(ev); } catch { /* swallow */ }
      }
      return true;
    },
    _fire: (type, evObj) => {
      if (!winListeners.has(type)) return;
      for (const fn of winListeners.get(type)) {
        try { fn(evObj || { type }); } catch { /* swallow */ }
      }
    },
  };
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init) {
      this.type = type;
      this.detail = (init && init.detail) || null;
    }
  };
}

function _teardownDom() {
  delete globalThis.document;
  delete globalThis.window;
  delete globalThis.CustomEvent;
}

// ─── mobileCameraLifecycle ─────────────────────────────

describe('mobileCameraLifecycle', () => {
  beforeEach(() => {
    cameraLifecycleInternal._resetForTests();
    _stubDom();
  });

  it('install + uninstall is idempotent + reflects snapshot', () => {
    expect(installMobileCameraLifecycle({
      videoElRef:    () => null,
      restartCamera: async () => ({ ok: true }),
      stopCamera:    () => {},
    }).uninstall).toBeTruthy();
    expect(getMobileCameraLifecycleSnapshot().installed).toBe(true);
    expect(getMobileCameraLifecycleSnapshot().state).toBe('active');
    // Second install — replaces callbacks, doesn't double-register.
    installMobileCameraLifecycle({
      videoElRef:    () => null,
      restartCamera: async () => ({ ok: true }),
      stopCamera:    () => {},
    });
    expect(getMobileCameraLifecycleSnapshot().installed).toBe(true);
    uninstallMobileCameraLifecycle();
    expect(getMobileCameraLifecycleSnapshot().installed).toBe(false);
    expect(getMobileCameraLifecycleSnapshot().state).toBe('idle');
    // Second uninstall — no throw.
    expect(() => uninstallMobileCameraLifecycle()).not.toThrow();
  });

  it('visibility hidden transitions to HIDDEN state', () => {
    installMobileCameraLifecycle({
      videoElRef:    () => null,
      restartCamera: async () => ({ ok: true }),
      stopCamera:    () => {},
    });
    globalThis.document.visibilityState = 'hidden';
    globalThis.document._fire('visibilitychange');
    expect(getMobileCameraLifecycleSnapshot().state).toBe('hidden');
    expect(getMobileCameraLifecycleSnapshot().hideEvents).toBeGreaterThan(0);
    globalThis.document.visibilityState = 'visible';
    globalThis.document._fire('visibilitychange');
    expect(getMobileCameraLifecycleSnapshot().state).toBe('active');
    uninstallMobileCameraLifecycle();
  });

  it('pageshow with persisted=true triggers forced rehydrate', async () => {
    let restartCalls = 0;
    installMobileCameraLifecycle({
      videoElRef:    () => null,
      restartCamera: async () => { restartCalls += 1; return { ok: true }; },
      stopCamera:    () => {},
    });
    globalThis.window._fire('pageshow', { type: 'pageshow', persisted: true });
    // Wait one tick — forceRehydrate awaits a 200ms breath.
    await new Promise((r) => setTimeout(r, 300));
    expect(restartCalls).toBe(1);
    expect(getMobileCameraLifecycleSnapshot().rehydrateCount).toBe(1);
    uninstallMobileCameraLifecycle();
  });

  it('subscriber receives heartbeat events', () => {
    const events = [];
    const unsub = subscribeMobileCameraLifecycle((p) => events.push(p));
    installMobileCameraLifecycle({
      videoElRef:    () => null,
      restartCamera: async () => ({ ok: true }),
      stopCamera:    () => {},
    });
    expect(events.length).toBeGreaterThan(0);
    expect(events.some((e) => e.event === 'installed')).toBe(true);
    unsub();
    uninstallMobileCameraLifecycle();
  });

  it('forceRehydrateCamera coalesces concurrent calls', async () => {
    let restartCalls = 0;
    installMobileCameraLifecycle({
      videoElRef:    () => null,
      restartCamera: async () => {
        restartCalls += 1;
        await new Promise((r) => setTimeout(r, 30));
        return { ok: true };
      },
      stopCamera: () => {},
    });
    const [a, b] = await Promise.all([forceRehydrateCamera(), forceRehydrateCamera()]);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    // Both promises resolve from the SAME in-flight rehydrate.
    expect(restartCalls).toBe(1);
    uninstallMobileCameraLifecycle();
  });

  it('forceRehydrateCamera returns not_installed when nothing is installed', async () => {
    const r = await forceRehydrateCamera();
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('not_installed');
  });

  it('never throws on garbage opts', () => {
    expect(() => installMobileCameraLifecycle(null)).not.toThrow();
    expect(() => installMobileCameraLifecycle({})).not.toThrow();
    uninstallMobileCameraLifecycle();
  });
});

// ─── atomicLocaleSwitch ────────────────────────────────

describe('atomicLocaleSwitch', () => {
  beforeEach(() => {
    resetAtomicLocale();
  });

  it('coerces unsupported locales to the default (en) via normalizeLocale', async () => {
    // normalizeLocale falls back to 'en' for any unknown input; the
    // atomic switch trusts that contract rather than re-validating.
    // English is bundled, so the cache-hit path resolves with ok=true.
    const r = await setLanguageAtomic('zz');
    expect(r.code).toBe('en');
    expect(r.ok).toBe(true);
  });

  it('coerces region suffix before switching', async () => {
    const r = await setLanguageAtomic('fr-CA');
    expect(r.code).toBe('fr');
  });

  it('awaitLocaleReady returns true immediately for en', async () => {
    const ok = await awaitLocaleReady({ code: 'en' });
    expect(ok).toBe(true);
  });

  it('awaitLocaleReady never throws on garbage opts', async () => {
    await expect(awaitLocaleReady(null)).resolves.toBeTypeOf('boolean');
    await expect(awaitLocaleReady({})).resolves.toBeTypeOf('boolean');
  });

  it('subscriber receives lifecycle events', async () => {
    const events = [];
    const unsub = subscribeAtomicLocaleSwitch((e) => events.push(e));
    await setLanguageAtomic('zz');
    expect(events.some((e) => e.event === 'start')).toBe(true);
    unsub();
  });

  it('superseded switches return stale=true without flipping legacy', async () => {
    // Fire two switches in quick succession — the first should
    // resolve with stale=true once the second supersedes it.
    const first = setLanguageAtomic('fr', { timeoutMs: 200 });
    const second = setLanguageAtomic('sw', { timeoutMs: 200 });
    const [r1, r2] = await Promise.all([first, second]);
    expect(r1.stale === true || r2.stale === true).toBe(true);
  });
});

// ─── scanLifecycleStateMachine: spec aliases ──────────

describe('scanLifecycleStateMachine — spec aliases', () => {
  it('LIFECYCLE_STATE_SPEC maps every spec key to a real lifecycle state', () => {
    const validStates = new Set(Object.values(LIFECYCLE_STATE));
    for (const key of Object.keys(LIFECYCLE_STATE_SPEC)) {
      expect(validStates.has(LIFECYCLE_STATE_SPEC[key])).toBe(true);
    }
  });

  it('toSpecState produces the spec vocabulary', () => {
    expect(toSpecState(LIFECYCLE_STATE.IDLE)).toBe('IDLE');
    expect(toSpecState(LIFECYCLE_STATE.CAPTURING)).toBe('CAPTURING');
    expect(toSpecState(LIFECYCLE_STATE.NORMALIZING)).toBe('PREPROCESSING');
    expect(toSpecState(LIFECYCLE_STATE.PREVIEW_READY)).toBe('IMAGE_READY');
    expect(toSpecState(LIFECYCLE_STATE.AI_PROCESSING)).toBe('ANALYZING');
    expect(toSpecState(LIFECYCLE_STATE.AI_COMPLETE)).toBe('SUCCESS');
    expect(toSpecState(LIFECYCLE_STATE.LOW_CONFIDENCE)).toBe('LOW_CONFIDENCE');
    expect(toSpecState(LIFECYCLE_STATE.RECOVERABLE_ERROR)).toBe('RECOVERABLE_ERROR');
    expect(toSpecState(LIFECYCLE_STATE.FAILED)).toBe('FATAL_ERROR');
  });

  it('fromSpecState is a left-inverse', () => {
    for (const key of Object.keys(LIFECYCLE_STATE_SPEC)) {
      expect(fromSpecState(key)).toBe(LIFECYCLE_STATE_SPEC[key]);
    }
  });

  it('fromSpecState handles garbage', () => {
    expect(fromSpecState(null)).toBe(LIFECYCLE_STATE.IDLE);
    expect(fromSpecState('GARBAGE')).toBe(LIFECYCLE_STATE.IDLE);
    expect(fromSpecState(42)).toBe(LIFECYCLE_STATE.IDLE);
  });
});

// ─── scanDiagnosticsBridge ─────────────────────────────

describe('scanDiagnosticsBridge', () => {
  beforeEach(() => {
    _stubDom();
    uninstallScanDiagnosticsBridge();
  });

  it('install + uninstall is idempotent', () => {
    expect(installScanDiagnosticsBridge()).toBe(true);
    expect(getScanDiagnosticsBridgeSnapshot().installed).toBe(true);
    expect(installScanDiagnosticsBridge()).toBe(false);
    uninstallScanDiagnosticsBridge();
    expect(getScanDiagnosticsBridgeSnapshot().installed).toBe(false);
  });

  it('reports sentryAvailable=false when no global Sentry', () => {
    installScanDiagnosticsBridge();
    expect(getScanDiagnosticsBridgeSnapshot().sentryAvailable).toBe(false);
    uninstallScanDiagnosticsBridge();
  });

  it('never throws on uninstall without install', () => {
    expect(() => uninstallScanDiagnosticsBridge()).not.toThrow();
  });
});
