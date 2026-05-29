/**
 * priorityRanker.js — Phase 11 task priority bucketing.
 *
 *   import { rankTasks } from 'src/runtime/today/priorityRanker.js';
 *
 * What this is
 * ────────────
 *   Pure deterministic ranker. Takes a list of tasks + a context
 *   envelope (weather/risk/health) and returns the SAME tasks
 *   annotated with:
 *
 *     impactScore   0-1   (how important is the outcome)
 *     urgencyScore  0-1   (how soon must it be done)
 *     riskScore     0-1   (what happens if missed)
 *     priorityScore 0-1   weighted composite
 *     bucket        'do_now' | 'do_today' | 'can_wait' | 'recovery'
 *
 *   Buckets:
 *     do_now    priorityScore ≥ 0.70
 *     do_today  priorityScore ≥ 0.40
 *     can_wait  priorityScore < 0.40
 *     recovery  task is past due AND not completed
 *
 *   The ranker NEVER modifies the task. NEVER writes. NEVER throws.
 */

const RUNTIME_VERSION = 'priority-ranker-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const _str  = (v) => (typeof v === 'string' ? v : '');
const _arr  = (v) => (Array.isArray(v) ? v : []);
const _clamp01 = (v) => Math.max(0, Math.min(1, _isNum(v) ? v : 0));
const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

const WEIGHTS = Object.freeze({
  impact:  0.40,
  urgency: 0.40,
  risk:    0.20,
});

export const TASK_BUCKET = Object.freeze({
  DO_NOW:   'do_now',
  DO_TODAY: 'do_today',
  CAN_WAIT: 'can_wait',
  RECOVERY: 'recovery',
});

const BUCKET_THRESHOLDS = Object.freeze({
  do_now:   0.70,
  do_today: 0.40,
});

const DAY_MS = 24 * 60 * 60 * 1000;

function _hoursUntil(dueAt, now) {
  return _safe(() => {
    if (dueAt == null) return null;
    const d = (typeof dueAt === 'number') ? dueAt
            : (typeof dueAt === 'string') ? new Date(dueAt).getTime()
            : (dueAt instanceof Date) ? dueAt.getTime()
            : null;
    if (!Number.isFinite(d)) return null;
    return (d - now) / (60 * 60 * 1000);
  }, null);
}

// Score: impact from task.kind / task.severity / task.scoreHint
function _scoreImpact(task) {
  return _safe(() => {
    if (!_isObj(task)) return 0.4;
    if (_isNum(task.impactScore))  return _clamp01(task.impactScore);
    if (_isNum(task.scoreHint))    return _clamp01(task.scoreHint);
    const sev = _str(task.severity || task.urgencyTone).toLowerCase();
    if (sev === 'high' || sev === 'serious') return 0.9;
    if (sev === 'medium' || sev === 'moderate') return 0.6;
    if (sev === 'low' || sev === 'mild') return 0.3;
    const kind = _str(task.kind || task.type).toLowerCase();
    if (/treatment|disease|pest/i.test(kind)) return 0.8;
    if (/water|irrig/i.test(kind))             return 0.7;
    if (/scan|inspect/i.test(kind))            return 0.55;
    if (/fertili/i.test(kind))                 return 0.5;
    return 0.4;
  }, 0.4);
}

// Score: urgency from time-to-due
function _scoreUrgency(task, now) {
  return _safe(() => {
    if (!_isObj(task)) return 0.3;
    if (_isNum(task.urgencyScore)) return _clamp01(task.urgencyScore);
    const hrs = _hoursUntil(task.dueAt || task.dueDate, now);
    if (hrs == null) return 0.4;
    if (hrs <= 0)    return 1.0;     // past due
    if (hrs <= 6)    return 0.9;     // within 6 hours
    if (hrs <= 24)   return 0.7;     // due today
    if (hrs <= 72)   return 0.5;     // within 3 days
    if (hrs <= 168)  return 0.3;     // within a week
    return 0.15;
  }, 0.3);
}

// Score: risk if missed — pulls from caller-provided risk hints.
function _scoreRisk(task, ctx) {
  return _safe(() => {
    if (!_isObj(task)) return 0.3;
    if (_isNum(task.riskScore)) return _clamp01(task.riskScore);
    const kind = _str(task.kind || task.type).toLowerCase();
    // Compose with field-risk envelope when relevant.
    const risk = ctx && ctx.fieldRisk;
    if (risk && _isObj(risk.risks)) {
      if (/water|irrig/i.test(kind) && risk.risks.drought
          && risk.risks.drought.level === 'high') return 0.85;
      if (/treatment|disease/i.test(kind) && risk.risks.disease
          && risk.risks.disease.level === 'high') return 0.85;
      if (/pest/i.test(kind) && risk.risks.pest_outbreak
          && risk.risks.pest_outbreak.level === 'high') return 0.8;
    }
    const sev = _str(task.severity || '').toLowerCase();
    if (sev === 'high') return 0.7;
    if (sev === 'medium') return 0.5;
    return 0.3;
  }, 0.3);
}

function _bucketFor(score, isPastDue) {
  if (isPastDue) return TASK_BUCKET.RECOVERY;
  if (score >= BUCKET_THRESHOLDS.do_now)   return TASK_BUCKET.DO_NOW;
  if (score >= BUCKET_THRESHOLDS.do_today) return TASK_BUCKET.DO_TODAY;
  return TASK_BUCKET.CAN_WAIT;
}

/**
 * Rank a list of tasks. Returns frozen array preserving caller's
 * task objects with `priority` field merged on. Pure / never throws.
 *
 *   @param {Array} tasks
 *   @param {{ now?: number, fieldRisk?: Object }} ctx
 */
export function rankTasks(tasks, ctx) {
  const list = _arr(tasks);
  const now = _isNum(ctx && ctx.now) ? ctx.now : Date.now();
  const out = [];
  for (const t of list) {
    if (!_isObj(t)) continue;
    const impact  = _scoreImpact(t);
    const urgency = _scoreUrgency(t, now);
    const risk    = _scoreRisk(t, ctx || {});
    const priority = (impact * WEIGHTS.impact)
                   + (urgency * WEIGHTS.urgency)
                   + (risk * WEIGHTS.risk);
    const hrs = _hoursUntil(t.dueAt || t.dueDate, now);
    const isPastDue = hrs != null && hrs < 0 && t.completed !== true;
    const bucket = _bucketFor(priority, isPastDue);
    out.push(Object.freeze({
      task: t,
      priority: Object.freeze({
        runtimeVersion: RUNTIME_VERSION,
        impactScore:  Math.round(impact * 100) / 100,
        urgencyScore: Math.round(urgency * 100) / 100,
        riskScore:    Math.round(risk * 100) / 100,
        priorityScore: Math.round(priority * 100) / 100,
        bucket,
        isPastDue,
      }),
    }));
  }
  // Sort: do_now → do_today → recovery → can_wait, then by score desc.
  const ORDER = { do_now: 0, do_today: 1, recovery: 2, can_wait: 3 };
  out.sort((a, b) => {
    const oa = ORDER[a.priority.bucket] ?? 99;
    const ob = ORDER[b.priority.bucket] ?? 99;
    if (oa !== ob) return oa - ob;
    return b.priority.priorityScore - a.priority.priorityScore;
  });
  return Object.freeze(out);
}

export const _internal = Object.freeze({
  WEIGHTS, BUCKET_THRESHOLDS, _scoreImpact, _scoreUrgency, _scoreRisk,
});
