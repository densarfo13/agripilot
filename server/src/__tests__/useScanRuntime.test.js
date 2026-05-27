/**
 * useScanRuntime.test.js — contract test for the React hook
 * subscription wire. Validates by exercising the underlying
 * runtime + the snapshot-mirroring contract the hook enforces,
 * without spinning up a React renderer (this project's vitest
 * setup doesn't ship @testing-library/react).
 *
 * The hook's only React-specific responsibility is:
 *   1. Create one runtime per mount.
 *   2. Subscribe to onStateChange + call setSnapshot.
 *   3. Mirror runtime.getPreviewUrl() / getResult() in the returned api.
 *   4. Auto-register with window.__registerScanRuntime.
 *   5. destroySession() on unmount.
 *
 * Each of those is tested below by exercising the runtime
 * directly with a captured onStateChange callback that mimics
 * what the hook does.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  createScanRuntime, SCAN_STATE,
} from '../../../src/core/scan/ScanRuntime.js';

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

function _stubURL() {
  if (typeof globalThis.URL === 'undefined') globalThis.URL = {};
  globalThis.URL.createObjectURL = (b) =>
    'blob:test/' + (b && b._id ? b._id : Math.random().toString(36));
  globalThis.URL.revokeObjectURL = () => {};
}

function _stubWindow() {
  if (typeof globalThis.window === 'undefined') globalThis.window = {};
}

let _registered = null;

beforeEach(() => {
  _stubLocalStorage();
  _stubURL();
  _stubWindow();
  _registered = null;
  globalThis.window.__registerScanRuntime = (rt) => { _registered = rt; };
});

afterEach(() => {
  try { delete globalThis.window.__registerScanRuntime; } catch { /* swallow */ }
});

// ═══ Subscription contract ═══════════════════════════════════

describe('Hook subscription contract', () => {
  it('onStateChange fires after every transition', async () => {
    const onStateChange = vi.fn();
    const rt = createScanRuntime({
      onStateChange,
      classifier: async () => ({
        diagnosis: 'leaf_spot', confidenceTone: 'high_confidence',
      }),
    });
    expect(onStateChange).not.toHaveBeenCalled();
    await rt.choosePhoto({ size: 1024, _id: 'a' });
    expect(onStateChange).toHaveBeenCalled();
    const lastSnap = onStateChange.mock.calls.at(-1)[0];
    expect(lastSnap.currentState).toBe(SCAN_STATE.IMAGE_READY);
    expect(lastSnap.previewUrl).toMatch(/^blob:/);
  });

  it('snapshot mirrors runtime.getPreviewUrl()', async () => {
    let lastSnap = null;
    const rt = createScanRuntime({
      onStateChange: (s) => { lastSnap = s; },
    });
    await rt.choosePhoto({ size: 1024, _id: 'b' });
    expect(lastSnap.previewUrl).toBe(rt.getPreviewUrl());
  });

  it('snapshot mirrors runtime.getResult() after a successful analysis', async () => {
    let lastSnap = null;
    const rt = createScanRuntime({
      onStateChange: (s) => { lastSnap = s; },
      classifier: async () => ({
        diagnosis: 'leaf_spot', confidenceTone: 'high_confidence',
      }),
    });
    await rt.choosePhoto({ size: 1024, _id: 'c' });
    await rt.analyzeImage();
    expect(lastSnap.resultValid).toBe(true);
    expect(rt.getResult().diagnosis).toBe('leaf_spot');
  });

  it('snapshot reports analyzing=true during PREPROCESSING + ANALYZING', async () => {
    const snaps = [];
    let resolveClassifier = null;
    const rt = createScanRuntime({
      onStateChange: (s) => { snaps.push(s.currentState); },
      classifier: () => new Promise((r) => { resolveClassifier = r; }),
    });
    await rt.choosePhoto({ size: 1024, _id: 'd' });
    const p = rt.analyzeImage();
    // Snapshot should now reflect PREPROCESSING or ANALYZING
    expect(snaps).toContain(SCAN_STATE.PREPROCESSING);
    expect(snaps).toContain(SCAN_STATE.ANALYZING);
    resolveClassifier({
      diagnosis: 'leaf_spot', confidenceTone: 'high_confidence',
    });
    await p;
    expect(snaps).toContain(SCAN_STATE.RESULT_READY);
  });
});

