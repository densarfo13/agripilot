/**
 * visualConsistencyRules — governance for inline styles in
 * active runtime files.
 *
 * Enforced patterns:
 *   • Locked Soft Ochre / Beige tokens only — see
 *     `src/design/tokens/colors.js` for the canonical table.
 *   • No legacy neon-green / dark-navy hex literals (caught by
 *     the existing `scripts/ci/check-garden-principles.mjs` and
 *     re-checked by the runExperienceAudit utility).
 *   • Restrained motion — animation durations capped at 240ms
 *     for the calm-default tier (180–220ms is the spec sweet
 *     spot; 240ms is the hard ceiling).
 *
 * Strict-rule audit
 *   • Pure data. Re-uses the existing FORBIDDEN_GARDEN_COLORS
 *     list rather than duplicating it.
 */

import {
  FORBIDDEN_GARDEN_COLORS as _FORBIDDEN_COLORS,
} from '../principles/gardenPrinciples.js';

// Re-export the locked forbidden-color list under the
// governance-shaped name. Single source of truth.
export const FORBIDDEN_COLORS = _FORBIDDEN_COLORS;

// Patterns that should NOT appear in inline-style strings
// across active surfaces. Used by the audit to flag drift.
//
// Intentionally conservative — false positives erode trust in
// the gate. We catch the unambiguous visual-noise signals here;
// stop-count and shadow-density rules are deferred to code
// review because their regex versions produce too much noise
// once you account for nested `rgba()` and compound shadows.
export const FORBIDDEN_VISUAL_PATTERNS = Object.freeze([
  Object.freeze({
    pattern: /\b(?:rgba?|hsla?)\(\s*0\s*,\s*255\s*,\s*0\b/i,
    reason:  'pure-green neon (lime)',
  }),
  Object.freeze({
    pattern: /#39FF14\b/i,
    reason:  'pure neon-green hex literal',
  }),
  Object.freeze({
    pattern: /\bneon[A-Z]/,
    reason:  'neon* keyword in inline style',
  }),
]);

// Animation budget — used by the audit as a soft warning when an
// inline `animation:` declaration exceeds the ceiling.
export const ANIMATION_BUDGET_MS = Object.freeze({
  calmDefault: 220,
  hardCeiling: 240,
});

/**
 * Quick checker — returns the forbidden color literals present
 * in the supplied source string. Pure / never throws.
 */
export function findForbiddenColors(src) {
  if (typeof src !== 'string' || !src) return [];
  const out = [];
  for (const entry of FORBIDDEN_COLORS) {
    if (src.indexOf(entry.literal) !== -1) {
      out.push({ literal: entry.literal, reason: entry.reason });
    }
  }
  return out;
}

export default Object.freeze({
  FORBIDDEN_COLORS,
  FORBIDDEN_VISUAL_PATTERNS,
  ANIMATION_BUDGET_MS,
  findForbiddenColors,
});
