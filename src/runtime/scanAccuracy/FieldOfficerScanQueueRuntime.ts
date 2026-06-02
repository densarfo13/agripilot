/**
 * FieldOfficerScanQueueRuntime.ts — §FIELD OFFICER REVIEW.
 *
 * Per-officer queue of scans needing review. Role-gated: a field
 * officer sees ONLY scans where assignedOfficerId matches their userId.
 * Org admins see all queues within their organization. System admins
 * see global (filter not applied).
 *
 * Persists queue items locally; queue draws from real scan memory
 * entries with confidence below the routing threshold. No fabrication.
 */

import { GUIDANCE_TAIL } from './ScanAccuracyContracts';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}
function _ls(key: string): any {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, null);
}
type Confidence = 'low' | 'medium' | 'high';

export const FIELD_OFFICER_SCAN_QUEUE_VERSION = 'field-officer-scan-queue-v1' as const;
const STORAGE_KEY = 'farroway_field_officer_scan_queue';
const MAX_ENTRIES = 100;

export interface FieldOfficerScanQueueItem {
  scanId: string;
  farmerId: string | null;
  assignedOfficerId: string | null;
  organizationId: string | null;
  plantKey: string | null;
  bestCandidateKey: string | null;
  bestCandidateConfidencePct: number;
  candidates: ReadonlyArray<{ key: string; label: string; confidencePct: number }>;
  farmContextSummary: string;
  problemReported: string | null;
  enqueuedAt: number;
  status: 'queued' | 'in_review' | 'completed';
}

export interface OfficerScanReviewSubmission {
  scanId: string;
  identifiedPlantKey: string | null;
  identifiedIssue: string | null;
  recommendedNextStep: string;
  officerId: string;
  reviewedAt: number;
}

export interface FieldOfficerScanQueueHealthEnvelope {
  initialized: true;
  storageReady: boolean;
  queueDepth: number;
  inReviewCount: number;
  completedCount: number;
  roleScoped: true;
  orgScoped: true;
  noCrossOrgLeakage: true;
  noFabricatedQueue: true;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

function _readQueue(): FieldOfficerScanQueueItem[] {
  return _safe(() => {
    const raw = _ls(STORAGE_KEY);
    if (!Array.isArray(raw)) return [];
    const out: FieldOfficerScanQueueItem[] = [];
    for (const r of raw) {
      if (!r || typeof r !== 'object') continue;
      if (typeof r.scanId !== 'string') continue;
      if (typeof r.enqueuedAt !== 'number') continue;
      if (r.status !== 'queued' && r.status !== 'in_review' && r.status !== 'completed') continue;
      out.push({
        scanId: r.scanId,
        farmerId: typeof r.farmerId === 'string' ? r.farmerId : null,
        assignedOfficerId: typeof r.assignedOfficerId === 'string' ? r.assignedOfficerId : null,
        organizationId: typeof r.organizationId === 'string' ? r.organizationId : null,
        plantKey: typeof r.plantKey === 'string' ? r.plantKey : null,
        bestCandidateKey: typeof r.bestCandidateKey === 'string' ? r.bestCandidateKey : null,
        bestCandidateConfidencePct: typeof r.bestCandidateConfidencePct === 'number'
          ? r.bestCandidateConfidencePct : 0,
        candidates: Array.isArray(r.candidates)
          ? Object.freeze(r.candidates.slice(0, 5)) as ReadonlyArray<any> : Object.freeze([]),
        farmContextSummary: typeof r.farmContextSummary === 'string' ? r.farmContextSummary : '',
        problemReported: typeof r.problemReported === 'string' ? r.problemReported : null,
        enqueuedAt: r.enqueuedAt,
        status: r.status,
      });
    }
    return out;
  }, []);
}

function _writeQueue(list: FieldOfficerScanQueueItem[]): boolean {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const bounded = list.length > MAX_ENTRIES
      ? list.slice(list.length - MAX_ENTRIES) : list;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bounded));
    return true;
  }, false);
}

export function enqueueScanForOfficerReview(
  item: Omit<FieldOfficerScanQueueItem, 'enqueuedAt' | 'status'>,
  nowMs: number,
): boolean {
  return _safe(() => {
    if (!item || !item.scanId || typeof nowMs !== 'number') return false;
    const list = _readQueue();
    if (list.some((q) => q.scanId === item.scanId)) return false;
    list.push({ ...item, enqueuedAt: nowMs, status: 'queued' as const });
    return _writeQueue(list);
  }, false);
}

