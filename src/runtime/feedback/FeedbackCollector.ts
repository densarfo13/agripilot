/**
 * src/runtime/feedback/FeedbackCollector.ts — Farroway Feedback
 * Intelligence v1 single-writer collector.
 *
 *   import {
 *     collect, FEEDBACK_COLLECTOR_VERSION,
 *   } from 'src/runtime/feedback/FeedbackCollector';
 *
 *   collect({ feedbackType: 'scan_result', entityId: 's_123',
 *             userId: 'u_abc', helpful: true });
 *
 * What this is
 * ────────────
 *   The ONLY writer of the farroway.feedback localStorage key.
 *   UI calls collect() — collect() is a pure write. It does not
 *   call analytics, does not POST to any server. UI keeps a
 *   separate analytics fire path elsewhere.
 *
 *   Persistence rules:
 *     • Append-only, cap 500 rows (FIFO trim — oldest drop).
 *     • Dedupe by  feedbackType + entityId + userId.
 *       Same user can't accidentally double-tap.
 *     • userId is hashed (short non-crypto djb2) before storage.
 *     • Only the helpful flag, the type, the entityId, the
 *       hashed userId, and the timestamp are persisted.
 *
 * Strict-rule audit
 *   • Composition over storage. No new schemas, no server.
 *   • SSR-safe — every localStorage access is typeof-guarded.
 *   • Never throws — every public function has _safe fallback.
 *   • Frozen envelopes for the returned receipt.
 *   • No PII — raw userId never leaves this function.
 *   • Single-writer invariant — only this module writes the key.
 *   • Pure write — no analytics, no fetch, no side channels.
 */

import {
  FEEDBACK_STORAGE_KEY, FEEDBACK_MAX_ROWS, FEEDBACK_TYPES,
  type FeedbackInput, type FeedbackRow, type FeedbackType,
} from './feedbackContracts';

export const FEEDBACK_COLLECTOR_VERSION = 'farroway-feedback-collector-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

/**
 * Short non-crypto djb2 hash, base-36 encoded. Stable across
 * runs, fast, ~6–8 chars. Used so we can dedupe by user without
 * persisting the raw id. NOT for security.
 */
function _djb2(raw: string): string {
  return _safe(() => {
    const s = String(raw == null ? '' : raw);
    let h = 5381;
    for (let i = 0; i < s.length; i++) {
      // ((h << 5) + h) + c  →  h * 33 + c
      h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    }
    // Force unsigned, base-36 for compactness.
    return (h >>> 0).toString(36);
  }, '0');
}

function _readRows(): FeedbackRow[] {
  return _safe(() => {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(FEEDBACK_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Defensive filter — drop rows missing required fields or
    // with unknown types, so a corrupted key can't poison reads.
    const legal = new Set<string>(FEEDBACK_TYPES as ReadonlyArray<string>);
    return parsed.filter((r: any) =>
      r && typeof r === 'object'
      && legal.has(r.t)
      && typeof r.e === 'string'
      && typeof r.u === 'string'
      && typeof r.h === 'boolean'
      && typeof r.ts === 'number'
    ) as FeedbackRow[];
  }, []);
}

function _writeRows(rows: FeedbackRow[]): boolean {
  return _safe(() => {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(rows));
    return true;
  }, false);
}

function _isLegalType(t: unknown): t is FeedbackType {
  return typeof t === 'string'
      && (FEEDBACK_TYPES as ReadonlyArray<string>).indexOf(t) >= 0;
}

/** Frozen receipt envelope returned by collect(). */
export type CollectReceipt = Readonly<{
  ok:        boolean;
  stored:    boolean;
  deduped:   boolean;
  reason:    string | null;
  total:     number;
}>;

const _RECEIPT_FAIL: CollectReceipt = Object.freeze({
  ok: false, stored: false, deduped: false,
  reason: 'collect_failed', total: 0,
});

/**
 * Append a single feedback row. Pure write — no analytics, no
 * network. Returns a frozen receipt. Never throws.
 *
 * Rules:
 *   • Unknown feedbackType → rejected.
 *   • Missing entityId or userId → rejected.
 *   • Duplicate (same hashed user + same type + same entity) →
 *     deduped (already stored, ok: true, stored: false).
 *   • Over the 500-row cap → FIFO trim of the oldest rows.
 */
export function collect(input: FeedbackInput): CollectReceipt {
  return _safe(() => {
    if (!input || typeof input !== 'object') {
      return Object.freeze({
        ok: false, stored: false, deduped: false,
        reason: 'invalid_input', total: 0,
      }) as CollectReceipt;
    }

    const t = (input as any).feedbackType;
    const e = (input as any).entityId;
    const u = (input as any).userId;
    const h = (input as any).helpful;
    const tsIn = (input as any).timestamp;

    if (!_isLegalType(t)) {
      return Object.freeze({
        ok: false, stored: false, deduped: false,
        reason: 'unknown_feedback_type', total: _readRows().length,
      }) as CollectReceipt;
    }
    if (typeof e !== 'string' || !e.trim()) {
      return Object.freeze({
        ok: false, stored: false, deduped: false,
        reason: 'missing_entity_id', total: _readRows().length,
      }) as CollectReceipt;
    }
    if (typeof u !== 'string' || !u.trim()) {
      return Object.freeze({
        ok: false, stored: false, deduped: false,
        reason: 'missing_user_id', total: _readRows().length,
      }) as CollectReceipt;
    }
    if (typeof h !== 'boolean') {
      return Object.freeze({
        ok: false, stored: false, deduped: false,
        reason: 'missing_helpful', total: _readRows().length,
      }) as CollectReceipt;
    }

    // Hash raw userId immediately — raw id is never persisted,
    // never returned in the receipt, never logged.
    const hashedU = _djb2(u);
    const ts = (typeof tsIn === 'number' && isFinite(tsIn))
      ? tsIn
      : Date.now();

    const rows = _readRows();

    // Dedupe by (type, entity, hashedUser). First-write wins —
    // we do not overwrite the helpful flag on a re-tap, to honour
    // the "can't accidentally double-tap" contract.
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r.t === t && r.e === e && r.u === hashedU) {
        return Object.freeze({
          ok: true, stored: false, deduped: true,
          reason: null, total: rows.length,
        }) as CollectReceipt;
      }
    }

    const next: FeedbackRow = Object.freeze({
      t: t as FeedbackType,
      e: e,
      u: hashedU,
      h: h,
      ts: ts,
    });

    rows.push(next);

    // FIFO trim once over cap — drop oldest rows.
    while (rows.length > FEEDBACK_MAX_ROWS) {
      rows.shift();
    }

    const wrote = _writeRows(rows);
    if (!wrote) {
      return Object.freeze({
        ok: false, stored: false, deduped: false,
        reason: 'storage_unavailable', total: rows.length,
      }) as CollectReceipt;
    }

    return Object.freeze({
      ok: true, stored: true, deduped: false,
      reason: null, total: rows.length,
    }) as CollectReceipt;
  }, _RECEIPT_FAIL);
}

/**
 * Internal helper exported for the runtime/health envelope —
 * NOT for UI use. UI reads via FeedbackRuntime.list().
 */
export function _internalReadRows(): FeedbackRow[] {
  return _readRows();
}
