/**
 * CommunityScanReviewRuntime.ts — §COMMUNITY REVIEW.
 *
 * Bridges scan results to the community feed so growers can ask
 * "What plant is this?" or "What issue is this?" when confidence is
 * low. Persists pending-review records to localStorage with bounded
 * size; admin moderation flows through the EXISTING community runtime
 * (this module never writes directly to public surfaces).
 *
 * Honest contract:
 *   • Records are LOCAL pending-review markers only — actual publish
 *     to community feed happens via the moderation gate.
 *   • Each record carries the question kind: 'identify' | 'diagnose'.
 *   • Idempotent on scanId; bounded to last 50 entries.
 *
 * Self-contained; never throws.
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

export const COMMUNITY_SCAN_REVIEW_VERSION = 'community-scan-review-v1' as const;
const STORAGE_KEY = 'farroway_community_scan_review_log';
const MAX_ENTRIES = 50;

export type ReviewKind = 'identify' | 'diagnose';
export type ReviewStatus = 'pending' | 'submitted' | 'resolved';

export interface CommunityScanReviewRecord {
  scanId: string;
  kind: ReviewKind;
  status: ReviewStatus;
  question: string;
  createdAt: number;
  resolvedAt: number | null;
}

export interface CommunityScanReviewHealthEnvelope {
  initialized: true;
  storageReady: boolean;
  pendingCount: number;
  submittedCount: number;
  resolvedCount: number;
  communityRuntimeAvailable: boolean;
  moderationRequired: true;
  noPublicWritesFromThisRuntime: true;
  composedFrom: ReadonlyArray<string>;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

function _readLog(): CommunityScanReviewRecord[] {
  return _safe(() => {
    const raw = _ls(STORAGE_KEY);
    if (!Array.isArray(raw)) return [];
    const out: CommunityScanReviewRecord[] = [];
    for (const r of raw) {
      if (!r || typeof r !== 'object') continue;
      if (typeof r.scanId !== 'string') continue;
      if (r.kind !== 'identify' && r.kind !== 'diagnose') continue;
      if (r.status !== 'pending' && r.status !== 'submitted' && r.status !== 'resolved') continue;
      if (typeof r.createdAt !== 'number') continue;
      out.push({
        scanId: r.scanId,
        kind: r.kind,
        status: r.status,
        question: typeof r.question === 'string' ? r.question : '',
        createdAt: r.createdAt,
        resolvedAt: typeof r.resolvedAt === 'number' ? r.resolvedAt : null,
      });
    }
    return out;
  }, []);
}

function _writeLog(list: CommunityScanReviewRecord[]): boolean {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const bounded = list.length > MAX_ENTRIES
      ? list.slice(list.length - MAX_ENTRIES) : list;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bounded));
    return true;
  }, false);
}

/** Record a pending community review for a scan. Idempotent on
 *  (scanId, kind). Returns true on persisted write. */
export function recordCommunityScanReview(
  scanId: string, kind: ReviewKind, question: string, nowMs: number,
): boolean {
  return _safe(() => {
    if (!scanId || typeof scanId !== 'string') return false;
    if (kind !== 'identify' && kind !== 'diagnose') return false;
    if (typeof nowMs !== 'number' || !isFinite(nowMs)) return false;
    const list = _readLog();
    const existing = list.findIndex(
      (r) => r.scanId === scanId && r.kind === kind,
    );
    const entry: CommunityScanReviewRecord = {
      scanId, kind, status: 'pending',
      question: typeof question === 'string' ? question : '',
      createdAt: nowMs,
      resolvedAt: null,
    };
    if (existing >= 0) list[existing] = entry;
    else list.push(entry);
    return _writeLog(list);
  }, false);
}

/** Mark a review as submitted to the community feed. The actual
 *  community publish happens via the existing community runtime
 *  (which carries admin moderation). This local update reflects the
 *  outbound state. */
