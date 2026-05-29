/**
 * digitalTwin.js — Phase 12 farm timelines.
 *
 *   import { buildDigitalTwin }
 *     from 'src/runtime/intelligenceNetwork/digitalTwin.js';
 *
 * What this is
 * ────────────
 *   Pure composer that turns the event log + scan history + task
 *   activity into FOUR per-farm timelines:
 *
 *     health     daily farm-health score
 *     risk       daily top field-risk level
 *     yield      observed outcomes by day
 *     activity   tasks completed + scans taken per day
 *
 *   Each entry is { day, value, meta }. Days span the requested
 *   window (default 30) so the UI can render a continuous chart
 *   even on idle days.
 *
 *   This runtime READS only — no writes, no fetches. Works fully
 *   offline. The network effect comes when a future backend
 *   aggregates anonymized records from the anonymizer — until
 *   then the twin is single-farm local intelligence.
 */

const RUNTIME_VERSION = 'digital-twin-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const _arr   = (v) => (Array.isArray(v) ? v : []);
const _str   = (v) => (typeof v === 'string' ? v : '');
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

const DAY_MS = 24 * 60 * 60 * 1000;

function _dayKey(ts) {
  if (!_isNum(ts)) return null;
  return _safe(() => {
    const d = new Date(Math.floor(ts / DAY_MS) * DAY_MS);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return y + '-' + m + '-' + dd;
  }, null);
}

function _eventTime(e) {
  if (!_isObj(e)) return null;
  return _safe(() => {
    if (_isNum(e.at)) return e.at;
    if (typeof e.at === 'string') return new Date(e.at).getTime();
    if (_isNum(e.timestamp)) return e.timestamp;
    if (typeof e.timestamp === 'string') return new Date(e.timestamp).getTime();
    return null;
  }, null);
}

function _daysWindow(now, windowDays) {
  const out = [];
  const base = Math.floor(now / DAY_MS) * DAY_MS;
  for (let i = windowDays - 1; i >= 0; i -= 1) {
    out.push(_dayKey(base - i * DAY_MS));
  }
  return out;
}

function _riskLevelToOrdinal(level) {
  if (level === 'high') return 2;
  if (level === 'medium') return 1;
  if (level === 'low') return 0;
  return null;
}

/**
 * @param {{
 *   now?: number,
 *   windowDays?: number,        // default 30
 *   events?: Array,             // wave-5 event log
 *   scanHistory?: Array,        // wave-1 useScanHistory entries
 *   dailyHealthSnapshots?: Array, // optional per-day health rows
 *   dailyRiskSnapshots?: Array,   // optional per-day risk rows
 *   outcomeRecords?: Array,     // wave-6 outcome memory entries
 * }} ctx
 */
export function buildDigitalTwin(ctx) {
  const c = _isObj(ctx) ? ctx : {};
  const now = _isNum(c.now) ? c.now : Date.now();
  const win = _isNum(c.windowDays) && c.windowDays > 0
    ? Math.min(180, c.windowDays) : 30;
  const days = _daysWindow(now, win);
  const daySet = new Set(days);

  // ─── Health timeline ──────────────────────────────────────
  const healthMap = new Map();
  for (const snap of _arr(c.dailyHealthSnapshots)) {
    if (!_isObj(snap)) continue;
    const k = _str(snap.day) || _dayKey(_eventTime(snap));
    if (!k || !daySet.has(k)) continue;
    if (_isNum(snap.score)) healthMap.set(k, snap.score);
  }
  const health = days.map((d) => Object.freeze({
    day: d,
    value: healthMap.has(d) ? healthMap.get(d) : null,
    meta: null,
  }));

  // ─── Risk timeline ────────────────────────────────────────
  const riskMap = new Map();
  for (const snap of _arr(c.dailyRiskSnapshots)) {
    if (!_isObj(snap)) continue;
    const k = _str(snap.day) || _dayKey(_eventTime(snap));
    if (!k || !daySet.has(k)) continue;
    const o = _riskLevelToOrdinal(_str(snap.topLevel));
    if (o != null) riskMap.set(k, { level: snap.topLevel, ordinal: o });
  }
  const risk = days.map((d) => {
    const r = riskMap.get(d);
    return Object.freeze({
      day: d,
      value: r ? r.ordinal : null,
      meta: r ? Object.freeze({ level: r.level }) : null,
    });
  });

  // ─── Yield timeline (outcome bands per day) ───────────────
  const yieldMap = new Map();
  for (const o of _arr(c.outcomeRecords)) {
    if (!_isObj(o)) continue;
    const k = _str(o.day) || _str(o.dayBucket) || _dayKey(_eventTime(o));
    if (!k || !daySet.has(k)) continue;
    const cur = yieldMap.get(k) || { positive: 0, flat: 0, negative: 0 };
    const band = _str(o.yieldDeltaBand) || _str(o.band);
    if (band === 'positive') cur.positive += 1;
    else if (band === 'negative') cur.negative += 1;
    else cur.flat += 1;
    yieldMap.set(k, cur);
  }
  const yields = days.map((d) => {
    const y = yieldMap.get(d);
    if (!y) return Object.freeze({ day: d, value: null, meta: null });
    // Composite -1..+1 net signal.
    const total = y.positive + y.flat + y.negative;
    const net = total === 0 ? 0
      : (y.positive - y.negative) / total;
    return Object.freeze({
      day: d,
      value: Math.round(net * 100) / 100,
      meta: Object.freeze({ ...y, total }),
    });
  });

  // ─── Activity timeline ────────────────────────────────────
  const activityMap = new Map();
  for (const e of _arr(c.events)) {
    const ts = _eventTime(e);
    const k = _dayKey(ts);
    if (!k || !daySet.has(k)) continue;
    const kind = _str(e && e.kind || e && e.event).toLowerCase();
    const cur = activityMap.get(k) || { tasks: 0, scans: 0 };
    if (kind === 'task.completed' || kind === 'task.completed_with_photo') {
      cur.tasks += 1;
    }
    if (kind === 'scan.completed' || kind === 'scan.queued') {
      cur.scans += 1;
    }
    activityMap.set(k, cur);
  }
  for (const s of _arr(c.scanHistory)) {
    if (!_isObj(s)) continue;
    const k = _dayKey(_safe(() => new Date(s.createdAt).getTime(), null));
    if (!k || !daySet.has(k)) continue;
    const cur = activityMap.get(k) || { tasks: 0, scans: 0 };
    cur.scans += 1;
    activityMap.set(k, cur);
  }
  const activity = days.map((d) => {
    const a = activityMap.get(d) || { tasks: 0, scans: 0 };
    return Object.freeze({
      day: d,
      value: a.tasks + a.scans,
      meta: Object.freeze(a),
    });
  });

  return Object.freeze({
    runtimeVersion: RUNTIME_VERSION,
    windowDays: win,
    health, risk, yields, activity,
  });
}

export const _internal = Object.freeze({ _daysWindow, _riskLevelToOrdinal });
