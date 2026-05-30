/**
 * src/runtime/outcomes/OutcomeScoringEngine.ts — Pure scoring.
 *
 *   import {
 *     scoreOutcomeStatus, OUTCOME_SCORING_VERSION,
 *   } from 'src/runtime/outcomes/OutcomeScoringEngine';
 *
 * What this is
 * ────────────
 *   Given the lifecycle signals — linked scanIds, whether the
 *   recommendation was accepted, the follow-up scan's diagnostic
 *   verdict — derive a single outcomeStatus drawn from the canonical
 *   five-value enum:
 *
 *     resolved   — follow-up scan reports healthy / no detection
 *     improved   — follow-up scan severity strictly lower than first
 *     unchanged  — follow-up scan severity matches first
 *     worsened   — follow-up scan severity strictly higher than first
 *     unknown    — insufficient signal (no follow-up scan, or scans
 *                  lack diagnostic data)
 *
 * Strict-rule audit
 *   • Pure function. No side effects. No persistence. No window.
 *   • SSR-safe. Never throws.
 *   • Frozen result envelope.
 *   • Never inspects PII — operates on ids + severity strings only.
 */

import { OUTCOME_STATUS } from './outcomeContracts';

export const OUTCOME_SCORING_VERSION = 'farroway-outcome-scoring-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _str = (v: unknown): string =>
  typeof v === 'string' ? v : '';

/**
 * Normalised severity ladder. The engine accepts a wide variety of
 * input strings (legacy scan results vary) and maps them to a small
 * ordered space. Higher = worse.
 *
 *   0  healthy / resolved
 *   1  low / mild
 *   2  moderate / medium
 *   3  high / severe
 *   4  critical
 *  -1  unknown (use null severity in scoring)
 */
function _severityRank(raw: unknown): number {
  return _safe(() => {
    const s = _str(raw).toLowerCase().trim();
    if (!s) return -1;
    if (s === 'healthy' || s === 'none' || s === 'resolved'
     || s === 'no_issue' || s === 'clear') return 0;
    if (s === 'low' || s === 'mild' || s === 'minor'
     || s === 'early' || s === 'early_stage') return 1;
    if (s === 'medium' || s === 'moderate' || s === 'mid') return 2;
    if (s === 'high' || s === 'severe') return 3;
    if (s === 'critical' || s === 'extreme') return 4;
    return -1;
  }, -1);
}

/**
 * Extract a severity rank from a scan-result-like object. Tries
 * several common field names so this works against both fresh and
 * legacy result shapes without coupling to any one engine.
 */
function _scanSeverity(scan: unknown): number {
  return _safe(() => {
    if (!_isObj(scan)) return -1;
    const obj = scan as any;
    // Direct severity fields first.
    const direct = _severityRank(obj.severity)
                || _severityRank(obj.severityLevel)
                || _severityRank(obj.severity_label);
    // Treat 0 as "valid healthy" — don't fall through if explicitly 0.
    const directRaw = [obj.severity, obj.severityLevel, obj.severity_label]
      .map(_severityRank).find((v) => v >= 0);
    if (typeof directRaw === 'number') return directRaw;
    // Health-style fields.
    const healthRank = _severityRank(obj.healthStatus)
                    || _severityRank(obj.health_status)
                    || _severityRank(obj.status);
    if (healthRank >= 0) return healthRank;
    // Detection flags.
    if (obj.healthy === true || obj.isHealthy === true) return 0;
    if (obj.detectionFound === false) return 0;
    if (obj.detectionFound === true) return 2; // assume moderate
    return -1;
    // Note: 'direct' is unused above intentionally — kept for clarity
    // that we attempted multiple lookups.
    void direct;
  }, -1);
}

/**
 * Public — compute an outcomeStatus from the lifecycle signals.
 *
 * Inputs:
 *   • scanIds                : ordered scan ids (first = diagnostic,
 *                              last = follow-up). When length < 2 we
 *                              cannot compare scans.
 *   • recommendationAccepted : whether the user accepted the rec.
 *                              Influences UNKNOWN vs UNCHANGED when
 *                              no follow-up signal exists.
 *   • firstScan / followUpScan: caller-supplied scan envelopes. The
 *                               engine NEVER reads them from storage
 *                               — keeps the function pure.
 *
 * Returns one of:  resolved | improved | unchanged | worsened | unknown
 */
export function scoreOutcomeStatus(input: {
  scanIds:                 ReadonlyArray<string>;
  recommendationAccepted?: boolean;
  firstScan?:              unknown;
  followUpScan?:           unknown;
}): string {
  return _safe(() => {
    if (!_isObj(input)) return OUTCOME_STATUS.UNKNOWN;
    const ids = Array.isArray(input.scanIds) ? input.scanIds : [];
    // No scans at all → unknown.
    if (ids.length === 0) return OUTCOME_STATUS.UNKNOWN;
    // Only one scan (no follow-up performed) → unknown, regardless
    // of acceptance — we cannot claim improvement without evidence.
    if (ids.length < 2) return OUTCOME_STATUS.UNKNOWN;

    const sev0 = _scanSeverity(input.firstScan);
    const sevN = _scanSeverity(input.followUpScan);

    // Follow-up explicitly healthy = resolved, even when first
    // severity is unknown — a clean follow-up scan is the strongest
    // possible signal.
    if (sevN === 0) return OUTCOME_STATUS.RESOLVED;

    // Without both severities we cannot compare — unknown.
    if (sev0 < 0 || sevN < 0) return OUTCOME_STATUS.UNKNOWN;

    if (sevN < sev0) return OUTCOME_STATUS.IMPROVED;
    if (sevN > sev0) return OUTCOME_STATUS.WORSENED;
    return OUTCOME_STATUS.UNCHANGED;
  }, OUTCOME_STATUS.UNKNOWN);
}

/**
 * scoreOutcomeEnvelope — frozen verdict envelope, useful for
 * diagnostics. Pure. Never throws.
 */
export function scoreOutcomeEnvelope(input: {
  scanIds:                 ReadonlyArray<string>;
  recommendationAccepted?: boolean;
  firstScan?:              unknown;
  followUpScan?:           unknown;
}) {
  return _safe(() => Object.freeze({
    runtimeVersion: OUTCOME_SCORING_VERSION,
    outcomeStatus:  scoreOutcomeStatus(input),
    scanCount:      Array.isArray(input && input.scanIds)
                      ? input.scanIds.length : 0,
    recommendationAccepted: !!(input && input.recommendationAccepted),
  }), Object.freeze({
    runtimeVersion: OUTCOME_SCORING_VERSION,
    outcomeStatus:  OUTCOME_STATUS.UNKNOWN,
    scanCount:      0,
    recommendationAccepted: false,
  }));
}
