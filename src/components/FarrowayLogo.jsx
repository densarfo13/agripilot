/**
 * FarrowayLogo — v7 brand mark, redrawn April 2026 to better
 * match the supplied brand asset.
 *
 * If you have the brand asset as a finished SVG / PNG and
 * want pixel-perfect fidelity, drop it in at
 *   public/icons/farroway-mark.svg
 * and either:
 *   1. Replace the contents of `FarrowayMark` below with
 *      <img src="/icons/farroway-mark.svg" ... /> — the
 *      lockup, props, and tile variants will keep working.
 *   2. Or paste the new SVG path data into LEAF_PATH /
 *      ARROW_PATH below.
 *
 * Composition (v7):
 *   * Vertical pointed-oval leaf — sharp tip at top, softer
 *     point at the base, widest near the middle.
 *   * Darker-green outline around the leaf edge so the
 *     silhouette has depth on both light and dark surfaces.
 *   * Bright brand-green fill with a faint lighter-green
 *     highlight along the upper-right edge.
 *   * White triangular wedge cutting into the lower-left of
 *     the leaf body.
 *   * Solid dark-navy chevron arrow painted on top, running
 *     from the lower-left up through the white wedge to a
 *     finned arrowhead near the upper-right of the leaf.
 *
 * API and tile variants are unchanged from v6 — props, the
 * full lockup, and the tagline composition all keep working.
 */

import React from 'react';
import { FARROWAY_BRAND } from '../brand/farrowayBrand.js';

const C = FARROWAY_BRAND.colors;

let _uid = 0;
function nextId(prefix) {
  _uid += 1;
  return `${prefix}_${_uid}`;
}

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

  // Vertical pointed-oval leaf. Sharp tip at top (50, 6);
  // widest around y ≈ 50; softly pointed base at (50, 94).
  const LEAF_PATH =
    'M 50 6 '
    + 'Q 22 14, 14 46 '   // upper-left curve down to widest
    + 'Q 12 82, 50 94 '   // lower-left curve to base
    + 'Q 88 82, 86 46 '   // lower-right curve up
    + 'Q 78 14, 50 6 Z';  // upper-right curve back to top

  // Solid dark arrow as a single filled polygon. Runs from
  // the lower-left of the leaf to the upper-right tip with a
  // chevron-style head.
  const ARROW_POINTS =
      '78,16 '       // tip (top-right)
    + '60,18 '       // back-top flange
    + '70,28 '       // shaft-top meets head
    + '34,66 '       // shaft top-edge tail
    + '24,76 '       // tail (bottom-left)
    + '30,82 '       // tail bottom
    + '40,72 '       // shaft bottom-edge
    + '76,34 '       // shaft-bottom meets head
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

      {/* Dark-green outline behind the fill so the leaf has a
          visible edge. Drawn first; the clipped fill overlays
          it, leaving a thin outline visible around the path. */}
      <path
        d={LEAF_PATH}
        fill="none"
        stroke={C.darkGreen}
        strokeWidth="5"
        strokeLinejoin="round"
      />

      {/* Leaf interior — three zones clipped to the silhouette. */}
      <g clipPath={`url(#${clipId})`}>
        {/* 1. Bright green base fills the whole leaf. */}
        <rect x="0" y="0" width="100" height="100" fill={C.green} />

        {/* 2. Faint lighter-green highlight along the upper
              edge — gives the leaf a subtle gradient instead
              of a flat fill. */}
        <polygon
          points="-10,-10 110,-10 110,8 -10,28"
          fill={C.lightGreen}
          opacity="0.55"
        />

        {/* 3. White triangular wedge cutting into the lower
              portion of the leaf. The cut line runs from
              roughly (-10, 84) up to (110, 50). */}
        <polygon
          points="-10,84 110,50 110,120 -10,120"
          fill={C.white}
        />
      </g>

      {/* Solid dark-navy chevron arrow. */}
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
  withTile,
  tileVariant,
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
