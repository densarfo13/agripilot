/**
 * ScanResolutionEngine.ts — §RESOLUTION ENGINE.
 *
 * When a review (community / officer / admin) completes, the engine:
 *   1. Records a ScanResolved artifact in localStorage.
 *   2. Generates a recommendedAction string + followUpDate offset.
 *   3. Transitions the scan's status to 'resolved'.
 *   4. Surfaces a follow-up task descriptor pages can read.
 *
 * Self-contained; never throws. The actual task render is handled by
 * ScanFollowUpRuntime — this module just constructs the descriptor.
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

export const SCAN_RESOLUTION_VERSION = 'scan-resolution-v1' as const;
const STORAGE_KEY = 'farroway_scan_resolved_artifacts';
const MAX_ENTRIES = 200;

export type ResolutionSource = 'community' | 'field_officer' | 'admin' | 'grower_pick';

export interface ScanResolvedArtifact {
  kind: 'ScanResolved';
  scanId: string;
  source: ResolutionSource;
  resolvedPlantKey: string | null;
  resolvedIssue: string | null;
  recommendedAction: string;
  followUpDaysFromNow: number;
  resolvedAt: number;
}

export interface ResolutionResult {
  artifact: Readonly<ScanResolvedArtifact>;
  followUpTaskDescriptor: Readonly<{
    title: string;
    why: string;
    daysFromNow: number;
    sourceScanId: string;
  }>;
}

export interface ScanResolutionHealthEnvelope {
  initialized: true;
  storageReady: boolean;
  resolvedCount: number;
  bySource: Readonly<Record<ResolutionSource, number>>;
  alwaysGeneratesAction: true;
  alwaysGeneratesFollowUp: true;
  noFakeArtifacts: true;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

function _readArtifacts(): ScanResolvedArtifact[] {
  return _safe(() => {
    const raw = _ls(STORAGE_KEY);
    if (!Array.isArray(raw)) return [];
    const out: ScanResolvedArtifact[] = [];
    for (const r of raw) {
      if (!r || typeof r !== 'object') continue;
      if (r.kind !== 'ScanResolved') continue;
      if (typeof r.scanId !== 'string') continue;
      if (typeof r.resolvedAt !== 'number') continue;
      if (r.source !== 'community' && r.source !== 'field_officer'
          && r.source !== 'admin' && r.source !== 'grower_pick') continue;
      out.push({
        kind: 'ScanResolved',
        scanId: r.scanId,
        source: r.source,
        resolvedPlantKey: typeof r.resolvedPlantKey === 'string' ? r.resolvedPlantKey : null,
        resolvedIssue: typeof r.resolvedIssue === 'string' ? r.resolvedIssue : null,
        recommendedAction: typeof r.recommendedAction === 'string' ? r.recommendedAction : '',
        followUpDaysFromNow: typeof r.followUpDaysFromNow === 'number' ? r.followUpDaysFromNow : 3,
        resolvedAt: r.resolvedAt,
      });
    }
    return out;
  }, []);
}

function _writeArtifacts(list: ScanResolvedArtifact[]): boolean {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const bounded = list.length > MAX_ENTRIES
      ? list.slice(list.length - MAX_ENTRIES) : list;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bounded));
    return true;
  }, false);
}

/** Build the recommended action + follow-up window from the
 *  resolution context. Pure function; never fabricates plant data. */
function _composeAction(
  source: ResolutionSource,
  resolvedPlantKey: string | null,
  resolvedIssue: string | null,
): { recommendedAction: string; followUpDaysFromNow: number } {
  if (resolvedIssue && resolvedPlantKey) {
    return {
      recommendedAction:
        'Inspect ' + resolvedPlantKey + ' for ' + resolvedIssue
        + ' and follow the guidance shared by the ' + source.replace('_', ' ') + '.',
      followUpDaysFromNow: 2,
    };
  }
  if (resolvedPlantKey) {
    return {
      recommendedAction:
        'Continue monitoring your ' + resolvedPlantKey + ' and retake a photo if symptoms appear.',
      followUpDaysFromNow: 3,
    };
  }
  return {
    recommendedAction:
      'Retake a clearer photo of the affected leaf or plant.',
    followUpDaysFromNow: 3,
  };
}

/** Resolve a scan — ALWAYS generates an artifact + a follow-up
 *  descriptor. Never returns null. */
