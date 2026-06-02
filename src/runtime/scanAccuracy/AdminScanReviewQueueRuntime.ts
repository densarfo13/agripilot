/**
 * AdminScanReviewQueueRuntime.ts — §ADMIN REVIEW.
 *
 * Admin queue for:
 *   • unresolved scans (no community or officer suggestion accepted)
 *   • conflicting reviews (community vs officer disagreement)
 *   • high-risk crops (severity 'high' from disease pipeline)
 *
 * Role-gated: ONLY 'admin' role can read items. Other roles see EMPTY.
 * Persists items locally; no fabrication.
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

export const ADMIN_SCAN_REVIEW_QUEUE_VERSION = 'admin-scan-review-queue-v1' as const;
const STORAGE_KEY = 'farroway_admin_scan_review_queue';
const MAX_ENTRIES = 100;

export type AdminReviewReason = 'unresolved' | 'conflicting' | 'high_risk';

export interface AdminScanReviewItem {
  scanId: string;
  reason: AdminReviewReason;
  notes: string;
  organizationId: string | null;
  enqueuedAt: number;
  status: 'queued' | 'in_review' | 'completed';
}

export interface AdminScanReviewQueueHealthEnvelope {
  initialized: true;
  storageReady: boolean;
  queueDepth: number;
  inReviewCount: number;
  completedCount: number;
  adminOnly: true;
  noFabricatedQueue: true;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

function _readQueue(): AdminScanReviewItem[] {
  return _safe(() => {
    const raw = _ls(STORAGE_KEY);
    if (!Array.isArray(raw)) return [];
    const out: AdminScanReviewItem[] = [];
    for (const r of raw) {
      if (!r || typeof r !== 'object') continue;
      if (typeof r.scanId !== 'string') continue;
      if (r.reason !== 'unresolved' && r.reason !== 'conflicting' && r.reason !== 'high_risk') continue;
      if (typeof r.enqueuedAt !== 'number') continue;
      if (r.status !== 'queued' && r.status !== 'in_review' && r.status !== 'completed') continue;
      out.push({
        scanId: r.scanId,
        reason: r.reason,
        notes: typeof r.notes === 'string' ? r.notes : '',
        organizationId: typeof r.organizationId === 'string' ? r.organizationId : null,
        enqueuedAt: r.enqueuedAt,
        status: r.status,
      });
    }
    return out;
  }, []);
}

function _writeQueue(list: AdminScanReviewItem[]): boolean {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const bounded = list.length > MAX_ENTRIES
      ? list.slice(list.length - MAX_ENTRIES) : list;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bounded));
    return true;
  }, false);
}

export function enqueueAdminReview(
  scanId: string, reason: AdminReviewReason, notes: string,
  organizationId: string | null, nowMs: number,
): boolean {
  return _safe(() => {
    if (!scanId || typeof scanId !== 'string') return false;
    if (typeof nowMs !== 'number') return false;
    const list = _readQueue();
    if (list.some((q) => q.scanId === scanId)) return false;
    list.push({
      scanId, reason,
      notes: typeof notes === 'string' ? notes : '',
      organizationId, enqueuedAt: nowMs, status: 'queued' as const,
    });
    return _writeQueue(list);
  }, false);
}

/** Admin-only read; other roles return EMPTY. */
export function listAdminQueueForRole(role: string, limit = 20)
  : ReadonlyArray<Readonly<AdminScanReviewItem>> {
  return _safe(() => {
    const r = String(role || '').toLowerCase();
    if (r !== 'admin') {
      return Object.freeze([]) as ReadonlyArray<Readonly<AdminScanReviewItem>>;
    }
    const list = _readQueue();
    list.sort((a, b) => b.enqueuedAt - a.enqueuedAt);
    return Object.freeze(list.slice(0, Math.max(1, Math.min(limit, 50)))
      .map((q) => Object.freeze(q))) as ReadonlyArray<Readonly<AdminScanReviewItem>>;
  }, Object.freeze([]) as ReadonlyArray<Readonly<AdminScanReviewItem>>);
}

export function adminReviewReady(): boolean {
  return _safe(() => typeof window !== 'undefined' && !!window.localStorage, false);
}

export function adminScanReviewQueueHealth()
  : Readonly<AdminScanReviewQueueHealthEnvelope> {
  return _safe(() => {
    const list = _readQueue();
    return Object.freeze<AdminScanReviewQueueHealthEnvelope>({
      initialized: true,
      storageReady: typeof window !== 'undefined' && !!window.localStorage,
      queueDepth: list.filter((q) => q.status === 'queued').length,
      inReviewCount: list.filter((q) => q.status === 'in_review').length,
      completedCount: list.filter((q) => q.status === 'completed').length,
      adminOnly: true as const,
      noFabricatedQueue: true as const,
      confidence: 'high' as Confidence,
      explanation:
        'Admin scan review queue. Role-gated to admin only — other roles ALWAYS see empty. ' +
        'Reasons: unresolved / conflicting / high_risk. Items enqueued explicitly by the ' +
        'routing layer when no other review path resolves the scan.',
      limitations:
        'Admin queue is the final escalation path; entries reflect real unresolved scans. '
        + GUIDANCE_TAIL,
    });
  }, Object.freeze<AdminScanReviewQueueHealthEnvelope>({
    initialized: true, storageReady: false,
    queueDepth: 0, inReviewCount: 0, completedCount: 0,
    adminOnly: true as const, noFabricatedQueue: true as const,
    confidence: 'low' as Confidence,
    explanation: 'Admin scan review queue runtime initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }));
}

export function installAdminScanReviewQueueGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__adminScanReviewQueueHealth !== 'function') {
      w.__adminScanReviewQueueHealth = function () {
        const out = adminScanReviewQueueHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Admin Scan Queue]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
