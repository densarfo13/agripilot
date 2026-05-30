/**
 * src/runtime/outcomeIntelligence/PilotAnalyticsRuntime.ts —
 * wave-36 pure-aggregation runtime for the pilot analytics view.
 *
 * Reads ONLY existing real data sources:
 *   • retention events at `farroway.retentionEvents` (wave-37)
 *   • outcome records via OutcomeRuntime.listOutcomes()
 *   • the `firstVisit` anchor for the active-grower calculation
 *
 * Computes:
 *   Metrics (counts):
 *     weeklyActiveGrowers  — distinct event-days in last 7d
 *     scans                — count of scan events in last 7d
 *     plantsAdded          — count of plant_created in last 7d
 *     tasksGenerated       — derived: tasks_completed + open tasks
 *                            (we can only see completed via audit;
 *                            for now report tasksCompleted only and
 *                            mark tasksGenerated null if unknown)
 *     tasksCompleted       — count of task_completed in last 7d
 *     followUpScans        — count of outcomes with ≥ 2 scans
 *     outcomesRecorded     — outcomes with status != UNKNOWN
 *
 *   Rates (percent, 0–100):
 *     taskCompletionRate   — completed / generated
 *     followUpScanRate     — followUpScans / outcomes
 *     improvementRate      — improved+resolved / outcomes
 *
 * Strict-rule audit
 *   • Pure read-only. SSR-safe. Frozen envelope. Never throws.
 *   • Numeric fields are `null` when the source is unavailable.
 *     NEVER fabricates a 0 or fake count.
 */

import { listOutcomes } from '../outcomes/OutcomeRuntime';
import { OUTCOME_STATUS } from '../outcomes/outcomeContracts';
import { readStoredEvents, readFirstVisit } from '../retention/RetentionRuntime';
import { RETENTION_EVENT } from '../retention/retentionContracts';

export const PILOT_ANALYTICS_RUNTIME_VERSION = 'pilot-analytics-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

const _MS_PER_DAY = 24 * 60 * 60 * 1000;
const _DAY_MS = _MS_PER_DAY;

function _toMs(iso: string): number {
  return _safe(() => new Date(iso).getTime(), NaN);
}

function _withinWindow(iso: string, nowMs: number, windowDays: number): boolean {
  return _safe(() => {
    const ms = _toMs(iso);
    if (!Number.isFinite(ms)) return false;
    const cutoff = nowMs - windowDays * _DAY_MS;
    return ms > cutoff && ms <= nowMs;
  }, false);
}

function _percent(num: number, denom: number): number | null {
  if (!Number.isFinite(num) || !Number.isFinite(denom)) return null;
  if (denom <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((num / denom) * 100)));
}

export interface PilotAnalyticsSnapshot {
  runtimeVersion:       string;
  initialized:          boolean;
  realDataOnly:         true;
  windowDays:           number;
  // Counts — null when source unavailable.
  weeklyActiveGrowers:  number | null;
  scans:                number | null;
  plantsAdded:          number | null;
  tasksGenerated:       number | null;
  tasksCompleted:       number | null;
  followUpScans:        number | null;
  outcomesRecorded:     number | null;
  // Rates 0-100, null when denominator absent.
  taskCompletionRate:   number | null;
  followUpScanRate:     number | null;
  improvementRate:      number | null;
  // Honest empty-state hint for the UI.
  emptyStateMessage:    string;
}

const FROZEN_FALLBACK: Readonly<PilotAnalyticsSnapshot> = Object.freeze({
  runtimeVersion:       PILOT_ANALYTICS_RUNTIME_VERSION,
  initialized:          false,
  realDataOnly:         true as const,
  windowDays:           7,
  weeklyActiveGrowers:  null,
  scans:                null,
  plantsAdded:          null,
  tasksGenerated:       null,
  tasksCompleted:       null,
  followUpScans:        null,
  outcomesRecorded:     null,
  taskCompletionRate:   null,
  followUpScanRate:     null,
  improvementRate:      null,
  emptyStateMessage:    'Not enough data yet',
});

