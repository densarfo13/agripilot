/**
 * src/runtime/review/ReviewQueue.ts — In-memory, append-only
 * Human Review queue.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Validates enums at write time.
 *   • Idempotent on (type, userId, plantId|scanId|artifactId).
 *   • Frozen envelopes everywhere.
 *   • No PII persisted — only ids and reason strings.
 *   • No localStorage / IndexedDB writes.
 */

import {
  HUMAN_REVIEW_VERSION,
  REVIEW_TYPES,
  REVIEW_STATUSES,
  type ReviewType,
  type ReviewStatus,
} from './reviewContracts';

export const REVIEW_QUEUE_VERSION = HUMAN_REVIEW_VERSION;

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const _str = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _now = () => _safe(() => new Date().toISOString(), '');

const _validTypes    = new Set<string>(REVIEW_TYPES as readonly string[]);
const _validStatuses = new Set<string>(REVIEW_STATUSES as readonly string[]);

export interface ReviewItem {
  id:               string;
  type:             ReviewType;
  status:           ReviewStatus;
  userId:           string;
  organizationId?:  string;
  plantId?:         string;
  scanId?:          string;
  artifactId?:      string;
  reason?:          string;
  createdAt:        string;
  updatedAt:        string;
}

const _items: ReviewItem[] = [];
const _byDedupKey = new Map<string, string>(); // dedupKey -> id
const _byId = new Map<string, number>();       // id -> index

function _hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function _dedupKey(
  type: string, userId: string,
  plantId: string, scanId: string, artifactId: string,
): string {
  const subject = plantId || scanId || artifactId || '_';
  return type + '|' + userId + '|' + subject;
}

interface SubmitCtx {
  type:             ReviewType | string;
  userId:           string;
  organizationId?:  string;
  plantId?:         string;
  scanId?:          string;
  artifactId?:      string;
  reason?:          string;
}

/**
 * Append a review item to the queue. Idempotent on
 * (type, userId, plantId|scanId|artifactId).
 */
export function submitForReview(ctx: SubmitCtx) {
  return _safe(() => {
    if (!_isObj(ctx)) {
      return Object.freeze({
        runtimeVersion: REVIEW_QUEUE_VERSION,
        ok: false, reason: 'invalid_context', item: null,
      });
    }
    const type   = _str(ctx.type);
    const userId = _str(ctx.userId);
    if (!_validTypes.has(type)) {
      return Object.freeze({
        runtimeVersion: REVIEW_QUEUE_VERSION,
        ok: false, reason: 'invalid_type', item: null,
      });
    }
    if (!userId) {
      return Object.freeze({
        runtimeVersion: REVIEW_QUEUE_VERSION,
        ok: false, reason: 'missing_user', item: null,
      });
    }
    const plantId    = _str(ctx.plantId);
    const scanId     = _str(ctx.scanId);
    const artifactId = _str(ctx.artifactId);
    const orgId      = _str(ctx.organizationId);
    const reason     = _str(ctx.reason);

    const key = _dedupKey(type, userId, plantId, scanId, artifactId);
    const existingId = _byDedupKey.get(key);
    if (existingId) {
      const idx = _byId.get(existingId);
      const existing = typeof idx === 'number' ? _items[idx] : null;
      return Object.freeze({
        runtimeVersion: REVIEW_QUEUE_VERSION,
        ok: true, reason: 'duplicate', item: existing,
      });
    }

    const createdAt = _now();
    const id = 'review_' + _hash(key + '|' + createdAt);
    const item: ReviewItem = Object.freeze({
      id,
      type: type as ReviewType,
      status: 'pending' as ReviewStatus,
      userId,
      organizationId: orgId,
      plantId,
      scanId,
      artifactId,
      reason,
      createdAt,
      updatedAt: createdAt,
    });
    const idx = _items.length;
    _items.push(item);
    _byDedupKey.set(key, id);
    _byId.set(id, idx);

    return Object.freeze({
      runtimeVersion: REVIEW_QUEUE_VERSION,
      ok: true, reason: '', item,
    });
  }, Object.freeze({
    runtimeVersion: REVIEW_QUEUE_VERSION,
    ok: false, reason: 'error', item: null,
  }));
}

