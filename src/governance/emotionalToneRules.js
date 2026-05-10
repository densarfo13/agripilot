/**
 * emotionalToneRules — governance for user-facing copy across
 * UI, notifications, scan results, and recommendations.
 *
 * Tone contract:
 *   • Calm, grounded, observational, reassuring.
 *   • Never alarmist, AI-hyped, enterprise-toned, or productivity-
 *     aggressive.
 *
 * This module wires together the existing pieces into one canonical
 * surface:
 *   • FORBIDDEN_GARDEN_WORDS  — locked regex list of alarm/jargon
 *                               patterns (lives in gardenPrinciples)
 *   • softenForGarden(text)   — gardener-tone substitution layer
 *                               (lives in scanResultPolicy)
 *
 * Strict-rule audit
 *   • Pure / no I/O. Frozen exports.
 *   • Re-exports rather than duplicates so a single edit to the
 *     forbidden list propagates everywhere.
 */

import {
  FORBIDDEN_GARDEN_WORDS as _FORBIDDEN_WORDS,
  findGardenViolations  as _findViolations,
} from '../principles/gardenPrinciples.js';
import { softenForGarden as _soften } from '../core/scanResultPolicy.js';

// Re-export under the governance-shaped names.
export const FORBIDDEN_TONE_PATTERNS = _FORBIDDEN_WORDS;

/**
 * Pure tone softener. Returns the rewritten string with farm-style
 * operational copy adapted to the gardener register. Falls through
 * to the original text when nothing matches.
 *
 * @param {string} text
 * @returns {string}
 */
export const softenForGarden = _soften;

/**
 * Find every forbidden tone pattern that matches the supplied
 * text. Returns an array of { pattern, principle, tone, match }.
 *
 * @param {string} text
 */
export const findToneViolations = _findViolations;

/**
 * Boolean convenience for inline assertions.
 */
export function isToneViolation(text) {
  return findToneViolations(text).length > 0;
}

export default Object.freeze({
  FORBIDDEN_TONE_PATTERNS,
  softenForGarden,
  findToneViolations,
  isToneViolation,
});
