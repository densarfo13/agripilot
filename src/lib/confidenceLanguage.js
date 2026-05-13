/**
 * confidenceLanguage.js — canonical farmer-language phrase library.
 *
 *   const phrase = mapToCalmPhrase({
 *     kind:       'risk_high:fungal',
 *     urgency:    'high',
 *     confidence: 'medium',
 *   });
 *   // → 'May need attention'
 *
 *   sanitizeConfidenceWording('72% confidence the disease is critical')
 *   // → 'May need attention'    (sanitised + clamped to a calm phrase)
 *
 * Why a single phrase library
 * ───────────────────────────
 *   The Clarity + Confidence + Action spec §3 lists the exact
 *   farmer-facing phrases the product wants on screen:
 *
 *     • "May need attention"
 *     • "Looks stable"
 *     • "Check again tomorrow"
 *     • "Good time to act"
 *     • "Conditions changed"
 *
 *   The intelligence stack already enforces "no fake X" and
 *   "no raw NDVI" rules, but each surface (agronomist reply,
 *   daily briefing, NBA normalizer, alert candidates, yield
 *   forecast) composes its own wording — close to the spec, but
 *   not identical. Drift accumulates: one card says "Watch
 *   closely," another says "Worth watching," a third says
 *   "Keep an eye on this." The farmer reads three different
 *   phrasings for the same calm signal.
 *
 *   This module is the single source of truth so every surface
 *   can adopt one import + emit ONE of five canonical phrases.
 *   Sanitisation also catches the kind of leaked technical
 *   wording the spec explicitly forbids:
 *
 *     "73% confidence the model says critical error" →
 *       'May need attention'
 *     "NDVI 0.42 indicates declining vegetation"     →
 *       'Conditions changed'
 *
 * Strict-rule audit
 *   • Pure functions. Never throw.
 *   • Constants frozen. No runtime mutation.
 *   • Forbidden-word filter is conservative: a string that
 *     contains 'critical' / 'NDVI' / a percent / 'confidence:'
 *     gets clamped to the closest calm phrase. Unrecognised input
 *     falls through to 'Looks stable' (the least-noisy default).
 */

// ─── The five canonical phrases ───────────────────────────────

export const CALM_PHRASES = Object.freeze({
  MAY_NEED_ATTENTION:   'May need attention',
  LOOKS_STABLE:         'Looks stable',
  CHECK_AGAIN_TOMORROW: 'Check again tomorrow',
  GOOD_TIME_TO_ACT:     'Good time to act',
  CONDITIONS_CHANGED:   'Conditions changed',
});

// Phrase the orchestrator's `kind` maps to. The orchestrator
// outputs kinds like 'crop_health' / 'severe_weather' / etc; this
// table is the canonical decoder.
const _KIND_TO_PHRASE = Object.freeze({
  crop_health:               CALM_PHRASES.MAY_NEED_ATTENTION,
  severe_weather:            CALM_PHRASES.CONDITIONS_CHANGED,
  urgent_task:               CALM_PHRASES.GOOD_TIME_TO_ACT,
  scan_followup:             CALM_PHRASES.CHECK_AGAIN_TOMORROW,
  yield_risk:                CALM_PHRASES.MAY_NEED_ATTENTION,
  pattern_worsening:         CALM_PHRASES.MAY_NEED_ATTENTION,
  health_urgent:             CALM_PHRASES.MAY_NEED_ATTENTION,
  market_opportunity:        CALM_PHRASES.GOOD_TIME_TO_ACT,
  buyer_opportunity:         CALM_PHRASES.GOOD_TIME_TO_ACT,
  funding_opportunity:       CALM_PHRASES.GOOD_TIME_TO_ACT,
  cooperative_opportunity:   CALM_PHRASES.GOOD_TIME_TO_ACT,
  encouragement:             CALM_PHRASES.LOOKS_STABLE,
  fallback_walk:             CALM_PHRASES.LOOKS_STABLE,
});

// Risk-kind prefixes (the orchestrator emits 'risk_high:fungal' etc).
const _RISK_PREFIX_PHRASE = Object.freeze({
  risk_high:    CALM_PHRASES.MAY_NEED_ATTENTION,
  risk_medium:  CALM_PHRASES.CHECK_AGAIN_TOMORROW,
});

