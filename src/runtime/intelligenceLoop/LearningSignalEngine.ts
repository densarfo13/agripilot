/**
 * src/runtime/intelligenceLoop/LearningSignalEngine.ts —
 * Phase 6 (Learn). Structured signal store for future
 * intelligence work — explicitly NOT training ML now.
 *
 *   import {
 *     recordLearningSignal, listLearningSignals,
 *     learningSignalSnapshot, LEARNING_SIGNAL_ENGINE_VERSION,
 *   } from 'src/runtime/intelligenceLoop/LearningSignalEngine';
 *
 * What this file owns
 * ───────────────────
 *   Append-only signal log of {cropOrPlant, region,
 *   actionTaken, outcome, confidence, timestamp}. We DO NOT
 *   train any model; this is structured raw data for the
 *   future. Region is a COARSE code (e.g. 'us-maryland'), never
 *   exact GPS.
 *
 * Strict-rule audit
 *   • Pure runtime. SSR-safe. Never throws.
 *   • No PII. No fetch. No persistence writes.
 *   • Cap at 5000 in-memory signals to prevent runaway growth.
 */

export const LEARNING_SIGNAL_ENGINE_VERSION = 'loop-learning-signal-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _now = () => _safe(() => new Date().toISOString(), '');

const MAX_SIGNALS = 5000;

export interface LearningSignal {
  id:           string;
  cropOrPlant:  string;
  region:       string;
  actionTaken:  string;
  outcome:      string;
  confidence:   string;
  timestamp:    string;
}

const _signals: LearningSignal[] = [];

function _hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

interface SignalCtx {
  cropOrPlant: string;
  region?:     string;
  actionTaken: string;
  outcome:     string;
  confidence?: string;
}

export function recordLearningSignal(ctx: SignalCtx) {
  return _safe(() => {
    if (!_isObj(ctx)) {
      return Object.freeze({
        runtimeVersion: LEARNING_SIGNAL_ENGINE_VERSION,
        ok: false, reason: 'invalid_context', signal: null,
      });
    }
    const cropOrPlant = _str(ctx.cropOrPlant);
    const actionTaken = _str(ctx.actionTaken);
    const outcome     = _str(ctx.outcome);
    if (!cropOrPlant) {
      return Object.freeze({
        runtimeVersion: LEARNING_SIGNAL_ENGINE_VERSION,
        ok: false, reason: 'cropOrPlant_required', signal: null,
      });
    }
    if (!actionTaken || !outcome) {
      return Object.freeze({
        runtimeVersion: LEARNING_SIGNAL_ENGINE_VERSION,
        ok: false, reason: 'action_and_outcome_required', signal: null,
      });
    }
    const timestamp = _now();
    const id = 'signal_' + _hash(cropOrPlant + '|' + actionTaken
                + '|' + outcome + '|' + timestamp);
    const signal: LearningSignal = Object.freeze({
      id, cropOrPlant,
      region:      _str(ctx.region),
      actionTaken, outcome,
      confidence:  _str(ctx.confidence) || 'unknown',
      timestamp,
    });
    _signals.push(signal);
    // LRU-ish bounded growth.
    if (_signals.length > MAX_SIGNALS) {
      _signals.splice(0, _signals.length - MAX_SIGNALS);
    }
    return Object.freeze({
      runtimeVersion: LEARNING_SIGNAL_ENGINE_VERSION,
      ok: true, reason: '',
      signal,
    });
  }, Object.freeze({
    runtimeVersion: LEARNING_SIGNAL_ENGINE_VERSION,
    ok: false, reason: 'error', signal: null,
  }));
}

export function listLearningSignals(opts?: { limit?: number;
                                                cropOrPlant?: string;
                                                region?: string }):
    ReadonlyArray<LearningSignal> {
  return _safe(() => {
    const o = _isObj(opts) ? opts as any : {};
    const limit = typeof o.limit === 'number' ? o.limit : 200;
    const cop = _str(o.cropOrPlant);
    const region = _str(o.region);
    let pool = _signals;
    if (cop)    pool = pool.filter((s) => s.cropOrPlant === cop);
    if (region) pool = pool.filter((s) => s.region === region);
    return Object.freeze(pool.slice(-limit).map((s) =>
      Object.freeze({ ...s })));
  }, Object.freeze([] as LearningSignal[]));
}

export function learningSignalSnapshot() {
  return _safe(() => {
    const byOutcome: Record<string, number> = {};
    const byPlant:   Record<string, number> = {};
    const byRegion:  Record<string, number> = {};
    for (const s of _signals) {
      byOutcome[s.outcome]     = (byOutcome[s.outcome]     || 0) + 1;
      byPlant[s.cropOrPlant]   = (byPlant[s.cropOrPlant]   || 0) + 1;
      if (s.region) byRegion[s.region] = (byRegion[s.region] || 0) + 1;
    }
    return Object.freeze({
      runtimeVersion: LEARNING_SIGNAL_ENGINE_VERSION,
      total: _signals.length,
      capacity: MAX_SIGNALS,
      byOutcome: Object.freeze(byOutcome),
      byPlant:   Object.freeze(byPlant),
      byRegion:  Object.freeze(byRegion),
      // Honesty note — we are NOT training ML on these signals.
      // They are stored for future intelligence work; the
      // present app behaviour is fully deterministic.
      mlTraining: false,
    });
  }, Object.freeze({
    runtimeVersion: LEARNING_SIGNAL_ENGINE_VERSION,
    total: 0, capacity: MAX_SIGNALS,
    byOutcome: Object.freeze({}), byPlant: Object.freeze({}),
    byRegion: Object.freeze({}), mlTraining: false,
  }));
}

/** Test-only — wipe the signal log. */
export function _resetLearningSignals() {
  _signals.length = 0;
}
