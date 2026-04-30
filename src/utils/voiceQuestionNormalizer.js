/**
 * voiceQuestionNormalizer.js — split out from voiceEngine.js
 * to break the voiceEngine ↔ voiceIntents circular import that
 * was tripping a TDZ ('Cannot access X before initialization')
 * in the minified production bundle.
 *
 * Pure function — no DOM, no I/O. Used by:
 *   • voiceEngine.js  (re-exports for backwards compat)
 *   • voiceIntents.js (pattern-matching pipeline)
 */

// Common spoken filler words we drop before pattern matching.
// Keeps "Hey Farroway, please tell me, will it rain today?"
// → "tell me will it rain today" → matches the "will it rain"
// intent pattern cleanly.
const FILLER_WORDS = new Set([
  'please', 'farroway', 'hey', 'hi', 'hello', 'ok', 'um', 'uh',
  'so', 'just', 'kindly', 'pls', 'plz',
]);

/**
 * normalizeFarmerQuestion — lowercase + strip punctuation +
 * collapse whitespace + drop filler words. Always returns a
 * string (empty when input is empty).
 */
export function normalizeFarmerQuestion(text) {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .replace(/[\u2018\u2019\u201C\u201D]/g, "'")
    .replace(/[^a-z0-9\u00C0-\u024F\u0900-\u097F\u4e00-\u9fff'\s-]/gi, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !FILLER_WORDS.has(w))
    .join(' ')
    .trim();
}

export const _internal = Object.freeze({ FILLER_WORDS });
