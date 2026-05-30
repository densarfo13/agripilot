/**
 * src/runtime/outcomeComparison/OutcomeComparisonRuntime.ts —
 * compares the current scan with the most recent prior scan for
 * the same plant and emits an Improved / Unchanged / Worsened /
 * Unknown verdict.
 *
 *   evaluate(currentScan, plantContext, timestamp)
 *     → frozen OutcomeComparisonResult
 *
 * Strict-rule audit
 *   • Composition over architecture. Reads from the SeverityRuntime
 *     history (which is itself populated by the severity runtime's
 *     evaluate call earlier in the same scan-result pipeline).
 *   • Pure runtime. Never throws.
 *   • Frozen envelopes.
 *   • Single window global: __outcomeComparisonHealth.
 */

import {
  OUTCOME_COMPARISON_RUNTIME_VERSION,
  COMPARISON_STATUS,
  OUTCOME_COMPARISON_STORAGE_KEY,
  OUTCOME_COMPARISON_HISTORY_CAP,
  type ComparisonStatusValue,
  type OutcomeComparisonResult,
  type OutcomeComparisonHealth,
} from './outcomeComparisonContracts';
import {
  SEVERITY_LEVEL, listSeverityHistoryForPlant,
  type SeverityLevelValue,
} from '../severity';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _lower(s: unknown): string {
  return typeof s === 'string' ? s.toLowerCase().trim() : '';
}

function _str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

const SEVERITY_ORDER: Readonly<Record<SeverityLevelValue, number>> =
  Object.freeze({
    [SEVERITY_LEVEL.UNKNOWN]:  -1,
    [SEVERITY_LEVEL.LOW]:       1,
    [SEVERITY_LEVEL.MEDIUM]:    2,
    [SEVERITY_LEVEL.HIGH]:      3,
    [SEVERITY_LEVEL.CRITICAL]:  4,
  });

function _compareLevels(prev: SeverityLevelValue,
                        curr: SeverityLevelValue): ComparisonStatusValue {
  const p = SEVERITY_ORDER[prev] ?? -1;
  const c = SEVERITY_ORDER[curr] ?? -1;
  if (p < 0 || c < 0) return COMPARISON_STATUS.UNKNOWN;
  if (c < p)         return COMPARISON_STATUS.IMPROVED;
  if (c > p)         return COMPARISON_STATUS.WORSENED;
  return COMPARISON_STATUS.UNCHANGED;
}

function _hasLocal(): boolean {
  return _safe(() => typeof localStorage !== 'undefined' && !!localStorage, false);
}

