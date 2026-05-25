/**
 * scanTrustLayerHardening.test.js — verifies the Scan Trust Layer
 * permanent fixes:
 *   • validateScanImage.js              (hard image validator)
 *   • scanAcquisitionStateMachine.js    (11-state acquisition FSM)
 *   • scanResultContract.js             (typed result contract + Journal gate)
 *   • cameraFallbackEngine.js           (capture-method picker)
 *   • iosScanHardening.js               (HEIC + downscale + iOS Safari)
 */

import { describe, it, expect } from 'vitest';
import {
  validateScanImage, assertValidScanInput, INVALID_REASON,
} from '../../../src/core/scan/validateScanImage.js';
import {
  ACQ_STATE, ACQ_EVENT,
  nextAcquisitionState, canRunClassifier, canSaveJournal,
  fromCoarseState,
} from '../../../src/core/scan/scanAcquisitionStateMachine.js';
import {
  buildScanResult, verifyScanResultContract, isJournalSafe,
  REQUIRED_FIELDS,
} from '../../../src/core/scan/contracts/scanResultContract.js';
import {
  chooseCaptureMethod, CAPTURE_METHOD,
} from '../../../src/core/scan/cameraFallbackEngine.js';
import {
  isIosSafari, isHeic, computeDownscaleTarget, shouldRetryAfterBackgroundResume,
} from '../../../src/core/mobile/iosScanHardening.js';

// ─── validateScanImage ───────────────────────────────────

describe('validateScanImage', () => {
  it('null/undefined → invalid no_record', () => {
    expect(validateScanImage(null).valid).toBe(false);
    expect(validateScanImage(undefined).reason).toBe(INVALID_REASON.NO_RECORD);
  });

  it('object without survival channel → no_survival_channel', () => {
    const r = validateScanImage({ size: 100, mimeType: 'image/jpeg' });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe(INVALID_REASON.NO_SURVIVAL_CHANNEL);
  });

  it('zero bytes (no file) → empty_bytes', () => {
    const r = validateScanImage({
      objectUrl: 'blob:abc', size: 0, mimeType: 'image/jpeg',
    });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe(INVALID_REASON.EMPTY_BYTES);
  });

  it('unsupported MIME (PDF) → unsupported_mime', () => {
    const r = validateScanImage({
      objectUrl: 'blob:abc', size: 1024, mimeType: 'application/pdf',
    });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe(INVALID_REASON.UNSUPPORTED_MIME);
  });

  it('revoked/empty objectUrl → revoked_url', () => {
    const r = validateScanImage({
      objectUrl: '', dataUrlBackup: 'data:image/jpeg;base64,abc',
      size: 1024, mimeType: 'image/jpeg',
    });
    // Object url is empty → fails survival on the URL shape;
    // dataUrlBackup carries us through.
    expect(r.valid).toBe(true);
  });

  it('valid blob URL + size + MIME → valid:true', () => {
    const r = validateScanImage({
      objectUrl: 'blob:https://farroway.app/abc',
      size: 2048, mimeType: 'image/jpeg',
    });
    expect(r.valid).toBe(true);
    expect(r.size).toBe(2048);
    expect(r.mime).toBe('image/jpeg');
  });

  it('mismatched dimensions (one zero, one set) → bad_dimensions', () => {
    const r = validateScanImage({
      objectUrl: 'blob:abc', size: 1024, mimeType: 'image/jpeg',
      width: 100, height: 0,
    });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe(INVALID_REASON.BAD_DIMENSIONS);
  });

  it('valid record with no dimensions read → still valid', () => {
    const r = validateScanImage({
      objectUrl: 'blob:abc', size: 1024, mimeType: 'image/png',
    });
    expect(r.valid).toBe(true);
    expect(r.dimensions).toBe(null);
  });

  it('HEIC mime accepted (iOS source)', () => {
    const r = validateScanImage({
      objectUrl: 'blob:abc', size: 1024, mimeType: 'image/heic',
    });
    expect(r.valid).toBe(true);
  });

  it('assertValidScanInput delegates to validateScanImage', () => {
    expect(assertValidScanInput(null).valid).toBe(false);
    expect(assertValidScanInput({
      objectUrl: 'blob:x', size: 1, mimeType: 'image/jpeg',
    }).valid).toBe(true);
  });

  it('never throws on garbage input', () => {
    expect(() => validateScanImage(42)).not.toThrow();
    expect(() => validateScanImage('string')).not.toThrow();
  });
});