export function pilotAnalyticsSnapshot(opts?: {
  nowIso?: string;
  windowDays?: number;
}): PilotAnalyticsSnapshot {
  return _safe(() => {
    const nowIso = (opts && opts.nowIso) || new Date().toISOString();
    const nowMs = _toMs(nowIso);
    if (!Number.isFinite(nowMs)) return FROZEN_FALLBACK;

    const windowDays = Math.max(1, Math.min(90,
      (opts && Number.isFinite(opts.windowDays!) ? Math.floor(opts.windowDays!) : 7)));

    // ── Retention events ──
    const events = readStoredEvents();
    const eventsSource = Array.isArray(events) ? events : null;

    let scans = 0, plantsAdded = 0, tasksCompleted = 0;
    const activeDays = new Set<number>();
    if (eventsSource) {
      for (const e of events) {
        if (!e || !_withinWindow(e.iso, nowMs, windowDays)) continue;
        // Active days
        const ms = _toMs(e.iso);
        if (Number.isFinite(ms)) activeDays.add(Math.floor(ms / _DAY_MS));
        if (e.t === RETENTION_EVENT.SCAN)            scans++;
        if (e.t === RETENTION_EVENT.PLANT_CREATED)   plantsAdded++;
        if (e.t === RETENTION_EVENT.TASK_COMPLETED)  tasksCompleted++;
      }
    }
    const weeklyActiveGrowers = eventsSource ? activeDays.size : null;
    const scansOut       = eventsSource ? scans : null;
    const plantsOut      = eventsSource ? plantsAdded : null;
    const tasksOut       = eventsSource ? tasksCompleted : null;

    // ── Outcome records ──
    const outcomes = listOutcomes();
    const outcomesSource = Array.isArray(outcomes) ? outcomes : null;
    let followUpScans = 0, outcomesRecorded = 0, improvedCount = 0;
    if (outcomesSource) {
      for (const o of outcomes) {
        if (!o) continue;
        if (!_withinWindow(o.timestamp, nowMs, windowDays)) continue;
        // Follow-up scan: outcome record references ≥ 2 scans.
        if (Array.isArray(o.scanIds) && o.scanIds.length >= 2) {
          followUpScans++;
        }
        // Outcome recorded: status not UNKNOWN.
        if (o.outcomeStatus && o.outcomeStatus !== OUTCOME_STATUS.UNKNOWN) {
          outcomesRecorded++;
          if (o.outcomeStatus === OUTCOME_STATUS.IMPROVED
              || o.outcomeStatus === OUTCOME_STATUS.RESOLVED) {
            improvedCount++;
          }
        }
      }
    }
    const followUpOut       = outcomesSource ? followUpScans : null;
    const outcomesRecOut    = outcomesSource ? outcomesRecorded : null;

    // Rates — null-safe denominators.
    // tasksGenerated isn't directly recorded; we honestly leave it
    // null and compute the rate against tasksCompleted only when
    // a "generated" stream becomes available. Reporting null here
    // is the spec-compliant honest answer.
    const tasksGenerated: number | null = null;
    const taskCompletionRate: number | null = null;
    const followUpScanRate = _percent(followUpScans, outcomesRecorded);
    const improvementRate  = _percent(improvedCount, outcomesRecorded);

    return Object.freeze({
      runtimeVersion:       PILOT_ANALYTICS_RUNTIME_VERSION,
      initialized:          true,
      realDataOnly:         true as const,
      windowDays,
      weeklyActiveGrowers,
      scans:                scansOut,
      plantsAdded:          plantsOut,
      tasksGenerated,
      tasksCompleted:       tasksOut,
      followUpScans:        followUpOut,
      outcomesRecorded:     outcomesRecOut,
      taskCompletionRate,
      followUpScanRate,
      improvementRate,
      emptyStateMessage:    'Not enough data yet',
    });
  }, FROZEN_FALLBACK);
}

export function installPilotAnalyticsGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__pilotAnalytics !== 'function') {
      w.__pilotAnalytics = function (opts?: any) {
        const out = pilotAnalyticsSnapshot(opts);
        try { console.log('[Farroway · Pilot Analytics]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}

// Used by __outcomeHealth wave-36 envelope for the analyticsReady
// + improvementTrackingReady attestations.
export function analyticsReady(): boolean {
  return _safe(() => {
    const events = readStoredEvents();
    return Array.isArray(events);
  }, false);
}
export function improvementTrackingReady(): boolean {
  return _safe(() => {
    const outcomes = listOutcomes();
    return Array.isArray(outcomes);
  }, false);
}