function _readHistory(): OutcomeComparisonResult[] {
  return _safe(() => {
    if (!_hasLocal()) return [];
    const raw = localStorage.getItem(OUTCOME_COMPARISON_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  }, []);
}

function _writeHistory(list: OutcomeComparisonResult[]): boolean {
  return _safe(() => {
    if (!_hasLocal()) return false;
    const trimmed = list.length > OUTCOME_COMPARISON_HISTORY_CAP
      ? list.slice(list.length - OUTCOME_COMPARISON_HISTORY_CAP) : list;
    localStorage.setItem(OUTCOME_COMPARISON_STORAGE_KEY,
                         JSON.stringify(trimmed));
    return true;
  }, false);
}

function _appendHistory(rec: OutcomeComparisonResult): void {
  _safe(() => {
    const list = _readHistory();
    const key = `${rec.plantId}:${rec.currentScanId}`;
    const dedup = list.filter((r) => `${r.plantId}:${r.currentScanId}` !== key);
    dedup.push(rec);
    _writeHistory(dedup);
  }, undefined as any);
}

function _copy(status: ComparisonStatusValue): string {
  switch (status) {
    case COMPARISON_STATUS.IMPROVED:
      return 'Signals appear improved since the previous scan. Continue the current care plan and monitor.';
    case COMPARISON_STATUS.WORSENED:
      return 'Signals appear worse than the previous scan. Inspect closely and consider stronger intervention.';
    case COMPARISON_STATUS.UNCHANGED:
      return 'No clear change since the previous scan. Stay with the current plan and re-scan in a few days.';
    default:
      return 'Not enough prior history to compare. Scan again later to track change.';
  }
}

// ─── Public entry ─────────────────────────────────────────────────

export interface OutcomeComparisonEvaluateInput {
  currentScan:   any;
  plantContext?: { plantId?: string };
  timestamp?:    string;
}

export function evaluate(input: OutcomeComparisonEvaluateInput): OutcomeComparisonResult {
  const fallback = (scanId: string, plantId: string): OutcomeComparisonResult =>
    Object.freeze({
      plantId,
      currentScanId: scanId,
      status: COMPARISON_STATUS.UNKNOWN,
      confidence: 0,
      recommendation: _copy(COMPARISON_STATUS.UNKNOWN),
      needsReview: true,
      timestamp: _str(input?.timestamp),
    });

  return _safe(() => {
    const scan = input.currentScan || {};
    const scanId = _str(scan.scanId) || _str(scan.id) || '';
    if (!scanId) return fallback('', '');
    const plantId = _lower(input.plantContext?.plantId)
                  || _lower(scan.plantId)
                  || _lower(scan.crop)
                  || _lower(scan.cropId)
                  || _lower(scan.plantName)
                  || 'unknown';

    // Read severity history for this plant. The severity runtime
    // wrote the CURRENT scan FIRST in the scan pipeline (before
    // this runtime fires), so [0] is current and [1] is the
    // previous scan.
    const history = listSeverityHistoryForPlant(plantId);
    if (!Array.isArray(history) || history.length < 2) {
      const rec = fallback(scanId, plantId);
      _appendHistory(rec);
      return rec;
    }
    const current  = history[0];
    const previous = history[1];

    // Only compare when the current scan id matches — defence
    // against stale history.
    const currMatches = _lower(current.scanId) === _lower(scanId);
    const status = currMatches
      ? _compareLevels(
          previous.level as SeverityLevelValue,
          current.level  as SeverityLevelValue)
      : COMPARISON_STATUS.UNKNOWN;

    // Confidence — derived from the prior + current severity
    // confidence proxies. Both have a "needsReview" flag; if either
    // is UNKNOWN we drop confidence below 40.
    let conf = 70;
    if (current.level  === SEVERITY_LEVEL.UNKNOWN) conf = 25;
    if (previous.level === SEVERITY_LEVEL.UNKNOWN) conf = Math.min(conf, 25);

    // Wave-30 gap-fix #2 — resolve the previous scan's image URL
    // from the canonical scan-history store (composition over the
    // existing localStorage layer). Read-only; never throws.
    let previousImageUrl = '';
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('farroway_scan_history_v1');
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) {
            const row = arr.find((r: any) =>
              r && (r.scanId === previous.scanId || r.id === previous.scanId));
            if (row) {
              previousImageUrl = _str(row.imageUrl)
                              || _str(row.thumbnail)
                              || _str(row.photo)
                              || '';
            }
          }
        }
      }
    } catch { /* swallow — read-only fallback */ }

    const result: OutcomeComparisonResult = Object.freeze({
      plantId,
      currentScanId: scanId,
      previousScanId: previous.scanId,
      status,
      confidence: conf,
      beforePhoto: _str(scan.previousImageUrl)
                || previousImageUrl
                || undefined,
      afterPhoto:  _str(scan.imageUrl)
                || _str(scan.thumbnail)
                || undefined,
      beforeSeverity: previous.level,
      afterSeverity:  current.level,
      recommendation: _copy(status),
      needsReview: status === COMPARISON_STATUS.UNKNOWN,
      timestamp: _str(input.timestamp),
    });

    _appendHistory(result);
    return result;
  }, fallback(_str(input?.currentScan?.scanId), _str(input?.plantContext?.plantId)));
}

export function getLatestComparisonForPlant(plantId: string): OutcomeComparisonResult | null {
  return _safe(() => {
    const pid = _lower(plantId);
    if (!pid) return null;
    const rows = _readHistory()
      .filter((r) => _lower(r.plantId) === pid)
      .sort((a, b) => {
        const ta = a.timestamp ? Date.parse(a.timestamp) : 0;
        const tb = b.timestamp ? Date.parse(b.timestamp) : 0;
        return (Number.isFinite(tb) ? tb : 0)
             - (Number.isFinite(ta) ? ta : 0);
      });
    return rows[0] || null;
  }, null);
}

// ─── Diagnostic envelope ──────────────────────────────────────────

export function outcomeComparisonHealth(): OutcomeComparisonHealth {
  return _safe(() => Object.freeze({
    runtimeVersion:         OUTCOME_COMPARISON_RUNTIME_VERSION,
    initialized:            true,
    outcomeComparisonReady: true,
    statusValues: Object.freeze([
      COMPARISON_STATUS.IMPROVED,
      COMPARISON_STATUS.UNCHANGED,
      COMPARISON_STATUS.WORSENED,
      COMPARISON_STATUS.UNKNOWN,
    ]),
  }), Object.freeze({
    runtimeVersion:         OUTCOME_COMPARISON_RUNTIME_VERSION,
    initialized:            false,
    outcomeComparisonReady: false,
    statusValues:           Object.freeze([]),
  }));
}

export function installOutcomeComparisonGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__outcomeComparisonHealth !== 'function') {
      w.__outcomeComparisonHealth = function () {
        const out = outcomeComparisonHealth();
        try { console.log('[Farroway · Outcome Comparison]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
