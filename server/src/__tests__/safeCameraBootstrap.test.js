/**
 * safeCameraBootstrap.test.js — iPhone Safari camera stream
 * stabilization. Verifies the bootstrap state machine, the
 * "fallback only after real failure" timing rule, the health
 * gate, and the cleanup helpers.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  BOOTSTRAP_STAGE, BOOTSTRAP_OBS, READY_STATE, REQUIRED_VIDEO_ATTRS, CLEANUP_STEPS,
  nextBootstrapStage, shouldShowFallback,
  cameraHealthCheck, isFrameRendering, canEnableCapture,
  cleanupStream, getCleanupSteps,
  recordBootstrapObservation, getBootstrapObservationCounts, resetBootstrapObservationCounts,
} from '../../../src/core/camera/safeCameraBootstrap.js';

// ─── State machine ────────────────────────────────────────

describe('nextBootstrapStage — valid transitions only', () => {
  it('happy path: idle → permission_check → stream_requesting → … → ready', () => {
    let s = BOOTSTRAP_STAGE.IDLE;
    for (const next of [
      BOOTSTRAP_STAGE.PERMISSION_CHECK,
      BOOTSTRAP_STAGE.STREAM_REQUESTING,
      BOOTSTRAP_STAGE.STREAM_ATTACHED,
      BOOTSTRAP_STAGE.METADATA_LOADED,
      BOOTSTRAP_STAGE.FIRST_FRAME,
      BOOTSTRAP_STAGE.READY,
    ]) {
      s = nextBootstrapStage(s, next);
      expect(s).toBe(next);
    }
  });

  it('invalid signals are no-ops (state never breaks)', () => {
    expect(nextBootstrapStage(BOOTSTRAP_STAGE.IDLE, BOOTSTRAP_STAGE.READY))
      .toBe(BOOTSTRAP_STAGE.IDLE);
    expect(nextBootstrapStage(BOOTSTRAP_STAGE.READY, 'on_fire'))
      .toBe(BOOTSTRAP_STAGE.READY);
    expect(() => nextBootstrapStage(null, null)).not.toThrow();
  });

  it('FAILED is reachable from any active stage', () => {
    for (const from of [
      BOOTSTRAP_STAGE.PERMISSION_CHECK,
      BOOTSTRAP_STAGE.STREAM_REQUESTING,
      BOOTSTRAP_STAGE.STREAM_ATTACHED,
      BOOTSTRAP_STAGE.METADATA_LOADED,
      BOOTSTRAP_STAGE.FIRST_FRAME,
      BOOTSTRAP_STAGE.READY,
    ]) {
      expect(nextBootstrapStage(from, BOOTSTRAP_STAGE.FAILED))
        .toBe(BOOTSTRAP_STAGE.FAILED);
    }
  });
});

// ─── Fallback timing — the heart of the fix ──────────────

describe('shouldShowFallback — never premature', () => {
  it('does NOT fire during permission_check', () => {
    expect(shouldShowFallback({
      stage: BOOTSTRAP_STAGE.PERMISSION_CHECK,
      stageStartMs: 0, nowMs: 30_000,
    })).toBe(false);
  });

  it('does NOT fire while the stream is requesting and under the threshold', () => {
    expect(shouldShowFallback({
      stage: BOOTSTRAP_STAGE.STREAM_REQUESTING,
      stageStartMs: 0, nowMs: 4_000, fallbackMs: 7_000,
    })).toBe(false);
  });

  it('DOES fire after the request threshold elapses with no stream', () => {
    expect(shouldShowFallback({
      stage: BOOTSTRAP_STAGE.STREAM_REQUESTING,
      stageStartMs: 0, nowMs: 10_000, fallbackMs: 7_000,
    })).toBe(true);
  });

  it('does NOT fire once stream is attached and Safari is rendering — within attached threshold', () => {
    expect(shouldShowFallback({
      stage: BOOTSTRAP_STAGE.STREAM_ATTACHED,
      stageStartMs: 0, nowMs: 6_000, fallbackMs: 7_000,
    })).toBe(false);
  });

  it('DOES fire if attached but never progresses (Safari truly stuck)', () => {
    expect(shouldShowFallback({
      stage: BOOTSTRAP_STAGE.STREAM_ATTACHED,
      stageStartMs: 0, nowMs: 20_000, fallbackMs: 7_000,
    })).toBe(true);
  });

  it('does NOT fire in metadata_loaded / first_frame / ready / cleaning', () => {
    for (const stage of [
      BOOTSTRAP_STAGE.METADATA_LOADED,
      BOOTSTRAP_STAGE.FIRST_FRAME,
      BOOTSTRAP_STAGE.READY,
      BOOTSTRAP_STAGE.CLEANING,
    ]) {
      expect(shouldShowFallback({ stage, stageStartMs: 0, nowMs: 999_999 }))
        .toBe(false);
    }
  });

  it('always fires when stage is FAILED', () => {
    expect(shouldShowFallback({ stage: BOOTSTRAP_STAGE.FAILED })).toBe(true);
  });

  it('never throws on garbage input', () => {
    expect(() => shouldShowFallback(null)).not.toThrow();
    expect(shouldShowFallback(null)).toBe(false);
  });
});

// ─── Health check + capture gate ──────────────────────────

describe('cameraHealthCheck + canEnableCapture — the capture gate', () => {
  const goodStream = { getTracks: () => [{ readyState: 'live' }] };
  const goodVideo = { srcObject: goodStream, readyState: READY_STATE.HAVE_CURRENT_DATA, videoWidth: 1920, videoHeight: 1080 };

  it('healthy when stream + video + dimensions + readyState all valid', () => {
    expect(cameraHealthCheck({ stream: goodStream, video: goodVideo }).healthy).toBe(true);
  });

  it('flags missing stream / video / srcObject / dimensions / not-ready', () => {
    expect(cameraHealthCheck({ video: goodVideo }).issues).toContain('no_stream');
    expect(cameraHealthCheck({ stream: goodStream }).issues).toContain('no_video');
    expect(cameraHealthCheck({
      stream: goodStream,
      video: { ...goodVideo, srcObject: null },
    }).issues).toContain('no_srcObject');
    expect(cameraHealthCheck({
      stream: goodStream,
      video: { ...goodVideo, readyState: READY_STATE.HAVE_NOTHING },
    }).issues).toContain('not_ready');
    expect(cameraHealthCheck({
      stream: goodStream,
      video: { ...goodVideo, videoWidth: 0, videoHeight: 0 },
    }).issues).toContain('no_dimensions');
  });

  it('flags ended tracks', () => {
    const ended = { getTracks: () => [{ readyState: 'ended' }] };
    expect(cameraHealthCheck({ stream: ended, video: { ...goodVideo, srcObject: ended } }).issues)
      .toContain('tracks_ended');
  });

  it('canEnableCapture is true ONLY at READY + healthy', () => {
    expect(canEnableCapture({ stage: BOOTSTRAP_STAGE.READY, stream: goodStream, video: goodVideo })).toBe(true);
    expect(canEnableCapture({ stage: BOOTSTRAP_STAGE.FIRST_FRAME, stream: goodStream, video: goodVideo })).toBe(false);
    expect(canEnableCapture({ stage: BOOTSTRAP_STAGE.READY, stream: goodStream, video: { ...goodVideo, videoWidth: 0 } })).toBe(false);
  });

  it('isFrameRendering is the boolean alias for cameraHealthCheck', () => {
    expect(isFrameRendering({ stream: goodStream, video: goodVideo })).toBe(true);
    expect(isFrameRendering(null)).toBe(false);
  });
});

// ─── Cleanup ──────────────────────────────────────────────

describe('cleanupStream + cleanup contract', () => {
  it('stops every track on a stream and returns true', () => {
    let stopped = 0;
    const stream = { getTracks: () => [
      { stop: () => { stopped += 1; } },
      { stop: () => { stopped += 1; } },
    ]};
    expect(cleanupStream(stream)).toBe(true);
    expect(stopped).toBe(2);
  });

  it('returns false on a null / shapeless stream and never throws', () => {
    expect(cleanupStream(null)).toBe(false);
    expect(cleanupStream({})).toBe(false);
    expect(() => cleanupStream({ getTracks: () => { throw new Error('x'); } })).not.toThrow();
  });

  it('exports the cleanup-script as data, not behaviour', () => {
    expect(getCleanupSteps()).toEqual([...CLEANUP_STEPS]);
    expect(getCleanupSteps()).toContain('stop_tracks');
    expect(getCleanupSteps()).toContain('clear_src_object');
  });
});

// ─── Mandatory video attributes ───────────────────────────

describe('REQUIRED_VIDEO_ATTRS', () => {
  it('mandates autoPlay + muted + playsInline for the iPhone Safari path', () => {
    expect(REQUIRED_VIDEO_ATTRS.autoPlay).toBe(true);
    expect(REQUIRED_VIDEO_ATTRS.muted).toBe(true);
    expect(REQUIRED_VIDEO_ATTRS.playsInline).toBe(true);
  });
});

// ─── Observability ────────────────────────────────────────

describe('recordBootstrapObservation', () => {
  beforeEach(() => resetBootstrapObservationCounts());

  it('counts events and forwards failures to observabilityTracker', () => {
    recordBootstrapObservation(BOOTSTRAP_OBS.STREAM_ACQUIRED);
    recordBootstrapObservation(BOOTSTRAP_OBS.STREAM_FAILED);
    recordBootstrapObservation(BOOTSTRAP_OBS.FALLBACK_TRIGGERED);
    recordBootstrapObservation(BOOTSTRAP_OBS.RETRY_SUCCESS);
    const c = getBootstrapObservationCounts();
    expect(c[BOOTSTRAP_OBS.STREAM_ACQUIRED]).toBe(1);
    expect(c[BOOTSTRAP_OBS.STREAM_FAILED]).toBe(1);
    expect(c[BOOTSTRAP_OBS.FALLBACK_TRIGGERED]).toBe(1);
    expect(c[BOOTSTRAP_OBS.RETRY_SUCCESS]).toBe(1);
  });

  it('never throws on bogus input', () => {
    expect(() => recordBootstrapObservation(null)).not.toThrow();
    expect(recordBootstrapObservation(undefined)).toBe(false);
  });
});
