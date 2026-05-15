/**
 * copilotSafety.js — the Farm Copilot Beta's output safety layer.
 *
 * The copilot answers from Farroway's deterministic context engines
 * (no open-internet LLM), so hallucination is already off the table.
 * This module is the second line of defence: it scrubs any answer
 * text for the four claim classes a farm assistant must never make,
 * and it gates a low-confidence note onto uncertain answers.
 *
 *   import { makeSafe, assessConfidence } from './copilotSafety.js';
 *
 *   const conf = assessConfidence(envelope);     // 'likely' | 'limited'
 *   const text = makeSafe(rawAnswer, { confidence: conf });
 *
 * Blocked claim classes (spec §8):
 *   1. Guaranteed-yield claims      ("will double your harvest")
 *   2. Financial promises           ("you will earn", "guaranteed profit")
 *   3. Absolute / medical certainty ("definitely blight", "100% sure")
 *   4. Unsafe chemical certainty    ("just spray X, it will fix it")
 *
 * Strict-rule audit
 *   • Pure. Never throws. No I/O, no React, SSR-safe.
 *   • Deterministic — same input, same output.
 *   • Softens rather than deletes: the farmer still gets a useful
 *     answer, just without the dangerous certainty.
 */

// The calm hedge appended when an answer is low-confidence. This is
// the exact spec §8 fallback phrasing.
export const LOW_CONFIDENCE_NOTE = 'This may need closer inspection.';

// Each rule: a matcher + the calmer replacement. Order matters —
// broader phrases first. Replacements keep the sentence readable.
const SCRUB_RULES = Object.freeze([
  // ── Guaranteed-yield / financial promises ──────────────────
  { re: /\b(guarantee|guaranteed|guarantees)\b/gi,             to: 'aims to help' },
  { re: /\byou will (earn|profit|make money)\b/gi,             to: 'you may earn' },
  { re: /\b(will|guaranteed to) (double|triple|increase) your (yield|harvest|income|profit)\b/gi,
    to: 'can support a better $3' },
  { re: /\b(certain|sure) profit\b/gi,                          to: 'possible income' },
  // ── Absolute / medical-style certainty ─────────────────────
  { re: /\b100% (sure|certain|safe|effective)\b/gi,             to: 'likely' },
  { re: /\b(definitely|certainly|absolutely)\b/gi,              to: 'likely' },
  { re: /\bthis is (definitely|certainly) (a |an )?/gi,         to: 'this looks like ' },
  { re: /\b(diagnos(is|ed|e))\b/gi,                             to: 'possible issue' },
  // ── Unsafe chemical certainty ──────────────────────────────
  { re: /\bjust spray\b/gi,                                     to: 'consider treating' },
  { re: /\b(will|definitely) (cure|fix|kill) (it|the disease|the pest)\b/gi,
    to: 'may help with $3' },
  { re: /\bsafe to (spray|apply) any\b/gi,                       to: 'check the label before applying any' },
]);

/** True when the text makes a banned claim that scrubbing changed. */
export function containsUnsafeClaim(text) {
  if (typeof text !== 'string' || !text) return false;
  for (const rule of SCRUB_RULES) {
    rule.re.lastIndex = 0;
    if (rule.re.test(text)) return true;
  }
  return false;
}

/** Scrub banned claim phrasings out of an answer. Pure. */
export function redactUnsafeClaims(text) {
  if (typeof text !== 'string' || !text) return '';
  let out = text;
  for (const rule of SCRUB_RULES) {
    rule.re.lastIndex = 0;
    out = out.replace(rule.re, rule.to);
  }
  return out.replace(/\s{2,}/g, ' ').trim();
}

/**
 * Map a response-engine envelope's confidenceTone to the copilot's
 * two-state confidence. Anything not clearly "likely" is treated as
 * limited so the calmer hedge is shown.
 *
 * @param {object} envelope  answerCommand() output
 * @returns {'likely'|'limited'}
 */
export function assessConfidence(envelope) {
  try {
    const tone = envelope && envelope.confidenceTone;
    return tone === 'likely' ? 'likely' : 'limited';
  } catch {
    return 'limited';
  }
}

/**
 * Produce the safe, farmer-facing answer string.
 *   • scrubs banned claims
 *   • appends the low-confidence note when confidence is limited
 *     and the note isn't already present
 *
 * @param {string} text
 * @param {object} [opts]
 * @param {'likely'|'limited'} [opts.confidence]
 * @returns {string}
 */
export function makeSafe(text, opts) {
  try {
    const confidence = (opts && opts.confidence) || 'likely';
    let out = redactUnsafeClaims(typeof text === 'string' ? text : '');
    if (!out) {
      // Never return an empty answer — fall back to the calm hedge.
      return LOW_CONFIDENCE_NOTE;
    }
    if (confidence === 'limited' && !out.includes(LOW_CONFIDENCE_NOTE)) {
      out = out.replace(/\s*$/, '') + ' ' + LOW_CONFIDENCE_NOTE;
    }
    return out;
  } catch {
    return LOW_CONFIDENCE_NOTE;
  }
}

const _module = {
  LOW_CONFIDENCE_NOTE,
  containsUnsafeClaim,
  redactUnsafeClaims,
  assessConfidence,
  makeSafe,
};
export default _module;
