/**
 * alertFatigueEngine.js — cooldown system that prevents
 * recommendation spam + notification exhaustion.
 *
 *   import { gateAlert, recordAlertShown, getCooldowns }
 *     from 'src/core/intelligence/alertFatigueEngine.js';
 *
 *   const decision = gateAlert({
 *     candidateId: 'crop_survival_frost',
 *     urgency: 'high',
 *     nowMs,
 *   });
 *   if (decision.allowed) {
 *     showAlert();
 *     recordAlertShown(decision.candidateId, decision.urgency);
 *   } else {
 *     // skip silently — decision.reason explains why
 *   }
 *
 * What this is
 * ────────────
 *   Per-candidate cooldown ledger living in memory + localStorage.
 *   Three rules in order:
 *     1. URGENCY COOLDOWN — high urgency may repeat every 4h,
 *        medium every 12h, low every 24h.
 *     2. REPEATED-IGNORE COOLDOWN — if the user has acknowledged
 *        but not acted, double the window.
 *     3. PER-DAY CAP — at most 6 distinct alerts shown per
 *        rolling 24h window.
 *
 *   `gateAlert()` returns the decision envelope; surfaces call
 *   `recordAlertShown()` AFTER actually surfacing the alert.
 *
 * Strict-rule audit
 *   • Pure-ish runtime. Never throws. SSR-safe.
 *   • localStorage wrapped in try/catch.
 *   • Capped buffer (50 most recent shows).
 */

const ENGINE_VERSION = 'alert-fatigue-v1';
const STORAGE_KEY = 'farroway:alertFatigue:v1';
const MAX_HISTORY = 50;
const ROLLING_WINDOW_MS = 24 * 60 * 60 * 1000;
const PER_DAY_CAP = 6;

const _COOLDOWN_BY_URGENCY = Object.freeze({
  high:   4  * 60 * 60 * 1000,   // 4h
  medium: 12 * 60 * 60 * 1000,   // 12h
  low:    24 * 60 * 60 * 1000,   // 24h
});

const _isObj = (v) => v != null && typeof v === 'object';
const _str   = (v) => (typeof v === 'string' ? v : '');
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _readLog() {
  return _safe(() => {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  }, []);
}

function _writeLog(arr) {
  _safe(() => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  });
}

function _cooldownFor(urgency) {
  const u = _str(urgency).toLowerCase();
  return _COOLDOWN_BY_URGENCY[u] || _COOLDOWN_BY_URGENCY.low;
}

/**
 * Decide whether to show an alert.
 *
 *   { candidateId, urgency, ignoredCount?, nowMs? }
 *
 * Returns: { allowed, reason, candidateId, msUntilNextAllowed }
 */
export function gateAlert(input) {
  return _safe(() => {
    const safe = _isObj(input) ? input : {};
    const candidateId = _str(safe.candidateId);
    if (!candidateId) {
      return _freeze({
        allowed: false, reason: 'no_candidate_id',
        candidateId: null, msUntilNextAllowed: null,
      });
    }
    const urgency = _str(safe.urgency).toLowerCase() || 'low';
    const nowMs = _num(safe.nowMs) || Date.now();
    const log = _readLog();

    // 3. Per-day cap check.
    const recent = log.filter((e) => e && e.at >= nowMs - ROLLING_WINDOW_MS);
    if (recent.length >= PER_DAY_CAP) {
      return _freeze({
        allowed: false, reason: 'per_day_cap_reached',
        candidateId, msUntilNextAllowed: null,
      });
    }

    // 1. Per-candidate cooldown.
    const lastShown = log.filter((e) => e && e.id === candidateId)
      .sort((a, b) => b.at - a.at)[0];
    if (lastShown) {
      const cooldown = _cooldownFor(urgency);
      // 2. Repeated-ignore — double the window when user
      //    acknowledged but didn't act.
      const ignoredCount = _num(safe.ignoredCount) || 0;
      const effective = ignoredCount >= 1 ? cooldown * 2 : cooldown;
      const since = nowMs - lastShown.at;
      if (since < effective) {
        return _freeze({
          allowed: false,
          reason:  ignoredCount >= 1 ? 'repeated_ignore_cooldown' : 'urgency_cooldown',
          candidateId,
          msUntilNextAllowed: Math.max(0, effective - since),
        });
      }
    }

    return _freeze({
      allowed: true, reason: 'within_budget',
      candidateId, urgency, msUntilNextAllowed: 0,
    });
  }, _freeze({
    allowed: false, reason: 'gate_error',
    candidateId: null, msUntilNextAllowed: null,
  }));
}

function _freeze(o) {
  return Object.freeze({ engineVersion: ENGINE_VERSION, ...o,
    decidedAt: Date.now() });
}

/**
 * Record that an alert was actually shown so future gateAlert
 * calls see it.
 */
export function recordAlertShown(candidateId, urgency, meta) {
  return _safe(() => {
    if (!candidateId || typeof candidateId !== 'string') return false;
    const log = _readLog();
    log.push({
      id:      candidateId,
      urgency: _str(urgency).toLowerCase() || 'low',
      at:      Date.now(),
      meta:    _isObj(meta) ? { ..._stripPii(meta) } : null,
    });
    if (log.length > MAX_HISTORY) log.splice(0, log.length - MAX_HISTORY);
    _writeLog(log);
    return true;
  }, false);
}

const _PII = new Set(['userId', 'phone', 'email', 'lat', 'lng', 'address']);
function _stripPii(o) {
  const out = {};
  for (const k of Object.keys(o)) {
    if (_PII.has(k)) continue;
    const v = o[k];
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v;
    }
  }
  return out;
}

/** Read every recorded cooldown. Used by diagnostic hooks. */
export function getCooldowns() {
  return Object.freeze({
    engineVersion: ENGINE_VERSION,
    recent:        Object.freeze(_readLog().slice(-20)),
    cooldownsMs:   _COOLDOWN_BY_URGENCY,
    perDayCap:     PER_DAY_CAP,
    generatedAt:   Date.now(),
  });
}

/** Test-only reset. */
export function clearAlertHistory() { _writeLog([]); }

export const _internal = Object.freeze({
  _COOLDOWN_BY_URGENCY, _cooldownFor, _stripPii, _PII,
  ROLLING_WINDOW_MS, PER_DAY_CAP, ENGINE_VERSION,
});

const _module = {
  gateAlert, recordAlertShown, getCooldowns, clearAlertHistory,
  _internal,
};
export default _module;