// Forbidden patterns that flag wording as "needs sanitisation."
// We match case-insensitively. NDVI, raw percents, model jargon,
// "critical / fatal / error" language — anything the spec calls
// out as scary or technical.
const _FORBIDDEN_PATTERNS = Object.freeze([
  /\bNDVI\b/i,
  /\d+\s*%/,                              // any percent
  /\bconfidence\s*[:=]\s*\d/i,            // 'confidence: 73'
  /\b(?:critical|fatal|severe)\s+(?:error|alert|condition)\b/i,
  /\bmodel\s+(?:output|confidence|score)\b/i,
  /\b(?:dangerous|catastrophic|disastrous)\b/i,
  /\b0\.\d+\b/,                           // raw 0.42-style numeric
]);

// ─── Helpers ──────────────────────────────────────────────────

function _safeStr(v) {
  return String(v == null ? '' : v).trim();
}

function _isForbiddenWording(text) {
  if (!text) return false;
  for (const re of _FORBIDDEN_PATTERNS) {
    if (re.test(text)) return true;
  }
  return false;
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Map a structured signal to one of the five canonical phrases.
 *
 * @param {object} input
 * @param {string} [input.kind]        — orchestrator kind ('crop_health' etc)
 * @param {string} [input.urgency]     — 'high' | 'medium' | 'low'
 * @param {string} [input.confidence]  — 'high' | 'medium' | 'low'
 * @returns {string}                    one of CALM_PHRASES (always returns SOMETHING)
 */
export function mapToCalmPhrase(input) {
  const safe = (input && typeof input === 'object') ? input : {};
  const kind = _safeStr(safe.kind).toLowerCase();
  const urgency = _safeStr(safe.urgency).toLowerCase();
  const confidence = _safeStr(safe.confidence).toLowerCase();

  // Direct kind hit takes precedence.
  if (kind && _KIND_TO_PHRASE[kind]) return _KIND_TO_PHRASE[kind];

  // Risk-prefix kinds like 'risk_high:fungal'.
  if (kind) {
    const prefix = kind.split(':')[0];
    if (_RISK_PREFIX_PHRASE[prefix]) return _RISK_PREFIX_PHRASE[prefix];
  }

  // Urgency-driven fallback when no kind matched.
  if (urgency === 'high') return CALM_PHRASES.MAY_NEED_ATTENTION;
  if (urgency === 'medium') {
    return confidence === 'high'
      ? CALM_PHRASES.GOOD_TIME_TO_ACT
      : CALM_PHRASES.CHECK_AGAIN_TOMORROW;
  }
  if (urgency === 'low') return CALM_PHRASES.LOOKS_STABLE;

  // Truly nothing → the calmest default.
  return CALM_PHRASES.LOOKS_STABLE;
}

/**
 * Sanitise an existing string of farmer-facing wording. If the
 * string contains forbidden technical / scary language, replace
 * it with the closest calm phrase. If the input is already calm,
 * return it unchanged.
 *
 * @param {unknown} text
 * @param {object} [hint]  — optional { kind, urgency, confidence } to
 *                            improve replacement when sanitisation fires.
 * @returns {string}
 */
export function sanitizeConfidenceWording(text, hint) {
  const s = _safeStr(text);
  if (!s) return '';
  if (!_isForbiddenWording(s)) return s;
  // Forbidden wording detected — replace with canonical phrase.
  return mapToCalmPhrase(hint || {});
}

/**
 * Whether wording contains any forbidden technical/scary patterns.
 * Useful for guards + tests + linting.
 *
 * @param {unknown} text
 * @returns {boolean}
 */
export function hasForbiddenWording(text) {
  return _isForbiddenWording(_safeStr(text));
}

/**
 * Read-only access to the canonical phrase set.
 * @returns {string[]}
 */
export function getCalmPhraseList() {
  return Object.values(CALM_PHRASES).slice();
}

export default {
  CALM_PHRASES,
  mapToCalmPhrase,
  sanitizeConfidenceWording,
  hasForbiddenWording,
  getCalmPhraseList,
};
