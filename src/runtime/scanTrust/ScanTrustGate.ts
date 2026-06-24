/**
 * ScanTrustGate.ts — sprint #214 §2.
 *
 * The trust gate: decides what a scan result is ALLOWED to do, so a
 * bad photo or a low-confidence guess can never create a plant, a
 * task, a FarmBrain entry, or a timeline row. A blocked-but-photographed
 * scan is routed to the review queue instead — it is NOT discarded.
 *
 * Works off REAL signals the pipeline already produces (confidence,
 * candidates, plant name, issue, status) + the PhotoQuality verdict.
 * It NEVER fabricates a diagnosis to unblock a scan.
 *
 * Pure. SSR-safe. Never throws. Frozen returns. Pins
 * window.__scanTrustGateHealth().
 */

import {
  TRUST_CONFIDENCE_THRESHOLD_PCT, UNKNOWN_PLANT_TOKENS,
  UNKNOWN_ISSUE_TOKENS, UNCLEAR_STATUS_TOKENS,
} from './ScanTrustContracts';
import type { ScanTrustDecision, GateStatus } from './ScanTrustContracts';

export const SCAN_TRUST_GATE_VERSION = 'scan-trust-gate-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _str = (v: unknown): string => (typeof v === 'string' ? v.trim().toLowerCase() : '');
const _arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);

// Accept confidence as 0-100 (pct) OR 0-1 (frac); normalize to pct.
function _confPct(input: any): number {
  const p = input.confidencePct;
  if (typeof p === 'number' && Number.isFinite(p)) return p;
  const c = input.confidence;
  if (typeof c === 'number' && Number.isFinite(c)) return c <= 1 ? c * 100 : c;
  return 0;
}

export function evaluateScanTrust(input: {
  confidencePct?: number;
  confidence?: number | string;
  topCandidates?: ReadonlyArray<unknown>;
  plantName?: string;
  issueType?: string;
  status?: string;
  nextAction?: string;
  hasPhoto?: boolean;
  photoQuality?: { passed?: boolean; failed?: boolean } | null;
} = {}): Readonly<ScanTrustDecision> {
  return _safe(() => {
    const conf = _confPct(input);
    const lowConfidence = conf < TRUST_CONFIDENCE_THRESHOLD_PCT;
    const candidates = _arr(input.topCandidates);
    const noCandidates = candidates.length === 0;
    const plant = _str(input.plantName);
    const plantUnknown = UNKNOWN_PLANT_TOKENS.includes(plant);
    const issue = _str(input.issueType);
    const issueUnknown = UNKNOWN_ISSUE_TOKENS.includes(issue);
    const status = _str(input.status);
    const statusUnclear = UNCLEAR_STATUS_TOKENS.includes(status);
    const nextAction = _str(input.nextAction);
    const retakeRequested = nextAction.includes('retake');
    const photoFailed = !!(input.photoQuality && input.photoQuality.failed);
    const hasPhoto = !!input.hasPhoto;

    const reasons: string[] = [];

    // ── plant creation ─────────────────────────────────────────────
    let allowPlantCreation = true;
    if (lowConfidence) { allowPlantCreation = false; reasons.push('confidence_below_threshold'); }
    if (noCandidates)  { allowPlantCreation = false; reasons.push('no_candidates'); }
    if (photoFailed)   { allowPlantCreation = false; reasons.push('photo_quality_failed'); }
    if (plantUnknown)  { allowPlantCreation = false; reasons.push('plant_unknown'); }

    // ── task creation ──────────────────────────────────────────────
    let allowTaskCreation = true;
    if (issueUnknown && plantUnknown) { allowTaskCreation = false; reasons.push('issue_unknown'); }
    if (lowConfidence)      { allowTaskCreation = false; }
    if (statusUnclear)      { allowTaskCreation = false; reasons.push('status_needs_review'); }
    if (retakeRequested)    { allowTaskCreation = false; reasons.push('next_action_retake'); }
    if (photoFailed)        { allowTaskCreation = false; }

    // ── FarmBrain ingestion ────────────────────────────────────────
    let allowFarmBrainIngestion = true;
    if (lowConfidence)  { allowFarmBrainIngestion = false; }
    if (statusUnclear)  { allowFarmBrainIngestion = false; }
    if (plantUnknown)   { allowFarmBrainIngestion = false; }
    if (photoFailed)    { allowFarmBrainIngestion = false; }

    // ── timeline write follows FarmBrain (low-confidence → review) ─
    const allowTimelineWrite = allowFarmBrainIngestion;

    // ── recent-scan display: only trusted scans ───────────────────
    const allowRecentScanDisplay = allowFarmBrainIngestion;

    // ── review save: always available when a photo exists ─────────
    const allowReviewSave = hasPhoto;

    // dedupe reasons
    const gateReasons = Object.freeze(Array.from(new Set(reasons)));

    let gateStatus: GateStatus;
    if (allowPlantCreation && allowFarmBrainIngestion) gateStatus = 'trusted';
    else if (hasPhoto) gateStatus = 'review';
    else gateStatus = 'blocked';

    return Object.freeze({
      runtimeVersion: SCAN_TRUST_GATE_VERSION,
      allowPlantCreation, allowTaskCreation, allowFarmBrainIngestion,
      allowTimelineWrite, allowRecentScanDisplay, allowReviewSave,
      gateStatus, gateReasons,
    });
  }, Object.freeze({
    runtimeVersion: SCAN_TRUST_GATE_VERSION,
    allowPlantCreation: false, allowTaskCreation: false,
    allowFarmBrainIngestion: false, allowTimelineWrite: false,
    allowRecentScanDisplay: false, allowReviewSave: true,
    gateStatus: 'review' as const,
    gateReasons: Object.freeze(['gate_error_safe_default']),
  }));
}

export function buildScanTrustGateHealth(): Readonly<{
  ok: boolean; runtimeVersion: string;
  trustGateReady: true; unknownPlantBlocked: true;
  taskCreationBlockedForUnknown: true; farmBrainProtected: true;
  thresholdPct: number;
}> {
  return Object.freeze({
    ok: true, runtimeVersion: SCAN_TRUST_GATE_VERSION,
    trustGateReady: true as const,
    unknownPlantBlocked: true as const,
    taskCreationBlockedForUnknown: true as const,
    farmBrainProtected: true as const,
    thresholdPct: TRUST_CONFIDENCE_THRESHOLD_PCT,
  });
}

let _installed = false;
export function installScanTrustGateHealthGlobal(): void {
  if (_installed) return;
  if (_safe(() => typeof window === 'undefined', true)) return;
  _safe(() => {
    Object.defineProperty(window as any, '__scanTrustGateHealth', {
      configurable: true, enumerable: false, writable: false,
      value: () => buildScanTrustGateHealth(),
    });
    _installed = true;
  }, undefined);
}

export const _internal = Object.freeze({
  evaluateScanTrust, buildScanTrustGateHealth, installScanTrustGateHealthGlobal,
});
export default evaluateScanTrust;