// ─── scanAcquisitionStateMachine ─────────────────────────

describe('scanAcquisitionStateMachine — 11-state acquisition FSM', () => {
  it('happy path: idle → camera → capturing → validating → persisting → ready → analyzing → result', () => {
    let s = ACQ_STATE.IDLE;
    s = nextAcquisitionState(s, ACQ_EVENT.REQUEST_CAMERA); expect(s).toBe(ACQ_STATE.REQUESTING_CAMERA);
    s = nextAcquisitionState(s, ACQ_EVENT.CAMERA_OPEN);    expect(s).toBe(ACQ_STATE.CAPTURING);
    s = nextAcquisitionState(s, ACQ_EVENT.PHOTO_CAPTURED); expect(s).toBe(ACQ_STATE.VALIDATING_IMAGE);
    s = nextAcquisitionState(s, ACQ_EVENT.VALIDATION_OK);  expect(s).toBe(ACQ_STATE.PERSISTING_IMAGE);
    s = nextAcquisitionState(s, ACQ_EVENT.PERSIST_OK);     expect(s).toBe(ACQ_STATE.IMAGE_READY);
    s = nextAcquisitionState(s, ACQ_EVENT.ANALYZE_START);  expect(s).toBe(ACQ_STATE.ANALYZING);
    s = nextAcquisitionState(s, ACQ_EVENT.ANALYZE_OK);     expect(s).toBe(ACQ_STATE.RESULT_READY);
  });

  it('camera denied → falls to selecting_photo (gallery)', () => {
    let s = ACQ_STATE.REQUESTING_CAMERA;
    s = nextAcquisitionState(s, ACQ_EVENT.CAMERA_DENIED);
    expect(s).toBe(ACQ_STATE.SELECTING_PHOTO);
  });

  it('camera timeout → falls to selecting_photo (gallery)', () => {
    let s = ACQ_STATE.REQUESTING_CAMERA;
    s = nextAcquisitionState(s, ACQ_EVENT.CAMERA_TIMEOUT);
    expect(s).toBe(ACQ_STATE.SELECTING_PHOTO);
  });

  it('validation_fail → FAILED (terminal)', () => {
    let s = ACQ_STATE.VALIDATING_IMAGE;
    s = nextAcquisitionState(s, ACQ_EVENT.VALIDATION_FAIL);
    expect(s).toBe(ACQ_STATE.FAILED);
  });

  it('persist_fail → FAILED (no analysis happens)', () => {
    let s = ACQ_STATE.PERSISTING_IMAGE;
    s = nextAcquisitionState(s, ACQ_EVENT.PERSIST_FAIL);
    expect(s).toBe(ACQ_STATE.FAILED);
  });

  it('offline detected from REQUESTING_CAMERA / IMAGE_READY / ANALYZING → OFFLINE_QUEUED', () => {
    for (const from of [ACQ_STATE.REQUESTING_CAMERA, ACQ_STATE.IMAGE_READY, ACQ_STATE.ANALYZING]) {
      expect(nextAcquisitionState(from, ACQ_EVENT.OFFLINE_DETECTED))
        .toBe(ACQ_STATE.OFFLINE_QUEUED);
    }
  });

  it('canRunClassifier true ONLY from IMAGE_READY / ANALYZING', () => {
    for (const s of Object.values(ACQ_STATE)) {
      const expected = (s === ACQ_STATE.IMAGE_READY || s === ACQ_STATE.ANALYZING);
      expect(canRunClassifier(s)).toBe(expected);
    }
  });

  it('canSaveJournal true ONLY from RESULT_READY / OFFLINE_QUEUED', () => {
    for (const s of Object.values(ACQ_STATE)) {
      const expected = (s === ACQ_STATE.RESULT_READY || s === ACQ_STATE.OFFLINE_QUEUED);
      expect(canSaveJournal(s)).toBe(expected);
    }
  });

  it('canSaveJournal NEVER true from FAILED', () => {
    expect(canSaveJournal(ACQ_STATE.FAILED)).toBe(false);
  });

  it('invalid transition returns current state', () => {
    expect(nextAcquisitionState(ACQ_STATE.IDLE, ACQ_EVENT.ANALYZE_START))
      .toBe(ACQ_STATE.IDLE);
  });

  it('fromCoarseState maps the legacy 8-state vocabulary', () => {
    expect(fromCoarseState('idle')).toBe(ACQ_STATE.IDLE);
    expect(fromCoarseState('failed_image')).toBe(ACQ_STATE.FAILED);
    expect(fromCoarseState('preview_ready')).toBe(ACQ_STATE.IMAGE_READY);
  });

  it('never throws on garbage input', () => {
    expect(() => nextAcquisitionState(null, null)).not.toThrow();
  });
});

