/**
 * trendDetector.js — Phase 12 local trend detection.
 *
 *   import { detectTrends }
 *     from 'src/runtime/intelligenceNetwork/trendDetector.js';
 *
 * What this is
 * ────────────
 *   Pure rolling-window comparison over the local event log + scan
 *   history. Detects whether key signals (pest detections, disease
 *   detections, heat signals, drought signals) are rising or
 *   falling vs a baseline window.
 *
 *   This is LOCAL trend detection. Without a backend aggregating
 *   anonymized records from many farms, the trends only reflect
 *   what this device has seen. The composite envelope marks
 *   `regional` as null until backend feeds arrive.
 */

const RUNTIME_VERSION = 'trend-detector-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const _arr   = (v) => (Array.isArray(v) ? v : []);
const _str   = (v) => (typeof v === 'string' ? v : '');
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

const DAY_MS = 24 * 60 * 60 * 1000;

function _ts(e) {
  if (!_isObj(e)) return null;
  return _safe(() => {
    if (_isNum(e.at)) return e.at;
    if (typeof e.at === 'string') return new Date(e.at).getTime();
    if (_isNum(e.timestamp)) return e.timestamp;
    if (typeof e.timestamp === 'string') return new Date(e.timestamp).getTime();
    if (e.createdAt) return new Date(e.createdAt).getTime();
    return null;
  }, null);
}

function _trendCompare(recentCount, baselineCount) {
  if (!_isNum(recentCount) || !_isNum(baselineCount)) {
    return { direction: 'unknown', changePct: null };
  }
  if (baselineCount === 0) {
    if (recentCount === 0) return { direction: 'flat', changePct: 0 };
    return { direction: 'rising', changePct: 100 };
  }
  const change = ((recentCount - baselineCount) / baselineCount) * 100;
  const direction = change >= 25 ? 'rising'
                 : change <= -25 ? 'falling'
                 : 'flat';
  return { direction, changePct: Math.round(change) };
}

function _countInWindow(records, fromTs, toTs, predicate) {
  let n = 0;
  for (const r of _arr(records)) {
    const t = _ts(r);
    if (t == null) continue;
    if (t < fromTs || t > toTs) continue;
    if (predicate(r)) n += 1;
  }
  return n;
}

/**
 * @param {{
 *   now?: number,
 *   recentWindowDays?: number,    // default 7
 *   baselineWindowDays?: number,  // default 14 (the 14 days BEFORE recent)
 *   events?: Array,
 *   scanHistory?: Array,
 * }} ctx
 */
export function detectTrends(ctx) {
  const c = _isObj(ctx) ? ctx : {};
  const now = _isNum(c.now) ? c.now : Date.now();
  const recentDays   = _isNum(c.recentWindowDays)   ? c.recentWindowDays   : 7;
  const baselineDays = _isNum(c.baselineWindowDays) ? c.baselineWindowDays : 14;

  const recentFrom   = now - recentDays * DAY_MS;
  const recentTo     = now;
  const baselineFrom = recentFrom - baselineDays * DAY_MS;
  const baselineTo   = recentFrom;

  const events = _arr(c.events);
  const scans  = _arr(c.scanHistory);

  const matchers = {
    pestDetection: (r) =>
      /pest|insect|holes_or_pest/i.test(_str(r && r.possibleIssue))
      || /pest|insect/i.test(_str(r && r.kind || r && r.event)),
    diseaseDetection: (r) =>
      /disease|spot|blight|rot|spots_or_disease/i.test(_str(r && r.possibleIssue))
      || /disease/i.test(_str(r && r.kind || r && r.event)),
    heatSignal: (r) =>
      /heat|hot|scorch/i.test(_str(r && r.possibleIssue))
      || (_str(r && r.kind || r && r.event) === 'weather.heat_signal'),
    droughtSignal: (r) =>
      /drought|dry|wilt/i.test(_str(r && r.possibleIssue))
      || (_str(r && r.kind || r && r.event) === 'weather.drought_signal'),
    needsReview: (r) =>
      _str(r && r.confidence).toLowerCase() === 'low'
      || _str(r && r.status).toLowerCase() === 'needs_review',
  };

  const trends = {};
  for (const [key, predicate] of Object.entries(matchers)) {
    const recentSrc = key === 'needsReview'
      ? scans
      : (key === 'pestDetection' || key === 'diseaseDetection')
        ? scans.concat(events)
        : events;
    const recent = _countInWindow(recentSrc, recentFrom, recentTo, predicate);
    const baseline = _countInWindow(recentSrc, baselineFrom, baselineTo, predicate);
    const cmp = _trendCompare(recent, baseline);
    trends[key] = Object.freeze({
      kind: key,
      recentCount: recent,
      baselineCount: baseline,
      direction: cmp.direction,
      changePct: cmp.changePct,
    });
  }

  // Composite hotspot signal — "regional alert" hint for the UI.
  // Local-only; the spec'd cross-farm version requires backend.
  const hotspots = [];
  if (trends.pestDetection.direction === 'rising'
      && trends.pestDetection.recentCount >= 2) {
    hotspots.push(Object.freeze({
      kind: 'pest_outbreak_local',
      headlineKey: 'network.hotspot.pest_outbreak.headline',
      headlineDefault: 'Pest activity is rising in your area.',
      bodyKey: 'network.hotspot.pest_outbreak.body',
      bodyDefault: 'Increase scouting and consider preventive action.',
    }));
  }
  if (trends.diseaseDetection.direction === 'rising'
      && trends.diseaseDetection.recentCount >= 2) {
    hotspots.push(Object.freeze({
      kind: 'disease_outbreak_local',
      headlineKey: 'network.hotspot.disease_outbreak.headline',
      headlineDefault: 'Disease reports are rising in your area.',
      bodyKey: 'network.hotspot.disease_outbreak.body',
      bodyDefault: 'Inspect leaves carefully and scan affected plants.',
    }));
  }
  if (trends.heatSignal.direction === 'rising') {
    hotspots.push(Object.freeze({
      kind: 'heat_stress_rising',
      headlineKey: 'network.hotspot.heat.headline',
      headlineDefault: 'Heat stress signals are rising.',
      bodyKey: 'network.hotspot.heat.body',
      bodyDefault: 'Irrigate early in the day and shade sensitive plants.',
    }));
  }

  return Object.freeze({
    runtimeVersion: RUNTIME_VERSION,
    windows: Object.freeze({
      recentDays, baselineDays,
      recentFrom, recentTo, baselineFrom, baselineTo,
    }),
    trends:    Object.freeze(trends),
    hotspots:  Object.freeze(hotspots),
    scopeNote: 'local',
  });
}

export const _internal = Object.freeze({ _trendCompare });
