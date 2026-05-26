/**
 * productionDiagnosticsAndTelemetry.test.js — verifies the
 * Production Incident Investigation diagnostic + recovery tools:
 *   • src/lib/productionDiagnostics.js
 *   • src/core/scan/scanTelemetry.js
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  buildBuildDiagnostic, buildLanguageTrace, readBuildIdentity,
  forceLocaleReload, clearScanSession, rebuildPreview,
  forceAssetRefresh, clearSWCaches,
  installProductionDiagnostics,
} from '../../../src/lib/productionDiagnostics.js';

import {
  SCAN_EVENTS, emitScanEvent, getScanEventLog,
  clearScanEventLog, getEventsForSession,
} from '../../../src/core/scan/scanTelemetry.js';

function _stubLocalStorage() {
  if (typeof globalThis.localStorage === 'undefined') {
    const _store = new Map();
    globalThis.localStorage = {
      getItem: (k) => _store.has(k) ? _store.get(k) : null,
      setItem: (k, v) => _store.set(k, String(v)),
      removeItem: (k) => _store.delete(k),
      clear: () => _store.clear(),
      get length() { return _store.size; },
      key: (i) => Array.from(_store.keys())[i] || null,
    };
  } else {
    try { globalThis.localStorage.clear(); } catch { /* swallow */ }
  }
}

// ─── productionDiagnostics ───────────────────────────────

describe('productionDiagnostics — readBuildIdentity', () => {
  it('returns an object even when no env vars are set', () => {
    const id = readBuildIdentity();
    expect(typeof id).toBe('object');
    expect(id).not.toBeNull();
  });
});

describe('productionDiagnostics — buildBuildDiagnostic', () => {
  beforeEach(() => { _stubLocalStorage(); delete globalThis.window; });

  it('returns the documented shape', () => {
    const snap = buildBuildDiagnostic();
    expect(snap).toBeTruthy();
    expect(typeof snap.timestamp).toBe('string');
    expect(snap.locale).toBeTruthy();
    expect(Array.isArray(snap.locale.supportedCodes)).toBe(true);
    expect(snap.locale.supportedCodes).toEqual(['en', 'fr', 'sw', 'ha', 'tw', 'hi']);
    expect(snap.scan).toBeTruthy();
    expect(typeof snap.scan.scanHistorySize).toBe('number');
  });

  it('never throws even with no environment', () => {
    expect(() => buildBuildDiagnostic()).not.toThrow();
  });
});

describe('productionDiagnostics — buildLanguageTrace', () => {
  beforeEach(() => { _stubLocalStorage(); });

  it('returns the documented shape', () => {
    const t = buildLanguageTrace();
    expect(typeof t.currentLocale).toBe('string');
    expect(Array.isArray(t.supportedLocales)).toBe(true);
    expect(t.supportedLocales).toHaveLength(6);
    expect(typeof t.rawEnglishLeaks).toBe('number');
    expect(Array.isArray(t.leakSamples)).toBe(true);
  });

  it('defaults to en when nothing is persisted', () => {
    const t = buildLanguageTrace();
    expect(t.currentLocale).toBe('en');
  });

  it('picks up the persisted locale', () => {
    localStorage.setItem('farroway:lang', 'tw');
    const t = buildLanguageTrace();
    expect(t.currentLocale).toBe('tw');
    expect(t.persisted).toBe('tw');
  });

  it('never throws on garbage state', () => {
    expect(() => buildLanguageTrace()).not.toThrow();
  });
});

describe('productionDiagnostics — recovery hooks', () => {
  beforeEach(() => { _stubLocalStorage(); delete globalThis.window; });

  it('forceLocaleReload clears the persisted locale slots', () => {
    localStorage.setItem('farroway:lang', 'tw');
    localStorage.setItem('farroway:voiceLang', 'tw');
    localStorage.setItem('farroway_lang', 'tw');
    localStorage.setItem('farroway_language', 'tw');
    forceLocaleReload();
    expect(localStorage.getItem('farroway:lang')).toBeNull();
    expect(localStorage.getItem('farroway:voiceLang')).toBeNull();
    expect(localStorage.getItem('farroway_lang')).toBeNull();
    expect(localStorage.getItem('farroway_language')).toBeNull();
  });

  it('clearScanSession is a no-op in tests but never throws', () => {
    expect(() => clearScanSession()).not.toThrow();
  });

  it('rebuildPreview returns null when no persisted session exists', () => {
    const rec = rebuildPreview();
    expect(rec).toBeNull();
  });

  it('clearSWCaches resolves without throwing', async () => {
    await expect(clearSWCaches()).resolves.toBeTruthy();
  });

  it('forceAssetRefresh resolves without throwing in SSR env', async () => {
    await expect(forceAssetRefresh()).resolves.toBeTruthy();
  });
});

