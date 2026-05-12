/**
 * scanFollowupSchedule.js — derive the rescan + monitoring cadence
 * for a freshly-completed scan.
 *
 *   const schedule = computeScanFollowupSchedule(result);
 *   // → {
 *   //     nextScanAt:      ISO,           // when to rescan
 *   //     monitoringDays:  number,        // window to keep eyes on
 *   //     treatmentCheckAt: ISO | null,   // when to verify treatment
 *   //     outbreakWatchDays: number|null, // self-pattern watch window
 *   //     reason:          string,
 *   //   }
 *
 * Spec §4 — Contextual Scan Follow-up
 * ───────────────────────────────────
 *   After a scan, the engine should automatically recommend:
 *     • next scan timing       — when to take a fresh photo
 *     • monitoring interval    — how many days to actively watch
 *     • treatment verification — when to confirm the action worked
 *     • outbreak watch         — how long to look for the same
 *                                 issue on nearby plants
 *
 *   The schedule is keyed off severity + presence of treatment.
 *   We don't pretend to model disease progression — these are
 *   sensible cadences a calm advisor would suggest.
 *
 * Cadence table (frozen, tunable)
 * ────────────────────────────────
 *               nextScan    monitor    treatment-check   outbreak-watch
 *   high          2 days     14 days     3 days            14 days
 *   medium        4 days     10 days     5 days             7 days
 *   low           7 days      7 days     —                  —
 *   healthy       14 days     —          —                  —
 *
 *   When the result has NO suggested treatment (i.e. just an
 *   inspection task), treatmentCheckAt is null because there's
 *   nothing to verify.
 *
 * Strict-rule audit
 *   • Pure function. Never throws. Tolerates partial result shapes.
 *   • Returns a stable shape so callers don't have to feature-detect.
 */

const _DAY = 24 * 60 * 60 * 1000;

export const FOLLOWUP_CADENCE = Object.freeze({
  high: Object.freeze({
    nextScanDays:       2,
    monitoringDays:    14,
    treatmentCheckDays: 3,
    outbreakWatchDays: 14,
  }),
  medium: Object.freeze({
    nextScanDays:       4,
    monitoringDays:    10,
    treatmentCheckDays: 5,
    outbreakWatchDays:  7,
  }),
  low: Object.freeze({
    nextScanDays:       7,
    monitoringDays:     7,
    treatmentCheckDays: null,
    outbreakWatchDays:  null,
  }),
  healthy: Object.freeze({
    nextScanDays:      14,
    monitoringDays:     0,
    treatmentCheckDays: null,
    outbreakWatchDays:  null,
  }),
});

function _normSeverity(raw) {
  const s = String(raw || '').toLowerCase().trim();
  if (s === 'high'   || s.includes('high'))   return 'high';
  if (s === 'medium' || s.includes('medium') || s.includes('moderate')) return 'medium';
  if (s === 'low'    || s.includes('low')     || s.includes('mild'))    return 'low';
  if (s === 'healthy' || s.includes('healthy') || s.includes('no_issue')) return 'healthy';
  return null;
}

function _addDays(nowMs, days) {
  if (typeof days !== 'number' || !Number.isFinite(days)) return null;
  try { return new Date(nowMs + days * _DAY).toISOString(); }
  catch { return null; }
}

function _hasTreatmentAction(result) {
  if (!result || typeof result !== 'object') return false;
  const tasks = Array.isArray(result.suggestedTasks) ? result.suggestedTasks : [];
  return tasks.some((t) => {
    const a = String(t && t.actionType || '').toLowerCase();
    return a === 'spray' || a === 'treat' || a === 'fertilize';
  });
}

/**
 * @param {object} result      — scan result envelope
 * @param {object} [options]
 * @param {number} [options.nowMs]
 * @returns {{
 *   nextScanAt:        string|null,
 *   monitoringDays:    number,
 *   treatmentCheckAt:  string|null,
 *   outbreakWatchDays: number|null,
 *   reason:            string,
 *   severity:          'high'|'medium'|'low'|'healthy'|'unknown',
 * }}
 */
export function computeScanFollowupSchedule(result, options = {}) {
  const safeOptions = (options && typeof options === 'object') ? options : {};
  const nowMs = (typeof safeOptions.nowMs === 'number') ? safeOptions.nowMs : Date.now();
  const safeResult = (result && typeof result === 'object') ? result : {};
  const decision = (safeResult.decision && typeof safeResult.decision === 'object') ? safeResult.decision : {};

  // Pull severity from the decision envelope first (authoritative),
  // then fall back to result.severity / category. When nothing is
  // recognisable we treat the scan as 'medium' so the user still
  // gets a sensible monitoring window.
  let severity = _normSeverity(decision.severityTone)
              || _normSeverity(safeResult.severity)
              || _normSeverity(safeResult.category);
  let severityKey = severity || 'medium';
  const cadence = FOLLOWUP_CADENCE[severityKey] || FOLLOWUP_CADENCE.medium;

  const hasTreatment = _hasTreatmentAction(safeResult);
  const treatmentDays = hasTreatment ? cadence.treatmentCheckDays : null;

  return {
    nextScanAt:        _addDays(nowMs, cadence.nextScanDays),
    monitoringDays:    cadence.monitoringDays || 0,
    treatmentCheckAt:  _addDays(nowMs, treatmentDays),
    outbreakWatchDays: cadence.outbreakWatchDays,
    reason: severity === 'healthy'
      ? 'Crop reads healthy — a 2-week routine rescan is enough.'
      : `Severity tier '${severityKey}': rescan in ${cadence.nextScanDays} days, monitor for ${cadence.monitoringDays}.`,
    severity:           severity || 'unknown',
  };
}

export default { computeScanFollowupSchedule, FOLLOWUP_CADENCE };