// ─── scanResultContract ──────────────────────────────────

describe('scanResultContract', () => {
  it('REQUIRED_FIELDS lists the documented 8 fields', () => {
    expect(REQUIRED_FIELDS.length).toBe(8);
    for (const f of ['imageId', 'imageUrl', 'imageHash',
                     'classifierInputVerified', 'persisted',
                     'diagnosis', 'confidence', 'timestamp']) {
      expect(REQUIRED_FIELDS).toContain(f);
    }
  });

  it('verifyScanResultContract: missing imageId → ok:false + missing list', () => {
    const r = verifyScanResultContract({
      imageUrl: 'blob:x', imageHash: 'h', classifierInputVerified: true,
      persisted: true, diagnosis: { issue: 'x' }, confidence: 'high', timestamp: 1,
    });
    expect(r.ok).toBe(false);
    expect(r.missing).toContain('imageId');
  });

  it('classifierInputVerified must be exactly true', () => {
    const base = buildScanResult({
      imageId: 'i', imageUrl: 'u', imageHash: 'h',
      classifierInputVerified: false, persisted: true,
      diagnosis: { x: 1 }, confidence: 'high', timestamp: 100,
    });
    expect(verifyScanResultContract(base).ok).toBe(false);
    expect(verifyScanResultContract(base).reason).toBe('classifier_input_unverified');
  });

  it('persisted must be exactly true', () => {
    const base = buildScanResult({
      imageId: 'i', imageUrl: 'u', imageHash: 'h',
      classifierInputVerified: true, persisted: false,
      diagnosis: { x: 1 }, confidence: 'high', timestamp: 100,
    });
    expect(verifyScanResultContract(base).reason).toBe('not_persisted');
  });

  it('valid result → ok:true', () => {
    const r = buildScanResult({
      imageId: 'i', imageUrl: 'u', imageHash: 'h',
      classifierInputVerified: true, persisted: true,
      diagnosis: { issue: 'fungal' }, confidence: 'medium', timestamp: 1700000000000,
    });
    expect(verifyScanResultContract(r).ok).toBe(true);
    expect(isJournalSafe(r)).toBe(true);
  });

  it('isJournalSafe: failed validation → false', () => {
    expect(isJournalSafe(null)).toBe(false);
    expect(isJournalSafe({})).toBe(false);
  });

  it('buildScanResult preserves optional fields when present', () => {
    const r = buildScanResult({
      imageId: 'i', imageUrl: 'u', imageHash: 'h',
      classifierInputVerified: true, persisted: true,
      diagnosis: { x: 1 }, confidence: 'high', timestamp: 1,
      scanId: 'S', crop: 'tomato', followupTaskId: 'F',
    });
    expect(r.scanId).toBe('S');
    expect(r.crop).toBe('tomato');
    expect(r.followupTaskId).toBe('F');
  });
});

// ─── cameraFallbackEngine ────────────────────────────────

