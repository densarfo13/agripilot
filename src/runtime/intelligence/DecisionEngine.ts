/**
 * src/runtime/intelligence/DecisionEngine.ts — Action shaping
 * over OODA decisions.
 *
 *   import {
 *     shapeRecommendations, DECISION_ENGINE_VERSION,
 *   } from 'src/runtime/intelligence/DecisionEngine';
 *
 * What this file owns
 * ───────────────────
 *   Takes a raw OODA envelope and produces grower-safe
 *   recommendation text. The Decision Engine is the boundary
 *   between internal OODA output and external UI surfaces —
 *   raw OODA fields (confidence, likelyIssue, etc.) stay
 *   internal; only safe wording crosses into the grower view.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • No raw OODA text leaks to growers — every output runs
 *     through the safe-wording filter.
 *   • All copy is tSafe-compatible {key, fallback} envelopes.
 */

export const DECISION_ENGINE_VERSION = 'decision-engine-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr  = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

// Disallowed wording per the spec — replace with safe terms.
const FORBIDDEN_WORDS: Record<string, string> = Object.freeze({
  guaranteed: 'expected',
  confirmed:  'likely',
  certain:    'likely',
  proven:     'observed',
  cure:       'treatment',
  cures:      'treats',
  cured:      'treated',
});

function _scrubWording(text: string): string {
  if (!_str(text)) return '';
  return _str(text).replace(/[A-Za-z]+/g, (w) => {
    const lo = w.toLowerCase();
    if (FORBIDDEN_WORDS[lo]) {
      const safe = FORBIDDEN_WORDS[lo];
      return w[0] === w[0].toUpperCase()
        ? safe[0].toUpperCase() + safe.slice(1) : safe;
    }
    return w;
  });
}

/**
 * Take a raw OODA envelope and emit the grower-safe
 * recommendation list. Each entry is a tSafe-compatible
 * envelope ready for the existing recommendation card UI.
 */
export function shapeRecommendations(oodaResult: any) {
  return _safe(() => {
    if (!_isObj(oodaResult)) {
      return Object.freeze({
        runtimeVersion: DECISION_ENGINE_VERSION,
        recommendations: Object.freeze([]),
      });
    }
    const tasks = _arr(oodaResult.recommendedTasks);
    const out: any[] = [];
    for (const t of tasks) {
      const label = _str(t && t.labelDefault);
      const safe  = _scrubWording(label);
      out.push(Object.freeze({
        labelKey:     _str(t && t.labelKey),
        labelDefault: safe || label || 'Recommended action',
        priority:     _str(t && t.priority) || 'low',
        source:       _str(t && t.source) || 'ooda',
      }));
    }
    return Object.freeze({
      runtimeVersion: DECISION_ENGINE_VERSION,
      recommendations: Object.freeze(out),
    });
  }, Object.freeze({
    runtimeVersion: DECISION_ENGINE_VERSION,
    recommendations: Object.freeze([]),
  }));
}

export { _scrubWording as _scrubWordingForTests };
