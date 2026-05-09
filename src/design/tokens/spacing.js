/**
 * design/tokens/spacing — locked spacing scale.
 *
 * Spec §4: 4 / 8 / 12 / 16 / 24 / 32 / 48.
 * Components MUST pick one of these values. Bespoke pixels are
 * a code-review red flag.
 *
 * EXPORT SHAPE
 *   • `SPACING.s4`–`s48`  → integers (px), use directly in style objects.
 *   • `SPACING.css.s4`–   → `'4px'` strings for CSS template literals.
 *   • `gap()` / `pad()`   → tiny helpers for inline-style ergonomics.
 */

export const SPACING = Object.freeze({
  s4:  4,
  s8:  8,
  s12: 12,
  s16: 16,
  s24: 24,
  s32: 32,
  s48: 48,
  // CSS-string aliases for callers that build style strings.
  css: Object.freeze({
    s4:  '4px',
    s8:  '8px',
    s12: '12px',
    s16: '16px',
    s24: '24px',
    s32: '32px',
    s48: '48px',
  }),
});

/**
 * Build a `gap` value snapped to the spacing scale. Falls back
 * to `s16` on bad input.
 *
 * @param {number} step  — one of 4/8/12/16/24/32/48
 * @returns {string}     — `'16px'`-style value
 */
export function gap(step) {
  const allowed = [4, 8, 12, 16, 24, 32, 48];
  return (allowed.includes(step) ? step : 16) + 'px';
}

/**
 * Build a CSS shorthand for `padding: y x` snapped to the scale.
 *
 * @param {number} y
 * @param {number} [x=y]
 * @returns {string}
 */
export function pad(y, x = y) {
  return gap(y) + ' ' + gap(x);
}

export default SPACING;
