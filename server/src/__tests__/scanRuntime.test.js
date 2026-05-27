/**
 * scanRuntime.test.js — Complete Scan Runtime Rebuild regression suite.
 *
 * Covers spec §0-§25 contracts (the engine-layer parts):
 *   • ScanRuntime state machine + session ownership
 *   • input guard + result contract + low-confidence rule
 *   • offline queue
 *   • diagnostic hooks
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  createScanRuntime, SCAN_STATE,
} from '../../../src/core/scan/ScanRuntime.js';
import {
  assertValidScanInput, validateScanResult,
  isLowConfidenceAllowed, invalidImageMessage,
} from '../../../src/core/scan/scanRuntimeContracts.js';
import {
  enqueueOfflineScan, drainOfflineQueue, getQueuedScans,
  clearOfflineQueue,
} from '../../../src/core/scan/offlineScanQueue.js';

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
  // Force-override regardless of native availability — Node 21+
  // ships a real URL.createObjectURL that rejects our plain-object
  // file stubs. The test stub accepts anything with a _id field
  // and returns a deterministic blob: URL.
  if (typeof globalThis.URL === 'undefined') globalThis.URL = {};
  globalThis.URL.createObjectURL = (b) =>
    'blob:test/' + (b && b._id ? b._id : Math.random().toString(36));
  globalThis.URL.revokeObjectURL = () => {};
}

beforeEach(() => {
  _stubLocalStorage();
  _stubURL();
  clearOfflineQueue();
});

afterEach(() => { /* nothing global to clean */ });

// ═══ Contracts — §11 / §12 / §13 ═════════════════════════════

describe('assertValidScanInput', () => {
  it('rejects empty input', () => {
    const v = assertValidScanInput(null);
    expect(v.allowed).toBe(false);
    expect(v.reason).toBe('no_input');
  });
  it('rejects stale session', () => {
    const v = assertValidScanInput({
      sessionId: 'old', activeSessionId: 'new',
      imageValid: true, previewUrl: 'blob:x',
      normalizedBlob: true, persisted: true, state: 'IMAGE_READY',
    });
    expect(v.allowed).toBe(false);
    expect(v.reason).toBe('stale_session');
  });
  it('rejects analysis without valid image', () => {
    const v = assertValidScanInput({
      sessionId: 's', activeSessionId: 's',
      imageValid: false, previewUrl: 'blob:x',
      normalizedBlob: true, persisted: true, state: 'IMAGE_READY',
    });
    expect(v.reason).toBe('image_invalid');
  });
  it('rejects analysis with missing preview', () => {
    const v = assertValidScanInput({
      sessionId: 's', activeSessionId: 's',
      imageValid: true, previewUrl: '',
      normalizedBlob: true, persisted: true, state: 'IMAGE_READY',
    });
    expect(v.reason).toBe('preview_missing');
  });
  it('rejects wrong state', () => {
    const v = assertValidScanInput({
      sessionId: 's', activeSessionId: 's',
      imageValid: true, previewUrl: 'blob:x',
      normalizedBlob: true, persisted: true, state: 'IDLE',
    });
    expect(v.reason).toBe('wrong_state');
  });
  it('allows when every condition met', () => {
    const v = assertValidScanInput({
      sessionId: 's', activeSessionId: 's',
      imageValid: true, previewUrl: 'blob:x',
      normalizedBlob: true, persisted: true, state: 'IMAGE_READY',
    });
    expect(v.allowed).toBe(true);
  });
});

describe('validateScanResult', () => {
  function _good(overrides) {
    return Object.assign({
      sessionId: 's', imageId: 'i', imagePreviewUrl: 'blob:x',
      imageHash: 'h', imageValidated: true,
      classifierInputVerified: true,
      diagnosis: 'leaf_spot', confidenceTone: 'high_confidence',
      timestamp: Date.now(),
    }, overrides || {});
  }
  it('rejects null', () => {
    expect(validateScanResult(null).valid).toBe(false);
  });
  it('rejects missing required fields', () => {
    const v = validateScanResult(_good({ sessionId: '' }));
    expect(v.valid).toBe(false);
    expect(v.missing).toContain('sessionId');
  });
  it('rejects imageValidated=false', () => {
    const v = validateScanResult(_good({ imageValidated: false }));
    expect(v.reason).toBe('image_not_validated');
  });
  it('rejects classifierInputVerified=false', () => {
    const v = validateScanResult(_good({ classifierInputVerified: false }));
    expect(v.reason).toBe('classifier_input_not_verified');
  });
  it('accepts a complete result', () => {
    expect(validateScanResult(_good()).valid).toBe(true);
  });
});

