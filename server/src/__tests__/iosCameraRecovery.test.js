/**
 * iosCameraRecovery.test.js — iPhone Safari Camera Permission
 * Recovery Fix.
 *
 *   1. iosDetection.detectIosCamera() — UA-sniffed snapshot
 *   2. cameraErrorClassifier.classifyCameraError() — maps every
 *      spec-mandated failure type to user-facing copy + actions
 *   3. cameraFailureCounter — module-level counter that survives
 *      navigation, drives the after-2-failures auto-fallback
 *   4. cameraSession.stopCamera() cleanup already correct
 *      (regression guard)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  detectIosCamera,
} from '../../../src/lib/camera/iosDetection.js';
import {
  classifyCameraError,
  CAMERA_FAILURE_KINDS,
} from '../../../src/lib/camera/cameraErrorClassifier.js';
import {
  recordCameraFailure,
  recordCameraSuccess,
  getCameraFailureCount,
  getLastCameraFailureKind,
  shouldAutoFallback,
  resetCameraFailureCounter,
  AUTO_FALLBACK_THRESHOLD,
} from '../../../src/lib/camera/cameraFailureCounter.js';

const IOS_SAFARI_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IOS_CHROME_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1';
const ANDROID_CHROME_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36';
const DESKTOP_SAFARI_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';

function withNavigator(ua, platform, extra) {
  const restore = { hasNavigator: 'navigator' in globalThis, prev: globalThis.navigator };
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      userAgent:        ua,
      platform:         platform || '',
      maxTouchPoints:   (extra && extra.maxTouchPoints)   || 0,
      standalone:       (extra && extra.standalone)        || false,
    },
    configurable: true,
    writable:     true,
  });
  return () => {
    if (restore.hasNavigator) {
      Object.defineProperty(globalThis, 'navigator', {
        value: restore.prev, configurable: true, writable: true,
      });
    } else {
      delete globalThis.navigator;
    }
  };
}

beforeEach(() => {
  resetCameraFailureCounter();
});

// ─── 1. detectIosCamera ──────────────────────────────────────

describe('detectIosCamera', () => {
  let restore;
  afterEach(() => { if (restore) { restore(); restore = null; } });

  it('iPhone Safari → isIos + isSafari true', () => {
    restore = withNavigator(IOS_SAFARI_UA, 'iPhone');
    const out = detectIosCamera();
    expect(out.isIos).toBe(true);
    expect(out.isSafari).toBe(true);
    expect(out.uaSummary).toBe('ios_safari');
  });

  it('iPhone Chrome → isIos but NOT isSafari', () => {
    restore = withNavigator(IOS_CHROME_UA, 'iPhone');
    const out = detectIosCamera();
    expect(out.isIos).toBe(true);
    expect(out.isSafari).toBe(false);
    expect(out.uaSummary).toBe('ios_other');
  });

  it('Android Chrome → neither iOS nor Safari', () => {
    restore = withNavigator(ANDROID_CHROME_UA, 'Linux armv8l');
    const out = detectIosCamera();
    expect(out.isIos).toBe(false);
    expect(out.isSafari).toBe(false);
    expect(out.uaSummary).toBe('other');
  });

  it('Desktop Safari → isSafari true, isIos false', () => {
    restore = withNavigator(DESKTOP_SAFARI_UA, 'MacIntel');
    const out = detectIosCamera();
    expect(out.isIos).toBe(false);
    expect(out.isSafari).toBe(true);
    expect(out.uaSummary).toBe('safari_desktop');
  });

  it('iPad in desktop mode (Macintosh UA + touch points)', () => {
    restore = withNavigator(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
      'MacIntel',
      { maxTouchPoints: 5 },
    );
    const out = detectIosCamera();
    expect(out.isIos).toBe(true);
    expect(out.isSafari).toBe(true);
  });

  it('returns empty shape when navigator is unavailable', () => {
    const out = detectIosCamera();
    expect(out.isIos).toBe(false);
    expect(out.isSafari).toBe(false);
    expect(out.uaSummary).toBeTruthy();
  });
});

// ─── 2. classifyCameraError ──────────────────────────────────

const IOS_CTX = {
  ios: { isIos: true, isSafari: true, isStandalone: false, isPrivateLikely: false, uaSummary: 'ios_safari' },
  isSecure: true,
  attemptCount: 0,
};
const OTHER_CTX = {
  ios: { isIos: false, isSafari: false, isStandalone: false, isPrivateLikely: false, uaSummary: 'other' },
  isSecure: true,
  attemptCount: 0,
};

describe('classifyCameraError — error kind mapping', () => {
  it('NotAllowedError → permission_denied', () => {
    const out = classifyCameraError({ name: 'NotAllowedError' }, OTHER_CTX);
    expect(out.kind).toBe(CAMERA_FAILURE_KINDS.PERMISSION_DENIED);
  });

  it('NotFoundError → no_camera', () => {
    const out = classifyCameraError({ name: 'NotFoundError' }, OTHER_CTX);
    expect(out.kind).toBe(CAMERA_FAILURE_KINDS.NO_CAMERA);
  });

  it('NotReadableError → hardware_busy', () => {
    const out = classifyCameraError({ name: 'NotReadableError' }, OTHER_CTX);
    expect(out.kind).toBe(CAMERA_FAILURE_KINDS.HARDWARE_BUSY);
  });

  it('AbortError → browser_interrupted', () => {
    const out = classifyCameraError({ name: 'AbortError' }, OTHER_CTX);
    expect(out.kind).toBe(CAMERA_FAILURE_KINDS.BROWSER_INTERRUPTED);
  });

  it('SecurityError on insecure origin → insecure_origin', () => {
    const out = classifyCameraError({ name: 'SecurityError' }, { ...OTHER_CTX, isSecure: false });
    expect(out.kind).toBe(CAMERA_FAILURE_KINDS.INSECURE_ORIGIN);
  });

  it('SecurityError on secure origin → permission_denied', () => {
    const out = classifyCameraError({ name: 'SecurityError' }, OTHER_CTX);
    expect(out.kind).toBe(CAMERA_FAILURE_KINDS.PERMISSION_DENIED);
  });

  it('OverconstrainedError → overconstrained', () => {
    const out = classifyCameraError({ name: 'OverconstrainedError' }, OTHER_CTX);
    expect(out.kind).toBe(CAMERA_FAILURE_KINDS.OVERCONSTRAINED);
  });

  it.each([
    ['unsupported',    CAMERA_FAILURE_KINDS.NO_CAMERA],
    ['ready_deadline', CAMERA_FAILURE_KINDS.STREAM_TIMEOUT],
    ['no_video',       CAMERA_FAILURE_KINDS.STREAM_TIMEOUT],
    ['denied',         CAMERA_FAILURE_KINDS.PERMISSION_DENIED],
    ['busy',           CAMERA_FAILURE_KINDS.HARDWARE_BUSY],
    ['not_found',      CAMERA_FAILURE_KINDS.NO_CAMERA],
    ['in_flight',      CAMERA_FAILURE_KINDS.BROWSER_INTERRUPTED],
  ])('cameraSession reason "%s" → %s', (reason, expected) => {
    const out = classifyCameraError({ reason }, OTHER_CTX);
    expect(out.kind).toBe(expected);
  });

  it('unknown error name → unknown', () => {
    const out = classifyCameraError({ name: 'SomethingNew' }, OTHER_CTX);
    expect(out.kind).toBe(CAMERA_FAILURE_KINDS.UNKNOWN);
  });
});

describe('classifyCameraError — iOS-specific copy', () => {
  it('permission_denied on iPhone Safari after 2 attempts → iOS settings instructions', () => {
    const out = classifyCameraError(
      { name: 'NotAllowedError' },
      { ...IOS_CTX, attemptCount: 2 },
    );
    expect(out.title.toLowerCase()).toContain('safari');
    expect(out.instructions.length).toBeGreaterThan(0);
    expect(out.instructions.join(' ').toLowerCase()).toContain('settings');
    expect(out.secondaryCta.kind).toBe('open_settings');
    expect(out.primaryCta.kind).toBe('use_saved_photo');
    expect(out.autoFallback).toBe(true);
  });

  it('permission_denied on first attempt is recoverable — primary CTA is retry', () => {
    const out = classifyCameraError(
      { name: 'NotAllowedError' },
      { ...IOS_CTX, attemptCount: 0 },
    );
    expect(out.primaryCta.kind).toBe('retry');
    expect(out.autoFallback).toBe(false);
  });

  it('permission_denied on non-iOS browser after 2 attempts → generic settings copy', () => {
    const out = classifyCameraError(
      { name: 'NotAllowedError' },
      { ...OTHER_CTX, attemptCount: 2 },
    );
    expect(out.instructions.length).toBeGreaterThan(0);
    expect(out.title.toLowerCase()).not.toContain('safari');
    expect(out.autoFallback).toBe(true);
  });

  it('no_camera always shows "saved photos too" copy regardless of platform', () => {
    const out = classifyCameraError({ name: 'NotFoundError' }, IOS_CTX);
    expect(out.body.toLowerCase()).toContain('saved photo');
    expect(out.primaryCta.kind).toBe('use_saved_photo');
  });
});

describe('classifyCameraError — safety guards', () => {
  it('null input returns a calm envelope', () => {
    const out = classifyCameraError(null);
    expect(out.kind).toBe(CAMERA_FAILURE_KINDS.UNKNOWN);
    expect(out.primaryCta).toBeTruthy();
  });

  it('frozen envelope', () => {
    const out = classifyCameraError({ name: 'NotAllowedError' }, OTHER_CTX);
    expect(Object.isFrozen(out)).toBe(true);
  });

  it('never leaks the raw DOMException name into copy', () => {
    const out = classifyCameraError({ name: 'NotAllowedError' }, OTHER_CTX);
    const blob = JSON.stringify(out);
    expect(blob).not.toMatch(/NotAllowedError/);
    expect(blob).not.toMatch(/SecurityError/);
    expect(blob).not.toMatch(/NotReadableError/);
  });
});

// ─── 3. cameraFailureCounter ─────────────────────────────────

describe('cameraFailureCounter', () => {
  it('records failures and increments the count', () => {
    expect(getCameraFailureCount()).toBe(0);
    expect(recordCameraFailure('permission_denied')).toBe(1);
    expect(recordCameraFailure('hardware_busy')).toBe(2);
    expect(getCameraFailureCount()).toBe(2);
    expect(getLastCameraFailureKind()).toBe('hardware_busy');
  });

  it('shouldAutoFallback flips after the threshold', () => {
    expect(getCameraFailureCount()).toBe(0); // beforeEach clears
    expect(shouldAutoFallback()).toBe(false);
    recordCameraFailure();
    expect(getCameraFailureCount()).toBe(1);
    expect(shouldAutoFallback()).toBe(false);
    recordCameraFailure();
    expect(getCameraFailureCount()).toBe(2);
    expect(shouldAutoFallback()).toBe(true);
    expect(AUTO_FALLBACK_THRESHOLD).toBe(2);
  });

  it('recordCameraSuccess clears the counter', () => {
    recordCameraFailure();
    recordCameraFailure();
    recordCameraSuccess();
    expect(getCameraFailureCount()).toBe(0);
    expect(shouldAutoFallback()).toBe(false);
    expect(getLastCameraFailureKind()).toBeNull();
  });

  it('resetCameraFailureCounter wipes state for tests', () => {
    recordCameraFailure();
    resetCameraFailureCounter();
    expect(getCameraFailureCount()).toBe(0);
  });
});

// ─── 4. stopCamera() cleanup regression guard ────────────────

describe('cameraSession.stopCamera — cleanup contract', () => {
  it('stopCamera is idempotent + always leaves the session in IDLE', async () => {
    // The detailed track-stop / srcObject-null contract is covered
    // by the existing cameraSession.test.js suite. Here we just
    // verify the public-facing invariant: calling stopCamera() on
    // a fresh session never throws and always leaves the state
    // machine in IDLE. That's the only guarantee callers depend
    // on outside the service itself.
    const mod = await import('../../../src/services/cameraSession.js');
    mod._resetCameraSession();
    expect(() => mod.stopCamera()).not.toThrow();
    expect(mod.getCameraState()).toBe(mod.CAMERA_SESSION_STATES.IDLE);
    // Idempotent — second call must also be safe.
    expect(() => mod.stopCamera()).not.toThrow();
    expect(mod.getCameraState()).toBe(mod.CAMERA_SESSION_STATES.IDLE);
  });
});
