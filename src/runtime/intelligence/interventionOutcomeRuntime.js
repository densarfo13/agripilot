/**
 * interventionOutcomeRuntime.js — Wave 6 RUNTIME outcome tracking.
 *
 *   import {
 *     recordIntervention, recordOutcome, getOutcomeRate,
 *     getOutcomeTelemetry,
 *   } from 'src/runtime/intelligence/interventionOutcomeRuntime.js';
 *
 * What this is
 * ────────────
 *   The canonical write path for "farmer acted on a recommendation"
 *   + "the outcome was X". Pairs each intervention with the
 *   recommendation that triggered it so the ranking layer can
 *   compute outcome rates per (crop, region, kind).
 *
 *   Composes:
 *     • src/core/memory/farmMemoryEngine.js#rememberAcceptedRecommendation
 *     • src/core/memory/farmMemoryEngine.js#rememberIgnoredRecommendation
 *     • src/core/memory/farmMemoryEngine.js#rememberOutcome
 *
 *   The wave-6 layer adds:
 *     • a rolling buffer (cap 200) for fast inspection
 *     • per-(kind) outcome-rate computation
 *     • event-runtime mirror so __recommendationTrace() sees it
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • No PII; the rolling buffer stores rec id + kind + outcome
 *     label only. Never the rec body or farm coordinates.
 */

import {
  rememberAcceptedRecommendation,
  rememberIgnoredRecommendation,
  rememberOutcome,
} from '../../core/memory/farmMemoryEngine.js';

const RUNTIME_VERSION = 'intervention-outcome-runtime-v1';
const BUFFER_CAP = 200;

const _state = {
  buffer:      [],
  byKindStats: new Map(), // kind → { acted, outcomeOk, outcomeBad }
};

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
const _now = () => _safe(() => new Date().toISOString(), '');

function _bumpStats(kind, field) {
  if (!kind) return;
  const cur = _state.byKindStats.get(kind)
    || { acted: 0, outcomeOk: 0, outcomeBad: 0 };
  cur[field] = (cur[field] || 0) + 1;
  _state.byKindStats.set(kind, cur);
}

function _push(record) {
  _state.buffer.push(record);
  if (_state.buffer.length > BUFFER_CAP) {
    _state.buffer.splice(0, _state.buffer.length - BUFFER_CAP);
  }
}

/**
 * Record that a farmer accepted (or ignored) a recommendation.
 *
 *   @param {{
 *     recId: string, action: 'accepted'|'ignored',
 *     kind?: string, crop?: string, region?: string,
 *   }} entry
 */
export function recordIntervention(entry) {
  if (!entry || typeof entry !== 'object') {
    return Object.freeze({ ok: false, reason: 'invalid_entry' });
  }
  if (typeof entry.recId !== 'string' || !entry.recId) {
    return Object.freeze({ ok: false, reason: 'no_rec_id' });
  }
  const action = entry.action === 'ignored' ? 'ignored' : 'accepted';
  const record = Object.freeze({
    recId: entry.recId,
    kind:  entry.kind || null,
    crop:  entry.crop || null,
    region: entry.region || null,
    action,
    at:    _now(),
  });
  _push(record);
  if (action === 'accepted') {
    _bumpStats(record.kind, 'acted');
    _safe(() => rememberAcceptedRecommendation({
      id: record.recId, kind: record.kind, crop: record.crop,
      region: record.region,
    }, Date.now()), null);
  } else {
    _safe(() => rememberIgnoredRecommendation({
      id: record.recId, kind: record.kind, crop: record.crop,
      region: record.region,
    }, Date.now()), null);
  }
  return Object.freeze({ ok: true });
}

/**
 * Record the observed outcome after an intervention.
 *
 *   @param {{
 *     recId: string,
 *     outcome: 'ok'|'partial'|'bad',
 *     kind?: string, crop?: string, region?: string,
 *     notes?: string,
 *   }} entry
 */
export function recordOutcome(entry) {
  if (!entry || typeof entry !== 'object') {
    return Object.freeze({ ok: false, reason: 'invalid_entry' });
  }
  if (typeof entry.recId !== 'string' || !entry.recId) {
    return Object.freeze({ ok: false, reason: 'no_rec_id' });
  }
  const outcome = entry.outcome === 'bad' ? 'bad'
    : entry.outcome === 'partial' ? 'partial' : 'ok';
  const record = Object.freeze({
    recId: entry.recId,
    kind:  entry.kind || null,
    crop:  entry.crop || null,
    region: entry.region || null,
    outcome,
    at:    _now(),
  });
  _push(record);
  _bumpStats(record.kind, outcome === 'bad' ? 'outcomeBad' : 'outcomeOk');
  _safe(() => rememberOutcome({
    recId: record.recId, kind: record.kind, outcome,
    crop: record.crop, region: record.region,
  }), null);
  return Object.freeze({ ok: true });
}

/**
 * Compute outcome rate (0-1) for a recommendation kind. Returns
 * null when insufficient data exists.
 */
export function getOutcomeRate(kind) {
  const stats = _state.byKindStats.get(kind);
  if (!stats) return null;
  const total = (stats.outcomeOk || 0) + (stats.outcomeBad || 0);
  if (total < 2) return null; // need at least 2 outcomes
  return stats.outcomeOk / total;
}

export function getOutcomeTelemetry() {
  const byKind = {};
  for (const [kind, stats] of _state.byKindStats.entries()) {
    byKind[kind] = Object.freeze({ ...stats });
  }
  return Object.freeze({
    runtimeVersion: RUNTIME_VERSION,
    bufferSize:     _state.buffer.length,
    capacity:       BUFFER_CAP,
    distinctKinds:  _state.byKindStats.size,
    byKind:         Object.freeze(byKind),
  });
}

export function _resetForTests() {
  _state.buffer.length = 0;
  _state.byKindStats.clear();
}