export function resolveScanReview(input: {
  scanId: string;
  source: ResolutionSource;
  resolvedPlantKey: string | null;
  resolvedIssue: string | null;
  nowMs: number;
}): Readonly<ResolutionResult> {
  return _safe(() => {
    const scanId = input && typeof input.scanId === 'string' ? input.scanId : '';
    const source = input && input.source ? input.source : 'admin';
    const nowMs = typeof input.nowMs === 'number' && isFinite(input.nowMs) ? input.nowMs : 0;
    const composed = _composeAction(source, input.resolvedPlantKey, input.resolvedIssue);

    const artifact: ScanResolvedArtifact = {
      kind: 'ScanResolved',
      scanId,
      source,
      resolvedPlantKey: input.resolvedPlantKey,
      resolvedIssue: input.resolvedIssue,
      recommendedAction: composed.recommendedAction,
      followUpDaysFromNow: composed.followUpDaysFromNow,
      resolvedAt: nowMs,
    };
    // Persist (idempotent on scanId).
    const list = _readArtifacts();
    const i = list.findIndex((a) => a.scanId === scanId);
    if (i >= 0) list[i] = artifact;
    else list.push(artifact);
    _writeArtifacts(list);

    return Object.freeze<ResolutionResult>({
      artifact: Object.freeze(artifact),
      followUpTaskDescriptor: Object.freeze({
        title: 'Follow up on scan' + (input.resolvedPlantKey ? ': ' + input.resolvedPlantKey : ''),
        why: composed.recommendedAction,
        daysFromNow: composed.followUpDaysFromNow,
        sourceScanId: scanId,
      }),
    });
  }, Object.freeze<ResolutionResult>({
    artifact: Object.freeze({
      kind: 'ScanResolved' as const,
      scanId: '', source: 'admin' as ResolutionSource,
      resolvedPlantKey: null, resolvedIssue: null,
      recommendedAction: 'Retake a clearer photo of the affected leaf or plant.',
      followUpDaysFromNow: 3, resolvedAt: 0,
    }),
    followUpTaskDescriptor: Object.freeze({
      title: 'Follow up on scan',
      why: 'Retake a clearer photo of the affected leaf or plant.',
      daysFromNow: 3, sourceScanId: '',
    }),
  }));
}

export function listResolvedArtifacts(limit = 20)
  : ReadonlyArray<Readonly<ScanResolvedArtifact>> {
  return _safe(() => {
    const list = _readArtifacts();
    list.sort((a, b) => b.resolvedAt - a.resolvedAt);
    return Object.freeze(list.slice(0, Math.max(1, Math.min(limit, 100)))
      .map((a) => Object.freeze(a))) as ReadonlyArray<Readonly<ScanResolvedArtifact>>;
  }, Object.freeze([]) as ReadonlyArray<Readonly<ScanResolvedArtifact>>);
}

export function resolutionEngineReady(): boolean {
  return _safe(() => typeof window !== 'undefined' && !!window.localStorage, false);
}

export function scanResolutionHealth()
  : Readonly<ScanResolutionHealthEnvelope> {
  return _safe(() => {
    const list = _readArtifacts();
    const counts: Record<ResolutionSource, number> = {
      community: 0, field_officer: 0, admin: 0, grower_pick: 0,
    };
    for (const a of list) counts[a.source]++;
    return Object.freeze<ScanResolutionHealthEnvelope>({
      initialized: true,
      storageReady: typeof window !== 'undefined' && !!window.localStorage,
      resolvedCount: list.length,
      bySource: Object.freeze(counts),
      alwaysGeneratesAction: true as const,
      alwaysGeneratesFollowUp: true as const,
      noFakeArtifacts: true as const,
      confidence: 'high' as Confidence,
      explanation:
        'Scan resolution engine. resolveScanReview() always returns an artifact + a follow-up ' +
        'task descriptor (never null). Persists ScanResolved artifacts to localStorage; ' +
        'idempotent on scanId. Recommended action composed deterministically from the source ' +
        'and resolution data — never fabricated.',
      limitations:
        'Resolution generates a follow-up window in days; pages render the task via ' +
        'ScanFollowUpRuntime. ' + GUIDANCE_TAIL,
    });
  }, Object.freeze<ScanResolutionHealthEnvelope>({
    initialized: true, storageReady: false,
    resolvedCount: 0,
    bySource: Object.freeze({ community: 0, field_officer: 0, admin: 0, grower_pick: 0 }),
    alwaysGeneratesAction: true as const,
    alwaysGeneratesFollowUp: true as const,
    noFakeArtifacts: true as const,
    confidence: 'low' as Confidence,
    explanation: 'Scan resolution engine runtime initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }));
}

export function installScanResolutionEngineGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__scanResolutionHealth !== 'function') {
      w.__scanResolutionHealth = function () {
        const out = scanResolutionHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Scan Resolution]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
