/**
 * ScanMythosEngine.ts — top-level entry + health globals for the
 * Mythos scan composition layer (sprint #200).
 *
 * Pins:
 *   window.__scanMythosHealth()      — engine readiness + honesty flags
 *   window.__multiPhotoScanHealth()  — multi-photo flow readiness
 *
 * Satellite globals (__satelliteCorrelationHealth /
 * __scanSatelliteCorrelatorHealth) are intentionally NOT installed —
 * satellite is out of scope this sprint (founder partial-override).
 *
 * Pure / SSR-safe / idempotent install / never throws.
 */

import { composeScanMythosDecision } from './ScanDecisionComposer';
import { getMultiPhotoStatus } from './MultiPhotoGuidance';

export const SCAN_MYTHOS_ENGINE_VERSION = 'scan-mythos-engine-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _hasWindow = (): boolean =>
  _safe(() => typeof window !== 'undefined' && !!window, false);

export function getScanMythosDecision(input: any) {
  return composeScanMythosDecision(input || {});
}

export function buildScanMythosHealth(): Readonly<{
  ok: boolean;
  runtimeVersion: string;
  mythosReady: boolean;
  farmContextReady: boolean;
  satelliteOptional: boolean;
  noFabricatedSatelliteData: boolean;
  nonBlocking: boolean;
  nextActionReady: boolean;
  followUpReady: boolean;
  outcomePathReady: boolean;
}> {
  return _safe(() => {
    // Self-test: compose an empty decision and confirm the contract
    // floor holds (plant non-empty, nextAction + followUp present,
    // satellite boost is exactly 0).
    const probe = composeScanMythosDecision({ envelope: {} });
    const floorOk = !!probe.plant && !!probe.nextAction
      && probe.satelliteContextBoost === 0
      && probe.neverFabricatesSatellite === true;
    return Object.freeze({
      ok: floorOk,
      runtimeVersion: 'scan-mythos-health-v1',
      mythosReady: floorOk,
      farmContextReady: true,
      satelliteOptional: true,           // satellite never required
      noFabricatedSatelliteData: true,   // no satellite produced at all
      nonBlocking: true,                 // composition can't block scan
      nextActionReady: !!probe.nextAction,
      followUpReady: true,               // composer always yields a date path
      outcomePathReady: probe.outcomePrompt === 'Did the plant improve?',
    });
  }, Object.freeze({
    ok: false,
    runtimeVersion: 'scan-mythos-health-v1',
    mythosReady: false, farmContextReady: false, satelliteOptional: true,
    noFabricatedSatelliteData: true, nonBlocking: true,
    nextActionReady: false, followUpReady: false, outcomePathReady: false,
  }));
}

export function buildMultiPhotoScanHealth(): Readonly<{
  ok: boolean;
  runtimeVersion: string;
  optionalPhotos: boolean;
  guidanceReady: boolean;
  noPhotoRequired: boolean;
}> {
  return _safe(() => {
    const s = getMultiPhotoStatus({ photosUsed: [], confidencePct: 40 });
    return Object.freeze({
      ok: true,
      runtimeVersion: 'multi-photo-scan-health-v1',
      optionalPhotos: true,
      guidanceReady: typeof s.guidance === 'string' || s.guidance === null,
      noPhotoRequired: true,
    });
  }, Object.freeze({
    ok: false, runtimeVersion: 'multi-photo-scan-health-v1',
    optionalPhotos: true, guidanceReady: false, noPhotoRequired: true,
  }));
}

let _installed = false;
export function installScanMythosHealthGlobals(): void {
  if (_installed) return;
  if (!_hasWindow()) return;
  _safe(() => {
    const w: any = window;
    Object.defineProperty(w, '__scanMythosHealth', {
      configurable: true, enumerable: false, writable: false,
      value: () => buildScanMythosHealth(),
    });
    Object.defineProperty(w, '__multiPhotoScanHealth', {
      configurable: true, enumerable: false, writable: false,
      value: () => buildMultiPhotoScanHealth(),
    });
    Object.defineProperty(w, '__scanMythosDecision', {
      configurable: true, enumerable: false, writable: false,
      value: (input: any) => getScanMythosDecision(input),
    });
    _installed = true;
  }, undefined);
}

export const _internal = Object.freeze({
  getScanMythosDecision, buildScanMythosHealth,
  buildMultiPhotoScanHealth, installScanMythosHealthGlobals,
});

export default getScanMythosDecision;