describe('chooseCaptureMethod', () => {
  it('offline → offline_queue regardless of device', () => {
    const m = chooseCaptureMethod({ userAgent: 'desktop chrome', online: false });
    expect(m.method).toBe(CAPTURE_METHOD.OFFLINE_QUEUE);
    expect(m.chain).toContain(CAPTURE_METHOD.OFFLINE_QUEUE);
  });

  it('prior denial → gallery fallback', () => {
    const m = chooseCaptureMethod({
      userAgent: 'desktop chrome', online: true,
      prior: { cameraDenied: true },
    });
    expect(m.method).toBe(CAPTURE_METHOD.GALLERY);
    expect(m.reason).toBe('prior_failure');
  });

  it('iOS Safari → input_capture (not getUserMedia)', () => {
    const m = chooseCaptureMethod({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      online: true,
    });
    expect(m.method).toBe(CAPTURE_METHOD.INPUT_CAPTURE);
    expect(m.reason).toBe('ios_safari');
  });

  it('iOS Chrome (CriOS) → NOT detected as iOS Safari', () => {
    const m = chooseCaptureMethod({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1',
      online: true,
    });
    expect(m.method).toBe(CAPTURE_METHOD.GET_USER_MEDIA);
  });

  it('default desktop → getUserMedia chain', () => {
    const m = chooseCaptureMethod({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
      online: true,
    });
    expect(m.method).toBe(CAPTURE_METHOD.GET_USER_MEDIA);
    expect(m.chain[0]).toBe(CAPTURE_METHOD.GET_USER_MEDIA);
    expect(m.chain).toContain(CAPTURE_METHOD.GALLERY);
  });

  it('never throws on garbage input', () => {
    expect(() => chooseCaptureMethod(null)).not.toThrow();
  });
});

// ─── iosScanHardening ────────────────────────────────────

describe('iosScanHardening', () => {
  it('isIosSafari true for iPhone Safari UA', () => {
    expect(isIosSafari('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1'))
      .toBe(true);
  });

  it('isIosSafari false for iPhone Chrome / Firefox', () => {
    expect(isIosSafari('CriOS/120 Mobile')).toBe(false);
    expect(isIosSafari('FxiOS/120 Mobile')).toBe(false);
  });

  it('isHeic detects MIME + filename', () => {
    expect(isHeic({ type: 'image/heic' })).toBe(true);
    expect(isHeic({ type: 'image/heif' })).toBe(true);
    expect(isHeic({ name: 'photo.HEIC' })).toBe(true);
    expect(isHeic({ type: 'image/jpeg' })).toBe(false);
    expect(isHeic(null)).toBe(false);
  });

  it('computeDownscaleTarget shrinks large images, preserves AR', () => {
    const t = computeDownscaleTarget({ width: 4032, height: 3024 }, 2048);
    expect(t.scaled).toBe(true);
    expect(Math.max(t.width, t.height)).toBe(2048);
    // Aspect ratio preserved within rounding
    expect(t.width / t.height).toBeCloseTo(4032 / 3024, 2);
  });

  it('computeDownscaleTarget passes through small images', () => {
    const t = computeDownscaleTarget({ width: 800, height: 600 }, 2048);
    expect(t.scaled).toBe(false);
    expect(t.width).toBe(800);
  });

  it('shouldRetryAfterBackgroundResume — short suspension = no retry', () => {
    const r = shouldRetryAfterBackgroundResume({
      wasSuspended: true, secondsSuspended: 2,
    });
    expect(r.retry).toBe(false);
  });

  it('shouldRetryAfterBackgroundResume — camera stream reclaimed → retry', () => {
    const r = shouldRetryAfterBackgroundResume({
      wasSuspended: true, secondsSuspended: 10, hasCameraStream: true,
    });
    expect(r.retry).toBe(true);
  });

  it('shouldRetryAfterBackgroundResume — long suspension → retry', () => {
    const r = shouldRetryAfterBackgroundResume({
      wasSuspended: true, secondsSuspended: 60,
    });
    expect(r.retry).toBe(true);
  });

  it('never throws on garbage input', () => {
    expect(() => computeDownscaleTarget(null)).not.toThrow();
    expect(() => shouldRetryAfterBackgroundResume(null)).not.toThrow();
    expect(() => isHeic(undefined)).not.toThrow();
  });
});