describe('isLowConfidenceAllowed — §13 hard rule', () => {
  it('blocked when image invalid', () => {
    const v = isLowConfidenceAllowed({
      imageValid: false, analysisCompleted: true, previewUrl: 'blob:x',
    });
    expect(v.allowed).toBe(false);
    expect(v.reason).toBe('image_invalid');
  });
  it('blocked when analysis not completed', () => {
    const v = isLowConfidenceAllowed({
      imageValid: true, analysisCompleted: false, previewUrl: 'blob:x',
    });
    expect(v.reason).toBe('analysis_not_completed');
  });
  it('blocked when preview missing', () => {
    const v = isLowConfidenceAllowed({
      imageValid: true, analysisCompleted: true, previewUrl: '',
    });
    expect(v.reason).toBe('preview_missing');
  });
  it('allowed when all three preconditions met', () => {
    const v = isLowConfidenceAllowed({
      imageValid: true, analysisCompleted: true, previewUrl: 'blob:x',
    });
    expect(v.allowed).toBe(true);
  });
});

describe('invalidImageMessage', () => {
  it('returns a tSafe envelope with the exact spec wording', () => {
    const m = invalidImageMessage();
    expect(m.key).toBe('scan.image.invalid');
    expect(m.fallback).toBe('Photo could not be loaded. Please choose the photo again.');
  });
});

// ═══ Offline queue — §15 ═════════════════════════════════════

describe('offlineScanQueue', () => {
  it('enqueue + read roundtrip', () => {
    enqueueOfflineScan({ farmId: 'f1', crop: 'pepper', imageId: 'img1' });
    const q = getQueuedScans();
    expect(q.length).toBe(1);
    expect(q[0].crop).toBe('pepper');
  });
  it('idempotent enqueue on clientDraftId', () => {
    enqueueOfflineScan({ clientDraftId: 'd1', farmId: 'f1', crop: 'pepper' });
    enqueueOfflineScan({ clientDraftId: 'd1', farmId: 'f1', crop: 'pepper' });
    expect(getQueuedScans().length).toBe(1);
  });
  it('cap at MAX_QUEUE (50)', () => {
    for (let i = 0; i < 60; i++) {
      enqueueOfflineScan({ clientDraftId: 'd' + i, crop: 'pepper' });
    }
    expect(getQueuedScans().length).toBe(50);
  });
  it('drainOfflineQueue removes successfully processed rows', async () => {
    enqueueOfflineScan({ clientDraftId: 'd1', crop: 'pepper' });
    enqueueOfflineScan({ clientDraftId: 'd2', crop: 'cassava' });
    const s = await drainOfflineQueue(async () => ({ ok: true }));
    expect(s.processed).toBe(2);
    expect(s.remaining).toBe(0);
  });
  it('keeps failed rows + increments retries', async () => {
    enqueueOfflineScan({ clientDraftId: 'd1', crop: 'pepper' });
    const s = await drainOfflineQueue(async () => ({ ok: false }));
    expect(s.failed).toBe(1);
    expect(s.remaining).toBe(1);
    expect(getQueuedScans()[0].retries).toBe(1);
  });
  it('no processor → safe summary', async () => {
    const s = await drainOfflineQueue(null);
    expect(s.reason).toBe('no_processor');
  });
  it('garbage never throws', () => {
    expect(() => enqueueOfflineScan(null)).not.toThrow();
    expect(() => enqueueOfflineScan('hi')).not.toThrow();
  });
});

// ═══ ScanRuntime state machine ════════════════════════════════

describe('ScanRuntime — initial state', () => {
  it('starts in IDLE', () => {
    const rt = createScanRuntime({});
    expect(rt.getState()).toBe(SCAN_STATE.IDLE);
    expect(rt.getResult()).toBeNull();
    expect(rt.getPreviewUrl()).toBeNull();
  });

  it('snapshot has documented envelope', () => {
    const rt = createScanRuntime({});
    const s = rt.getSnapshot();
    expect(s.engineVersion).toBe('scan-runtime-v1');
    expect(s.currentState).toBe(SCAN_STATE.IDLE);
    expect(s.previewExists).toBe(false);
    expect(s.analyzing).toBe(false);
    expect(s.resultValid).toBe(false);
  });
});

