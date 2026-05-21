/**
 * safeScanImagePipeline.test.js — Scan Pipeline Hardening. Covers
 * the pure gating + validation rules that the existing scan flow
 * can adopt to stop the "analyze fired on a half-loaded blob" bug
 * and the Safari/iPhone "preview revoked too early" bug.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SCAN_STAGE, SCAN_OBS,
  validateImageCapture, validateImageDimensions,
  canAnalyze, isPreviewStable, isImageQualityPoor,
  shouldRevokeBlobUrl,
  recordScanObservation, getScanObservationCounts, resetScanObservationCounts,
} from '../../../src/core/scan/safeScanImagePipeline.js';

// ─── validateImageCapture ──────────────────────────────────

describe('validateImageCapture', () => {
  it('accepts a real-looking jpeg blob', () => {
    const r = validateImageCapture({ type: 'image/jpeg', size: 200_000 });
    expect(r.ok).toBe(true);
    expect(r.mime).toBe('image/jpeg');
    expect(r.sizeBytes).toBe(200_000);
  });

  it('accepts a sized data URL', () => {
    // 4 KB of pad ≈ 3 KB of payload after the base64 / 3*4 estimate
    const dataUrl = 'data:image/png;base64,' + 'A'.repeat(8000);
    const r = validateImageCapture(dataUrl);
    expect(r.ok).toBe(true);
    expect(r.mime).toBe('image/png');
  });

  it('rejects a too-small / stub blob', () => {
    const r = validateImageCapture({ type: 'image/jpeg', size: 100 });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('too_small');
  });

  it('rejects an unsupported mime', () => {
    const r = validateImageCapture({ type: 'application/pdf', size: 50_000 });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('unsupported_mime');
  });

  it('never throws on garbage input', () => {
    expect(() => validateImageCapture(null)).not.toThrow();
    expect(validateImageCapture(null).ok).toBe(false);
    expect(validateImageCapture(42).ok).toBe(false);
  });
});

// ─── validateImageDimensions ───────────────────────────────

describe('validateImageDimensions', () => {
  it('passes a normal phone-photo size', () => {
    expect(validateImageDimensions({ width: 1080, height: 1920 }).ok).toBe(true);
  });

  it('treats 0/0 as not-yet-loaded, not an error verdict', () => {
    const r = validateImageDimensions({ width: 0, height: 0 });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('not_loaded');
  });

  it('rejects extreme aspect ratios', () => {
    expect(validateImageDimensions({ width: 100, height: 2000 }).ok).toBe(false);
  });

  it('rejects tiny crops', () => {
    expect(validateImageDimensions({ width: 32, height: 32 }).ok).toBe(false);
  });
});

// ─── canAnalyze — the GATE ─────────────────────────────────

describe('canAnalyze — the analysis gate', () => {
  const goodCapture = { ok: true, mime: 'image/jpeg', sizeBytes: 200_000 };
  const goodDims = { ok: true, width: 1080, height: 1920 };

  it('passes only when preview is stable AND both validations succeeded', () => {
    expect(canAnalyze({
      isPreviewStable: true,
      captureValidation: goodCapture,
      dimensionValidation: goodDims,
    })).toBe(true);
  });

  it('blocks while preview is not yet stable', () => {
    expect(canAnalyze({
      isPreviewStable: false,
      captureValidation: goodCapture,
      dimensionValidation: goodDims,
    })).toBe(false);
  });

  it('blocks when an analysis is already in flight (no double-fire)', () => {
    expect(canAnalyze({
      isPreviewStable: true,
      captureValidation: goodCapture,
      dimensionValidation: goodDims,
      analysisInFlight: true,
    })).toBe(false);
  });

  it('blocks when capture validation failed (bad blob)', () => {
    expect(canAnalyze({
      isPreviewStable: true,
      captureValidation: { ok: false, reason: 'too_small' },
      dimensionValidation: goodDims,
    })).toBe(false);
  });

  it('never throws on garbage state', () => {
    expect(() => canAnalyze(null)).not.toThrow();
    expect(canAnalyze(null)).toBe(false);
  });
});

// ─── isPreviewStable ───────────────────────────────────────

describe('isPreviewStable', () => {
  it('only true when preview reported onload AND dims are valid', () => {
    expect(isPreviewStable({
      previewLoaded: true,
      dimensionValidation: { ok: true, width: 800, height: 600 },
    })).toBe(true);
    expect(isPreviewStable({ previewLoaded: false })).toBe(false);
    expect(isPreviewStable({
      previewLoaded: true,
      dimensionValidation: { ok: false, reason: 'not_loaded' },
    })).toBe(false);
  });
});

// ─── isImageQualityPoor — anti-premature-fail ──────────────

describe('isImageQualityPoor — needs MULTIPLE failed signals', () => {
  it('does NOT fail on a single dim signal — keeps analyzing', () => {
    const r = isImageQualityPoor({ brightness: 0.1, contrast: 0.4, blurScore: 0.3, cropVisibility: 0.8 });
    expect(r.poor).toBe(false);
    expect(r.reasons).toEqual(['too_dark']);
  });

  it('fails ONLY when at least two independent signals agree', () => {
    const r = isImageQualityPoor({ brightness: 0.1, contrast: 0.05, blurScore: 0.8, cropVisibility: 0.1 });
    expect(r.poor).toBe(true);
    expect(r.reasons.length).toBeGreaterThanOrEqual(2);
  });

  it('returns no-failure when no metrics are provided (do not assume poor)', () => {
    expect(isImageQualityPoor({}).poor).toBe(false);
  });

  it('never throws on garbage input', () => {
    expect(() => isImageQualityPoor(null)).not.toThrow();
    expect(isImageQualityPoor('x').poor).toBe(false);
  });
});

// ─── shouldRevokeBlobUrl — Safari fix ─────────────────────

describe('shouldRevokeBlobUrl — revoke only after RESULT or ERROR', () => {
  it('does NOT revoke during preview or analyze stages', () => {
    expect(shouldRevokeBlobUrl(SCAN_STAGE.PREVIEW_RENDERING)).toBe(false);
    expect(shouldRevokeBlobUrl(SCAN_STAGE.PREVIEW_STABLE)).toBe(false);
    expect(shouldRevokeBlobUrl(SCAN_STAGE.ANALYZING)).toBe(false);
  });

  it('revokes once the result has rendered', () => {
    expect(shouldRevokeBlobUrl(SCAN_STAGE.RESULT)).toBe(true);
  });

  it('revokes after an error too, so we do not leak URLs', () => {
    expect(shouldRevokeBlobUrl(SCAN_STAGE.ERROR)).toBe(true);
  });
});

// ─── Observability adapter ─────────────────────────────────

describe('recordScanObservation — observability adapter', () => {
  beforeEach(() => resetScanObservationCounts());

  it('counts events in-memory and forwards errors to observabilityTracker', () => {
    recordScanObservation(SCAN_OBS.ANALYSIS_FAILED);
    recordScanObservation(SCAN_OBS.ANALYSIS_FAILED);
    recordScanObservation(SCAN_OBS.GALLERY_SUCCESS);
    const counts = getScanObservationCounts();
    expect(counts[SCAN_OBS.ANALYSIS_FAILED]).toBe(2);
    expect(counts[SCAN_OBS.GALLERY_SUCCESS]).toBe(1);
  });

  it('never throws on bogus input', () => {
    expect(() => recordScanObservation(null)).not.toThrow();
    expect(recordScanObservation(undefined)).toBe(false);
  });
});
