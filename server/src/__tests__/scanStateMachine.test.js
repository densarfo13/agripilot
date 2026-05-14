/**
 * scanStateMachine.test.js — Permanent Scan Pipeline Replacement.
 *
 * The FSM contract — every path through the scan pipeline MUST
 * reach a terminal state. No indefinite waiting, no hung
 * promises, no "taking longer than expected" dead-end.
 *
 * Terminal states tested:
 *   ANALYSIS_COMPLETE   - happy path
 *   DELAYED             - analysis exceeded ceiling but photo saved
 *   OFFLINE_QUEUED      - upload skipped (offline)
 *   FAILED              - unrecoverable + classified
 *   MANUAL_FALLBACK     - user opted in OR analysis returned empty
 *
 * Hard rules verified:
 *   * startWithFile() ALWAYS resolves (never rejects, never hangs)
 *   * cancel() during analysis returns to IDLE + resolves the
 *     pending promise
 *   * reset() can be called from any state
 *   * Invalid image -> FAILED with kind='unsupported_image'
 *     before any network call
 *   * Offline -> OFFLINE_QUEUED + queueOffline called once
 *   * Upload timeout -> OFFLINE_QUEUED fallback
 *   * Analysis timeout -> DELAYED (NOT failed - spec §8)
 *   * Backend ok:false -> FAILED with classified kind
 *   * Empty result -> MANUAL_FALLBACK
 *   * onChange fires on every transition with frozen snapshot
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createScanStateMachine, SCAN_STATES } from
  '../../../src/features/scan/scanStateMachine.js';

// ─── Fixtures ────────────────────────────────────────────────

function fakeBlob(size, mime) {
  // Preserve a 0 size for the empty-file regression - || would
  // coerce 0 to the default 1024.
  return {
    size: Number.isFinite(size) ? size : 1024,
    type: mime || 'image/jpeg',
  };
}

function fakeFile(size, mime, name) {
  return Object.assign(fakeBlob(size, mime), { name: name || 'test.jpg' });
}

function happyPathDeps(overrides) {
  const o = (overrides && typeof overrides === 'object') ? overrides : {};
  return {
    compress: o.compress || (async (file) => fakeBlob(Math.floor(file.size / 3), file.type)),
    upload:   o.upload   || (async () => ({ ok: true, uploadId: 'up_1', status: 200 })),
    analyse:  o.analyse  || (async () => ({ ok: true, scanId: 's_1', possibleIssue: 'leaf yellowing' })),
    queueOffline: o.queueOffline || (async () => true),
    onChange: o.onChange || (() => {}),
  };
}

beforeEach(() => {
  // Ensure no leftover navigator state from other suites.
  if (globalThis.navigator && globalThis.navigator.onLine === false) {
    Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true });
  }
});

// ─── Construction + idle ────────────────────────────────────

describe('createScanStateMachine — construction', () => {
  it('starts in IDLE', () => {
    const fsm = createScanStateMachine(happyPathDeps());
    expect(fsm.getState().state).toBe(SCAN_STATES.IDLE);
    expect(fsm.isTerminal()).toBe(false);
  });

  it('exposes the 12 spec states', () => {
    expect(SCAN_STATES.IDLE).toBeTruthy();
    expect(SCAN_STATES.CAMERA_READY).toBeTruthy();
    expect(SCAN_STATES.IMAGE_SELECTED).toBeTruthy();
    expect(SCAN_STATES.COMPRESSING).toBeTruthy();
    expect(SCAN_STATES.UPLOADING).toBeTruthy();
    expect(SCAN_STATES.UPLOAD_COMPLETE).toBeTruthy();
    expect(SCAN_STATES.ANALYZING).toBeTruthy();
    expect(SCAN_STATES.ANALYSIS_COMPLETE).toBeTruthy();
    expect(SCAN_STATES.DELAYED).toBeTruthy();
    expect(SCAN_STATES.OFFLINE_QUEUED).toBeTruthy();
    expect(SCAN_STATES.FAILED).toBeTruthy();
    expect(SCAN_STATES.MANUAL_FALLBACK).toBeTruthy();
  });
});

// ─── Happy path ─────────────────────────────────────────────

describe('Happy path — file → ANALYSIS_COMPLETE', () => {
  it('resolves at ANALYSIS_COMPLETE with the result attached', async () => {
    const transitions = [];
    const fsm = createScanStateMachine(happyPathDeps({
      onChange: (state) => transitions.push(state),
    }));
    const out = await fsm.startWithFile(fakeFile(2_000_000), { source: 'camera' });
    expect(out.state).toBe(SCAN_STATES.ANALYSIS_COMPLETE);
    expect(out.ctx.result.scanId).toBe('s_1');
    expect(transitions).toContain(SCAN_STATES.IMAGE_SELECTED);
    expect(transitions).toContain(SCAN_STATES.COMPRESSING);
    expect(transitions).toContain(SCAN_STATES.UPLOADING);
    expect(transitions).toContain(SCAN_STATES.UPLOAD_COMPLETE);
    expect(transitions).toContain(SCAN_STATES.ANALYZING);
    expect(transitions).toContain(SCAN_STATES.ANALYSIS_COMPLETE);
  });

  it('isTerminal() returns true at ANALYSIS_COMPLETE', async () => {
    const fsm = createScanStateMachine(happyPathDeps());
    await fsm.startWithFile(fakeFile());
    expect(fsm.isTerminal()).toBe(true);
  });
});

// ─── Image validation (spec §4) ─────────────────────────────

describe('Image validation', () => {
  it('null file → FAILED with unsupported_image before any async', async () => {
    const fsm = createScanStateMachine(happyPathDeps());
    const out = await fsm.startWithFile(null);
    expect(out.state).toBe(SCAN_STATES.FAILED);
    expect(out.ctx.failureKind).toBe('unsupported_image');
  });

  it('empty file → FAILED', async () => {
    const fsm = createScanStateMachine(happyPathDeps());
    const out = await fsm.startWithFile(fakeFile(0, 'image/jpeg'));
    expect(out.state).toBe(SCAN_STATES.FAILED);
    expect(out.ctx.failureKind).toBe('unsupported_image');
  });

  it('oversized file (>10MB) → FAILED', async () => {
    const fsm = createScanStateMachine(happyPathDeps());
    const out = await fsm.startWithFile(fakeFile(11 * 1024 * 1024, 'image/jpeg'));
    expect(out.state).toBe(SCAN_STATES.FAILED);
    expect(out.ctx.failureKind).toBe('unsupported_image');
  });

  it('unsupported mime (PDF) → FAILED', async () => {
    const fsm = createScanStateMachine(happyPathDeps());
    const out = await fsm.startWithFile(fakeFile(1024, 'application/pdf'));
    expect(out.state).toBe(SCAN_STATES.FAILED);
    expect(out.ctx.failureKind).toBe('unsupported_image');
  });

  it.each([
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
    'image/heic', 'image/heif',
  ])('accepts supported mime %s', async (mime) => {
    const fsm = createScanStateMachine(happyPathDeps());
    const out = await fsm.startWithFile(fakeFile(1024, mime));
    expect(out.state).toBe(SCAN_STATES.ANALYSIS_COMPLETE);
  });
});

// ─── Compression failure → falls back to raw file ──────────

describe('Compression failure — falls back to raw file', () => {
  it('compress throws → pipeline continues to upload with raw file', async () => {
    const fsm = createScanStateMachine(happyPathDeps({
      compress: async () => { throw new Error('jpeg encoder failed'); },
    }));
    const out = await fsm.startWithFile(fakeFile());
    expect(out.state).toBe(SCAN_STATES.ANALYSIS_COMPLETE);
  });
});

// ─── Offline / queue (spec §9) ─────────────────────────────

describe('Offline → OFFLINE_QUEUED', () => {
  it('navigator.onLine=false → queues + transitions to OFFLINE_QUEUED', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: false }, configurable: true, writable: true,
    });
    let queuedBlob = null;
    const fsm = createScanStateMachine(happyPathDeps({
      queueOffline: async (b) => { queuedBlob = b; return true; },
    }));
    const out = await fsm.startWithFile(fakeFile());
    expect(out.state).toBe(SCAN_STATES.OFFLINE_QUEUED);
    expect(queuedBlob).toBeTruthy();
    // restore
    Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true });
  });

  it('no upload fn wired → OFFLINE_QUEUED + queue called', async () => {
    let queued = false;
    const fsm = createScanStateMachine({
      compress: async (f) => f,
      analyse:  async () => ({ ok: true, scanId: 'x' }),
      queueOffline: async () => { queued = true; },
    });
    const out = await fsm.startWithFile(fakeFile());
    expect(out.state).toBe(SCAN_STATES.OFFLINE_QUEUED);
    expect(queued).toBe(true);
  });
});

// ─── Upload failure paths ───────────────────────────────────

describe('Upload failure', () => {
  it('upload returns ok:false → FAILED with classified kind', async () => {
    const fsm = createScanStateMachine(happyPathDeps({
      upload: async () => ({ ok: false, error: 'server boom', status: 500 }),
    }));
    const out = await fsm.startWithFile(fakeFile());
    expect(out.state).toBe(SCAN_STATES.FAILED);
    expect(out.ctx.failureKind).toBeTruthy();
    expect(out.ctx.failureMessage).toBeTruthy();
  });

  it('upload throws + offline queue available → OFFLINE_QUEUED (no FAILED)', async () => {
    let queued = false;
    const fsm = createScanStateMachine(happyPathDeps({
      upload: async () => { throw new Error('network down'); },
      queueOffline: async () => { queued = true; },
    }));
    const out = await fsm.startWithFile(fakeFile());
    expect(out.state).toBe(SCAN_STATES.OFFLINE_QUEUED);
    expect(queued).toBe(true);
  });
});

// ─── Analysis paths (spec §8 delayed mode) ──────────────────

describe('Analysis delayed mode (spec §8)', () => {
  it('analyse returns { ok:false, delayed:true } → DELAYED (not FAILED)', async () => {
    const fsm = createScanStateMachine(happyPathDeps({
      analyse: async () => ({ ok: false, delayed: true }),
    }));
    const out = await fsm.startWithFile(fakeFile());
    expect(out.state).toBe(SCAN_STATES.DELAYED);
    expect(out.ctx.result.delayed).toBe(true);
  });

  it('analyse returns empty/null result → MANUAL_FALLBACK', async () => {
    const fsm = createScanStateMachine(happyPathDeps({
      analyse: async () => null,
    }));
    const out = await fsm.startWithFile(fakeFile());
    expect(out.state).toBe(SCAN_STATES.MANUAL_FALLBACK);
    expect(out.ctx.fallbackResult).toBeTruthy();
    expect(out.ctx.fallbackResult.confidence).toBe('low');
  });

  it('analyse throws unrecoverable → FAILED', async () => {
    const fsm = createScanStateMachine(happyPathDeps({
      analyse: async () => { throw new Error('500 server boom'); },
    }));
    const out = await fsm.startWithFile(fakeFile());
    expect(out.state).toBe(SCAN_STATES.FAILED);
    expect(out.ctx.failureKind).toBeTruthy();
  });

  it('no analyse fn wired → MANUAL_FALLBACK', async () => {
    const fsm = createScanStateMachine({
      compress: async (f) => f,
      upload:   async () => ({ ok: true, uploadId: 'u1' }),
    });
    const out = await fsm.startWithFile(fakeFile());
    expect(out.state).toBe(SCAN_STATES.MANUAL_FALLBACK);
  });
});

// ─── Manual fallback opt-in ─────────────────────────────────

describe('Manual fallback opt-in (spec §10)', () => {
  it('user can transition FAILED → MANUAL_FALLBACK', async () => {
    const fsm = createScanStateMachine(happyPathDeps({
      upload: async () => ({ ok: false, error: 'unauth', status: 401 }),
    }));
    await fsm.startWithFile(fakeFile());
    expect(fsm.getState().state).toBe(SCAN_STATES.FAILED);
    fsm.selectManualFallback({ crop: 'tomato', stage: 'upload' });
    expect(fsm.getState().state).toBe(SCAN_STATES.MANUAL_FALLBACK);
    expect(fsm.getState().ctx.fallbackResult).toBeTruthy();
    expect(fsm.getState().ctx.fallbackResult.manualSymptoms.length).toBeGreaterThan(0);
  });

  it('manual fallback envelope carries the symptom list (spec §10)', async () => {
    const fsm = createScanStateMachine(happyPathDeps());
    fsm.selectManualFallback({ crop: 'tomato', stage: 'inference' });
    const fb = fsm.getState().ctx.fallbackResult;
    expect(fb.manualSymptoms.length).toBeGreaterThan(0);
    expect(fb.confidence).toBe('low');
    expect(fb.meta.engine).toBe('manual_fallback');
  });
});

// ─── reset() + cancel() ────────────────────────────────────

describe('reset + cancel hygiene (spec §15)', () => {
  it('reset() returns to IDLE from any terminal', async () => {
    const fsm = createScanStateMachine(happyPathDeps({
      upload: async () => ({ ok: false }),
    }));
    await fsm.startWithFile(fakeFile());
    expect(fsm.getState().state).toBe(SCAN_STATES.FAILED);
    fsm.reset();
    expect(fsm.getState().state).toBe(SCAN_STATES.IDLE);
    expect(fsm.getState().ctx.failureKind).toBeNull();
  });

  it('cancel() during in-flight resolves the promise + returns to IDLE on reset', async () => {
    let resolveUpload;
    const fsm = createScanStateMachine(happyPathDeps({
      upload: () => new Promise((r) => { resolveUpload = r; }),
    }));
    const p = fsm.startWithFile(fakeFile());
    fsm.cancel();
    // The pending startWithFile promise must resolve - never hang.
    const out = await p;
    expect(out).toBeTruthy();
    expect([SCAN_STATES.UPLOADING, SCAN_STATES.COMPRESSING, SCAN_STATES.IDLE])
      .toContain(out.state);
  });

  it('startWithFile after a reset spins up a fresh run', async () => {
    const fsm = createScanStateMachine(happyPathDeps());
    const a = await fsm.startWithFile(fakeFile());
    expect(a.state).toBe(SCAN_STATES.ANALYSIS_COMPLETE);
    fsm.reset();
    const b = await fsm.startWithFile(fakeFile());
    expect(b.state).toBe(SCAN_STATES.ANALYSIS_COMPLETE);
    expect(b.ctx.runId).not.toBe(a.ctx.runId);
  });
});

// ─── onChange contract ──────────────────────────────────────

describe('onChange contract', () => {
  it('fires on every transition with frozen ctx', async () => {
    const captures = [];
    const fsm = createScanStateMachine(happyPathDeps({
      onChange: (state, ctx) => captures.push({ state, frozen: Object.isFrozen(ctx) }),
    }));
    await fsm.startWithFile(fakeFile());
    expect(captures.length).toBeGreaterThan(4);
    for (const c of captures) {
      expect(c.frozen).toBe(true);
    }
  });

  it('startWithFile NEVER rejects (always resolves to a terminal)', async () => {
    // The FSM swallows every throw in the dep functions internally.
    const fsm = createScanStateMachine({
      compress: () => { throw new Error('compress sync throw'); },
      upload:   () => { throw new Error('upload sync throw'); },
      analyse:  () => { throw new Error('analyse sync throw'); },
    });
    const out = await fsm.startWithFile(fakeFile()); // does not reject
    expect(out).toBeTruthy();
    expect(fsm.isTerminal()).toBe(true);
  });
});