describe('ScanRuntime — choosePhoto + capturePhoto', () => {
  it('rejects an empty file', async () => {
    const rt = createScanRuntime({});
    const r = await rt.choosePhoto({ size: 0 });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('image_invalid');
    expect(rt.getState()).toBe(SCAN_STATE.RECOVERABLE_ERROR);
  });

  it('accepts a valid blob and moves to IMAGE_READY', async () => {
    const rt = createScanRuntime({});
    const r = await rt.choosePhoto({ size: 1024, type: 'image/jpeg', _id: 'a' });
    expect(r.ok).toBe(true);
    expect(rt.getState()).toBe(SCAN_STATE.IMAGE_READY);
    expect(rt.getPreviewUrl()).toMatch(/^blob:/);
    expect(rt.getSessionId()).toMatch(/^scan_/);
  });

  it('capturePhoto reaches IMAGE_READY too', async () => {
    const rt = createScanRuntime({});
    const r = await rt.capturePhoto({ size: 2048, type: 'image/jpeg', _id: 'b' });
    expect(r.ok).toBe(true);
    expect(rt.getState()).toBe(SCAN_STATE.IMAGE_READY);
  });
});

describe('ScanRuntime — analyzeImage guard', () => {
  it('blocks analysis without a valid image', async () => {
    const rt = createScanRuntime({ classifier: async () => ({}) });
    const r = await rt.analyzeImage();
    expect(r.ok).toBe(false);
    expect(rt.getState()).toBe(SCAN_STATE.RECOVERABLE_ERROR);
  });

  it('queues to offline when no classifier supplied', async () => {
    const rt = createScanRuntime({});
    await rt.choosePhoto({ size: 1024, type: 'image/jpeg', _id: 'c' });
    const r = await rt.analyzeImage();
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('no_classifier_queued');
    expect(rt.getState()).toBe(SCAN_STATE.OFFLINE_QUEUED);
    expect(getQueuedScans().length).toBeGreaterThan(0);
  });

  it('classifier returning empty → RECOVERABLE_ERROR', async () => {
    const rt = createScanRuntime({ classifier: async () => null });
    await rt.choosePhoto({ size: 1024, type: 'image/jpeg', _id: 'd' });
    const r = await rt.analyzeImage();
    expect(r.ok).toBe(false);
    expect(rt.getState()).toBe(SCAN_STATE.RECOVERABLE_ERROR);
  });

  it('successful analysis → RESULT_READY with valid result envelope', async () => {
    const rt = createScanRuntime({
      classifier: async () => ({
        diagnosis: 'leaf_spot',
        confidenceTone: 'high_confidence',
        severity: 'moderate',
      }),
    });
    await rt.choosePhoto({ size: 1024, type: 'image/jpeg', _id: 'e' });
    const r = await rt.analyzeImage();
    expect(r.ok).toBe(true);
    expect(rt.getState()).toBe(SCAN_STATE.RESULT_READY);
    const v = validateScanResult(rt.getResult());
    expect(v.valid).toBe(true);
  });

  it('classifier emitting needs_review → LOW_CONFIDENCE (only after valid analysis)', async () => {
    const rt = createScanRuntime({
      classifier: async () => ({
        diagnosis: 'unclear', confidenceTone: 'needs_review',
      }),
    });
    await rt.choosePhoto({ size: 1024, type: 'image/jpeg', _id: 'f' });
    const r = await rt.analyzeImage();
    expect(r.ok).toBe(true);
    expect(rt.getState()).toBe(SCAN_STATE.LOW_CONFIDENCE);
  });
});

// ═══ Session-id protection §3 ════════════════════════════════

describe('ScanRuntime — session-id protection', () => {
  it('stale async classifier result is discarded', async () => {
    let resolveFn = null;
    const rt = createScanRuntime({
      classifier: () => new Promise((r) => { resolveFn = r; }),
    });
    await rt.choosePhoto({ size: 1024, type: 'image/jpeg', _id: 'g' });
    const analysisPromise = rt.analyzeImage();
    // Destroy session while analysis is in flight.
    rt.destroySession();
    if (resolveFn) resolveFn({ diagnosis: 'leaf_spot', confidenceTone: 'high_confidence' });
    const r = await analysisPromise;
    expect(r.ok).toBe(false);
    expect(rt.getResult()).toBeNull();
    expect(rt.getState()).toBe(SCAN_STATE.IDLE);
  });
});

