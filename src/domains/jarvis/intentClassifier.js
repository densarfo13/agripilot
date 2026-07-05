/**
 * intentClassifier.js — Jarvis MVP classifier (honest kernel).
 *
 * Pure keyword scoring against intents.js. No cloud NLP, no generation, no learning.
 * Below CONFIDENCE_THRESHOLD it returns UNKNOWN so the UI asks a clarifying question
 * instead of guessing — a wrong route erodes trust faster than a question.
 */
import { KEYWORDS, CONFIDENCE_THRESHOLD } from './intents.js';

function _norm(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[.,!?;:"“”'’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * classify(text) → { intent, score, matched }
 * Deterministic: highest score wins; ties broken by intent table order.
 */
export function classify(text) {
  const t = _norm(text);
  if (!t) return Object.freeze({ intent: 'UNKNOWN', score: 0, matched: [] });

  // Whole-word matching (space-padded includes) — plain substring matching caused
  // cross-language bleed, e.g. Hausa 'rance' (loan) inside English 'insuRANCE'.
  const padded = ' ' + t + ' ';
  const hit = (kw) => padded.includes(' ' + kw + ' ');

  let best = { intent: 'UNKNOWN', score: 0, matched: [] };
  for (const [intent, words] of Object.entries(KEYWORDS)) {
    let score = 0;
    const matched = [];
    for (const [kw, weight] of words) {
      if (hit(kw)) { score += weight; matched.push(kw); }
    }
    if (score > best.score) best = { intent, score, matched };
  }
  if (best.score < CONFIDENCE_THRESHOLD) {
    return Object.freeze({ intent: 'UNKNOWN', score: best.score, matched: best.matched });
  }
  return Object.freeze(best);
}

export default classify;