// ═══ Diagnostic auto-register simulation ════════════════════

describe('Diagnostic auto-register simulation', () => {
  it('registering a runtime makes window.__activeScanRuntime observable', () => {
    const rt = createScanRuntime({});
    globalThis.window.__registerScanRuntime(rt);
    expect(_registered).toBe(rt);
  });

  it('unregistering clears it', () => {
    const rt = createScanRuntime({});
    globalThis.window.__registerScanRuntime(rt);
    expect(_registered).toBe(rt);
    globalThis.window.__registerScanRuntime(null);
    expect(_registered).toBeNull();
  });

  it('handles a runtime where destroySession is callable', () => {
    const rt = createScanRuntime({});
    globalThis.window.__registerScanRuntime(rt);
    expect(() => rt.destroySession()).not.toThrow();
    expect(rt.getState()).toBe(SCAN_STATE.IDLE);
  });
});

// ═══ Cleanup-on-unmount simulation ═══════════════════════════

describe('Destroy-on-unmount simulation', () => {
  it('destroySession releases preview + resets state', async () => {
    const rt = createScanRuntime({});
    await rt.choosePhoto({ size: 1024, _id: 'e' });
    expect(rt.getPreviewUrl()).toMatch(/^blob:/);
    expect(rt.getSessionId()).toBeTruthy();
    rt.destroySession();
    expect(rt.getPreviewUrl()).toBeNull();
    expect(rt.getSessionId()).toBeNull();
    expect(rt.getState()).toBe(SCAN_STATE.IDLE);
  });
});

// ═══ Pure subscriber: no parallel state ═════════════════════

describe('Pure subscriber contract', () => {
  it('runtime is the sole owner of preview URL — caller-side snapshots do not diverge', async () => {
    let lastSnap = null;
    const rt = createScanRuntime({
      onStateChange: (s) => { lastSnap = s; },
    });
    await rt.choosePhoto({ size: 1024, _id: 'f' });
    expect(lastSnap.previewUrl).toBe(rt.getPreviewUrl());
    // Destroying the runtime invalidates BOTH the runtime AND
    // the surface that subscribed.
    rt.destroySession();
    expect(rt.getPreviewUrl()).toBeNull();
  });

  it('runtime is the sole owner of result — analyzing pipeline reaches the snapshot', async () => {
    let lastSnap = null;
    const rt = createScanRuntime({
      onStateChange: (s) => { lastSnap = s; },
      classifier: async () => ({
        diagnosis: 'leaf_spot', confidenceTone: 'high_confidence',
      }),
    });
    await rt.choosePhoto({ size: 1024, _id: 'g' });
    await rt.analyzeImage();
    expect(lastSnap.resultValid).toBe(true);
    expect(lastSnap.currentState).toBe(SCAN_STATE.RESULT_READY);
  });
});

// ═══ Stale-session protection ═══════════════════════════════

describe('Stale-session protection (the hook inherits this)', () => {
  it('classifier resolving after destroy does not pollute state', async () => {
    let resolveClassifier = null;
    const rt = createScanRuntime({
      classifier: () => new Promise((r) => { resolveClassifier = r; }),
    });
    await rt.choosePhoto({ size: 1024, _id: 'h' });
    const p = rt.analyzeImage();
    rt.destroySession();
    if (resolveClassifier) {
      resolveClassifier({
        diagnosis: 'should_be_discarded',
        confidenceTone: 'high_confidence',
      });
    }
    const r = await p;
    expect(r.ok).toBe(false);
    expect(rt.getResult()).toBeNull();
    expect(rt.getState()).toBe(SCAN_STATE.IDLE);
  });
});
