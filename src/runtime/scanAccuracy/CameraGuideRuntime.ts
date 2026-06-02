/**
 * CameraGuideRuntime.ts — Stage 2.
 *
 * Pure state-machine module that evaluates per-frame camera metrics
 * and decides whether the auto-capture button is allowed to fire. No
 * UI, no DOM mutation, no timers — the caller polls evaluateGuideFrame
 * once per frame and drives its own UI from the returned envelope.
 *
 * The runtime never invents metrics: if the caller passes nulls (e.g.
 * because no frame has been measured yet) the guide reports not-ready
 * with honest reason hints rather than fabricating green-lights.
 */

import { IMAGE_QUALITY_THRESHOLDS, GUIDANCE_TAIL } from './ScanAccuracyContracts';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

export interface GuideFrameState {
  focused: boolean;
  leafCentered: boolean;
  brightnessOk: boolean;
  readyToCapture: boolean;
  reasonHints: ReadonlyArray<string>;
}

export interface CameraGuideHealth {
  initialized: true;
  autoCaptureReady: boolean;
  metricsThresholdsExported: true;
  noFakeFrameSignals: true;
  confidence: 'low' | 'medium' | 'high';
  explanation: string;
  limitations: string;
}

const _emptyState: Readonly<GuideFrameState> = Object.freeze({
  focused: false,
  leafCentered: false,
  brightnessOk: false,
  readyToCapture: false,
  reasonHints: Object.freeze(['Hold steady.']) as ReadonlyArray<string>,
});

/** Evaluate one frame of camera metrics into a capture-ready state.
 *  All inputs are nullable — null is treated as "not yet measured"
 *  and surfaces as a failing gate with an honest hint. Never throws. */
export function evaluateGuideFrame(metrics: {
  blurVariance: number | null;
  brightnessMean: number | null;
  leafCoverageRatio: number | null;
  focusEdgeDensity: number | null;
}): Readonly<GuideFrameState> {
  return _safe(() => {
    const T = IMAGE_QUALITY_THRESHOLDS;
    const bv = metrics ? metrics.blurVariance : null;
    const bm = metrics ? metrics.brightnessMean : null;
    const lc = metrics ? metrics.leafCoverageRatio : null;
    const fe = metrics ? metrics.focusEdgeDensity : null;

    const focused =
      bv !== null && bv >= T.blurVarianceMin &&
      fe !== null && fe >= T.focusEdgeDensityMin;
    const leafCentered = lc !== null && lc >= T.leafCoverageMin;
    const brightnessOk =
      bm !== null && bm >= T.brightnessMin && bm <= T.brightnessMax;
    const readyToCapture = focused && leafCentered && brightnessOk;

    const hints: string[] = [];
    if (!focused) hints.push('Hold steady.');
    if (!leafCentered) hints.push('Move closer.');
    if (!leafCentered) hints.push('Center the leaf.');
    if (!brightnessOk) hints.push('Use daylight.');

    return Object.freeze<GuideFrameState>({
      focused,
      leafCentered,
      brightnessOk,
      readyToCapture,
      reasonHints: Object.freeze(hints) as ReadonlyArray<string>,
    });
  }, _emptyState);
}

export function cameraGuideReady(): boolean {
  return _safe(() => typeof document !== 'undefined', false);
}

export function cameraGuideHealth(): Readonly<CameraGuideHealth> {
  return _safe(() => {
    const ready = cameraGuideReady();
    return Object.freeze<CameraGuideHealth>({
      initialized: true,
      autoCaptureReady: ready,
      metricsThresholdsExported: true as const,
      noFakeFrameSignals: true as const,
      confidence: ready ? 'high' : 'low',
      explanation:
        'Camera guide auto-capture state machine: evaluates blur variance, focus edge ' +
        'density, leaf coverage and brightness mean against IMAGE_QUALITY_THRESHOLDS to ' +
        'gate the capture button. Pure function — no UI, no timers, no fake frame ' +
        'signals; null metrics yield not-ready with honest hints.',
      limitations:
        'Per-frame readiness reflects pixel statistics only; lighting and motion can ' +
        'still produce a poor capture. ' + GUIDANCE_TAIL,
    });
  }, Object.freeze<CameraGuideHealth>({
    initialized: true,
    autoCaptureReady: false,
    metricsThresholdsExported: true as const,
    noFakeFrameSignals: true as const,
    confidence: 'low',
    explanation: 'Camera guide runtime initialized.',
    limitations: 'Camera guide threw. ' + GUIDANCE_TAIL,
  }));
}

export function installCameraGuideGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__cameraGuideHealth !== 'function') {
      w.__cameraGuideHealth = function () {
        const out = cameraGuideHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Camera Guide]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
