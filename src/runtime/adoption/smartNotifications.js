/**
 * runtime/adoption/smartNotifications.js — Phase 13 throttled
 * meaningful-alert composer.
 *
 *   import {
 *     composeSmartNotifications,
 *     NOTIFICATION_KIND,
 *     NOTIFICATION_COOLDOWN_MS,
 *   } from 'src/runtime/adoption/smartNotifications.js';
 *
 * What this is
 * ────────────
 *   The Farmer Rule says: silence is the default. Only send a
 *   notification when:
 *     1. The signal is materially actionable today.
 *     2. We haven't already sent the same kind within the cooldown.
 *
 *   This engine DOES NOT FIRE notifications — it returns 3 lists:
 *     • candidates  — every signal we'd consider sending
 *     • throttled   — candidates suppressed by cooldown
 *     • allowed     — candidates that the caller may now hand to
 *                     the wave-8 notifications runtime to deliver
 *
 *   4 notification kinds map to the 4 spec'd farmer alerts:
 *     • HIGH_DISEASE_RISK
 *     • TASK_OVERDUE
 *     • RAIN_APPROACHING
 *     • HARVEST_WINDOW
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • No persistence writes — caller appends to its own sentLog
 *     after delivery via the wave-5 single-writer path.
 *   • All copy via tSafe envelopes.
 */

export const SMART_NOTIFICATIONS_VERSION = 'smart-notifications-v1';
export const NOTIFICATION_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours

export const NOTIFICATION_KIND = Object.freeze({
  HIGH_DISEASE_RISK: 'HIGH_DISEASE_RISK',
  TASK_OVERDUE:      'TASK_OVERDUE',
  RAIN_APPROACHING:  'RAIN_APPROACHING',
  HARVEST_WINDOW:    'HARVEST_WINDOW',
});

const _isObj = (v) => v != null && typeof v === 'object';
const _arr   = (v) => (Array.isArray(v) ? v : []);
const _str   = (v) => (typeof v === 'string' ? v : '');
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

// Severity ladder — only HIGH-level risk envelopes count as "high"
function _highRiskKind(envelope) {
  if (!_isObj(envelope)) return null;
  const risks = _arr(envelope.risks);
  for (const r of risks) {
    if (!_isObj(r)) continue;
    const sev = _str(r.severity).toLowerCase();
    if (sev === 'high' || sev === 'critical') return r.kind || 'unknown';
  }
  return null;
}

function _overdueCount(taskState, now) {
  if (!_isObj(taskState)) return 0;
  let n = 0;
  for (const t of _arr(taskState.tasks)) {
    if (!_isObj(t)) continue;
    if (t.status === 'done' || t.status === 'completed' || t.completedAt) continue;
    const due = _safe(() =>
      new Date(_str(t.dueAt) || _str(t.dueDate)).getTime(), NaN);
    if (Number.isFinite(due) && due < now) n++;
  }
  return n;
}

function _rainApproaching(weatherForecast) {
  if (!_isObj(weatherForecast)) return null;
  const slots = _arr(weatherForecast.slots);
  for (const s of slots) {
    if (!_isObj(s)) continue;
    const inMs = _num(s.inMs);
    if (inMs == null || inMs < 0) continue;
    if (inMs > 36 * 60 * 60 * 1000) continue; // only next 36h
    const prob = _num(s.precipProbability);
    if (prob != null && prob >= 0.6) return { inMs, prob };
  }
  return null;
}

function _harvestWindow(cropStage) {
  if (!_isObj(cropStage)) return null;
  const stage = _str(cropStage.stage).toLowerCase();
  if (stage === 'harvest' || stage === 'fruit_development') {
    return { stage, windowDays: _num(cropStage.windowDays) || 14 };
  }
  return null;
}

function _lastSent(sentLog, kind) {
  let last = 0;
  for (const e of _arr(sentLog)) {
    if (!_isObj(e) || e.kind !== kind) continue;
    const t = _safe(() => new Date(_str(e.at)).getTime(), NaN);
    if (Number.isFinite(t) && t > last) last = t;
  }
  return last;
}

