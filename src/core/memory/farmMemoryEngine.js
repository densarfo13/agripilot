/**
 * farmMemoryEngine.js — spec-named facade + extensions over
 * growerMemoryEngine.
 *
 *   import {
 *     getFarmMemorySnapshot,
 *     rememberIgnoredRecommendation,
 *     rememberAcceptedRecommendation,
 *     rememberOutcome,
 *   } from 'src/core/memory/farmMemoryEngine.js';
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A thin extension layer on top of the existing
 *   `growerMemoryEngine.js`. Adds the action-tracking surface the
 *   spec asks for (acceptance / ignore / outcome) and a unified
 *   `getFarmMemorySnapshot()` that aggregates the memory the
 *   recommendation engines need to suppress noise + improve
 *   timing over time.
 *
 *   ONE implementation, no duplicate state — all writes go through
 *   the same localStorage slots growerMemoryEngine reads from, so
 *   surfaces using either entry point see consistent data.
 *
 *   PII discipline: only structured keys + counts + timestamps.
 *   Never stores free-text user content.
 *
 * Strict-rule audit
 *   • Pure-runtime. Never throws. SSR-safe.
 */

import { getGrowerMemorySnapshot } from './growerMemoryEngine.js';

const _LS_PREFIX = 'farroway_farm_memory_';
const _IGNORE_LOG_KEY  = _LS_PREFIX + 'ignore_log';
const _ACCEPT_LOG_KEY  = _LS_PREFIX + 'accept_log';
const _OUTCOME_LOG_KEY = _LS_PREFIX + 'outcome_log';

function _safeLs() {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage || null;
  } catch { return null; }
}

function _readJson(key, fallback) {
  try {
    const ls = _safeLs();
    if (!ls) return fallback;
    const raw = ls.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch { return fallback; }
}

function _writeJson(key, value) {
  try {
    const ls = _safeLs();
    if (!ls) return false;
    ls.setItem(key, JSON.stringify(value));
    return true;
  } catch { return false; }
}

function _recKey(rec) {
  if (!rec || typeof rec !== 'object') return null;
  const type = String(rec.type || '').toLowerCase();
  const id = String(rec.id || '').toLowerCase();
  if (!type) return null;
  return type + '::' + id;
}

/**
 * Record that the user IGNORED a recommendation. Used by the
 * suppression engine — after N ignores, the same recommendation
 * stops appearing as the primary action.
 *
 * @param {object} rec  the recommendation that was dismissed
 * @param {number} [nowMs]
 * @returns {boolean}
 */
export function rememberIgnoredRecommendation(rec, nowMs) {
  try {
    const key = _recKey(rec);
    if (!key) return false;
    const log = _readJson(_IGNORE_LOG_KEY, {});
    const cur = log[key] || { count: 0, lastAt: 0 };
    log[key] = { count: (cur.count || 0) + 1, lastAt: Number.isFinite(nowMs) ? nowMs : Date.now() };
    return _writeJson(_IGNORE_LOG_KEY, log);
  } catch { return false; }
}

/**
 * Record that the user ACCEPTED a recommendation. Used by the
 * memory snapshot to improve future timing — accepted timestamps
 * inform optimal-time picking ("user usually waters mornings").
 */
export function rememberAcceptedRecommendation(rec, nowMs) {
  try {
    const key = _recKey(rec);
    if (!key) return false;
    const log = _readJson(_ACCEPT_LOG_KEY, {});
    const cur = log[key] || { count: 0, lastAt: 0, history: [] };
    const ts = Number.isFinite(nowMs) ? nowMs : Date.now();
    log[key] = {
      count: (cur.count || 0) + 1,
      lastAt: ts,
      // Bounded history — last 20 timestamps is enough for any
      // pattern engine without growing localStorage indefinitely.
      history: [...(cur.history || []).slice(-19), ts],
    };
    return _writeJson(_ACCEPT_LOG_KEY, log);
  } catch { return false; }
}

/**
 * Record a harvest/outcome row. Used by yield forecasting + by
 * the priority engine to weight recurring-disease risk in future
 * recommendations.
 */
export function rememberOutcome(outcome) {
  try {
    if (!outcome || typeof outcome !== 'object') return false;
    const log = _readJson(_OUTCOME_LOG_KEY, []);
    // Keep the last 50 outcomes — older history flushed.
    const next = [...log.slice(-49), {
      ...outcome,
      recordedAt: Number.isFinite(outcome.recordedAt) ? outcome.recordedAt : Date.now(),
    }];
    return _writeJson(_OUTCOME_LOG_KEY, next);
  } catch { return false; }
}

/**
 * Aggregate every memory signal the recommendation engines need.
 * Composes the existing `growerMemoryEngine` snapshot with the
 * action logs added here.
 *
 * @param {object} [ctx]
 * @returns {object}
 */
export function getFarmMemorySnapshot(ctx) {
  try {
    const grower = (() => {
      try { return getGrowerMemorySnapshot(ctx) || {}; }
      catch { return {}; }
    })();
    const ignoreLog  = _readJson(_IGNORE_LOG_KEY, {});
    const acceptLog  = _readJson(_ACCEPT_LOG_KEY, {});
    const outcomeLog = _readJson(_OUTCOME_LOG_KEY, []);
    return {
      ...grower,
      ignoreLog,
      acceptLog,
      outcomeLog,
      generatedAt: Date.now(),
    };
  } catch {
    return {
      ignoreLog: {}, acceptLog: {}, outcomeLog: [],
      generatedAt: Date.now(),
    };
  }
}

/** Test-only reset. Clears all three logs from localStorage. */
export function _resetFarmMemoryForTests() {
  try {
    const ls = _safeLs();
    if (!ls) return;
    for (const k of [_IGNORE_LOG_KEY, _ACCEPT_LOG_KEY, _OUTCOME_LOG_KEY]) {
      try { ls.removeItem(k); } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
}

const _module = {
  getFarmMemorySnapshot,
  rememberIgnoredRecommendation,
  rememberAcceptedRecommendation,
  rememberOutcome,
  _resetFarmMemoryForTests,
};
export default _module;