// ═══ saveToJournal + createFollowUp safety ═══════════════════

describe('ScanRuntime — Journal + follow-up safety', () => {
  it('saveToJournal refuses without a result', async () => {
    const rt = createScanRuntime({});
    const r = await rt.saveToJournal();
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('no_result');
  });

  it('createFollowUp refuses without a result', async () => {
    const rt = createScanRuntime({});
    const r = await rt.createFollowUp();
    expect(r.ok).toBe(false);
  });

  it('saveToJournal moves to SAVED + emits scan_completed', async () => {
    const telemetry = vi.fn();
    const rt = createScanRuntime({
      activeFarm: { id: 'farm-1', crop: 'pepper' },
      classifier: async () => ({
        diagnosis: 'leaf_spot', confidenceTone: 'high_confidence',
        severity: 'moderate',
      }),
      onTelemetry: telemetry,
    });
    await rt.choosePhoto({ size: 1024, type: 'image/jpeg', _id: 'h' });
    await rt.analyzeImage();
    const s = await rt.saveToJournal();
    expect(s.ok).toBe(true);
    expect(rt.getState()).toBe(SCAN_STATE.SAVED);
    expect(telemetry).toHaveBeenCalledWith('scan_completed', expect.any(Object));
    expect(telemetry).toHaveBeenCalledWith('journal_saved', expect.any(Object));
  });

  it('createFollowUp emits followup_created when result has recommendation', async () => {
    const telemetry = vi.fn();
    const rt = createScanRuntime({
      classifier: async () => ({
        diagnosis: 'leaf_spot',
        confidenceTone: 'high_confidence',
        recommendation: { key: 'r', fallback: 'Re-scan tomorrow' },
      }),
      onTelemetry: telemetry,
    });
    await rt.choosePhoto({ size: 1024, type: 'image/jpeg', _id: 'i' });
    await rt.analyzeImage();
    const s = await rt.createFollowUp();
    expect(s.ok).toBe(true);
    expect(telemetry).toHaveBeenCalledWith('followup_created', expect.any(Object));
  });
});

// ═══ destroySession + recoverSession ═════════════════════════

describe('ScanRuntime — destroy + recover', () => {
  it('destroySession resets to IDLE', async () => {
    const rt = createScanRuntime({});
    await rt.choosePhoto({ size: 1024, type: 'image/jpeg', _id: 'j' });
    rt.destroySession();
    expect(rt.getState()).toBe(SCAN_STATE.IDLE);
    expect(rt.getPreviewUrl()).toBeNull();
    expect(rt.getResult()).toBeNull();
    expect(rt.getSessionId()).toBeNull();
  });

  it('recoverSession returns to IMAGE_READY when image persisted', async () => {
    const rt = createScanRuntime({});
    await rt.choosePhoto({ size: 1024, type: 'image/jpeg', _id: 'k' });
    const r = await rt.recoverSession();
    expect(r.ok).toBe(true);
    expect(rt.getState()).toBe(SCAN_STATE.IMAGE_READY);
  });
});

// ═══ Telemetry safety ═══════════════════════════════════════

describe('Telemetry safety', () => {
  it('no PII / no raw image data emitted', async () => {
    const events = [];
    const rt = createScanRuntime({
      classifier: async () => ({
        diagnosis: 'leaf_spot', confidenceTone: 'high_confidence',
      }),
      onTelemetry: (name, payload) => events.push({ name, payload }),
    });
    await rt.choosePhoto({ size: 1024, type: 'image/jpeg', _id: 'm' });
    await rt.analyzeImage();
    const json = JSON.stringify(events);
    expect(json).not.toMatch(/dataUrl|base64|imageBytes|userId|phone|email/);
  });
});

// ═══ State machine — every state is exposed ══════════════════

describe('SCAN_STATE — every documented state is exported', () => {
  it('all 15 states present', () => {
    const required = ['IDLE', 'OPENING_CAMERA', 'CAMERA_READY', 'CAPTURING',
      'PHOTO_SELECTED', 'VALIDATING_IMAGE', 'IMAGE_READY', 'PREPROCESSING',
      'ANALYZING', 'RESULT_READY', 'LOW_CONFIDENCE',
      'RECOVERABLE_ERROR', 'FATAL_ERROR', 'OFFLINE_QUEUED', 'SAVED'];
    for (const s of required) {
      expect(SCAN_STATE[s]).toBeTruthy();
    }
  });
});