export function composeSmartNotifications(ctx) {
  return _safe(() => {
    const c       = _isObj(ctx) ? ctx : {};
    const now     = _num(c.now) || Date.now();
    const sentLog = _arr(c.sentLog);
    const candidates = [];

    // 1. High disease risk
    const hiKind = _highRiskKind(c.riskEnvelope);
    if (hiKind) {
      candidates.push({
        kind: NOTIFICATION_KIND.HIGH_DISEASE_RISK,
        priority: 1,
        titleKey: 'adoption.notif.highRisk.title',
        titleDefault: 'High risk detected',
        bodyKey: 'adoption.notif.highRisk.body',
        bodyDefault: 'A high-severity ' + hiKind + ' risk is active today.',
        meta: { kind: hiKind },
      });
    }

    // 2. Task overdue
    const overdue = _overdueCount(c.taskState, now);
    if (overdue > 0) {
      candidates.push({
        kind: NOTIFICATION_KIND.TASK_OVERDUE,
        priority: 2,
        titleKey: 'adoption.notif.overdue.title',
        titleDefault: 'Tasks past due',
        bodyKey: 'adoption.notif.overdue.body',
        bodyDefault: overdue + ' task(s) need attention.',
        meta: { count: overdue },
      });
    }

    // 3. Rain approaching
    const rain = _rainApproaching(c.weatherForecast);
    if (rain) {
      const hours = Math.max(1, Math.round(rain.inMs / 3600000));
      candidates.push({
        kind: NOTIFICATION_KIND.RAIN_APPROACHING,
        priority: 3,
        titleKey: 'adoption.notif.rain.title',
        titleDefault: 'Rain approaching',
        bodyKey: 'adoption.notif.rain.body',
        bodyDefault: 'Rain expected in ' + hours + 'h. Plan field work.',
        meta: { inMs: rain.inMs, probability: rain.prob },
      });
    }

    // 4. Harvest window
    const harvest = _harvestWindow(c.cropStage);
    if (harvest) {
      candidates.push({
        kind: NOTIFICATION_KIND.HARVEST_WINDOW,
        priority: 4,
        titleKey: 'adoption.notif.harvest.title',
        titleDefault: 'Harvest window open',
        bodyKey: 'adoption.notif.harvest.body',
        bodyDefault: 'Harvest window opens in the next '
          + harvest.windowDays + ' day(s).',
        meta: { stage: harvest.stage, windowDays: harvest.windowDays },
      });
    }

    const allowed   = [];
    const throttled = [];
    for (const cand of candidates) {
      const last = _lastSent(sentLog, cand.kind);
      const ageMs = now - last;
      if (last > 0 && ageMs < NOTIFICATION_COOLDOWN_MS) {
        throttled.push(Object.freeze({
          ...cand,
          throttledReason: 'cooldown',
          cooldownRemainingMs: NOTIFICATION_COOLDOWN_MS - ageMs,
        }));
      } else {
        allowed.push(Object.freeze({ ...cand, allowedAt: now }));
      }
    }
    allowed.sort((a, b) => a.priority - b.priority);
    throttled.sort((a, b) => a.priority - b.priority);

    return Object.freeze({
      runtimeVersion: SMART_NOTIFICATIONS_VERSION,
      generatedAt:    _safe(() => new Date(now).toISOString(), ''),
      candidates:     Object.freeze(candidates.map((c) => Object.freeze(c))),
      allowed:        Object.freeze(allowed),
      throttled:      Object.freeze(throttled),
      cooldownMs:     NOTIFICATION_COOLDOWN_MS,
    });
  }, Object.freeze({
    runtimeVersion: SMART_NOTIFICATIONS_VERSION,
    generatedAt: '',
    candidates: Object.freeze([]),
    allowed:    Object.freeze([]),
    throttled:  Object.freeze([]),
    cooldownMs: NOTIFICATION_COOLDOWN_MS,
  }));
}