describe('productionDiagnostics — installProductionDiagnostics', () => {
  beforeEach(() => { delete globalThis.window; });

  it('returns false when no window is present (SSR)', () => {
    expect(installProductionDiagnostics()).toBe(false);
  });

  it('pins every hook on window (idempotent)', () => {
    globalThis.window = {};
    expect(installProductionDiagnostics()).toBe(true);
    expect(typeof globalThis.window.__farrowayBuild).toBe('function');
    expect(typeof globalThis.window.__languageTrace).toBe('function');
    expect(typeof globalThis.window.__forceLocaleReload).toBe('function');
    expect(typeof globalThis.window.__clearScanSession).toBe('function');
    expect(typeof globalThis.window.__rebuildPreview).toBe('function');
    expect(typeof globalThis.window.__forceAssetRefresh).toBe('function');
    expect(typeof globalThis.window.__clearSWCaches).toBe('function');
    expect(typeof globalThis.window.__scanTelemetry).toBe('function');
    // Idempotent — second call doesn't throw.
    expect(installProductionDiagnostics()).toBe(true);
  });
});

// ─── scanTelemetry ───────────────────────────────────────

describe('scanTelemetry', () => {
  beforeEach(() => { _stubLocalStorage(); clearScanEventLog(); });

  it('ships every documented event constant', () => {
    const required = [
      'SCAN_START', 'IMAGE_CAPTURED', 'IMAGE_NORMALIZED', 'PREVIEW_READY',
      'UPLOAD_STARTED', 'UPLOAD_SUCCESS', 'UPLOAD_FAILED',
      'AI_REQUEST_STARTED', 'AI_RESPONSE_RECEIVED', 'AI_REQUEST_FAILED',
      'RESULT_RENDERED', 'SESSION_RECOVERED', 'PREVIEW_RESTORED',
      'SCAN_CANCELLED',
    ];
    for (const k of required) {
      expect(typeof SCAN_EVENTS[k]).toBe('string');
    }
  });

  it('emitScanEvent appends + persists', () => {
    expect(emitScanEvent(SCAN_EVENTS.SCAN_START, { sessionId: 'a' })).toBe(true);
    const log = getScanEventLog();
    expect(log).toHaveLength(1);
    expect(log[0].event).toBe('SCAN_START');
    expect(log[0].sessionId).toBe('a');
    expect(typeof log[0].timestampMs).toBe('number');
  });

  it('strips large dataURL payloads to length hints', () => {
    const long = 'x'.repeat(500);
    emitScanEvent(SCAN_EVENTS.PREVIEW_READY, { sessionId: 'a', dataUrl: long });
    const log = getScanEventLog();
    expect(log[0].payload.dataUrl).toBe('<500 chars>');
  });

  it('caps the log at MAX_EVENTS (rolling buffer)', () => {
    for (let i = 0; i < 250; i++) emitScanEvent(SCAN_EVENTS.SCAN_START, { sessionId: 'i' + i });
    const log = getScanEventLog();
    expect(log.length).toBeLessThanOrEqual(200);
  });

  it('getEventsForSession filters correctly', () => {
    emitScanEvent(SCAN_EVENTS.SCAN_START, { sessionId: 'a' });
    emitScanEvent(SCAN_EVENTS.SCAN_START, { sessionId: 'b' });
    emitScanEvent(SCAN_EVENTS.PREVIEW_READY, { sessionId: 'a' });
    const a = getEventsForSession('a');
    expect(a).toHaveLength(2);
    expect(a.every((r) => r.sessionId === 'a')).toBe(true);
  });

  it('clearScanEventLog wipes the log', () => {
    emitScanEvent(SCAN_EVENTS.SCAN_START, { sessionId: 'a' });
    clearScanEventLog();
    expect(getScanEventLog()).toEqual([]);
  });

  it('returns false for invalid event names', () => {
    expect(emitScanEvent('', {})).toBe(false);
    expect(emitScanEvent(null, {})).toBe(false);
    expect(emitScanEvent(undefined, {})).toBe(false);
  });

  it('never throws on garbage payload', () => {
    expect(() => emitScanEvent(SCAN_EVENTS.SCAN_START, undefined)).not.toThrow();
    expect(() => emitScanEvent(SCAN_EVENTS.SCAN_START, null)).not.toThrow();
    expect(() => emitScanEvent(SCAN_EVENTS.SCAN_START, 'not an object')).not.toThrow();
  });
});
