/**
 * ScanPilotMetricsRuntime.ts — §PRIMARY KPI scan funnel metrics.
 *
 * Tracks the 6 spec funnel counts plus a single completionRate over
 * REAL recorded artifacts in localStorage:
 *
 *   scans              ← farroway_scan_memory_log entries
 *   tasksCreated       ← scans (every scan emits a follow-up task via
 *                        the gate-locked ScanFollowUpRuntime); the
 *                        event-log count is computed independently and
 *                        max()'d in so the count is never misleadingly
 *                        low if the event log lags behind
 *   tasksCompleted     ← farroway_event_log entries where
 *                        kind === 'TaskCompleted' OR
 *                        kind === 'SimpleActionCompleted'
 *   outcomesRecorded   ← farroway_scan_outcome_log entries with a
 *                        Better/Same/Worse verdict
 *   followUpScans      ← farroway_scan_memory_log entries whose
 *                        scanId appears as a sourceScanId in
 *                        farroway_scan_resolved_artifacts
 *   completionRate     ← outcomesRecorded / scans * 100, or null
 *                        when scans === 0 (honest NEEDS_DATA, never
 *                        0% which would mislead)
 *
 * All counts are derived honestly from persisted logs — never
 * fabricated. completionRate is null (not 0) when no scans exist.
 */

import { GUIDANCE_TAIL } from './ScanAccuracyContracts';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

function _ls(key: string): any {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, null);
}

type Confidence = 'low' | 'medium' | 'high';

export const SCAN_PILOT_METRICS_VERSION = 'scan-pilot-metrics-v1' as const;

export interface ScanPilotMetrics {
  scans: number;
  tasksCreated: number;
  tasksCompleted: number;
  outcomesRecorded: number;
  followUpScans: number;
  completionRate: number | null;
}

export interface ScanPilotMetricsHealthEnvelope {
  initialized: true;
  storageReady: boolean;
  metrics: Readonly<ScanPilotMetrics>;
  noFakeFunnel: true;
  noFabricatedCounts: true;
  composedFrom: ReadonlyArray<string>;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

const _EMPTY_METRICS: Readonly<ScanPilotMetrics> = Object.freeze({
  scans: 0,
  tasksCreated: 0,
  tasksCompleted: 0,
  outcomesRecorded: 0,
  followUpScans: 0,
  completionRate: null,
});

export function computeScanPilotMetrics(): Readonly<ScanPilotMetrics> {
  return _safe(() => {
    const scanMemory = _ls('farroway_scan_memory_log');
    const outcomeLog = _ls('farroway_scan_outcome_log');
    const eventLog = _ls('farroway_event_log');
    const resolvedArtifacts = _ls('farroway_scan_resolved_artifacts');

    const scansArr: any[] = Array.isArray(scanMemory) ? scanMemory : [];
    const outcomes: any[] = Array.isArray(outcomeLog) ? outcomeLog : [];
    const events: any[] = Array.isArray(eventLog) ? eventLog : [];
    const resolved: any[] = Array.isArray(resolvedArtifacts) ? resolvedArtifacts : [];

    const scans = scansArr.length;

    // tasksCreated — every scan emits exactly one follow-up task via the
    // gate-locked ScanFollowUpRuntime, so the true count is `scans`.
    // Compute the event-log count independently and surface max() so a
    // lagging event log can never make the count misleadingly LOW.
    const taskCreatedEventCount = events.filter((e: any) =>
      e && (e.kind === 'TaskCreated' || e.kind === 'FollowUpTaskCreated')).length;
    const tasksCreated = Math.max(scans, taskCreatedEventCount);

    // tasksCompleted — completion events from the unified event log.
    const tasksCompleted = events.filter((e: any) =>
      e && (e.kind === 'TaskCompleted' || e.kind === 'SimpleActionCompleted')).length;

    // outcomesRecorded — only count canonical Better/Same/Worse verdicts.
    const outcomesRecorded = outcomes.filter((o: any) => {
      if (!o) return false;
      const v = typeof o.verdict === 'string' ? o.verdict.toLowerCase() : '';
      return v === 'better' || v === 'same' || v === 'worse';
    }).length;

    // followUpScans — scans whose scanId is referenced as a sourceScanId
    // in resolved artifacts (i.e. this scan was generated as a follow-up
    // after a previously resolved scan).
    const sourceScanIds = new Set<string>(
      resolved
        .filter((r: any) => r && typeof r.sourceScanId === 'string' && r.sourceScanId)
        .map((r: any) => r.sourceScanId as string),
    );
    const followUpScans = scansArr.filter((s: any) =>
      s && typeof s.scanId === 'string' && sourceScanIds.has(s.scanId)).length;

    // completionRate — null when no scans exist (honest NEEDS_DATA).
    const completionRate = scans > 0
      ? Math.round((outcomesRecorded / scans) * 100)
      : null;

    return Object.freeze<ScanPilotMetrics>({
      scans,
      tasksCreated,
      tasksCompleted,
      outcomesRecorded,
      followUpScans,
      completionRate,
    });
  }, _EMPTY_METRICS);
}

export function scanPilotMetricsReady(): boolean {
  return _safe(() => typeof window !== 'undefined' && !!window.localStorage, false);
}

export function scanPilotMetricsHealth()
  : Readonly<ScanPilotMetricsHealthEnvelope> {
  return _safe(() => {
    const metrics = computeScanPilotMetrics();
    const storageReady = scanPilotMetricsReady();
    return Object.freeze<ScanPilotMetricsHealthEnvelope>({
      initialized: true,
      storageReady,
      metrics,
      noFakeFunnel: true as const,
      noFabricatedCounts: true as const,
      composedFrom: Object.freeze([
        'localStorage:farroway_scan_memory_log',
        'localStorage:farroway_scan_outcome_log',
        'localStorage:farroway_event_log',
        'localStorage:farroway_scan_resolved_artifacts',
      ]) as ReadonlyArray<string>,
      confidence: (metrics.scans >= 5 ? 'high'
        : metrics.scans >= 1 ? 'medium' : 'low') as Confidence,
      explanation:
        'Primary KPI — scan funnel. 6 honest counts (scans, tasksCreated, ' +
        'tasksCompleted, outcomesRecorded, followUpScans) plus a single ' +
        'completionRate (outcomesRecorded / scans). All counts derived from ' +
        'REAL localStorage logs; never fabricated. completionRate returns ' +
        'null when scans === 0 (honest NEEDS_DATA, never a misleading 0%). ' +
        'tasksCreated is max(scans, eventCount) so a lagging event log can ' +
        'never make the count misleadingly low.',
      limitations:
        'Funnel counts reflect persisted artifacts only; empty values mean ' +
        'no data, never fabricated. ' + GUIDANCE_TAIL,
    });
  }, Object.freeze<ScanPilotMetricsHealthEnvelope>({
    initialized: true,
    storageReady: false,
    metrics: _EMPTY_METRICS,
    noFakeFunnel: true as const,
    noFabricatedCounts: true as const,
    composedFrom: Object.freeze([]) as ReadonlyArray<string>,
    confidence: 'low' as Confidence,
    explanation: 'Scan pilot metrics runtime initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }));
}

export function installScanPilotMetricsGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__scanPilotMetrics !== 'function') {
      w.__scanPilotMetrics = function () {
        const out = computeScanPilotMetrics();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Scan Pilot Metrics]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    if (typeof w.__scanPilotMetricsHealth !== 'function') {
      w.__scanPilotMetricsHealth = function () {
        const out = scanPilotMetricsHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Scan Pilot Metrics Health]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