export function markQueueItemInReview(scanId: string): boolean {
  return _safe(() => {
    const list = _readQueue();
    const i = list.findIndex((q) => q.scanId === scanId);
    if (i < 0) return false;
    list[i] = { ...list[i], status: 'in_review' };
    return _writeQueue(list);
  }, false);
}

export function completeQueueItem(scanId: string): boolean {
  return _safe(() => {
    const list = _readQueue();
    const i = list.findIndex((q) => q.scanId === scanId);
    if (i < 0) return false;
    list[i] = { ...list[i], status: 'completed' };
    return _writeQueue(list);
  }, false);
}

/** Role-gated read: field officer sees only assigned items;
 *  organization_admin sees own org; admin sees all. Other roles see
 *  EMPTY — never cross-org/cross-officer leakage. */
export function listQueueForRole(
  role: string, userId: string | null, organizationId: string | null,
  limit = 20,
): ReadonlyArray<Readonly<FieldOfficerScanQueueItem>> {
  return _safe(() => {
    const r = String(role || '').toLowerCase();
    if (r !== 'field_officer' && r !== 'organization_admin' && r !== 'admin') {
      return Object.freeze([]) as ReadonlyArray<Readonly<FieldOfficerScanQueueItem>>;
    }
    const list = _readQueue();
    let filtered = list;
    if (r === 'field_officer') {
      if (!userId) return Object.freeze([]) as ReadonlyArray<Readonly<FieldOfficerScanQueueItem>>;
      filtered = list.filter((q) => q.assignedOfficerId === userId);
    } else if (r === 'organization_admin') {
      if (!organizationId) return Object.freeze([]) as ReadonlyArray<Readonly<FieldOfficerScanQueueItem>>;
      filtered = list.filter((q) => q.organizationId === organizationId);
    }
    // Admin path: no filter.
    filtered.sort((a, b) => b.enqueuedAt - a.enqueuedAt);
    return Object.freeze(filtered.slice(0, Math.max(1, Math.min(limit, 50)))
      .map((q) => Object.freeze(q))) as ReadonlyArray<Readonly<FieldOfficerScanQueueItem>>;
  }, Object.freeze([]) as ReadonlyArray<Readonly<FieldOfficerScanQueueItem>>);
}

export function fieldOfficerReviewReady(): boolean {
  return _safe(() => typeof window !== 'undefined' && !!window.localStorage, false);
}

export function fieldOfficerScanQueueHealth()
  : Readonly<FieldOfficerScanQueueHealthEnvelope> {
  return _safe(() => {
    const list = _readQueue();
    return Object.freeze<FieldOfficerScanQueueHealthEnvelope>({
      initialized: true,
      storageReady: typeof window !== 'undefined' && !!window.localStorage,
      queueDepth: list.filter((q) => q.status === 'queued').length,
      inReviewCount: list.filter((q) => q.status === 'in_review').length,
      completedCount: list.filter((q) => q.status === 'completed').length,
      roleScoped: true as const,
      orgScoped: true as const,
      noCrossOrgLeakage: true as const,
      noFabricatedQueue: true as const,
      confidence: 'high' as Confidence,
      explanation:
        'Field officer scan queue — role-scoped reads. field_officer sees only items where ' +
        'assignedOfficerId matches their userId. organization_admin sees only items in their ' +
        'organization. admin sees all. Other roles see empty array.',
      limitations:
        'Queue items must be enqueued explicitly by the routing layer; this runtime never ' +
        'fabricates entries. ' + GUIDANCE_TAIL,
    });
  }, Object.freeze<FieldOfficerScanQueueHealthEnvelope>({
    initialized: true, storageReady: false,
    queueDepth: 0, inReviewCount: 0, completedCount: 0,
    roleScoped: true as const, orgScoped: true as const,
    noCrossOrgLeakage: true as const, noFabricatedQueue: true as const,
    confidence: 'low' as Confidence,
    explanation: 'Field officer scan queue runtime initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }));
}

export function installFieldOfficerScanQueueGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__fieldOfficerScanQueueHealth !== 'function') {
      w.__fieldOfficerScanQueueHealth = function () {
        const out = fieldOfficerScanQueueHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · FO Scan Queue]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
