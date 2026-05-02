/**
 * scanSafetyFilter.js — last-mile sanitiser for the user-facing
 * scan verdict.
 *
 *   import { applySafetyFilter } from './scanSafetyFilter.js';
 *   const safeOutput = applySafetyFilter({
 *     possibleIssue, confidence, recommendedActions,
 *     urgency, followUpTask,
 *   });
 *
 * Spec §8 rules
 *   * Replace "disease detected" / "confirmed" / "diagnosis" /
 *     "guaranteed" with the safe "possible issue" framing.
 *   * Strip exact pesticide dosages from action strings (any
 *     numeric + unit pair like "20 ml" or "5 grams").
 *   * Always append the standard disclaimer.
 *   * Downgrade confidence to 'low' when the verdict is the
 *     unclear-image fallback (so the UI shows the right level
 *     of certainty even if a future provider over-reports).
 *   * Always include at least one practical next action (the
 *     followUpTask is the floor when recommendedActions is empty).
 *
 * Pure. Never throws. Idempotent — running output through the
 * filter again is a no-op.
 */

const DISCLAIMER =
  'Farroway provides guidance based on available information. '
  + 'Results are not guaranteed. For severe or spreading issues, '
  + 'contact a local expert.';

// Patterns we replace in any user-facing string.
const UNSAFE_PHRASES = Object.freeze([
  // word, replacement
  [/\bdisease\s+detected\b/gi,   'possible issue identified'],
  [/\bconfirmed\s+disease\b/gi,  'possible issue'],
  [/\bdefinitely\b/gi,           'possibly'],
  [/\bguaranteed\b/gi,           'likely'],
  [/\bguarantee\b/gi,            'likelihood'],
  [/\bdiagnosed?\b/gi,           'flagged'],
  [/\bdiagnosis\b/gi,            'guidance'],
  [/\bcertainly\b/gi,            'possibly'],
  [/\bwill\s+kill\b/gi,          'may help with'],
  [/\bcures?\b/gi,               'may help with'],
]);

// Strip exact dosages: "20 ml", "5 grams", "100 mg", "2 L", etc.
// Replaced with a generic "appropriate amount" so the action
// stays readable but the unsafe specificity is gone.
const DOSAGE_PATTERN =
  /\b\d+(?:\.\d+)?\s?(ml|millilit(?:re|er)s?|l\b|litres?|liters?|g\b|grams?|kg\b|kilograms?|mg|oz\b|teaspoons?|tablespoons?|tsp|tbsp|cup(?:s)?)\b/gi;

// Treatment-class spec §4: when an action mentions a SPECIFIC
// product (brand or active ingredient), rewrite to the safe
// class-only form. The first pattern that matches wins; the
// replacement is a complete sentence so even mid-paragraph
// mentions get cleanly rewritten.
const TREATMENT_CLASS_REWRITES = Object.freeze([
  [/\b(spray|apply|use)\s+([a-z\-]+\s+)?fungicides?\b[^.]*\.?/gi,
    'Use a locally approved fungicide for this crop and disease, and follow label instructions.'],
  [/\b(spray|apply|use)\s+([a-z\-]+\s+)?insecticides?\b[^.]*\.?/gi,
    'Use a locally approved insecticide for this crop and pest, and follow label instructions.'],
  [/\b(spray|apply|use)\s+([a-z\-]+\s+)?pesticides?\b[^.]*\.?/gi,
    'Use a locally approved pesticide for this crop, and follow label instructions.'],
  [/\b(spray|apply|use)\s+([a-z\-]+\s+)?herbicides?\b[^.]*\.?/gi,
    'Use a locally approved herbicide for this crop, and follow label instructions.'],
  // Active-ingredient names that occasionally leak out — every
  // mention rewrites to the same neutral instruction.
  [/\b(mancozeb|chlorothalonil|copper\s*(sulphate|hydroxide)|propiconazole|tebuconazole|azoxystrobin)\b[^.]*\.?/gi,
    'Use a locally approved fungicide for this crop and disease, and follow label instructions.'],
  [/\b(carbaryl|imidacloprid|cypermethrin|deltamethrin|malathion|chlorpyrifos|permethrin)\b[^.]*\.?/gi,
    'Use a locally approved insecticide for this crop and pest, and follow label instructions.'],
]);

function _scrub(text) {
  if (typeof text !== 'string' || !text) return text;
  let out = text;
  for (const [pattern, replacement] of UNSAFE_PHRASES) {
    out = out.replace(pattern, replacement);
  }
  // Treatment-class first-match: rewrite the whole sentence so
  // the action stays parsable to the UI.
  for (const [pattern, replacement] of TREATMENT_CLASS_REWRITES) {
    if (pattern.test(out)) {
      out = out.replace(pattern, replacement);
    }
    // Reset lastIndex so the next iteration scans the rewritten
    // text from the start (each pattern is global).
    pattern.lastIndex = 0;
  }
  out = out.replace(DOSAGE_PATTERN, 'appropriate amount');
  return out;
}

function _scrubArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((s) => _scrub(String(s || '')));
}

function _isUnclearVerdict(possibleIssue) {
  if (!possibleIssue) return true;
  const s = String(possibleIssue).toLowerCase();
  return s.includes('needs closer inspection') || s.includes('unknown');
}

/**
 * applySafetyFilter(verdict) → sanitized verdict.
 *
 * @param {object} verdict — output of contextFusionEngine + actions
 * @returns {object}
 */
export function applySafetyFilter(verdict = {}) {
  const safe = (verdict && typeof verdict === 'object') ? verdict : {};

  const possibleIssue = _scrub(String(safe.possibleIssue || 'Needs closer inspection'));

  let confidence = String(safe.confidence || 'low').toLowerCase();
  if (_isUnclearVerdict(possibleIssue) && confidence === 'high') {
    // Downgrade — no high confidence on the unclear branch.
    confidence = 'low';
  }
  if (confidence !== 'low' && confidence !== 'medium' && confidence !== 'high') {
    confidence = 'low';
  }

  let recommendedActions = _scrubArray(safe.recommendedActions);
  if (recommendedActions.length === 0 && safe.followUpTask && safe.followUpTask.title) {
    recommendedActions = [_scrub(String(safe.followUpTask.title))];
  }
  if (recommendedActions.length === 0) {
    // Always include at least one practical next action (spec §8).
    recommendedActions = ['Retake the photo in better light and check again tomorrow.'];
  }

  const reason = safe.reason ? _scrub(String(safe.reason)) : '';
  const urgency = String(safe.urgency || 'This week');

  const followUpTask = safe.followUpTask
    ? {
        ...safe.followUpTask,
        title:  _scrub(String(safe.followUpTask.title  || '')),
        reason: _scrub(String(safe.followUpTask.reason || '')),
      }
    : null;

  return {
    ...safe,
    possibleIssue,
    confidence,
    recommendedActions,
    reason,
    urgency,
    followUpTask,
    disclaimer: DISCLAIMER,
    safetyFiltered: true,
  };
}

export const _internal = Object.freeze({
  DISCLAIMER, UNSAFE_PHRASES, DOSAGE_PATTERN,
  TREATMENT_CLASS_REWRITES,
  _scrub, _isUnclearVerdict,
});

export default applySafetyFilter;
