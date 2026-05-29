/**
 * runtime/flywheel/regionalLearning.js — Phase 14 anonymous
 * regional aggregator.
 *
 *   import {
 *     anonymizeRegionalInsight, REGIONAL_LEARNING_VERSION,
 *   } from 'src/runtime/flywheel/regionalLearning.js';
 *
 *   const insight = anonymizeRegionalInsight({
 *     events, region, crop, season, weather, outcomes,
 *   });
 *
 * What this is
 * ────────────
 *   Builds one anonymous "what happened to crops like mine in
 *   regions like mine this season" record per call. The output
 *   carries NO farmer-identifying fields — caller can safely hand
 *   the record to the (future) network sync layer.
 *
 *   Cross-farm aggregation is named-deferred (requires backend).
 *
 *   Returns a frozen envelope:
 *     {
 *       insight: { region, crop, season, weatherSummary, outcomes },
 *       sampleSize, scopeNote, runtimeVersion,
 *     }
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • No PII fields ever leave the device.
 *   • Region label trimmed of digits/postal codes.
 *   • Confidence buckets, day-bucketed timestamps — same shape
 *     as the Phase 12 anonymizer.
 */

import { EVENT_KIND } from './eventEngine.js';

export const REGIONAL_LEARNING_VERSION = 'regional-learning-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _arr   = (v) => (Array.isArray(v) ? v : []);
const _str   = (v) => (typeof v === 'string' ? v : '');
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _trimRegion(s) {
  return _str(s).replace(/\d+/g, '').replace(/\s{2,}/g, ' ').trim();
}

function _confidenceBucket(c) {
  const n = _num(c);
  if (n == null) return 'unknown';
  if (n >= 0.8) return 'high';
  if (n >= 0.5) return 'medium';
  return 'low';
}

function _season(now) {
  // Northern + Southern hemisphere agnostic: use 4 calendar buckets
  // (callers in tropics can override with seasonLabel).
  const d = new Date(now);
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return 'unknown';
  const m = d.getUTCMonth();
  if (m <= 1 || m === 11) return 'winter';
  if (m <= 4) return 'spring';
  if (m <= 7) return 'summer';
  return 'autumn';
}

function _summarizeWeather(weather) {
  if (!_isObj(weather)) return null;
  return Object.freeze({
    summary:        _str(weather.summary),
    avgTempC:       _num(weather.avgTempC),
    totalRainfallMm: _num(weather.totalRainfallMm),
    eventCount:     _num(weather.eventCount) || 0,
  });
}

function _summarizeOutcomes(outcomes) {
  const list = _arr(outcomes);
  const totals = { improved: 0, neutral: 0, worsened: 0, unknown: 0 };
  for (const o of list) {
    if (!_isObj(o)) continue;
    const v = _str(o.verdict);
    if (totals[v] != null) totals[v]++;
  }
  return Object.freeze(totals);
}

function _eventCounts(events) {
  const c = {};
  for (const e of _arr(events)) {
    if (!_isObj(e)) continue;
    const k = _str(e.eventType);
    if (!k) continue;
    c[k] = (c[k] || 0) + 1;
  }
  return Object.freeze(c);
}

export function anonymizeRegionalInsight(ctx) {
  return _safe(() => {
    const c       = _isObj(ctx) ? ctx : {};
    const region  = _trimRegion(c.region || c.regionLabel);
    const crop    = _str(c.crop || c.cropName);
    const season  = _str(c.season || c.seasonLabel) || _season(c.now || Date.now());
    const events  = _arr(c.events);
    const sampleSize = _num(c.sampleSize) || events.length;

    return Object.freeze({
      runtimeVersion: REGIONAL_LEARNING_VERSION,
      insight: Object.freeze({
        region,
        crop,
        season,
        confidenceBucket: _confidenceBucket(c.confidence),
        weatherSummary: _summarizeWeather(c.weather),
        outcomeTotals:  _summarizeOutcomes(c.outcomes),
        eventCounts:    _eventCounts(events),
      }),
      sampleSize,
      scopeNote: 'single-record-anonymous',
      deferred:  Object.freeze({
        crossFarmAggregation:
          'backend aggregator required — this record is ready '
          + 'to ship when network sync arrives',
      }),
    });
  }, Object.freeze({
    runtimeVersion: REGIONAL_LEARNING_VERSION,
    insight: Object.freeze({
      region: '', crop: '', season: 'unknown',
      confidenceBucket: 'unknown',
      weatherSummary: null,
      outcomeTotals: Object.freeze({
        improved: 0, neutral: 0, worsened: 0, unknown: 0,
      }),
      eventCounts: Object.freeze({}),
    }),
    sampleSize: 0, scopeNote: 'empty',
    deferred: Object.freeze({}),
  }));
}

// Re-export the event kinds the aggregator considers material so
// downstream callers can mirror the contract.
export const REGIONAL_MATERIAL_KINDS = Object.freeze([
  EVENT_KIND.SCAN_COMPLETED,
  EVENT_KIND.SCAN_NEEDS_REVIEW,
  EVENT_KIND.TREATMENT_APPLIED,
  EVENT_KIND.HARVEST_LOGGED,
  EVENT_KIND.YIELD_FORECAST_GENERATED,
  EVENT_KIND.WEATHER_EVENT_RECORDED,
]);
