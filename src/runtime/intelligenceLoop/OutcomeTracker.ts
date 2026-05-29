/**
 * src/runtime/intelligenceLoop/OutcomeTracker.ts — Phase 5
 * (Track). Records grower-side outcomes tied to a recommendation.
 *
 *   import {
 *     recordOutcome, recordFeedback, listOutcomesFor,
 *     outcomeTrackerSnapshot, OUTCOME_TRACKER_VERSION,
 *   } from 'src/runtime/intelligenceLoop/OutcomeTracker';
 *
 * What this file owns
 * ───────────────────
 *   In-memory append-only tracker. Persistence belongs to the
 *   wave-5 single writer — callers wrap the emitted envelopes
 *   into the offline queue. This module never writes
 *   localStorage / IndexedDB directly.
 *
 * Strict-rule audit
 *   • Pure runtime. SSR-safe. Never throws.
 *   • Idempotent on (recommendationId + outcomeKind + userId).
 *   • No PII handled.
 */

import {
  LOOP_OUTCOME_KINDS, FEEDBACK_SIGNAL,
  feedbackIdempotencyKey,
} from './intelligenceLoopContracts';

export const OUTCOME_TRACKER_VERSION = 'loop-outcome-tracker-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _now = () => _safe(() => new Date().toISOString(), '');

const _validKinds = new Set<string>(LOOP_OUTCOME_KINDS as readonly string[]);

export interface OutcomeRecord {
  id:                string;
  recommendationId:  string;
  userId:            string;
  plantId?:          string;
  kind:              string;
  feedback?:         string;
  payload?:          Record<string, any>;
  timestamp:         string;
}

const _outcomes: OutcomeRecord[] = [];
const _seenKeys = new Set<string>();
const _byPlant: Record<string, string[]> = Object.create(null);

function _hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function _envelope(ok: boolean, record: OutcomeRecord | null,
                    reason = '') {
  return Object.freeze({
    runtimeVersion: OUTCOME_TRACKER_VERSION,
    ok, reason,
    record: record ? Object.freeze({ ...record }) : null,
  });
}

interface RecordCtx {
  recommendationId: string;
  userId:           string;
  kind:             string;
  plantId?:         string;
  payload?:         Record<string, any>;
}

export function recordOutcome(ctx: RecordCtx) {
  return _safe(() => {
    if (!_isObj(ctx)) return _envelope(false, null, 'invalid_context');
    const recommendationId = _str(ctx.recommendationId);
    const userId           = _str(ctx.userId);
    const kind             = _str(ctx.kind);
    if (!recommendationId) return _envelope(false, null, 'recommendationId_required');
    if (!userId)           return _envelope(false, null, 'userId_required');
    if (!_validKinds.has(kind)) return _envelope(false, null, 'invalid_kind');

    const key = recommendationId + '|' + kind + '|' + userId;
    if (_seenKeys.has(key)) {
      // idempotent — return the existing record.
      const existing = _outcomes.find((r) =>
        r.recommendationId === recommendationId
        && r.kind === kind && r.userId === userId);
      return _envelope(true, existing || null, 'duplicate');
    }
    const timestamp = _now();
    const id = 'outcome_' + _hash(key + '|' + timestamp);
    const record: OutcomeRecord = {
      id, recommendationId, userId, kind, timestamp,
      plantId: _str(ctx.plantId),
      payload: _isObj(ctx.payload)
        ? Object.freeze({ ...ctx.payload }) : undefined,
    };
    _outcomes.push(record);
    _seenKeys.add(key);
    if (record.plantId) {
      (_byPlant[record.plantId] = _byPlant[record.plantId] || [])
        .push(record.id);
    }
    return _envelope(true, record);
  }, _envelope(false, null, 'error'));
}

interface FeedbackCtx {
  recommendationId: string;
  userId:           string;
  signal:           string; // 'helpful' | 'not_helpful'
  plantId?:         string;
}

export function recordFeedback(ctx: FeedbackCtx) {
  return _safe(() => {
    if (!_isObj(ctx)) return _envelope(false, null, 'invalid_context');
    const signal = _str(ctx.signal);
    if (signal !== FEEDBACK_SIGNAL.HELPFUL
        && signal !== FEEDBACK_SIGNAL.NOT_HELPFUL) {
      return _envelope(false, null, 'invalid_signal');
    }
    // Reuse recordOutcome with kind=recommendation_accepted/rejected
    const kind = signal === FEEDBACK_SIGNAL.HELPFUL
      ? 'recommendation_accepted' : 'recommendation_shown';
    const inner = recordOutcome({
      recommendationId: ctx.recommendationId,
      userId:           ctx.userId,
      kind,
      plantId:          ctx.plantId,
      payload:          { feedback: signal },
    });
    const idempotencyKey = feedbackIdempotencyKey(
      _str(ctx.recommendationId), _str(ctx.userId));
    return Object.freeze({
      ...inner,
      idempotencyKey,
      signal,
    });
  }, _envelope(false, null, 'error'));
}

export function listOutcomesFor(plantId: string):
    ReadonlyArray<OutcomeRecord> {
  return _safe(() => {
    const ids = _byPlant[_str(plantId)] || [];
    const out = ids.map((id) =>
      _outcomes.find((r) => r.id === id))
      .filter(Boolean) as OutcomeRecord[];
    return Object.freeze(out.map((r) => Object.freeze({ ...r })));
  }, Object.freeze([] as OutcomeRecord[]));
}

export function outcomeTrackerSnapshot() {
  return _safe(() => {
    const counts: Record<string, number> = {};
    for (const k of LOOP_OUTCOME_KINDS) counts[k] = 0;
    for (const o of _outcomes) {
      counts[o.kind] = (counts[o.kind] || 0) + 1;
    }
    // Helpful-rate = helpful / (helpful + not_helpful) when ≥1
    // feedback exists; otherwise null (not enough data yet).
    let helpful = 0, notHelpful = 0;
    for (const o of _outcomes) {
      const fb = _str(o.payload && (o.payload as any).feedback);
      if      (fb === FEEDBACK_SIGNAL.HELPFUL)      helpful++;
      else if (fb === FEEDBACK_SIGNAL.NOT_HELPFUL)  notHelpful++;
    }
    const helpfulRate = (helpful + notHelpful) > 0
      ? Math.round(100 * helpful / (helpful + notHelpful))
      : null;
    return Object.freeze({
      runtimeVersion: OUTCOME_TRACKER_VERSION,
      total: _outcomes.length,
      counts: Object.freeze(counts),
      helpfulCount:    helpful,
      notHelpfulCount: notHelpful,
      helpfulRate,
    });
  }, Object.freeze({
    runtimeVersion: OUTCOME_TRACKER_VERSION,
    total: 0, counts: Object.freeze({}),
    helpfulCount: 0, notHelpfulCount: 0, helpfulRate: null,
  }));
}

/** Test-only — wipe the tracker. */
export function _resetOutcomeTracker() {
  _outcomes.length = 0;
  _seenKeys.clear();
  for (const k of Object.keys(_byPlant)) delete _byPlant[k];
}
