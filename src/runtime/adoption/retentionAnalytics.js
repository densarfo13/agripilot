/**
 * runtime/adoption/retentionAnalytics.js — Phase 13 D1/D7/D30 tracker.
 *
 *   import { computeRetentionAnalytics, RETENTION_DAYS }
 *     from 'src/runtime/adoption/retentionAnalytics.js';
 *
 * What this is
 * ────────────
 *   Local-only retention analytics from the wave-5 event log +
 *   caller-supplied session log. Computes:
 *
 *     • firstSessionAt
 *     • d1, d7, d30 — booleans indicating "user was active on or
 *                     after this offset from anchor"
 *     • mostUsedFeatures — top 5 event kinds by count
 *     • dropOffPoints — sessions with very few actions
 *     • dailyActiveDays / weeklyActiveWeeks (lifetime counts)
 *
 *   This does NOT replace product analytics — it's a local
 *   diagnostic the farmer + QA can introspect.
 *
 *   Returns a frozen envelope:
 *     {
 *       firstSessionAt, lastSessionAt,
 *       d1, d7, d30,
 *       dailyActiveDays, weeklyActiveWeeks,
 *       mostUsedFeatures, dropOffPoints,
 *       runtimeVersion,
 *     }
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • No PII fields handled — only timestamps + event kinds.
 *   • No network calls. No persistence writes.
 */

export const RETENTION_ANALYTICS_VERSION = 'retention-analytics-v1';

export const RETENTION_DAYS = Object.freeze({
  D1:  1,
  D7:  7,
  D30: 30,
});

const _isObj = (v) => v != null && typeof v === 'object';
const _arr   = (v) => (Array.isArray(v) ? v : []);
const _str   = (v) => (typeof v === 'string' ? v : '');
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

const MS_PER_DAY  = 86400000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

const FEATURE_DROPOFF_MIN_ACTIONS = 2;

function _timestamps(arr, keys) {
  const out = [];
  for (const e of _arr(arr)) {
    if (!_isObj(e)) continue;
    for (const k of keys) {
      const t = _safe(() => new Date(_str(e[k])).getTime(), NaN);
      if (Number.isFinite(t)) { out.push(t); break; }
    }
  }
  out.sort((a, b) => a - b);
  return out;
}

function _dayBucket(ts) {
  return Math.floor(ts / MS_PER_DAY);
}

function _weekBucket(ts) {
  return Math.floor(ts / MS_PER_WEEK);
}

export function computeRetentionAnalytics(ctx) {
  return _safe(() => {
    const c        = _isObj(ctx) ? ctx : {};
    const now      = _num(c.now) || Date.now();
    const events   = _arr(c.events);
    const sessions = _arr(c.sessionLog);

    // All "active" timestamps come from either explicit sessions
    // OR the wave-5 event log (each event implies the user was
    // present).
    const eventTs   = _timestamps(events,   ['at', 'timestamp', 'createdAt']);
    const sessionTs = _timestamps(sessions, ['startedAt', 'at', 'createdAt']);
    const allTs     = eventTs.concat(sessionTs).sort((a, b) => a - b);
    if (allTs.length === 0) {
      return Object.freeze({
        runtimeVersion: RETENTION_ANALYTICS_VERSION,
        firstSessionAt: '',
        lastSessionAt:  '',
        d1: false, d7: false, d30: false,
        dailyActiveDays:    0,
        weeklyActiveWeeks:  0,
        mostUsedFeatures:   Object.freeze([]),
        dropOffPoints:      Object.freeze([]),
      });
    }

    const first = allTs[0];
    const last  = allTs[allTs.length - 1];

    // Active-after-N — user has at least one timestamp ≥ anchor+N*day
    const _activeAfter = (n) => {
      const cutoff = first + n * MS_PER_DAY;
      return allTs.some((t) => t >= cutoff && t <= now);
    };
    const d1  = _activeAfter(RETENTION_DAYS.D1);
    const d7  = _activeAfter(RETENTION_DAYS.D7);
    const d30 = _activeAfter(RETENTION_DAYS.D30);

    // Lifetime active days/weeks
    const dayBuckets  = new Set();
    const weekBuckets = new Set();
    for (const t of allTs) {
      dayBuckets.add(_dayBucket(t));
      weekBuckets.add(_weekBucket(t));
    }

    // Most-used features — top 5 event kinds
    const featureCounts = {};
    for (const e of events) {
      if (!_isObj(e)) continue;
      const k = _str(e.kind);
      if (!k) continue;
      featureCounts[k] = (featureCounts[k] || 0) + 1;
    }
    const mostUsedFeatures = Object.keys(featureCounts)
      .map((k) => ({ kind: k, count: featureCounts[k] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((e) => Object.freeze(e));

    // Drop-off points — sessions where actionCount < threshold
    const dropOffPoints = [];
    for (const s of sessions) {
      if (!_isObj(s)) continue;
      const actionCount = _num(s.actionCount);
      if (actionCount == null) continue;
      if (actionCount < FEATURE_DROPOFF_MIN_ACTIONS) {
        dropOffPoints.push(Object.freeze({
          sessionId:   _str(s.id) || _str(s.sessionId) || '',
          startedAt:   _str(s.startedAt) || '',
          actionCount,
          lastRoute:   _str(s.lastRoute) || '',
        }));
      }
    }

    return Object.freeze({
      runtimeVersion: RETENTION_ANALYTICS_VERSION,
      firstSessionAt: _safe(() => new Date(first).toISOString(), ''),
      lastSessionAt:  _safe(() => new Date(last).toISOString(), ''),
      d1, d7, d30,
      dailyActiveDays:    dayBuckets.size,
      weeklyActiveWeeks:  weekBuckets.size,
      mostUsedFeatures:   Object.freeze(mostUsedFeatures),
      dropOffPoints:      Object.freeze(dropOffPoints),
    });
  }, Object.freeze({
    runtimeVersion: RETENTION_ANALYTICS_VERSION,
    firstSessionAt: '', lastSessionAt: '',
    d1: false, d7: false, d30: false,
    dailyActiveDays: 0, weeklyActiveWeeks: 0,
    mostUsedFeatures: Object.freeze([]),
    dropOffPoints: Object.freeze([]),
  }));
}
