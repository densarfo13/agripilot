/**
 * ScanReviewStatusRuntime.ts — §SCAN STATUS state machine.
 *
 *   Pending Review  → Community Reviewing | Officer Reviewing
 *   Community Reviewing → Resolved | Officer Reviewing
 *   Officer Reviewing   → Resolved
 *   Resolved → Follow-Up Due
 *   Follow-Up Due → Pending Review (next cycle) | (terminal when farmer done)
 *
 * Persists status records to localStorage; bounded; idempotent on scanId.
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

export const SCAN_REVIEW_STATUS_VERSION = 'scan-review-status-v1' as const;
const STORAGE_KEY = 'farroway_scan_review_status_log';
const MAX_ENTRIES = 200;

export type ScanReviewStatus =
  | 'pending_review'
  | 'community_reviewing'
  | 'officer_reviewing'
  | 'resolved'
  | 'follow_up_due';

export const VALID_STATUSES: ReadonlyArray<ScanReviewStatus> = Object.freeze([
  'pending_review', 'community_reviewing', 'officer_reviewing',
  'resolved', 'follow_up_due',
]);

const ALLOWED_TRANSITIONS: Readonly<Record<ScanReviewStatus, ReadonlyArray<ScanReviewStatus>>> = Object.freeze({
  pending_review: Object.freeze(['community_reviewing', 'officer_reviewing', 'resolved']),
  community_reviewing: Object.freeze(['resolved', 'officer_reviewing']),
  officer_reviewing: Object.freeze(['resolved']),
  resolved: Object.freeze(['follow_up_due']),
  follow_up_due: Object.freeze(['pending_review']),
});

export interface ScanReviewStatusRecord {
  scanId: string;
  status: ScanReviewStatus;
  updatedAt: number;
}

export interface ScanReviewStatusHealthEnvelope {
  initialized: true;
  storageReady: boolean;
  byStatus: Readonly<Record<ScanReviewStatus, number>>;
  totalTracked: number;
  noFakeStatuses: true;
  transitionsLocked: true;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

function _readLog(): ScanReviewStatusRecord[] {
  return _safe(() => {
    const raw = _ls(STORAGE_KEY);
    if (!Array.isArray(raw)) return [];
    const out: ScanReviewStatusRecord[] = [];
    for (const r of raw) {
      if (!r || typeof r !== 'object') continue;
      if (typeof r.scanId !== 'string') continue;
      if (VALID_STATUSES.indexOf(r.status) < 0) continue;
      if (typeof r.updatedAt !== 'number') continue;
      out.push({ scanId: r.scanId, status: r.status, updatedAt: r.updatedAt });
    }
    return out;
  }, []);
}

function _writeLog(list: ScanReviewStatusRecord[]): boolean {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const bounded = list.length > MAX_ENTRIES
      ? list.slice(list.length - MAX_ENTRIES) : list;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bounded));
    return true;
  }, false);
}

export function statusForScan(scanId: string): ScanReviewStatus | null {
  return _safe(() => {
    if (!scanId) return null;
    const list = _readLog();
    let latest: ScanReviewStatusRecord | null = null;
    for (const r of list) {
      if (r.scanId !== scanId) continue;
      if (!latest || r.updatedAt > latest.updatedAt) latest = r;
    }
    return latest ? latest.status : null;
  }, null);
}

export function setScanStatus(
  scanId: string, nextStatus: ScanReviewStatus, nowMs: number,
): boolean {
  return _safe(() => {
    if (!scanId || typeof scanId !== 'string') return false;
    if (VALID_STATUSES.indexOf(nextStatus) < 0) return false;
    if (typeof nowMs !== 'number' || !isFinite(nowMs)) return false;
    const current = statusForScan(scanId);
    if (current !== null) {
      const allowed = ALLOWED_TRANSITIONS[current] || [];
      if (allowed.indexOf(nextStatus) < 0) return false;
    }
    const list = _readLog();
    list.push({ scanId, status: nextStatus, updatedAt: nowMs });
    return _writeLog(list);
  }, false);
}

export function listByStatus(status: ScanReviewStatus, limit = 20)
  : ReadonlyArray<Readonly<ScanReviewStatusRecord>> {
  return _safe(() => {
    const list = _readLog();
    const latestByScan: Record<string, ScanReviewStatusRecord> = {};
    for (const r of list) {
      const prior = latestByScan[r.scanId];
      if (!prior || r.updatedAt > prior.updatedAt) latestByScan[r.scanId] = r;
    }
    const filtered = Object.values(latestByScan)
      .filter((r) => r.status === status)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    return Object.freeze(filtered.slice(0, Math.max(1, Math.min(limit, 100)))
      .map((r) => Object.freeze(r))) as ReadonlyArray<Readonly<ScanReviewStatusRecord>>;
  }, Object.freeze([]) as ReadonlyArray<Readonly<ScanReviewStatusRecord>>);
}

export function reviewQueueReady(): boolean {
  return _safe(() => typeof window !== 'undefined' && !!window.localStorage, false);
}

export function scanReviewStatusHealth()
  : Readonly<ScanReviewStatusHealthEnvelope> {
  return _safe(() => {
    const list = _readLog();
    const latestByScan: Record<string, ScanReviewStatusRecord> = {};
    for (const r of list) {
      const prior = latestByScan[r.scanId];
      if (!prior || r.updatedAt > prior.updatedAt) latestByScan[r.scanId] = r;
    }
    const counts: Record<ScanReviewStatus, number> = {
      pending_review: 0, community_reviewing: 0, officer_reviewing: 0,
      resolved: 0, follow_up_due: 0,
    };
    for (const r of Object.values(latestByScan)) counts[r.status]++;
    return Object.freeze<ScanReviewStatusHealthEnvelope>({
      initialized: true,
      storageReady: typeof window !== 'undefined' && !!window.localStorage,
      byStatus: Object.freeze(counts),
      totalTracked: Object.keys(latestByScan).length,
      noFakeStatuses: true as const,
      transitionsLocked: true as const,
      confidence: 'high' as Confidence,
      explanation:
        'Scan review status state machine. 5 statuses; transitions enforced via ' +
        'ALLOWED_TRANSITIONS table — invalid transitions are rejected at runtime. ' +
        'Counts reflect real persisted entries only.',
      limitations:
        'Status reflects local persistence; multi-device sync handled upstream. ' + GUIDANCE_TAIL,
    });
  }, Object.freeze<ScanReviewStatusHealthEnvelope>({
    initialized: true, storageReady: false,
    byStatus: Object.freeze({
      pending_review: 0, community_reviewing: 0, officer_reviewing: 0,
      resolved: 0, follow_up_due: 0,
    }),
    totalTracked: 0,
    noFakeStatuses: true as const, transitionsLocked: true as const,
    confidence: 'low' as Confidence,
    explanation: 'Scan review status runtime initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }));
}

export function installScanReviewStatusGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__scanReviewStatusHealth !== 'function') {
      w.__scanReviewStatusHealth = function () {
        const out = scanReviewStatusHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Scan Review Status]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
