/**
 * FarrowayLogo — v5 brand mark, redrawn April 2026 to match the
 * supplied brand-asset reference exactly:
 *
 *   * Vertical pointed-oval leaf (almond shape) — sharp top tip,
 *     softly pointed base, symmetric flanks.
 *   * Dark-green stroke around the outside (#15803D) so the
 *     leaf stays defined on light AND dark surfaces.
 *   * Brand-green interior fill (#22C55E).
 *   * Solid white upward arrow (shaft + triangular head) painted
 *     on top of the leaf body, pointing up-and-to-the-right.
 *
 * The mark is self-contained — its own outline + interior keep
 * it readable on a navy tile, a white page, or a dashboard panel
 * without recolouring.
 *
 * Two-tone tagline support: "Know what to do." (navy on light
 * surfaces, white on dark) + "Grow better." (always green).
 *
 * App-icon contexts wrap the bare mark in a rounded square tile
 * via `tileVariant="light"` or `"dark"`. The PRIMARY logo is
 * the bare leaf — no tile.
 *
 * Backwards-compatible API:
 *   size       — icon edge in px (default 32)
 *   showText   — wordmark on/off (default true)
 *   textColor  — explicit wordmark colour (overrides variant)
 *   variant    — "onDark" (white wordmark) | "onLight" (navy)
 *   iconOnly   — alias for showText={false}
 *   withTile   — legacy alias; if true, behaves like
 *                tileVariant="dark"
 *   tileVariant — "none" (default) | "light" | "dark"
 *   showTagline — render the two-tone tagline beneath the
 *                 wordmark (default false)
 *
 * Strict-rule audit
 *   * Inline SVG — no second network request.
 *   * Single mark, two surface contexts — no recolouring needed.
 *   * Accessibility: <svg role="img"> + <title>.
 */

import React from 'react';
import { FARROWAY_BRAND } from '../brand/farrowayBrand.js';

const C = FARROWAY_BRAND.colors;

/**
 * The bare leaf mark — no wordmark, no tile.
 *
 * viewBox is 0 0 100 100. Coordinates tuned so the mark stays
 * crisp from ~20 px (sidebar) up to 192 px (PWA tile).
 */
export function FarrowayMark({
  size = 32,
  tileVariant = 'none', // 'none' | 'light' | 'dark'
  ariaLabel = 'Farroway',
  style,
  ...rest
}) {
  const tileFill =
    tileVariant === 'dark'  ? C.navy  :
    tileVariant === 'light' ? C.white : null;

  // Vertical pointed-oval leaf.
  //   * Top tip:    (50, 6)   — sharp
  //   * Widest:     y ≈ 52
  //   * Base tip:   (50, 96)  — softly pointed
  // Symmetric quadratic curves so the silhouette reads as a
  // simple, recognisable leaf at every render size.
  const LEAF_PATH =
    'M 50 6 '
    + 'Q 18 18, 12 52 '
    + 'Q 18 88, 50 96 '
    + 'Q 82 88, 88 52 '
    + 'Q 82 18, 50 6 Z';

  // White arrow painted on top of the leaf body. Drawn as a
  // single filled polygon so the head + shaft read as one
  // confident shape (matches the supplied brand asset).
  //
  // Geometry:
  //                         tip (78, 18)
  //                        /
  //              (66, 18)*--*(72, 30)   outer / inner head edges
  //                       \  \
  //                        \  \
  //                shaft thick band
  //                  \      \
  //                   *(34, 70)
  //                   |
  //                  *(26, 78)  — base
  //
  const ARROW_PATH =
    'M 26 78 '
    + 'L 36 64 '
    + 'L 60 30 '   // up the lower flank of the shaft to head base
    + 'L 56 26 '   // back-bottom flange of arrowhead
    + 'L 80 16 '   // tip of the arrow
    + 'L 70 40 '   // back-top flange of arrowhead
    + 'L 66 36 '
    + 'L 42 70 '   // down the upper flank of the shaft
    + 'L 32 84 '
    + 'Z';

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', flexShrink: 0, ...(style || {}) }}
      {...rest}
    >
      <title>{ariaLabel}</title>

      {/* Optional rounded-square tile (app-icon variants). */}
      {tileFill && (
        <rect
          x="0" y="0" width="100" height="100"
          rx="22" ry="22"
          fill={tileFill}
        />
      )}

      {/* Leaf body — bright green fill with a dark-green outline
          so the silhouette holds on every backdrop. */}
      <path
        d={LEAF_PATH}
        fill={C.green}
        stroke={C.darkGreen}
        strokeWidth="5"
        strokeLinejoin="round"
      />

      {/* White upward arrow — confident, single filled shape. */}
      <path
        d={ARROW_PATH}
        fill={C.white}
        stroke={C.white}
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Legacy export name preserved so any caller still importing
// `FarrowayIcon` keeps working.
export const FarrowayIcon = FarrowayMark;

/**
 * Full lockup: mark + Farroway wordmark + (optional) two-tone
 * tagline.
 */
export default function FarrowayLogo({
  size       = 32,
  showText   = true,
  textColor,
  variant    = 'onDark',
  iconOnly   = false,
  withTile,                   // legacy: maps to tileVariant
  tileVariant,                // 'none' | 'light' | 'dark'
  showTagline = false,
  ...rest
}) {
  const effectiveTile =
    tileVariant
      ? tileVariant
      : (withTile === true ? 'dark' : 'none');

  const onDark = variant !== 'onLight';
  const wordmarkColor = textColor
    || (onDark ? C.white : C.navy);

  const taglinePrimary  = onDark ? C.white : C.navy;
  const taglineAccent   = C.green;

  const renderText = showText && !iconOnly;
  const fontStack =
    'Inter, system-ui, -apple-system, "Segoe UI", Roboto, '
    + '"Helvetica Neue", Arial, sans-serif';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: showTagline ? 'center' : 'center',
        gap: Math.max(8, Math.round(size * 0.32)),
        lineHeight: 1,
      }}
      {...rest}
    >
      <FarrowayMark size={size} tileVariant={effectiveTile} />

      {renderText && (
        <span
          style={{
            display: 'inline-flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: Math.max(2, Math.round(size * 0.08)),
          }}
        >
          <span
            style={{
              fontSize: Math.round(size * 0.95),
              fontWeight: 800,
              color: wordmarkColor,
              letterSpacing: '-0.02em',
              whiteSpace: 'nowrap',
              fontFamily: fontStack,
              lineHeight: 1,
            }}
          >
            Farroway
          </span>

          {showTagline && (
            <span
              style={{
                fontSize: Math.round(size * 0.34),
                fontWeight: 500,
                whiteSpace: 'nowrap',
                fontFamily: fontStack,
                lineHeight: 1.1,
                marginTop: Math.round(size * 0.08),
              }}
            >
              <span style={{ color: taglinePrimary }}>
                Know what to do.
              </span>
              {' '}
              <span style={{ color: taglineAccent, fontWeight: 700 }}>
                Grow better.
              </span>
            </span>
          )}
        </span>
      )}
    </span>
  );
}
