/**
 * stableScanImageStore.test.js — Permanent Scan Image
 * Preservation. Verifies the one-record store, the no-early-revoke
 * rule, the analysis-gating predicate, and the analyze() entry on
 * the classifier that hard-blocks invalid-image inputs.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  storeStableScanImage, getCurrentScanImage, replaceScanImage,
  clearScanImage, setImageDimensions,
  isValidForAnalysis, toAnalyzerInput,
  _setUrlHooks, _resetUrlHooks,
} from '../../../src/core/scan/stableScanImageStore.js';
import {
  analyze, ISSUE_CATEGORY,
} from '../../../src/core/scan/fastIssueClassifier.js';

// In-memory URL hooks so we can verify revocation timing.
let _nextUrl = 1;
const _revoked = new Set();
function _installUrlHooks() {
  _nextUrl = 1;
  _revoked.clear();
  _setUrlHooks(
    () => `blob://farroway/${_nextUrl++}`,
    (url) => { _revoked.add(url); },
  );
}

const _fakeBlob = (size = 200_000, type = 'image/jpeg') => ({
  size, type,
});

describe('stableScanImageStore — store + replace + clear', () => {
  beforeEach(() => { _installUrlHooks(); clearScanImage(); });

  it('storeStableScanImage produces a record with objectUrl + meta', () => {
    const r = storeStableScanImage({ blob: _fakeBlob() });
    expect(r).toBeTruthy();
    expect(r.objectUrl).toMatch(/^blob:\/\/farroway\//);
    expect(r.mimeType).toBe('image/jpeg');
    expect(r.size).toBe(200_000);
    expect(getCurrentScanImage()).toBe(r);
  });

  it('replaceScanImage revokes the prior URL and assigns a new one', () => {
    const a = storeStableScanImage({ blob: _fakeBlob() });
    const b = replaceScanImage({ blob: _fakeBlob() });
    expect(_revoked.has(a.objectUrl)).toBe(true);
    expect(b.objectUrl).not.toBe(a.objectUrl);
    expect(_revoked.has(b.objectUrl)).toBe(false);
  });

  it('clearScanImage revokes and empties the current record', () => {
    const r = storeStableScanImage({ blob: _fakeBlob() });
    clearScanImage();
    expect(_revoked.has(r.objectUrl)).toBe(true);
    expect(getCurrentScanImage()).toBe(null);
  });

  it('setImageDimensions updates width/height without changing objectUrl', () => {
    const r = storeStableScanImage({ blob: _fakeBlob() });
    const u = setImageDimensions(1280, 720);
    expect(u.objectUrl).toBe(r.objectUrl);
    expect(u.width).toBe(1280);
    expect(u.height).toBe(720);
    // Crucially: the previous URL is NOT in the revoked set.
    expect(_revoked.has(r.objectUrl)).toBe(false);
  });

  it('never throws on garbage input', () => {
    expect(() => storeStableScanImage(null)).not.toThrow();
    expect(storeStableScanImage(null)).toBe(null);
    expect(() => clearScanImage()).not.toThrow();
  });
});

describe('isValidForAnalysis — the analysis gate', () => {
  beforeEach(() => { _installUrlHooks(); clearScanImage(); });

  it('passes for a real file with dimensions', () => {
    storeStableScanImage({ blob: _fakeBlob() });
    setImageDimensions(1280, 720);
    expect(isValidForAnalysis().ok).toBe(true);
  });

  it('rejects no_image when nothing has been stored', () => {
    clearScanImage();
    expect(isValidForAnalysis().reason).toBe('no_image');
  });

  it('rejects bad_mime for non-image blobs', () => {
    storeStableScanImage({ blob: _fakeBlob(200_000, 'application/pdf') });
    setImageDimensions(1280, 720);
    expect(isValidForAnalysis().reason).toBe('bad_mime');
  });

  it('rejects empty_blob for zero-size files', () => {
    storeStableScanImage({ blob: _fakeBlob(0) });
    setImageDimensions(1280, 720);
    expect(isValidForAnalysis().reason).toBe('empty_blob');
  });

  it('rejects not_loaded when dimensions are still zero', () => {
    storeStableScanImage({ blob: _fakeBlob() });
    expect(isValidForAnalysis().reason).toBe('not_loaded');
  });

  it('toAnalyzerInput produces a usable shape for the classifier', () => {
    storeStableScanImage({ blob: _fakeBlob() });
    setImageDimensions(1280, 720);
    const a = toAnalyzerInput();
    expect(a.imageBlob).toBeTruthy();
    expect(a.imageMeta.width).toBe(1280);
    expect(a.imageMeta.height).toBe(720);
    expect(a.imageMeta.mimeType).toBe('image/jpeg');
  });

  it('toAnalyzerInput is safe with no current image', () => {
    clearScanImage();
    const a = toAnalyzerInput();
    expect(a.imageFile).toBe(null);
    expect(a.imageMeta).toBe(null);
  });
});

describe('classifier.analyze() — image-aware gate (no faked low-confidence)', () => {
  beforeEach(() => { _installUrlHooks(); clearScanImage(); });

  it('returns ok:true + a classifier result for a valid image', () => {
    storeStableScanImage({ blob: _fakeBlob() });
    setImageDimensions(1280, 720);
    const input = toAnalyzerInput();
    const r = analyze({
      ...input,
      scanSignals: { spots: true },
      crop: 'tomato',
    });
    expect(r.ok).toBe(true);
    expect(r.result.issueCategory).toBe(ISSUE_CATEGORY.LEAF_SPOT);
    expect(r.userMessage).toBe(null);
  });

  it('returns ok:false + userMessage on a missing image — NOT a fake low-confidence result', () => {
    const r = analyze({
      imageFile: null, imageBlob: null, imageMeta: null,
      scanSignals: { spots: true }, crop: 'tomato',
    });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('no_image');
    expect(r.userMessage.fallback).toMatch(/photo could not be loaded/i);
    expect(r.result).toBe(null);
  });

  it('returns ok:false on a wrong-mime blob', () => {
    const r = analyze({
      imageBlob: _fakeBlob(200_000, 'application/pdf'),
      imageMeta: { mimeType: 'application/pdf', size: 200_000, width: 100, height: 100 },
    });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('bad_mime');
  });

  it('returns ok:false on an empty (size=0) blob', () => {
    const r = analyze({
      imageBlob: _fakeBlob(0),
      imageMeta: { mimeType: 'image/jpeg', size: 0, width: 100, height: 100 },
    });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('empty_blob');
  });

  it('returns ok:false on a not-yet-loaded image (zero dims)', () => {
    const r = analyze({
      imageBlob: _fakeBlob(),
      imageMeta: { mimeType: 'image/jpeg', size: 200_000, width: 0, height: 0 },
    });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('not_loaded');
  });

  it('never throws on garbage input', () => {
    expect(() => analyze(null)).not.toThrow();
    const r = analyze(null);
    expect(r.ok).toBe(false);
    expect(r.userMessage.fallback).toMatch(/photo could not be loaded/i);
  });
});

afterAllSafe(() => _resetUrlHooks());

// Some test runners don't expose afterAll cleanly when there's a
// guard predicate — defining a tiny shim keeps this self-contained.
function afterAllSafe(fn) {
  try {
    if (typeof globalThis.afterAll === 'function') {
      globalThis.afterAll(fn);
    } else {
      try { fn(); } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
}
