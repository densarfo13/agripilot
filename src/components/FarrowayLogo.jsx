/**
 * FarrowayLogo — v9 brand mark.
 *
 * Composition (matches the supplied April 2026 brand asset):
 *
 *   1. Vertical pointed-oval leaf silhouette.
 *   2. Green gradient fill — lime green at top-right fading to
 *      darker green at the lower-left.
 *   3. Brown "soil" wedge filling the lower-right portion of
 *      the leaf (the earth/field motif).
 *   4. Three flowing white curves running across the leaf —
 *      reading as field furrows / growth bands.
 *   5. The top white curve transforms into an arrow with a
 *      white arrowhead near the upper-right tip of the leaf.
 *
 * If you want pixel-perfect fidelity to the source asset,
 * drop the canonical SVG / PNG into:
 *   public/icons/farroway-mark.svg
 * and follow the swap path documented in the file header.
 *
 * API (props, lockup, tile variants) unchanged from v8 —
 * existing callers keep working.
 */

import React from 'react';
import { FARROWAY_BRAND } from '../brand/farrowayBrand.js';

const C = FARROWAY_BRAND.colors;

// Earth / soil tone — not part of the canonical FARROWAY_BRAND
// palette but referenced by the logo. Kept as a local constant
// so the brand object stays focused on UI surface tokens.
const SOIL_BROWN = '#7C3F1D';

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
  // Per-render unique ids so multiple instances on the same
  // page don't collide on clipPath / gradient refs.
  const ids = React.useMemo(() => ({
    leafClip: nextId('farrowayLeafClip'),
    leafGrad: nextId('farrowayLeafGrad'),
  }), []);

  // Vertical pointed-oval leaf. Sharp top tip at (50, 6),
  // widest around y ≈ 50, soft point at the base (50, 94).
  const LEAF_PATH =
    'M 50 6 '
    + 'Q 22 14, 14 48 '
    + 'Q 12 82, 50 94 '
    + 'Q 88 82, 86 48 '
    + 'Q 78 14, 50 6 Z';

  // Brown "soil" wedge — fills the lower-right of the leaf.
  // The polygon extends well past the leaf bounds; the
  // clipPath trims it to the silhouette.
  const SOIL_WEDGE = 'M 110 50 L 110 110 L 30 110 Q 64 70, 110 50 Z';

  // Three flowing white curves. Stroke widths step down from
  // top (thickest, ends at the arrowhead) to bottom (thinnest,
  // sits at the boundary with the soil).
  const CURVE_TOP    = 'M 22 56 Q 48 30, 78 24';
  const CURVE_MID    = 'M 16 66 Q 48 56, 82 52';
  const CURVE_BOTTOM = 'M 24 80 Q 50 72, 80 64';

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
        <clipPath id={ids.leafClip}>
          <path d={LEAF_PATH} />
        </clipPath>
        {/* Leaf gradient: lime at top-right → medium green
            → darker green at lower-left. */}
        <linearGradient id={ids.leafGrad} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor={C.lightGreen} />
          <stop offset="55%"  stopColor={C.green} />
          <stop offset="100%" stopColor={C.darkGreen} />
        </linearGradient>
      </defs>

      {/* Optional rounded-square tile (app-icon variants). */}
      {tileFill(tileVariant) && (
        <rect
          x="0" y="0" width="100" height="100"
          rx="22" ry="22"
          fill={tileFill(tileVariant)}
        />
      )}

      {/* Layered fills clipped to the leaf silhouette. */}
      <g clipPath={`url(#${ids.leafClip})`}>
        {/* Green gradient fills the whole leaf. */}
        <rect x="0" y="0" width="100" height="100" fill={`url(#${ids.leafGrad})`} />

        {/* Brown soil wedge in the lower-right. */}
        <path d={SOIL_WEDGE} fill={SOIL_BROWN} />

        {/* Three white flowing curves — field furrows /
            growth bands. Drawn inside the clip so they don't
            extend past the leaf. */}
        <path
          d={CURVE_TOP}
          fill="none"
          stroke={C.white}
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d={CURVE_MID}
          fill="none"
          stroke={C.white}
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d={CURVE_BOTTOM}
          fill="none"
          stroke={C.white}
          strokeWidth="4"
          strokeLinecap="round"
        />
      </g>

      {/* White arrowhead at the upper-right end of the top
          curve. Drawn OUTSIDE the clip group so it can extend
          slightly past the leaf edge if needed. */}
      <polygon
        points="82,18 64,22 72,32"
        fill={C.white}
        stroke={C.white}
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function tileFill(variant) {
  if (variant === 'dark')  return C.navy;
  if (variant === 'light') return C.white;
  return null;
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
