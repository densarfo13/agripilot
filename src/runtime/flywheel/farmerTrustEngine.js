/**
 * runtime/flywheel/farmerTrustEngine.js — Phase 14 farmer trust
 * composer.
 *
 *   import { composeFarmerTrust, FARMER_TRUST_INPUTS }
 *     from 'src/runtime/flywheel/farmerTrustEngine.js';
 *
 * What this is
 * ────────────
 *   COMPOSES (does NOT replace) the wave-10 trustScore by adding
 *   the Phase 14 inputs:
 *     • Task completion ratio
 *     • Photo verification ratio   (scans that passed classifier)
 *     • Farm consistency           (active days per week)
 *     • Scan quality               (avg confidence)
 *     • Activity frequency         (events per week)
 *
 *   The wave-10 trustScore (when supplied as `baseTrust`) is
 *   blended in at weight 0.4; the Phase 14 weighted average
 *   contributes 0.6.
 *
 *   Returns a frozen envelope:
 *     {
 *       overall, band, components, baseTrust, runtimeVersion,
 *     }
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Does NOT modify wave-10 trustScore — composes its output.
 *   • No persistence writes.
 *   • Returns 0 + band 'unknown' rather than fake confidence on
 *     missing input.
 */

import { EVENT_KIND } from './eventEngine.js';

export const FARMER_TRUST_VERSION = 'farmer-trust-v1';

export const FARMER_TRUST_INPUTS = Object.freeze({
  TASK_COMPLETION:    'taskCompletion',
  PHOTO_VERIFICATION: 'photoVerification',
  FARM_CONSISTENCY:   'farmConsistency',
  SCAN_QUALITY:       'scanQuality',
  ACTIVITY_FREQUENCY: 'activityFrequency',
});

export const FARMER_TRUST_WEIGHTS = Object.freeze({
  taskCompletion:    0.25,
  photoVerification: 0.20,
  farmConsistency:   0.20,
  scanQuality:       0.20,
  activityFrequency: 0.15,
});

export const FARMER_TRUST_BANDS = Object.freeze([
  { min: 80, band: 'high' },
  { min: 55, band: 'medium' },
  { min: 30, band: 'low' },
  { min: 0,  band: 'building' },
]);

const _isObj = (v) => v != null && typeof v === 'object';
const _arr   = (v) => (Array.isArray(v) ? v : []);
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _str   = (v) => (typeof v === 'string' ? v : '');
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

const MS_PER_WEEK = 7 * 86400000;

function _clamp01(n) {
  const x = _num(n);
  if (x == null) return null;
  return Math.max(0, Math.min(1, x));
}

function _taskCompletionRatio(taskState) {
  if (!_isObj(taskState)) return null;
  const tasks = _arr(taskState.tasks);
  if (tasks.length === 0) return null;
  let done = 0;
  for (const t of tasks) {
    if (!_isObj(t)) continue;
    if (t.status === 'done' || t.status === 'completed' || t.completedAt) done++;
  }
  return done / tasks.length;
}

function _photoVerificationRatio(scanHistory) {
  const list = _arr(scanHistory);
  if (list.length === 0) return null;
  let verified = 0;
  for (const s of list) {
    if (!_isObj(s)) continue;
    const conf = _num(s.confidence);
    if (conf != null && conf >= 0.6) verified++;
  }
  return verified / list.length;
}

function _farmConsistency(events, nowMs) {
  const list = _arr(events);
  if (list.length === 0) return null;
  const weeks = new Set();
  for (const e of list) {
    if (!_isObj(e)) continue;
    const t = _safe(() => new Date(_str(e.timestamp)).getTime(), NaN);
    if (!Number.isFinite(t)) continue;
    const weeksAgo = Math.floor((nowMs - t) / MS_PER_WEEK);
    if (weeksAgo >= 0 && weeksAgo < 12) weeks.add(weeksAgo);
  }
  return weeks.size / 12;
}

function _scanQuality(scanHistory) {
  const list = _arr(scanHistory);
  if (list.length === 0) return null;
  let sum = 0, n = 0;
  for (const s of list) {
    if (!_isObj(s)) continue;
    const conf = _num(s.confidence);
    if (conf == null) continue;
    sum += conf; n++;
  }
  return n === 0 ? null : sum / n;
}

function _activityFrequency(events, nowMs) {
  const list = _arr(events);
  if (list.length === 0) return null;
  const recent = list.filter((e) => {
    if (!_isObj(e)) return false;
    const t = _safe(() => new Date(_str(e.timestamp)).getTime(), NaN);
    return Number.isFinite(t) && (nowMs - t) < 4 * MS_PER_WEEK;
  });
  // 4-week target: 12+ events for full credit
  return Math.min(1, recent.length / 12);
}

function _bandOf(score) {
  for (const b of FARMER_TRUST_BANDS) {
    if (score >= b.min) return b.band;
  }
  return 'building';
}

export function composeFarmerTrust(ctx) {
  return _safe(() => {
    const c     = _isObj(ctx) ? ctx : {};
    const now   = _num(c.now) || Date.now();
    const events = _arr(c.events);

    const components = {
      taskCompletion:    _clamp01(_taskCompletionRatio(c.taskState)),
      photoVerification: _clamp01(_photoVerificationRatio(c.scanHistory)),
      farmConsistency:   _clamp01(_farmConsistency(events, now)),
      scanQuality:       _clamp01(_scanQuality(c.scanHistory)),
      activityFrequency: _clamp01(_activityFrequency(events, now)),
    };

    // Weighted sum on components that have data
    let totalWeight = 0;
    let weightedSum = 0;
    const componentScores = {};
    for (const k of Object.keys(FARMER_TRUST_WEIGHTS)) {
      const v = components[k];
      const w = FARMER_TRUST_WEIGHTS[k];
      if (v == null) {
        componentScores[k] = Object.freeze({ score: null, weight: w });
        continue;
      }
      componentScores[k] = Object.freeze({ score: Math.round(v * 100), weight: w });
      weightedSum += v * w;
      totalWeight += w;
    }
    const ownScore = totalWeight === 0 ? null : (weightedSum / totalWeight) * 100;

    // Compose with the wave-10 baseTrust if supplied
    const baseTrust = _num(c.baseTrust && c.baseTrust.score) ?? _num(c.baseTrust);
    let overall;
    if (ownScore != null && baseTrust != null) {
      overall = Math.round((ownScore * 0.6) + (baseTrust * 0.4));
    } else if (ownScore != null) {
      overall = Math.round(ownScore);
    } else if (baseTrust != null) {
      overall = Math.round(baseTrust);
    } else {
      overall = 0;
    }
    const band = (ownScore == null && baseTrust == null) ? 'unknown' : _bandOf(overall);

    return Object.freeze({
      runtimeVersion: FARMER_TRUST_VERSION,
      overall,
      band,
      components: Object.freeze(componentScores),
      baseTrust:  baseTrust == null ? null : Math.round(baseTrust),
      composedAt: _safe(() => new Date(now).toISOString(), ''),
    });
  }, Object.freeze({
    runtimeVersion: FARMER_TRUST_VERSION,
    overall: 0, band: 'unknown',
    components: Object.freeze({}),
    baseTrust: null, composedAt: '',
  }));
}
