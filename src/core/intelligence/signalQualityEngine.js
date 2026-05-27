/**
 * signalQualityEngine.js — score reliability of every incoming
 * signal so downstream engines can suppress low-quality noise.
 *
 *   import { scoreSignalQuality, SIGNAL_QUALITY }
 *     from 'src/core/intelligence/signalQualityEngine.js';
 *
 *   const v = scoreSignalQuality({
 *     weather, scans, cropStage, region, taskCompletion,
 *     continuityMemory, recommendationHistory,
 *     satelliteReady, outcomeFeedback, offlineFreshnessMs,
 *     nowMs,
 *   });
 *
 *   v = {
 *     signalQuality,       — 'high' | 'medium' | 'low' | 'insufficient'
 *     trustScore,          — 0..1
 *     confidence,          — 'high' | 'medium' | 'low'
 *     staleSignals,        — [{ kind, reason }]
 *     suppressedSignals,   — [{ kind, reason }]
 *     contributingSignals, — [{ kind, weight }]
 *     engineVersion:'signal-quality-v1', generatedAt,
 *   }
 *
 * What this is
 * ────────────
 *   A pure scorer. Each signal contributes a weighted +/- vote
 *   toward a 0..1 trust score. The score maps into one of four
 *   bands. Surfaces consult this BEFORE rendering trust-sensitive
 *   advice: if `signalQuality === 'insufficient'`, the surface
 *   degrades to the calm "still building" copy.
 *
 *   Weights are deliberate, not learned:
 *     • weather freshness    +0.20
 *     • recent scan present  +0.15
 *     • crop + region set    +0.20
 *     • task completion >50% +0.15
 *     • outcome feedback ≥3  +0.20
 *     • continuity memory    +0.10
 *
 *   Penalties:
 *     • stale weather (> 2h) −0.20
 *     • zero scans + zero tasks combined −0.20
 *     • offline freshness > 24h −0.15
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • No I/O. Reads exactly what the caller supplies.
 */

const ENGINE_VERSION = 'signal-quality-v1';

export const SIGNAL_QUALITY = Object.freeze({
  HIGH:          'high',
  MEDIUM:        'medium',
  LOW:           'low',
  INSUFFICIENT:  'insufficient',
});

const _isObj = (v) => v != null && typeof v === 'object';
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _str   = (v) => (typeof v === 'string' ? v : '');
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _weatherSignal(input, now) {
  const w = input.weather;
  if (!_isObj(w)) return { weight: 0, stale: { kind: 'weather', reason: 'missing' } };
  const fetchedAt = _num(w.fetchedAt) || _num(w.at);
  if (fetchedAt == null) return { weight: +0.10, stale: null };  // partial signal
  const ageMin = (now - fetchedAt) / 60000;
  if (ageMin > 120) return { weight: -0.20, stale: { kind: 'weather', reason: 'stale' } };
  return { weight: +0.20, stale: null };
}

function _scansSignal(input) {
  const scans = Array.isArray(input.scans) ? input.scans : [];
  if (scans.length === 0) return { weight: 0, stale: { kind: 'scans', reason: 'empty' } };
  return { weight: +0.15, stale: null };
}

function _cropRegionSignal(input) {
  const crop = _str(input.cropStage) || _str(input.crop);
  const region = _str(input.region);
  if (crop && region) return { weight: +0.20, stale: null };
  if (crop || region) return { weight: +0.10, stale: null };
  return { weight: 0, stale: { kind: 'crop_region', reason: 'missing' } };
}

function _taskSignal(input) {
  const tc = input.taskCompletion;
  if (!Array.isArray(tc) || tc.length === 0) {
    return { weight: 0, stale: { kind: 'tasks', reason: 'empty' } };
  }
  const completed = tc.filter((t) => t && t.completed === true).length;
  const rate = completed / tc.length;
  if (rate > 0.5) return { weight: +0.15, stale: null };
  return { weight: +0.05, stale: null };
}

function _outcomeSignal(input) {
  const o = Array.isArray(input.outcomeFeedback) ? input.outcomeFeedback : [];
  if (o.length >= 3) return { weight: +0.20, stale: null };
  if (o.length >= 1) return { weight: +0.10, stale: null };
  return { weight: 0, stale: { kind: 'outcomes', reason: 'thin' } };
}