interface UpdateCtx {
  id:      string;
  status:  ReviewStatus | string;
  reason?: string;
}

/**
 * Update a review item's status. Admin-only — the calling page
 * enforces the role gate.
 */
export function updateReviewStatus(ctx: UpdateCtx) {
  return _safe(() => {
    if (!_isObj(ctx)) {
      return Object.freeze({
        runtimeVersion: REVIEW_QUEUE_VERSION,
        ok: false, reason: 'invalid_context', item: null,
      });
    }
    const id     = _str(ctx.id);
    const status = _str(ctx.status);
    if (!id) {
      return Object.freeze({
        runtimeVersion: REVIEW_QUEUE_VERSION,
        ok: false, reason: 'missing_id', item: null,
      });
    }
    if (!_validStatuses.has(status)) {
      return Object.freeze({
        runtimeVersion: REVIEW_QUEUE_VERSION,
        ok: false, reason: 'invalid_status', item: null,
      });
    }
    const idx = _byId.get(id);
    if (typeof idx !== 'number') {
      return Object.freeze({
        runtimeVersion: REVIEW_QUEUE_VERSION,
        ok: false, reason: 'not_found', item: null,
      });
    }
    const prev = _items[idx];
    const reasonStr = _str(ctx.reason);
    const next: ReviewItem = Object.freeze({
      ...prev,
      status:    status as ReviewStatus,
      reason:    reasonStr || prev.reason,
      updatedAt: _now(),
    });
    _items[idx] = next;
    return Object.freeze({
      runtimeVersion: REVIEW_QUEUE_VERSION,
      ok: true, reason: '', item: next,
    });
  }, Object.freeze({
    runtimeVersion: REVIEW_QUEUE_VERSION,
    ok: false, reason: 'error', item: null,
  }));
}

interface ListCtx {
  status?:          ReviewStatus | string;
  type?:            ReviewType | string;
  organizationId?:  string;
  limit?:           number;
}

/** Scoped read. */
export function listReviews(ctx?: ListCtx): ReadonlyArray<ReviewItem> {
  return _safe(() => {
    const c = _isObj(ctx) ? ctx! : {} as ListCtx;
    const limit  = typeof c.limit === 'number' ? c.limit : 200;
    const status = _str(c.status);
    const type   = _str(c.type);
    const orgId  = _str(c.organizationId);

    let filtered: ReviewItem[] = _arr<ReviewItem>(_items);
    if (status) filtered = filtered.filter((i) => _str(i.status) === status);
    if (type)   filtered = filtered.filter((i) => _str(i.type) === type);
    if (orgId)  filtered = filtered.filter((i) => _str(i.organizationId) === orgId);

    return Object.freeze(
      filtered.slice(-limit).map((i) => Object.freeze({ ...i })),
    );
  }, Object.freeze([] as ReviewItem[]));
}

/** Counts per status + per type. */
export function reviewQueueSnapshot() {
  return _safe(() => {
    const byStatus: Record<string, number> = {};
    const byType:   Record<string, number> = {};
    for (const s of REVIEW_STATUSES) byStatus[s] = 0;
    for (const t of REVIEW_TYPES)    byType[t]   = 0;
    for (const item of _items) {
      const s = _str(item.status);
      const t = _str(item.type);
      if (s in byStatus) byStatus[s] += 1;
      if (t in byType)   byType[t]   += 1;
    }
    return Object.freeze({
      runtimeVersion: REVIEW_QUEUE_VERSION,
      total:    _items.length,
      byStatus: Object.freeze(byStatus),
      byType:   Object.freeze(byType),
    });
  }, Object.freeze({
    runtimeVersion: REVIEW_QUEUE_VERSION,
    total: 0,
    byStatus: Object.freeze({}),
    byType:   Object.freeze({}),
  }));
}

/** Test-only — wipe queue state. */
export function _resetReviewQueue() {
  _items.length = 0;
  _byDedupKey.clear();
  _byId.clear();
}
