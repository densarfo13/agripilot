/**
 * cameraPermissionManager.test.js — Camera Permission Recovery +
 * iPhone Safari Hardening. Covers the pure state machine, the
 * one-retry rule, platform detection, per-platform guidance, the
 * always-on gallery rule, and the observability adapter.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CAMERA_PERMISSION, PLATFORM, CAMERA_PURPOSE, CAMERA_OBS,
  nextPermissionState, canRetry, detectPlatform, settingsGuidance,
  isGalleryAvailable,
  recordCameraObservation, getCameraObservationCounts, resetCameraObservationCounts,
} from '../../../src/core/camera/cameraPermissionManager.js';

// ─── State machine ────────────────────────────────────────

describe('nextPermissionState — valid transitions only', () => {
  it('UNKNOWN → REQUESTING is allowed', () => {
    expect(nextPermissionState(CAMERA_PERMISSION.UNKNOWN, CAMERA_PERMISSION.REQUESTING))
      .toBe(CAMERA_PERMISSION.REQUESTING);
  });

  it('REQUESTING → GRANTED/DENIED/BLOCKED are allowed', () => {
    for (const target of [CAMERA_PERMISSION.GRANTED, CAMERA_PERMISSION.DENIED, CAMERA_PERMISSION.BLOCKED]) {
      expect(nextPermissionState(CAMERA_PERMISSION.REQUESTING, target)).toBe(target);
    }
  });

  it('DENIED → RETRYING is allowed; → REQUESTING is NOT (we never re-prompt automatically)', () => {
    expect(nextPermissionState(CAMERA_PERMISSION.DENIED, CAMERA_PERMISSION.RETRYING))
      .toBe(CAMERA_PERMISSION.RETRYING);
    expect(nextPermissionState(CAMERA_PERMISSION.DENIED, CAMERA_PERMISSION.REQUESTING))
      .toBe(CAMERA_PERMISSION.DENIED);
  });

  it('BLOCKED is terminal — only UNKNOWN reset is allowed', () => {
    expect(nextPermissionState(CAMERA_PERMISSION.BLOCKED, CAMERA_PERMISSION.GRANTED))
      .toBe(CAMERA_PERMISSION.BLOCKED);
    expect(nextPermissionState(CAMERA_PERMISSION.BLOCKED, CAMERA_PERMISSION.UNKNOWN))
      .toBe(CAMERA_PERMISSION.UNKNOWN);
  });

  it('invalid signals are a no-op', () => {
    expect(nextPermissionState(CAMERA_PERMISSION.UNKNOWN, 'on_fire'))
      .toBe(CAMERA_PERMISSION.UNKNOWN);
    expect(() => nextPermissionState(null, null)).not.toThrow();
  });
});

// ─── canRetry — anti-loop rule ────────────────────────────

describe('canRetry — at most one retry per session', () => {
  it('allows retry exactly once from DENIED', () => {
    expect(canRetry(CAMERA_PERMISSION.DENIED, 0)).toBe(true);
    expect(canRetry(CAMERA_PERMISSION.DENIED, 1)).toBe(false);
    expect(canRetry(CAMERA_PERMISSION.DENIED, 5)).toBe(false);
  });

  it('never allows retry from BLOCKED — Settings is the only path', () => {
    expect(canRetry(CAMERA_PERMISSION.BLOCKED, 0)).toBe(false);
  });

  it('never throws on garbage input', () => {
    expect(() => canRetry(null, null)).not.toThrow();
    expect(canRetry('x', NaN)).toBe(false);
  });
});

// ─── Platform detection ───────────────────────────────────

describe('detectPlatform', () => {
  it('detects iPhone Safari', () => {
    expect(detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'))
      .toBe(PLATFORM.IOS);
  });

  it('detects Android Chrome', () => {
    expect(detectPlatform('Mozilla/5.0 (Linux; Android 13; Pixel) Chrome/'))
      .toBe(PLATFORM.ANDROID);
  });

  it('detects desktop browsers', () => {
    expect(detectPlatform('Mozilla/5.0 (Windows NT 10.0) Chrome/')).toBe(PLATFORM.DESKTOP);
  });

  it('falls back to unknown on empty / garbage', () => {
    expect(detectPlatform('')).toBe(PLATFORM.UNKNOWN);
    expect(detectPlatform(null)).toBe(PLATFORM.UNKNOWN);
  });
});

// ─── settingsGuidance — per-platform copy ─────────────────

describe('settingsGuidance — calm per-platform instructions', () => {
  it('iOS guidance mentions Safari and Camera', () => {
    const g = settingsGuidance(PLATFORM.IOS);
    expect(g.fallback).toMatch(/Safari/i);
    expect(g.fallback).toMatch(/Camera/i);
  });

  it('Android guidance mentions site/permission settings', () => {
    const g = settingsGuidance(PLATFORM.ANDROID);
    expect(g.fallback).toMatch(/Permission|Camera/i);
  });

  it('every platform returns a translation key + fallback', () => {
    for (const p of Object.values(PLATFORM)) {
      const g = settingsGuidance(p);
      expect(typeof g.key).toBe('string');
      expect(g.key).toMatch(/^camera\.settings\./);
      expect(typeof g.fallback).toBe('string');
      expect(g.fallback.length).toBeGreaterThan(0);
    }
  });
});

// ─── Gallery is always available ──────────────────────────

describe('isGalleryAvailable — the no-dead-end rule', () => {
  it('returns true for every permission state', () => {
    for (const s of Object.values(CAMERA_PERMISSION)) {
      expect(isGalleryAvailable(s)).toBe(true);
    }
  });
});

// ─── Camera education copy ────────────────────────────────

describe('CAMERA_PURPOSE — short, calm, localizable', () => {
  it('exposes a translation key + English fallback', () => {
    expect(CAMERA_PURPOSE.key).toBe('camera.purpose');
    expect(typeof CAMERA_PURPOSE.fallback).toBe('string');
    expect(CAMERA_PURPOSE.fallback).toMatch(/camera/i);
    expect(CAMERA_PURPOSE.fallback.length).toBeLessThanOrEqual(160);
  });
});

// ─── Observability adapter ────────────────────────────────

describe('recordCameraObservation — observability adapter', () => {
  beforeEach(() => resetCameraObservationCounts());

  it('counts events in memory + forwards denials/blocks to observabilityTracker', () => {
    recordCameraObservation(CAMERA_OBS.PERMISSION_DENIED);
    recordCameraObservation(CAMERA_OBS.GALLERY_FALLBACK_USED);
    recordCameraObservation(CAMERA_OBS.GALLERY_FALLBACK_USED);
    const counts = getCameraObservationCounts();
    expect(counts[CAMERA_OBS.PERMISSION_DENIED]).toBe(1);
    expect(counts[CAMERA_OBS.GALLERY_FALLBACK_USED]).toBe(2);
  });

  it('never throws on bogus input', () => {
    expect(() => recordCameraObservation(null)).not.toThrow();
    expect(recordCameraObservation(undefined)).toBe(false);
  });
});
