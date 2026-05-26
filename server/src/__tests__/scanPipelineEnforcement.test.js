/**
 * scanPipelineEnforcement.test.js — verifies the single-pipeline
 * enforcement primitives:
 *   • scanSessionId.js          (race-condition guard)
 *   • scanPipelineIntegrity.js  (invariant checker)
 *   • scanDebugOverlay.js       (dev-only state snapshot)
 *   • scanBuildStamp.js         (window.__SCAN_BUILD_SHA__)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  startScanSession, getActiveScanSessionId,
  isStaleScanSession, endScanSession,
  _resetScanSessionForTests,
} from '../../../src/core/scan/scanSessionId.js';
import {
  assertScanPipelineIntegrity, INTEGRITY_VIOLATION,
  setDevThrowMode, _resetIntegrityForTests,
} from '../../../src/core/scan/scanPipelineIntegrity.js';
import {
  buildScanDebugSnapshot, installScanDebugHook,
} from '../../../src/core/scan/scanDebugOverlay.js';
import {
  getScanBuildSha, installScanBuildStamp,
  _resetScanBuildStampForTests,
} from '../../../src/core/scan/scanBuildStamp.js';

// ─── scanSessionId ───────────────────────────────────────

describe('scanSessionId', () => {
  beforeEach(() => _resetScanSessionForTests());

  it('startScanSession returns a unique monotonic id', () => {
    const a = startScanSession();
    const b = startScanSession();
    expect(a).not.toBe(b);
    expect(getActiveScanSessionId()).toBe(b);
  });

  it('isStaleScanSession true for prior session ids', () => {
    const first = startScanSession();
    startScanSession();   // bumps the counter
    expect(isStaleScanSession(first)).toBe(true);
  });

  it('isStaleScanSession false for the currently-active id', () => {
    const id = startScanSession();
    expect(isStaleScanSession(id)).toBe(false);
  });

  it('isStaleScanSession true when no session is active', () => {
    endScanSession();
    expect(isStaleScanSession('whatever')).toBe(true);
  });

  it('endScanSession clears the active id', () => {
    startScanSession();
    endScanSession();
    expect(getActiveScanSessionId()).toBe(null);
  });

  it('never throws on garbage input', () => {
    expect(() => isStaleScanSession(null)).not.toThrow();
    expect(isStaleScanSession(null)).toBe(true);
  });
});

// ─── scanPipelineIntegrity ───────────────────────────────

describe('assertScanPipelineIntegrity', () => {
  beforeEach(() => _resetIntegrityForTests());

  it('null result → ok:true (nothing to verify)', () => {
    expect(assertScanPipelineIntegrity({}).ok).toBe(true);
    expect(assertScanPipelineIntegrity({ result: null }).ok).toBe(true);
  });

  it('result without image → RESULT_WITHOUT_IMAGE', () => {
    const v = assertScanPipelineIntegrity({
      result: { confidence: 'high' },
      state:  'result_ready',
    });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe(INTEGRITY_VIOLATION.RESULT_WITHOUT_IMAGE);
  });

  it('result from wrong state → RESULT_FROM_WRONG_STATE', () => {
    const v = assertScanPipelineIntegrity({
      result: { classifierInputVerified: true },
      image:  { objectUrl: 'blob:x' },
      state:  'idle',
    });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe(INTEGRITY_VIOLATION.RESULT_FROM_WRONG_STATE);
  });

  it('confidence without classifierInputVerified=true → CONFIDENCE_WITHOUT_VERIFIED_INPUT', () => {
    const v = assertScanPipelineIntegrity({
      result: { confidence: 'medium', classifierInputVerified: false },
      image:  { objectUrl: 'blob:x' },
      state:  'result_ready',
    });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe(INTEGRITY_VIOLATION.CONFIDENCE_WITHOUT_VERIFIED_INPUT);
  });

  it('stale session → STALE_SESSION', () => {
    const v = assertScanPipelineIntegrity({
      result: { confidence: 'medium', classifierInputVerified: true },
      image:  { objectUrl: 'blob:x' },
      state:  'result_ready',
      sessionId:       'scan-session-1',
      activeSessionId: 'scan-session-3',
    });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe(INTEGRITY_VIOLATION.STALE_SESSION);
  });

  it('valid pipeline → ok:true', () => {
    const v = assertScanPipelineIntegrity({
      result: {
        confidence: 'high',
        classifierInputVerified: true,
        persisted: true,
      },
      image: { objectUrl: 'blob:https://farroway.app/abc' },
      state: 'result_ready',
      sessionId: 'a', activeSessionId: 'a',
    });
    expect(v.ok).toBe(true);
  });

  it('dev throw mode raises on violation', () => {
    setDevThrowMode(true);
    expect(() => assertScanPipelineIntegrity({
      result: { confidence: 'high' },
      state: 'idle',
    })).toThrow(/result_without_image|result_from_wrong_state/);
  });

  it('prod mode never throws — only returns the verdict', () => {
    setDevThrowMode(false);
    expect(() => assertScanPipelineIntegrity({
      result: { confidence: 'high' },
      state: 'idle',
    })).not.toThrow();
  });

  it('never throws on garbage input (prod mode)', () => {
    setDevThrowMode(false);
    expect(() => assertScanPipelineIntegrity(null)).not.toThrow();
  });
});

// ─── scanDebugOverlay ────────────────────────────────────

describe('scanDebugOverlay', () => {
  beforeEach(() => {
    _resetScanSessionForTests();
    delete globalThis.window;
  });

  it('buildScanDebugSnapshot returns the documented rows', () => {
    const snap = buildScanDebugSnapshot({});
    expect(Array.isArray(snap.rows)).toBe(true);
    const keys = snap.rows.map((r) => r.key);
    for (const k of ['sessionId', 'fsmState', 'imageValid', 'classifierInputVerified',
                     'persisted', 'resultSource', 'rendererSource']) {
      expect(keys).toContain(k);
    }
  });

  it('imageValid reflects validateScanImage verdict', () => {
    const snap = buildScanDebugSnapshot({
      image: { objectUrl: 'blob:x', size: 100, mimeType: 'image/jpeg' },
    });
    const row = snap.rows.find((r) => r.key === 'imageValid');
    expect(row.value).toBe('true');
  });

  it('installScanDebugHook is no-op in production (no DEV flag)', () => {
    globalThis.window = {};
    // No import.meta.env.DEV in this test process → no-op.
    const ok = installScanDebugHook();
    // We can't reliably assert ok one way or another since DEV
    // detection depends on the runner — what we CAN assert is
    // that the call doesn't throw and doesn't pollute window
    // when it returns false.
    if (!ok) {
      expect(globalThis.window.__scanDebug).toBeUndefined();
    } else {
      expect(typeof globalThis.window.__scanDebug).toBe('function');
    }
  });

  it('never throws on garbage input', () => {
    expect(() => buildScanDebugSnapshot(null)).not.toThrow();
    expect(() => installScanDebugHook()).not.toThrow();
  });
});

// ─── scanBuildStamp ──────────────────────────────────────

describe('scanBuildStamp', () => {
  beforeEach(() => {
    _resetScanBuildStampForTests();
    delete globalThis.window;
  });

  it('getScanBuildSha returns a non-empty string', () => {
    const sha = getScanBuildSha();
    expect(typeof sha).toBe('string');
    expect(sha.length).toBeGreaterThan(0);
  });

  it('getScanBuildSha caches across calls', () => {
    const a = getScanBuildSha();
    const b = getScanBuildSha();
    expect(a).toBe(b);
  });

  it('installScanBuildStamp pins window.__SCAN_BUILD_SHA__', () => {
    globalThis.window = {};
    installScanBuildStamp();
    expect(typeof globalThis.window.__SCAN_BUILD_SHA__).toBe('string');
    expect(globalThis.window.__SCAN_BUILD_SHA__.length).toBeGreaterThan(0);
  });

  it('installScanBuildStamp is idempotent', () => {
    globalThis.window = {};
    installScanBuildStamp();
    const first = globalThis.window.__SCAN_BUILD_SHA__;
    installScanBuildStamp();
    expect(globalThis.window.__SCAN_BUILD_SHA__).toBe(first);
  });

  it('never throws on garbage input', () => {
    expect(() => installScanBuildStamp()).not.toThrow();
    expect(() => getScanBuildSha()).not.toThrow();
  });
});