export function markReviewSubmitted(scanId: string, kind: ReviewKind): boolean {
  return _safe(() => {
    const list = _readLog();
    const i = list.findIndex((r) => r.scanId === scanId && r.kind === kind);
    if (i < 0) return false;
    list[i] = { ...list[i], status: 'submitted' };
    return _writeLog(list);
  }, false);
}

/** Mark a review as resolved (e.g. community provided an answer the
 *  farmer accepted). */
export function markReviewResolved(
  scanId: string, kind: ReviewKind, nowMs: number,
): boolean {
  return _safe(() => {
    if (typeof nowMs !== 'number' || !isFinite(nowMs)) return false;
    const list = _readLog();
    const i = list.findIndex((r) => r.scanId === scanId && r.kind === kind);
    if (i < 0) return false;
    list[i] = { ...list[i], status: 'resolved', resolvedAt: nowMs };
    return _writeLog(list);
  }, false);
}

export function listPendingReviews(limit = 10)
  : ReadonlyArray<Readonly<CommunityScanReviewRecord>> {
  return _safe(() => {
    const list = _readLog().filter((r) => r.status === 'pending');
    list.sort((a, b) => b.createdAt - a.createdAt);
    return Object.freeze(list.slice(0, Math.max(1, Math.min(limit, 50)))
      .map((r) => Object.freeze(r))) as ReadonlyArray<Readonly<CommunityScanReviewRecord>>;
  }, Object.freeze([]) as ReadonlyArray<Readonly<CommunityScanReviewRecord>>);
}

export function communityReviewReady(): boolean {
  return _safe(() => typeof window !== 'undefined' && !!window.localStorage, false);
}

export function communityScanReviewHealth()
  : Readonly<CommunityScanReviewHealthEnvelope> {
  return _safe(() => {
    const log = _readLog();
    const pending = log.filter((r) => r.status === 'pending').length;
    const submitted = log.filter((r) => r.status === 'submitted').length;
    const resolved = log.filter((r) => r.status === 'resolved').length;
    const communityRuntime = _probe('__communityRuntimeHealth')
      || _probe('__communityFeedHealth')
      || _probe('__communityModerationHealth');
    const composed: string[] = ['localStorage:' + STORAGE_KEY];
    if (communityRuntime) composed.push('__communityRuntimeHealth');
    return Object.freeze<CommunityScanReviewHealthEnvelope>({
      initialized: true,
      storageReady: typeof window !== 'undefined' && !!window.localStorage,
      pendingCount: pending,
      submittedCount: submitted,
      resolvedCount: resolved,
      communityRuntimeAvailable: !!communityRuntime,
      moderationRequired: true as const,
      noPublicWritesFromThisRuntime: true as const,
      composedFrom: Object.freeze(composed) as ReadonlyArray<string>,
      confidence: (communityRuntime ? 'high' : 'medium') as Confidence,
      explanation:
        'Community scan review bridges low-confidence scans to the community feed. ' +
        'Local pending-review records are persisted here; the actual community publish ' +
        'flows through the existing community runtime which carries admin moderation. ' +
        'This module never writes directly to public surfaces.',
      limitations:
        'Submission to the public community feed requires admin moderation via the ' +
        'existing community runtime. ' + GUIDANCE_TAIL,
    });
  }, Object.freeze<CommunityScanReviewHealthEnvelope>({
    initialized: true, storageReady: false,
    pendingCount: 0, submittedCount: 0, resolvedCount: 0,
    communityRuntimeAvailable: false,
    moderationRequired: true as const,
    noPublicWritesFromThisRuntime: true as const,
    composedFrom: Object.freeze([]) as ReadonlyArray<string>,
    confidence: 'low' as Confidence,
    explanation: 'Community scan review runtime initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }));
}

export function installCommunityScanReviewGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__communityScanReviewHealth !== 'function') {
      w.__communityScanReviewHealth = function () {
        const out = communityScanReviewHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Community Scan Review]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
