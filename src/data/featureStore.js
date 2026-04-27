/**
 * featureStore.js — pure aggregations over the event log.
 *
 *   buildFeatures(farmId)
 *     -> {
 *          farmId,
 *          tasksCompleted,
 *          tasksViewed,
 *          pestReports,
 *          droughtAlerts,
 *          inactivity,
 *          riskComputations,
 *          firstEventAt,    // ms epoch or null
 *          lastEventAt,     // ms epoch or null
 *          windowDays,      // last N days the bucket covers
 *        }
 *
 * The shape is intentionally flat - every row this function
 * produces is one row of the future training set. Adding new
 * features = one new field here + one new entry in
 * EVENT_TYPES.
 *
 * Strict-rule audit:
 *   * pure: no I/O beyond the eventLogger read
 *   * never throws (every helper is defensive)
 *   * lightweight: O(N) over the events list
 */

import { getEventsForFarm, EVENT_TYPES } from './eventLogger.js';

const MS_PER_DAY = 86_400_000;

function _within(ts, sinceMs) {
  if (sinceMs == null) return true;
  const t = Number(ts);
  return Number.isFinite(t) && t >= sinceMs;
}

function _count(events, type) {
  let n = 0;
  for (const e of events) if (e && e.type === type) n += 1;
  return n;
}

function _firstLast(events) {
  let first = Number.POSITIVE_INFINITY;
  let last  = Number.NEGATIVE_INFINITY;
  for (const e of events) {
    const t = Number(e && e.timestamp);
    if (!Number.isFinite(t)) continue;
    if (t < first) first = t;
    if (t > last)  last  = t;
  }
  return {
    firstEventAt: Number.isFinite(first) ? first : null,
    lastEventAt:  Number.isFinite(last)  ? last  : null,
  };
}

/**
 * buildFeatures(farmId, opts?)
 *
 *   opts.windowDays   limit aggregation to the last N days
 *                     (default: include everything).
 *   opts.now          Date.now() override for tests.
 */
export function buildFeatures(farmId, opts = {}) {
  const { windowDays = null, now = Date.now() } = opts || {};
  const sinceMs = (Number.isFinite(Number(windowDays)) && Number(windowDays) > 0)
    ? now - Number(windowDays) * MS_PER_DAY
    : null;

  let events = getEventsForFarm(farmId);
  if (sinceMs != null) events = events.filter((e) => _within(e && e.timestamp, sinceMs));

  const { firstEventAt, lastEventAt } = _firstLast(events);

  return Object.freeze({
    farmId:           farmId == null ? null : String(farmId),
    tasksCompleted:   _count(events, EVENT_TYPES.TASK_COMPLETED),
    tasksViewed:      _count(events, EVENT_TYPES.TASK_VIEWED),
    pestReports:      _count(events, EVENT_TYPES.PEST_REPORTED),
    droughtAlerts:    _count(events, EVENT_TYPES.DROUGHT_ALERT_SHOWN),
    inactivity:       _count(events, EVENT_TYPES.FARM_INACTIVE),
    riskComputations: _count(events, EVENT_TYPES.RISK_COMPUTED),
    firstEventAt,
    lastEventAt,
    windowDays:       windowDays || null,
    eventCount:       events.length,
  });
}

/**
 * buildFeaturesForFarms(farmIds, opts?)
 *   -> Array<feature row>
 *
 * Convenience for batch jobs / training-set assembly.
 */
export function buildFeaturesForFarms(farmIds, opts = {}) {
  if (!Array.isArray(farmIds) || farmIds.length === 0) return [];
  return farmIds
    .filter((id) => id != null)
    .map((id) => buildFeatures(id, opts));
}
