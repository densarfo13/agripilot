/**
 * visualConsistencyRules — governance for inline styles in
 * active runtime files.
 *
 * Enforced patterns:
 *   • Locked Soft Ochre / Beige tokens only — see
 *     `src/design/tokens/colors.js` for the canonical table.
 *   • No legacy neon-green / dark-navy hex literals.
 *   • Restrained motion — animation durations capped at 240ms
 *     for the calm-default tier (180–220ms is the spec sweet
 *     spot; 240ms is the hard ceiling).
 *   • Linear gradients with > 3 color stops are visual noise.
 *     The check is parens-aware so nested `rgba(…)` doesn't
 *     trigger false positives.
 *
 * Strict-rule audit
 *   • Pure data + thin helpers. Re-uses the existing
 *     FORBIDDEN_GARDEN_COLORS list rather than duplicating it.
 */

import {
  FORBIDDEN_GARDEN_COLORS as _FORBIDDEN_COLORS,
} from '../principles/gardenPrinciples.js';

export interface ForbiddenColor {
  readonly literal: string;
  readonly reason: string;
}

export interface ForbiddenVisualPattern {
  readonly pattern: RegExp;
  readonly reason: string;
}

// Re-export the locked forbidden-color list under the
// governance-shaped name. Single source of truth.
export const FORBIDDEN_COLORS: ReadonlyArray<ForbiddenColor> =
  _FORBIDDEN_COLORS as ReadonlyArray<ForbiddenColor>;

// Patterns that should NOT appear in inline-style strings
// across active surfaces. Used by the audit to flag drift.
//
// Intentionally conservative — false positives erode trust in
// the gate. Stop-count and shadow-density rules use parens-aware
// helpers below rather than regex so nested rgba() doesn't
// over-fire.
export const FORBIDDEN_VISUAL_PATTERNS: ReadonlyArray<ForbiddenVisualPattern> = Object.freeze([
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
] as ReadonlyArray<ForbiddenVisualPattern>);

// Animation budget — used by the audit as a soft warning when an
// inline `animation:` declaration exceeds the ceiling.
export const ANIMATION_BUDGET_MS = Object.freeze({
  calmDefault: 220,
  hardCeiling: 240,
});

// Maximum color stops allowed inside a single linear-gradient(…).
// 2 stops is the canonical button gradient; the page wash uses 2.
// 3 is acceptable for atmospheric tints. Anything > 3 is noise.
export const MAX_GRADIENT_STOPS = 3;

/**
 * Quick checker — returns the forbidden color literals present
 * in the supplied source string. Pure / never throws.
 */
export function findForbiddenColors(src: string | null | undefined): Array<{ literal: string; reason: string }> {
  if (typeof src !== 'string' || !src) return [];
  const out: Array<{ literal: string; reason: string }> = [];
  for (const entry of FORBIDDEN_COLORS) {
    if (src.indexOf(entry.literal) !== -1) {
      out.push({ literal: entry.literal, reason: entry.reason });
    }
  }
  return out;
}

/**
 * Count color stops inside a single `linear-gradient(...)` call.
 * Parens-aware so nested `rgba(…)` commas don't inflate the
 * count. The first comma-separated token is the direction
 * (`180deg`, `to bottom`); the rest are stops.
 *
 *   countGradientStops('linear-gradient(180deg, #aaa 0%, #bbb 100%)')
 *     → 2
 *
 *   countGradientStops(
 *     'linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.04) 100%)'
 *   )
 *     → 2
 */
export function countGradientStops(gradientCallSrc: string): number {
  if (typeof gradientCallSrc !== 'string') return 0;
  const open = gradientCallSrc.indexOf('(');
  if (open < 0) return 0;
  // Find the matching close paren, respecting nested parens.
  let depth = 0;
  let close = -1;
  for (let i = open; i < gradientCallSrc.length; i++) {
    const ch = gradientCallSrc.charCodeAt(i);
    if (ch === 40 /* ( */) depth += 1;
    else if (ch === 41 /* ) */) {
      depth -= 1;
      if (depth === 0) { close = i; break; }
    }
  }
  if (close < 0) return 0;
  const inner = gradientCallSrc.slice(open + 1, close);
  // Split on commas at depth 0.
  const tokens: string[] = [];
  let bufStart = 0;
  let nesting  = 0;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner.charCodeAt(i);
    if (ch === 40) nesting += 1;
    else if (ch === 41) nesting -= 1;
    else if (ch === 44 /* , */ && nesting === 0) {
      tokens.push(inner.slice(bufStart, i));
      bufStart = i + 1;
    }
  }
  tokens.push(inner.slice(bufStart));
  // First token is direction; the rest are stops. A bare list
  // (no direction) is rare in our codebase but we treat all
  // tokens as stops then.
  if (tokens.length === 0) return 0;
  const direction = tokens[0].trim().toLowerCase();
  const isDirection = /^\d/.test(direction)
    || direction.startsWith('to ')
    || direction.endsWith('deg')
    || direction.endsWith('turn')
    || direction.endsWith('rad')
    || direction.endsWith('grad');
  return isDirection ? tokens.length - 1 : tokens.length;
}

/**
 * Find every `linear-gradient(...)` call in `src` whose stop
 * count exceeds `MAX_GRADIENT_STOPS`. Returns the offending
 * gradient text + stop count. Parens-aware via countGradientStops.
 */
export function findGradientStopViolations(src: string): Array<{ excerpt: string; stops: number }> {
  if (typeof src !== 'string' || !src) return [];
  const out: Array<{ excerpt: string; stops: number }> = [];
  const re = /linear-gradient\(/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) != null) {
    // Find the matching close paren respecting nesting.
    let depth = 0;
    let close = -1;
    for (let i = m.index + 'linear-gradient'.length; i < src.length; i++) {
      const ch = src.charCodeAt(i);
      if (ch === 40) depth += 1;
      else if (ch === 41) {
        depth -= 1;
        if (depth === 0) { close = i; break; }
      }
    }
    if (close < 0) break;
    const excerpt = src.slice(m.index, close + 1);
    const stops = countGradientStops(excerpt);
    if (stops > MAX_GRADIENT_STOPS) {
      out.push({ excerpt: excerpt.slice(0, 140), stops });
    }
    re.lastIndex = close + 1;
  }
  return out;
}

export default Object.freeze({
  FORBIDDEN_COLORS,
  FORBIDDEN_VISUAL_PATTERNS,
  ANIMATION_BUDGET_MS,
  MAX_GRADIENT_STOPS,
  findForbiddenColors,
  countGradientStops,
  findGradientStopViolations,
});