function _continuitySignal(input) {
  const cm = _isObj(input.continuityMemory) ? input.continuityMemory : null;
  if (cm && (cm.daysSinceLastScan != null || cm.resolvedCount > 0)) {
    return { weight: +0.10, stale: null };
  }
  return { weight: 0, stale: null };
}

function _offlineFreshnessSignal(input, now) {
  const ms = _num(input.offlineFreshnessMs);
  if (ms == null) return { weight: 0, stale: null };
  const ageHours = (now - ms) / 3600000;
  if (ageHours > 24) return { weight: -0.15, stale: { kind: 'offline', reason: 'stale_cache' } };
  return { weight: 0, stale: null };
}

function _combinedPenalty(scoreInputs) {
  // Combined penalty: zero scans + zero tasks together = penalty.
  const noScans = scoreInputs.scans.weight === 0;
  const noTasks = scoreInputs.tasks.weight === 0;
  if (noScans && noTasks) return { weight: -0.20, stale: { kind: 'no_activity', reason: 'zero_scans_zero_tasks' } };
  return { weight: 0, stale: null };
}

function _bandFor(score) {
  if (score >= 0.7) return SIGNAL_QUALITY.HIGH;
  if (score >= 0.45) return SIGNAL_QUALITY.MEDIUM;
  if (score >= 0.20) return SIGNAL_QUALITY.LOW;
  return SIGNAL_QUALITY.INSUFFICIENT;
}

function _confidenceFor(score, contributingCount) {
  if (score >= 0.7 && contributingCount >= 4) return 'high';
  if (score >= 0.45) return 'medium';
  return 'low';
}

/**
 * Score the supplied bundle of signals. Always returns frozen;
 * never throws.
 */
export function scoreSignalQuality(input) {
  return _safe(() => {
    const safe = _isObj(input) ? input : {};
    const now = _num(safe.nowMs) || Date.now();

    const scoreInputs = {
      weather:        _weatherSignal(safe, now),
      scans:          _scansSignal(safe),
      cropRegion:     _cropRegionSignal(safe),
      tasks:          _taskSignal(safe),
      outcomes:       _outcomeSignal(safe),
      continuity:     _continuitySignal(safe),
      offline:        _offlineFreshnessSignal(safe, now),
    };
    const combined = _combinedPenalty(scoreInputs);

    let score = 0;
    const contributingSignals = [];
    const staleSignals = [];
    const suppressedSignals = [];

    for (const [kind, slot] of Object.entries(scoreInputs)) {
      score += slot.weight;
      if (slot.weight > 0) {
        contributingSignals.push({ kind, weight: slot.weight });
      }
      if (slot.stale) {
        if (slot.weight < 0) suppressedSignals.push(slot.stale);
        else staleSignals.push(slot.stale);
      }
    }
    score += combined.weight;
    if (combined.stale) suppressedSignals.push(combined.stale);

    // Clamp + map.
    const trustScore = Math.max(0, Math.min(1, score));
    const signalQuality = _bandFor(trustScore);
    const confidence = _confidenceFor(trustScore, contributingSignals.length);

    return Object.freeze({
      engineVersion:        ENGINE_VERSION,
      signalQuality,
      trustScore:           Math.round(trustScore * 100) / 100,
      confidence,
      staleSignals:         Object.freeze(staleSignals.map(Object.freeze)),
      suppressedSignals:    Object.freeze(suppressedSignals.map(Object.freeze)),
      contributingSignals:  Object.freeze(contributingSignals.map(Object.freeze)),
      generatedAt:          Date.now(),
    });
  }, _emptyEnvelope());
}

function _emptyEnvelope() {
  return Object.freeze({
    engineVersion:       ENGINE_VERSION,
    signalQuality:       SIGNAL_QUALITY.INSUFFICIENT,
    trustScore:          0,
    confidence:          'low',
    staleSignals:        Object.freeze([]),
    suppressedSignals:   Object.freeze([]),
    contributingSignals: Object.freeze([]),
    generatedAt:         Date.now(),
  });
}

export const _internal = Object.freeze({
  _weatherSignal, _scansSignal, _cropRegionSignal,
  _taskSignal, _outcomeSignal, _continuitySignal,
  _offlineFreshnessSignal, _combinedPenalty, _bandFor, _confidenceFor,
  ENGINE_VERSION,
});

const _module = { scoreSignalQuality, SIGNAL_QUALITY, _internal };
export default _module;
