/**
 * scanV5StabilityPrimitives.test.js — verifies the Scan V5 Stability
 * primitives:
 *   • scanSessionManager.js
 *   • scanLifecycleStateMachine.js
 *   • imageNormalization.js
 *   • scanRetryEngine.js
 *   • validateScanImage.js (extended hints)
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  createScanSession, getActiveSession, updateSession,
  completeSession, failSession, endSession,
  isSessionStale, recordRetry,
  restorePersistedSession, getScanHistory, clearScanHistory,
  _resetSessionManagerForTests,
  SESSION_STATUS,
} from '../../../src/core/scan/scanSessionManager.js';

import {
  LIFECYCLE_STATE, LIFECYCLE_EVENT,
  nextLifecycleState, canPublishResult, isTerminal,
  isInFlight, shouldKeepPreview,
} from '../../../src/core/scan/scanLifecycleStateMachine.js';

import {
  isHeicMime, isHeicFilename, isHeicByMagic, isHeicFile,
  readExifOrientation, computeTargetDimensions, normalizeScanImage,
} from '../../../src/core/scan/imageNormalization.js';

import {
  withScanRetry, DEFAULT_RETRY_OPTS,
  _setDelayForTests, _resetDelayForTests,
} from '../../../src/core/scan/scanRetryEngine.js';

import {
  validateScanImage, MAX_VALIDATION_BYTES, friendlyHintFor,
  INVALID_REASON,
} from '../../../src/core/scan/validateScanImage.js';

// ─── scanSessionManager ──────────────────────────────────

describe('scanSessionManager', () => {
  beforeEach(() => {
    _resetSessionManagerForTests();
    // Stub localStorage so persistence paths run.
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
  });

  it('createScanSession returns a frozen session with all spec fields', () => {
    const s = createScanSession({ source: 'live_camera' });
    expect(s).toBeTruthy();
    expect(typeof s.sessionId).toBe('string');
    expect(s.source).toBe('live_camera');
    expect(s.status).toBe(SESSION_STATUS.ACTIVE);
    expect(s.lifecycle).toBe(LIFECYCLE_STATE.IDLE);
    expect(s.aiStatus).toBe('pending');
    expect(s.previewStatus).toBe('pending');
    expect(s.renderStatus).toBe('pending');
    expect(s.retryCount).toBe(0);
    expect(typeof s.locale).toBe('string');
    expect(Object.isFrozen(s)).toBe(true);
  });

  it('getActiveSession returns the live record', () => {
    const s = createScanSession({});
    expect(getActiveSession().sessionId).toBe(s.sessionId);
  });

  it('updateSession patches and freezes the new record', () => {
    const s = createScanSession({});
    const u = updateSession(s.sessionId, {
      lifecycle:     LIFECYCLE_STATE.AI_PROCESSING,
      localUri:      'data:image/jpeg;base64,A',
      cropPrediction: 'maize',
    });
    expect(u.lifecycle).toBe(LIFECYCLE_STATE.AI_PROCESSING);
    expect(u.localUri).toBe('data:image/jpeg;base64,A');
    expect(u.cropPrediction).toBe('maize');
    expect(u.sessionId).toBe(s.sessionId);  // unchanged
    expect(Object.isFrozen(u)).toBe(true);
  });

  it('updateSession with stale sessionId is a no-op', () => {
    const a = createScanSession({});
    const b = createScanSession({}); // bumps active
    const out = updateSession(a.sessionId, { confidence: 'high' });
    expect(out.sessionId).toBe(b.sessionId);  // unchanged
    expect(out.confidence).toBeNull();
  });

  it('isSessionStale matches the contract', () => {
    const s = createScanSession({});
    expect(isSessionStale(s.sessionId)).toBe(false);
    expect(isSessionStale('garbage')).toBe(true);
    expect(isSessionStale(null)).toBe(true);
    endSession();
    expect(isSessionStale(s.sessionId)).toBe(true);
  });

  it('recordRetry increments + persists', () => {
    const s = createScanSession({});
    expect(recordRetry(s.sessionId, 'upload')).toBe(1);
    expect(recordRetry(s.sessionId, 'upload')).toBe(2);
    expect(getActiveSession().retryCount).toBe(2);
    expect(getActiveSession().failedStage).toBe('upload');
  });

  it('completeSession promotes status to completed + appends to history', () => {
    clearScanHistory();
    const s = createScanSession({ source: 'gallery' });
    completeSession(s.sessionId, { confidence: 'high', cropPrediction: 'maize' });
    expect(getActiveSession().status).toBe(SESSION_STATUS.COMPLETED);
    const hist = getScanHistory();
    expect(hist.length).toBe(1);
    expect(hist[0].cropPrediction).toBe('maize');
  });

  it('failSession captures failedStage + reason', () => {
    const s = createScanSession({});
    failSession(s.sessionId, 'ai', 'timeout_30s');
    const live = getActiveSession();
    expect(live.status).toBe(SESSION_STATUS.FAILED);
    expect(live.failedStage).toBe('ai');
    expect(live.failReason).toBe('timeout_30s');
  });

  it('endSession wipes the active record + persisted slot', () => {
    createScanSession({});
    endSession();
    expect(getActiveSession()).toBeNull();
    expect(restorePersistedSession()).toBeNull();
  });

  it('restorePersistedSession returns the prior record', () => {
    const s = createScanSession({ source: 'gallery' });
    updateSession(s.sessionId, { localUri: 'data:image/jpeg;base64,A' });
    // Simulate tab refresh: clear in-memory, keep storage.
    _resetSessionManagerForTests();
    // Re-populate localStorage manually with what would have persisted:
    globalThis.localStorage.setItem(
      'farroway:scanSession:v1',
      JSON.stringify({
        sessionId:  s.sessionId,
        createdAt:  Date.now() - 1000,
        updatedAt:  Date.now() - 500,
        source:     'gallery',
        status:     SESSION_STATUS.ACTIVE,
        lifecycle:  LIFECYCLE_STATE.PREVIEW_READY,
        localUri:   'data:image/jpeg;base64,A',
        retryCount: 0,
      }),
    );
    const rest = restorePersistedSession();
    expect(rest).toBeTruthy();
    expect(rest.source).toBe('gallery');
    expect(rest._restored).toBe(true);
  });

  it('restorePersistedSession drops stale records', () => {
    globalThis.localStorage.setItem(
      'farroway:scanSession:v1',
      JSON.stringify({
        sessionId: 'old', createdAt: 0, updatedAt: 0,
        source: 'gallery', status: 'active',
      }),
    );
    expect(restorePersistedSession({ maxAgeMs: 1000 })).toBeNull();
  });

  it('never throws on garbage input', () => {
    expect(() => createScanSession(null)).not.toThrow();
    expect(() => updateSession(null, null)).not.toThrow();
    expect(() => completeSession('garbage', {})).not.toThrow();
    expect(() => recordRetry(null, null)).not.toThrow();
    expect(() => endSession()).not.toThrow();
    expect(() => restorePersistedSession(null)).not.toThrow();
  });
});

// ─── scanLifecycleStateMachine ────────────────────────────

describe('scanLifecycleStateMachine', () => {
  it('IDLE → CAPTURING via CAPTURE_START', () => {
    expect(nextLifecycleState(LIFECYCLE_STATE.IDLE, LIFECYCLE_EVENT.CAPTURE_START))
      .toBe(LIFECYCLE_STATE.CAPTURING);
  });

  it('full happy path resolves to AI_COMPLETE', () => {
    let s = LIFECYCLE_STATE.IDLE;
    s = nextLifecycleState(s, LIFECYCLE_EVENT.CAPTURE_START);
    s = nextLifecycleState(s, LIFECYCLE_EVENT.CAPTURE_OK);
    s = nextLifecycleState(s, LIFECYCLE_EVENT.NORMALIZE_OK);
    s = nextLifecycleState(s, LIFECYCLE_EVENT.AI_START);
    s = nextLifecycleState(s, LIFECYCLE_EVENT.AI_OK);
    expect(s).toBe(LIFECYCLE_STATE.AI_COMPLETE);
  });

  it('upload failure routes to RECOVERABLE_ERROR then back to UPLOADING', () => {
    let s = LIFECYCLE_STATE.PREVIEW_READY;
    s = nextLifecycleState(s, LIFECYCLE_EVENT.UPLOAD_START);
    s = nextLifecycleState(s, LIFECYCLE_EVENT.UPLOAD_FAIL);
    expect(s).toBe(LIFECYCLE_STATE.RECOVERABLE_ERROR);
    s = nextLifecycleState(s, LIFECYCLE_EVENT.UPLOAD_START);
    expect(s).toBe(LIFECYCLE_STATE.UPLOADING);
  });

  it('RECOVERABLE_ERROR + UPLOAD_FAIL → FAILED', () => {
    let s = LIFECYCLE_STATE.RECOVERABLE_ERROR;
    s = nextLifecycleState(s, LIFECYCLE_EVENT.UPLOAD_FAIL);
    expect(s).toBe(LIFECYCLE_STATE.FAILED);
  });

  it('canPublishResult is true only for AI_COMPLETE / LOW_CONFIDENCE', () => {
    expect(canPublishResult(LIFECYCLE_STATE.AI_COMPLETE)).toBe(true);
    expect(canPublishResult(LIFECYCLE_STATE.LOW_CONFIDENCE)).toBe(true);
    expect(canPublishResult(LIFECYCLE_STATE.IDLE)).toBe(false);
    expect(canPublishResult(LIFECYCLE_STATE.AI_PROCESSING)).toBe(false);
    expect(canPublishResult(LIFECYCLE_STATE.FAILED)).toBe(false);
  });

  it('isTerminal recognises AI_COMPLETE / LOW_CONFIDENCE / FAILED', () => {
    expect(isTerminal(LIFECYCLE_STATE.AI_COMPLETE)).toBe(true);
    expect(isTerminal(LIFECYCLE_STATE.LOW_CONFIDENCE)).toBe(true);
    expect(isTerminal(LIFECYCLE_STATE.FAILED)).toBe(true);
    expect(isTerminal(LIFECYCLE_STATE.UPLOADING)).toBe(false);
  });

  it('isInFlight recognises mid-flight states', () => {
    expect(isInFlight(LIFECYCLE_STATE.CAPTURING)).toBe(true);
    expect(isInFlight(LIFECYCLE_STATE.NORMALIZING)).toBe(true);
    expect(isInFlight(LIFECYCLE_STATE.UPLOADING)).toBe(true);
    expect(isInFlight(LIFECYCLE_STATE.AI_PROCESSING)).toBe(true);
    expect(isInFlight(LIFECYCLE_STATE.IDLE)).toBe(false);
    expect(isInFlight(LIFECYCLE_STATE.AI_COMPLETE)).toBe(false);
  });

  it('shouldKeepPreview is true except IDLE / CAPTURING', () => {
    expect(shouldKeepPreview(LIFECYCLE_STATE.IDLE)).toBe(false);
    expect(shouldKeepPreview(LIFECYCLE_STATE.CAPTURING)).toBe(false);
    expect(shouldKeepPreview(LIFECYCLE_STATE.PREVIEW_READY)).toBe(true);
    expect(shouldKeepPreview(LIFECYCLE_STATE.AI_PROCESSING)).toBe(true);
    expect(shouldKeepPreview(LIFECYCLE_STATE.AI_COMPLETE)).toBe(true);
    expect(shouldKeepPreview(LIFECYCLE_STATE.FAILED)).toBe(true);
  });

  it('unknown event leaves the state unchanged', () => {
    const s = LIFECYCLE_STATE.AI_PROCESSING;
    expect(nextLifecycleState(s, 'garbage')).toBe(s);
  });

  it('unknown current state resets to IDLE', () => {
    expect(nextLifecycleState('garbage', LIFECYCLE_EVENT.CAPTURE_START))
      .toBe(LIFECYCLE_STATE.CAPTURING);
  });
});

// ─── imageNormalization ──────────────────────────────────

describe('imageNormalization', () => {
  it('isHeicMime detects mime variants', () => {
    expect(isHeicMime('image/heic')).toBe(true);
    expect(isHeicMime('image/heif')).toBe(true);
    expect(isHeicMime('IMAGE/HEIC-SEQUENCE')).toBe(true);
    expect(isHeicMime('image/jpeg')).toBe(false);
    expect(isHeicMime('')).toBe(false);
    expect(isHeicMime(null)).toBe(false);
  });

  it('isHeicFilename detects extensions', () => {
    expect(isHeicFilename('IMG_1234.HEIC')).toBe(true);
    expect(isHeicFilename('photo.heif')).toBe(true);
    expect(isHeicFilename('photo.jpg')).toBe(false);
    expect(isHeicFilename(null)).toBe(false);
  });

  it('isHeicByMagic detects HEIC magic bytes', async () => {
    // Construct a fake HEIC: 4 bytes pad, 'ftyp', 'heic' brand
    const buf = new Uint8Array(16);
    [0x66, 0x74, 0x79, 0x70].forEach((b, i) => buf[4 + i] = b);
    [0x68, 0x65, 0x69, 0x63].forEach((b, i) => buf[8 + i] = b);
    const blob = new Blob([buf]);
    expect(await isHeicByMagic(blob)).toBe(true);
  });

  it('isHeicByMagic returns false for non-ISOBMFF data', async () => {
    const blob = new Blob([new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0])]);
    expect(await isHeicByMagic(blob)).toBe(false);
  });

  it('isHeicFile combines mime + filename + magic', async () => {
    const heicBlob = new Blob([new Uint8Array([
      0,0,0,0, 0x66,0x74,0x79,0x70, 0x68,0x65,0x69,0x63,
    ])], { type: '' });
    Object.defineProperty(heicBlob, 'name', { value: '' });
    expect(await isHeicFile(heicBlob)).toBe(true);
    const jpegBlob = new Blob([new Uint8Array([0xFF, 0xD8, 0xFF])], { type: 'image/jpeg' });
    expect(await isHeicFile(jpegBlob)).toBe(false);
  });

  it('readExifOrientation defaults to 1 for non-JPEG input', async () => {
    const blob = new Blob([new Uint8Array([0x89, 0x50, 0x4E, 0x47])]); // PNG sig
    expect(await readExifOrientation(blob)).toBe(1);
  });

  it('computeTargetDimensions never upscales', () => {
    expect(computeTargetDimensions(800, 600, 2048)).toEqual({ width: 800, height: 600, scale: 1 });
  });

  it('computeTargetDimensions downscales proportionally', () => {
    const out = computeTargetDimensions(4000, 3000, 2048);
    expect(out.width).toBe(2048);
    expect(out.height).toBe(1536);
    expect(out.scale).toBeCloseTo(2048 / 4000);
  });

  it('computeTargetDimensions handles zero / garbage', () => {
    expect(computeTargetDimensions(0, 0, 2048)).toEqual({ width: 0, height: 0, scale: 1 });
    expect(computeTargetDimensions(NaN, 100, 2048)).toEqual({ width: 0, height: 0, scale: 1 });
  });

  it('normalizeScanImage returns a structured failure for garbage input', async () => {
    const out = await normalizeScanImage(null);
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('no_file');
  });

  it('normalizeScanImage rejects oversized files', async () => {
    const fake = { size: 20_000_000, type: 'image/jpeg' };
    const out = await normalizeScanImage(fake, { maxBytes: 12_000_000 });
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('too_large');
  });

  it('normalizeScanImage never throws on undefined opts', async () => {
    await expect(normalizeScanImage(null, null)).resolves.toBeTruthy();
  });
});

// ─── scanRetryEngine ─────────────────────────────────────

describe('scanRetryEngine', () => {
  beforeEach(() => { _setDelayForTests(() => Promise.resolve()); });

  it('returns success on the first attempt', async () => {
    const out = await withScanRetry(async () => ({ ok: true, x: 1 }), {});
    expect(out.ok).toBe(true);
    expect(out.attempts).toBe(1);
    expect(out.value).toEqual({ ok: true, x: 1 });
  });

  it('retries up to maxAttempts on thrown errors', async () => {
    let calls = 0;
    const out = await withScanRetry(async () => {
      calls++;
      if (calls < 3) throw new Error('boom_' + calls);
      return 'ok';
    }, { maxAttempts: 3 });
    expect(out.ok).toBe(true);
    expect(out.attempts).toBe(3);
    expect(calls).toBe(3);
  });

  it('returns ok:false with lastError after exhausting retries', async () => {
    const out = await withScanRetry(async () => { throw new Error('timeout'); },
      { maxAttempts: 2 });
    expect(out.ok).toBe(false);
    expect(out.attempts).toBe(2);
    expect(out.lastError).toBe('timeout');
    expect(out.timings.length).toBe(2);
  });

  it('treats `{ ok: false }` as a failure for retry purposes', async () => {
    let calls = 0;
    const out = await withScanRetry(async () => {
      calls++;
      return calls < 2 ? { ok: false, reason: 'busy' } : { ok: true };
    }, { maxAttempts: 3 });
    expect(out.ok).toBe(true);
    expect(out.attempts).toBe(2);
  });

  it('aborts mid-chain when isStale returns true', async () => {
    let calls = 0;
    let stale = false;
    const out = await withScanRetry(async () => {
      calls++;
      if (calls === 1) { stale = true; throw new Error('first'); }
      return 'never';
    }, {
      maxAttempts: 3,
      activeSessionId: 'a',
      isStale: () => stale,
    });
    expect(out.stale).toBe(true);
    expect(out.ok).toBe(false);
    expect(calls).toBe(1);
  });

  it('fires onAttempt with timing rows', async () => {
    const rows = [];
    await withScanRetry(async () => 'x', {
      onAttempt: (r) => rows.push(r),
    });
    expect(rows.length).toBe(1);
    expect(rows[0].ok).toBe(true);
    expect(typeof rows[0].latencyMs).toBe('number');
  });

  it('never throws on garbage input', async () => {
    const out = await withScanRetry(null, {});
    expect(out.ok).toBe(false);
    expect(out.lastError).toBe('no_fn');
  });
});

// ─── validateScanImage (extended hints) ──────────────────

describe('validateScanImage (V5 extensions)', () => {
  it('flags oversized files', () => {
    const v = validateScanImage({
      file: { size: MAX_VALIDATION_BYTES + 1 },
      mimeType: 'image/jpeg',
      size: MAX_VALIDATION_BYTES + 1,
      objectUrl: 'blob:x', width: 100, height: 100,
    });
    expect(v.valid).toBe(false);
    expect(v.reason).toBe(INVALID_REASON.TOO_LARGE);
  });

  it('friendlyHintFor returns actionable copy for each reason', () => {
    for (const reason of Object.values(INVALID_REASON)) {
      const hint = friendlyHintFor(reason);
      expect(typeof hint).toBe('string');
      expect(hint.length).toBeGreaterThan(10);
    }
  });

  it('friendlyHintFor falls back for unknown reasons', () => {
    expect(typeof friendlyHintFor('made_up_reason')).toBe('string');
    expect(typeof friendlyHintFor(null)).toBe('string');
  });
});
