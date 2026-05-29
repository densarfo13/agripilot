/**
 * src/runtime/outcomes/RecommendationOutcomeTracker.ts —
 * Tracks lifecycle of a single recommendation.
 */

import {
  OUTCOME_RUNTIME_VERSION, OUTCOME_EVENTS,
} from './outcomeContracts';

export const RECOMMENDATION_OUTCOME_VERSION =
  'recommendation-outcome-tracker-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _now = () => _safe(() => new Date().toISOString(), '');

export interface OutcomeRecord {
  id:                string;
  userId:            string;
  plantId?:          string;
  farmId?:           string;
  programId?:        string;
  interventionId?:   string;
  recommendationId?: string;
  eventType:         string;
  beforeState?:      Record<string, any>;
  afterState?:       Record<string, any>;
  outcomeSignal?:    string;
  confidence?:       string;
  createdAt:         string;
}

const _records: OutcomeRecord[] = [];
const _seen = new Set<string>();

function _hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

const _validEvents = new Set<string>(OUTCOME_EVENTS as readonly string[]);

export function recordRecommendationOutcome(ctx: Partial<OutcomeRecord>) {
  return _safe(() => {
    if (!_isObj(ctx)) return _envelope(false, null, 'invalid_context');
    const userId    = _str(ctx.userId);
    const eventType = _str(ctx.eventType);
    if (!userId)               return _envelope(false, null, 'userId_required');
    if (!_validEvents.has(eventType)) {
      return _envelope(false, null, 'invalid_event');
    }
    const dedup = eventType + '|' + userId + '|'
      + _str(ctx.recommendationId) + '|' + _str(ctx.plantId);
    if (_seen.has(dedup)) {
      const existing = _records.find((r) =>
        r.eventType === eventType
        && r.userId === userId
        && _str(r.recommendationId) === _str(ctx.recommendationId)
        && _str(r.plantId) === _str(ctx.plantId));
      return _envelope(true, existing || null, 'duplicate');
    }
    const createdAt = _now();
    const id = 'outcome_' + _hash(dedup + '|' + createdAt);
    const rec: OutcomeRecord = Object.freeze({
      id, userId, eventType, createdAt,
      plantId:          _str(ctx.plantId),
      farmId:           _str(ctx.farmId),
      programId:        _str(ctx.programId),
      interventionId:   _str(ctx.interventionId),
      recommendationId: _str(ctx.recommendationId),
      beforeState:      ctx.beforeState
        ? Object.freeze({ ...(ctx.beforeState as any) }) : undefined,
      afterState:       ctx.afterState
        ? Object.freeze({ ...(ctx.afterState as any) }) : undefined,
      outcomeSignal:    _str(ctx.outcomeSignal),
      confidence:       _str(ctx.confidence),
    });
    _records.push(rec);
    _seen.add(dedup);
    return _envelope(true, rec);
  }, _envelope(false, null, 'error'));
}

function _envelope(ok: boolean, record: OutcomeRecord | null, reason = '') {
  return Object.freeze({
    runtimeVersion: RECOMMENDATION_OUTCOME_VERSION,
    ok, reason,
    record: record ? Object.freeze({ ...record }) : null,
  });
}

export function listRecommendationOutcomes(opts?: { plantId?: string;
                                                      limit?: number }):
    ReadonlyArray<OutcomeRecord> {
  return _safe(() => {
    const o = _isObj(opts) ? opts as any : {};
    const limit = typeof o.limit === 'number' ? o.limit : 200;
    const plantId = _str(o.plantId);
    let pool = _records;
    if (plantId) pool = pool.filter((r) => _str(r.plantId) === plantId);
    return Object.freeze(pool.slice(-limit).map((r) =>
      Object.freeze({ ...r })));
  }, Object.freeze([] as OutcomeRecord[]));
}

export function recommendationOutcomeSummary() {
  return _safe(() => {
    const counts: Record<string, number> = {};
    for (const e of OUTCOME_EVENTS) counts[e] = 0;
    for (const r of _records) {
      counts[r.eventType] = (counts[r.eventType] || 0) + 1;
    }
    return Object.freeze({
      runtimeVersion: RECOMMENDATION_OUTCOME_VERSION,
      total: _records.length,
      counts: Object.freeze(counts),
    });
  }, Object.freeze({
    runtimeVersion: RECOMMENDATION_OUTCOME_VERSION,
    total: 0, counts: Object.freeze({}),
  }));
}

export function _resetRecommendationOutcomes() {
  _records.length = 0;
  _seen.clear();
}

export { OUTCOME_RUNTIME_VERSION };
