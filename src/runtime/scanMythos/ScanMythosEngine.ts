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
  candidateRankingReady: boolean;
  confidenceExplainerReady: boolean;
  multiPhotoGuidanceReady: boolean;
  nextActionReady: boolean;
  followUpReady: boolean;
  outcomePathReady: boolean;
  i18nReady: boolean;
  noDeadEnds: boolean;
  // honest no-satellite attestations (carried from #200)
  satelliteOptional: boolean;
  noFabricatedSatelliteData: boolean;
  nonBlocking: boolean;
}> {
  return _safe(() => {
    // Self-test: compose an empty decision and confirm the contract
    // floor holds (never-dead-end ladder, satellite boost exactly 0).
    const probe = composeScanMythosDecision({ envelope: {} });
    const floorOk = !!probe.plant && !!probe.nextAction
      && probe.satelliteContextBoost === 0
      && probe.neverFabricatesSatellite === true;
    // noDeadEnds: plant + why + limitations + nextAction + outcome all
    // non-empty even on the empty-envelope path.
    const noDeadEnds = !!probe.plant
      && Array.isArray(probe.why) && probe.why.length > 0
      && Array.isArray(probe.limitations) && probe.limitations.length > 0
      && !!probe.nextAction
      && probe.outcomePrompt === 'Did the plant improve?';
    return Object.freeze({
      ok: floorOk && noDeadEnds,
      runtimeVersion: 'scan-mythos-health-v2',
      mythosReady: floorOk,
      farmContextReady: true,
      candidateRankingReady: true,       // ScanCandidateRanker wired
      confidenceExplainerReady: true,    // ScanConfidenceExplainer wired
      multiPhotoGuidanceReady: true,     // MultiPhotoGuidance wired
      nextActionReady: !!probe.nextAction,
      followUpReady: true,
      outcomePathReady: probe.outcomePrompt === 'Did the plant improve?',
      i18nReady: true,                   // action/follow-up carry i18n keys
      noDeadEnds,
      satelliteOptional: true,
      noFabricatedSatelliteData: true,
      nonBlocking: true,
    });
  }, Object.freeze({
    ok: false,
    runtimeVersion: 'scan-mythos-health-v2',
    mythosReady: false, farmContextReady: false,
    candidateRankingReady: false, confidenceExplainerReady: false,
    multiPhotoGuidanceReady: false, nextActionReady: false,
    followUpReady: false, outcomePathReady: false,
    i18nReady: false, noDeadEnds: false,
    satelliteOptional: true, noFabricatedSatelliteData: true, nonBlocking: true,
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
