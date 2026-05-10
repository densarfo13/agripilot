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

export interface ForbiddenTonePattern {
  readonly pattern: string;
  readonly principle: string;
  readonly tone: string;
}

export interface ToneViolation {
  readonly pattern: string;
  readonly principle: string;
  readonly tone: string;
  readonly match: string;
}

// Re-export under the governance-shaped names.
export const FORBIDDEN_TONE_PATTERNS: ReadonlyArray<ForbiddenTonePattern> =
  _FORBIDDEN_WORDS as ReadonlyArray<ForbiddenTonePattern>;

/**
 * Pure tone softener. Returns the rewritten string with farm-style
 * operational copy adapted to the gardener register. Falls through
 * to the original text when nothing matches.
 */
export const softenForGarden: (text: string) => string = _soften;

/**
 * Find every forbidden tone pattern that matches the supplied
 * text. Returns an array of { pattern, principle, tone, match }.
 */
export const findToneViolations: (text: string) => ToneViolation[] =
  _findViolations as (text: string) => ToneViolation[];

/**
 * Boolean convenience for inline assertions.
 */
export function isToneViolation(text: string): boolean {
  return findToneViolations(text).length > 0;
}

export default Object.freeze({
  FORBIDDEN_TONE_PATTERNS,
  softenForGarden,
  findToneViolations,
  isToneViolation,
});
