/**
 * streakTracker.js — Phase 11 streak calculator (pure).
 *
 *   import { computeStreaks } from 'src/runtime/today/streakTracker.js';
 *
 * What this is
 * ────────────
 *   Reads a chronological event timeline + a "now" timestamp and
 *   returns three streak counts:
 *
 *     dailyUsage         consecutive days the app was opened
 *     taskCompletion     consecutive days at least one task was completed
 *     scanActivity       consecutive days at least one scan was taken
 *
 *   Tier labels (per streak length):
 *     starting        0
 *     building        1-6
 *     three_day       3-6
 *     fortnight       7-29
 *     monthly         30-89
 *     ninety          ≥ 90
 *
 *   The tracker NEVER writes. Caller supplies the events array (from
 *   wave-5 eventRuntime.getEventLog() or equivalent).
 */

const RUNTIME_VERSION = 'streak-tracker-v1';

const DAY_MS = 24 * 60 * 60 * 1000;

const _isObj = (v) => v != null && typeof v === 'object';
const _isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const _arr  = (v) => (Array.isArray(v) ? v : []);
const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _eventTime(e) {
  if (!_isObj(e)) return null;
  return _safe(() => {
    if (typeof e.at === 'string') return new Date(e.at).getTime();
    if (_isNum(e.at)) return e.at;
    if (_isNum(e.timestamp)) return e.timestamp;
    if (typeof e.timestamp === 'string') return new Date(e.timestamp).getTime();
    return null;
  }, null);
}

function _eventKindOf(e) {
  if (!_isObj(e)) return '';
  return String(e.kind || e.event || '').toLowerCase();
}

function _isUsageKind(k) {
  return k === 'app.opened'
      || k === 'app.session_started'
      || k === 'farm.viewed'
      || k.startsWith('home.')
      || k.startsWith('today.');
}
function _isTaskCompleteKind(k) {
  return k === 'task.completed'
      || k === 'task.completed_with_photo';
}
function _isScanKind(k) {
  return k === 'scan.completed'
      || k === 'scan.queued';
}

function _dayKey(ts) {
  if (!_isNum(ts)) return null;
  // YYYY-MM-DD in UTC. Local-time variance is fine for the streak
  // semantic — what matters is contiguous calendar days.
  const d = _safe(() => new Date(ts), null);
  if (!d) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return y + '-' + m + '-' + dd;
}

function _streakOf(activeDaySet, nowDayTs) {
  let streak = 0;
  let cursor = nowDayTs;
  for (;;) {
    const k = _dayKey(cursor);
    if (!activeDaySet.has(k)) break;
    streak += 1;
    cursor -= DAY_MS;
  }
  return streak;
}

function _tierFor(len) {
  if (len >= 90) return 'ninety';
  if (len >= 30) return 'monthly';
  if (len >=  7) return 'fortnight';
  if (len >=  3) return 'three_day';
  if (len >=  1) return 'building';
  return 'starting';
}

/**
 * @param {Array} events — chronological event timeline
 * @param {{ now?: number }} ctx
 */
export function computeStreaks(events, ctx) {
  const now = _isNum(ctx && ctx.now) ? ctx.now : Date.now();
  // Normalize "now" to the start of its day so we don't double-count
  // events from earlier today vs yesterday under different cursors.
  const nowDayTs = Math.floor(now / DAY_MS) * DAY_MS;
  const usageDays = new Set();
  const taskDays = new Set();
  const scanDays = new Set();
  for (const e of _arr(events)) {
    const ts = _eventTime(e);
    if (!_isNum(ts)) continue;
    const k = _eventKindOf(e);
    const day = _dayKey(ts);
    if (!day) continue;
    if (_isUsageKind(k))        usageDays.add(day);
    if (_isTaskCompleteKind(k)) taskDays.add(day);
    if (_isScanKind(k))         scanDays.add(day);
  }
  const dailyUsage     = _streakOf(usageDays, nowDayTs);
  const taskCompletion = _streakOf(taskDays, nowDayTs);
  const scanActivity   = _streakOf(scanDays, nowDayTs);
  return Object.freeze({
    runtimeVersion: RUNTIME_VERSION,
    dailyUsage:     Object.freeze({ count: dailyUsage,     tier: _tierFor(dailyUsage) }),
    taskCompletion: Object.freeze({ count: taskCompletion, tier: _tierFor(taskCompletion) }),
    scanActivity:   Object.freeze({ count: scanActivity,   tier: _tierFor(scanActivity) }),
  });
}

export const _internal = Object.freeze({ _streakOf, _tierFor });
