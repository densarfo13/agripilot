/**
 * FarrowayLogo — v6 brand mark, redrawn April 2026 to match the
 * supplied brand asset exactly:
 *
 *   * Tilted leaf silhouette — pointed top-right tip, rounded
 *     bottom curving back up the right side.
 *   * THREE colour zones inside the leaf:
 *       1. lighter-green band hugging the upper-right tip
 *          (#A3E635 — brand lightGreen)
 *       2. medium green main body (#22C55E — brand green)
 *       3. WHITE wedge in the lower-left (#FFFFFF)
 *   * Solid dark-navy arrow (#0B1220) painted on top, curving
 *     from the lower-left of the leaf up through the white wedge
 *     and into the green body, ending in a chevron arrowhead at
 *     the upper-right tip.
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
 *   * Accessibility: <svg role="img"> + <title>.
 *   * Stable IDs prefixed with the component name so multiple
 *     instances on the same page never collide on clip-path refs.
 */

import React from 'react';
import { FARROWAY_BRAND } from '../brand/farrowayBrand.js';

const C = FARROWAY_BRAND.colors;

let _uid = 0;
function nextId(prefix) {
  _uid += 1;
  return `${prefix}_${_uid}`;
}

/**
 * The bare leaf mark — no wordmark, no tile.
 * viewBox 0 0 100 100.
 */
export function FarrowayMark({
  size = 32,
  tileVariant = 'none', // 'none' | 'light' | 'dark'
  ariaLabel = 'Farroway',
  style,
  ...rest
}) {
  const clipId = React.useMemo(() => nextId('farrowayLeaf'), []);

  const tileFill =
    tileVariant === 'dark'  ? C.navy  :
    tileVariant === 'light' ? C.white : null;

  // Tilted leaf silhouette. Pointed top-right tip ~(88, 14),
  // bulging upper-left around (10, 50), rounded bottom curve
  // through (28, 90), back up the right side.
  const LEAF_PATH =
    'M 88 14 '
    + 'Q 70 6, 48 12 '
    + 'Q 22 22, 10 50 '
    + 'Q 4 80, 28 90 '
    + 'Q 50 92, 66 76 '
    + 'Q 82 56, 88 14 Z';

  // Dark navy arrow drawn as a single filled polygon so the
  // shaft + chevron head read as one confident shape (matches
  // the supplied brand asset). The polygon outlines the shaft
  // along its lower edge, flares at the back-bottom of the
  // arrowhead, runs to the tip, comes back through the
  // back-top flange, then returns along the shaft's upper
  // edge to close at the tail.
  //
  //          tip (80, 14)
  //         /│
  //  (60,18)*│  ← back-top flange
  //         \│
  //          *(70, 28)  ← shaft-top meets head
  //           \
  //            \  shaft (curved by sequential L points)
  //             \
  //              *(34, 70)
  //              /
  //  tail (22, 78)
  //              \
  //               *(28, 84)  ← tail bottom
  //              /
  //             /
  //            /  shaft underside
  //           /
  //          *(76, 36)  ← shaft-bottom meets head
  //         /│
  //  (66,38)*│  ← back-bottom flange
  //         \│
  //          → back to tip
  const ARROW_POINTS =
      '80,14 '       // tip
    + '60,18 '       // back-top flange
    + '70,28 '       // shaft-top meets head
    + '34,70 '       // shaft top-edge tail
    + '22,78 '       // tail
    + '28,84 '       // tail bottom
    + '40,72 '       // shaft bottom-edge
    + '76,36 '       // shaft-bottom meets head
    + '66,38';       // back-bottom flange

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

      <defs>
        <clipPath id={clipId}>
          <path d={LEAF_PATH} />
        </clipPath>
      </defs>

      {/* Optional rounded-square tile (app-icon variants). */}
      {tileFill && (
        <rect
          x="0" y="0" width="100" height="100"
          rx="22" ry="22"
          fill={tileFill}
        />
      )}

      {/* Three-zone leaf composition. Polygons extend past the
          leaf bounds; the clipPath trims them to the silhouette. */}
      <g clipPath={`url(#${clipId})`}>
        {/* 1. Medium green base — fills the whole leaf */}
        <rect x="0" y="0" width="100" height="100" fill={C.green} />

        {/* 2. Lighter-green band hugging the upper-right tip.
              Cut runs from (-10, 32) to (110, 6) so the band
              sits along the top of the leaf. */}
        <polygon
          points="-10,-20 110,-20 110,6 -10,32"
          fill={C.lightGreen}
        />

        {/* 3. White wedge — slants up to the right so it sits
              in the lower-LEFT of the leaf. Cut runs from
              (-10, 86) to (110, 46). */}
        <polygon
          points="-10,86 110,46 110,120 -10,120"
          fill={C.white}
        />
      </g>

      {/* Dark navy arrow — single filled polygon (shaft + chevron
          head) painted on top of the leaf so it reads cleanly
          across both the green portion AND the white wedge. */}
      <polygon
        points={ARROW_POINTS}
        fill={C.navy}
        stroke={C.navy}
        strokeWidth="0.6"
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
