/**
 * cameraSession.test.js — verifies the canonical single-session
 * camera service contract:
 *   • supported-check returns 'unsupported' when no mediaDevices
 *   • startCamera fails cleanly with no video element
 *   • stopCamera is idempotent
 *   • setSessionState rejects unknown states
 *   • state transitions emit [SCAN_CAMERA_STATE] logs
 *   • _resetCameraSession returns to idle
 *
 * The full getUserMedia happy path requires a real browser DOM
 * + permission grant, so the tests here cover the contract +
 * the never-throws guarantees that matter for production
 * stability.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

beforeEach(async () => {
  vi.resetModules();
  delete globalThis.navigator;
  delete globalThis.document;
});

describe('cameraSession', () => {
  it('exposes the spec-mandated 9-state machine', async () => {
    const { CAMERA_SESSION_STATES } = await import('../../../src/services/cameraSession.js');
    expect(CAMERA_SESSION_STATES.IDLE).toBe('idle');
    expect(CAMERA_SESSION_STATES.REQUESTING_PERMISSION).toBe('requesting_permission');
    expect(CAMERA_SESSION_STATES.STARTING_CAMERA).toBe('starting_camera');
    expect(CAMERA_SESSION_STATES.CAMERA_READY).toBe('camera_ready');
    expect(CAMERA_SESSION_STATES.CAPTURING).toBe('capturing');
    expect(CAMERA_SESSION_STATES.UPLOADING).toBe('uploading');
    expect(CAMERA_SESSION_STATES.ANALYZING).toBe('analyzing');
    expect(CAMERA_SESSION_STATES.COMPLETED).toBe('completed');
    expect(CAMERA_SESSION_STATES.FAILED).toBe('failed');
  });

  it('initial state is idle', async () => {
    const { getCameraState, isCameraActive } = await import('../../../src/services/cameraSession.js');
    expect(getCameraState()).toBe('idle');
    expect(isCameraActive()).toBe(false);
  });

  it('startCamera returns ok=false reason=unsupported when no mediaDevices', async () => {
    globalThis.navigator = {}; // no mediaDevices
    const { startCamera, getCameraState, _resetCameraSession } = await import('../../../src/services/cameraSession.js');
    _resetCameraSession();
    const fakeVideo = {};
    const result = await startCamera(fakeVideo);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('unsupported');
    expect(getCameraState()).toBe('failed');
  });

  it('startCamera returns ok=false reason=no_video when video element missing', async () => {
    globalThis.navigator = {
      mediaDevices: { getUserMedia: vi.fn() },
    };
    const { startCamera, _resetCameraSession } = await import('../../../src/services/cameraSession.js');
    _resetCameraSession();
    const result = await startCamera(null);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('no_video');
  });

  it('stopCamera is idempotent on a clean session', async () => {
    const { stopCamera, getCameraState, _resetCameraSession } = await import('../../../src/services/cameraSession.js');
    _resetCameraSession();
    expect(() => stopCamera()).not.toThrow();
    expect(() => stopCamera()).not.toThrow();
    expect(() => stopCamera()).not.toThrow();
    expect(getCameraState()).toBe('idle');
  });

  it('setSessionState rejects unknown states silently', async () => {
    const { setSessionState, getCameraState, _resetCameraSession } = await import('../../../src/services/cameraSession.js');
    _resetCameraSession();
    setSessionState('not_a_real_state');
    expect(getCameraState()).toBe('idle');
    setSessionState(42);
    expect(getCameraState()).toBe('idle');
    setSessionState(null);
    expect(getCameraState()).toBe('idle');
  });

  it('setSessionState accepts canonical workflow states', async () => {
    const { setSessionState, getCameraState, _resetCameraSession } = await import('../../../src/services/cameraSession.js');
    _resetCameraSession();
    setSessionState('capturing');
    expect(getCameraState()).toBe('capturing');
    setSessionState('uploading');
    expect(getCameraState()).toBe('uploading');
    setSessionState('analyzing');
    expect(getCameraState()).toBe('analyzing');
    setSessionState('completed');
    expect(getCameraState()).toBe('completed');
  });

  it('emits [SCAN_CAMERA_STATE] log on state change', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { setSessionState, _resetCameraSession } = await import('../../../src/services/cameraSession.js');
    _resetCameraSession();
    setSessionState('capturing');
    const stateCalls = logSpy.mock.calls.filter(
      (c) => String(c[0]) === '[SCAN_CAMERA_STATE]' && c[1] === 'capturing',
    );
    expect(stateCalls.length).toBe(1);
    logSpy.mockRestore();
  });

  it('does not emit [SCAN_CAMERA_STATE] when state is unchanged', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { setSessionState, _resetCameraSession } = await import('../../../src/services/cameraSession.js');
    _resetCameraSession();
    setSessionState('capturing');
    setSessionState('capturing'); // duplicate
    setSessionState('capturing'); // duplicate
    const stateCalls = logSpy.mock.calls.filter(
      (c) => String(c[0]) === '[SCAN_CAMERA_STATE]' && c[1] === 'capturing',
    );
    expect(stateCalls.length).toBe(1);
    logSpy.mockRestore();
  });

  // Note: the in-flight guard (parallel startCamera rejection
  // with reason='in_flight') is exercised by integration tests
  // in a real browser. Unit-testing it here would require a full
  // DOM mock of the video element's addEventListener +
  // loadedmetadata/canplay/playing event sequence, which is more
  // surface than the guard's own logic.
});
