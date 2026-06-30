/**
 * breakpoints.js — canonical mobile-first responsive breakpoints + the content
 * grid max-width. Farroway is a phone-first PWA: the default styles target the
 * smallest screen, and these are the only widths a component may branch on.
 *
 *   import { BREAKPOINTS, GRID } from 'src/design/tokens';
 *
 * RULES
 *   • Mobile-first: write the base style for `phone`, widen at `tablet`/`desktop`.
 *   • Components MUST read these — no ad-hoc `@media (max-width: 412px)` literals.
 *   • Frozen so the shared shape can't be mutated by a consumer.
 */
export const BREAKPOINTS = Object.freeze({
  phone:   0,     // base (mobile-first default)
  phoneLg: 412,   // large phones (Pixel / iPhone Pro Max)
  tablet:  768,   // tablets / split view
  desktop: 1024,  // desktop / wide
  // px-string mirrors for CSS template literals.
  css: Object.freeze({
    phoneLg: '412px', tablet: '768px', desktop: '1024px',
  }),
  // Ready-made min-width media queries.
  up: Object.freeze({
    phoneLg: '@media (min-width: 412px)',
    tablet:  '@media (min-width: 768px)',
    desktop: '@media (min-width: 1024px)',
  }),
});

/** Canonical content grid — the column width every screen's shell is capped to. */
export const GRID = Object.freeze({
  maxWidth:   '32rem',   // 512px — the locked phone-first content column (matches Home shell)
  gutter:     16,        // px — page side padding
  columnGap:  12,        // px — card-to-card vertical rhythm
});

export default BREAKPOINTS;
