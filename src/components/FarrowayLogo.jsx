/**
 * FarrowayLogo — v8 brand mark.
 *
 * Composition (matches the supplied April 2026 brand asset):
 *
 *   1. Asymmetric tilted leaf silhouette — wide flat-ish top
 *      edge curving to a sharp pointed bottom on the right.
 *   2. Three internal colour zones, each separated by a dark
 *      navy "vein" line:
 *        • upper / largest    → bright lime green  (#A3E635)
 *        • middle / band      → medium green       (#22C55E)
 *        • lower-right wedge  → white              (#FFFFFF)
 *   3. Dark navy curved arrow painted on top of the upper
 *      green zone, with a chevron arrowhead near the top-right.
 *
 * If you want pixel-perfect fidelity to the source asset, drop
 * the canonical SVG / PNG into:
 *   public/icons/farroway-mark.svg
 * and either
 *   1. Replace the body of FarrowayMark with
 *      <img src="/icons/farroway-mark.svg" ... />, OR
 *   2. Paste the new path data into LEAF_PATH / VEIN_PATHS /
 *      ARROW_PATH below.
 *
 * API (props, lockup, tile variants) is unchanged from v7 —
 * every existing caller keeps working.
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

  // Outer leaf silhouette. Top edge runs nearly straight from
  // upper-left across to upper-right; the right side curves
  // gently down; the bottom comes to a sharp point near
  // (60, 92); the left side curves back up.
  const LEAF_PATH =
    'M 28 22 '
    + 'Q 50 14, 82 18 '   // top edge — wide and slightly slanted
    + 'L 84 22 '          // small upper-right shoulder
    + 'Q 90 48, 80 70 '   // right side curving down
    + 'L 60 92 '          // sharp bottom-right point (white tip)
    + 'L 42 80 '          // back up to lower-left of body
    + 'Q 22 62, 18 44 '   // left bulge
    + 'Q 22 28, 28 22 Z'; // close to upper-left

  // Vein lines. The leaf reads as three zones separated by
  // these dark navy strokes:
  //   topVein — separates bright-green top from medium-green band
  //   bottomVein — separates medium-green band from white wedge
  const TOP_VEIN  = 'M 24 50 Q 54 38, 84 32';
  const BOT_VEIN  = 'M 30 70 Q 54 64, 78 58';

  // Arrow — runs across the upper bright-green zone, finished
  // with a chevron head near the top-right.
  const ARROW_SHAFT = 'M 28 42 Q 56 30, 76 26';
  const ARROW_HEAD  = '80,22 64,24 70,32';

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
      {tileFill(tileVariant) && (
        <rect
          x="0" y="0" width="100" height="100"
          rx="22" ry="22"
          fill={tileFill(tileVariant)}
        />
      )}

      {/* Layered colour zones — each fills the whole canvas
          and is trimmed by the leaf clipPath. Rendering order
          matters: white sits at the bottom, then medium green
          covers the upper two thirds, then bright green
          covers the upper third. */}
      <g clipPath={`url(#${clipId})`}>
        {/* 3. Bottom layer — WHITE fills everything. */}
        <rect x="0" y="0" width="100" height="100" fill={C.white} />

        {/* 2. Medium-green band covers the upper two thirds.
              Cut runs along BOT_VEIN's contour; we approximate
              it with a polygon that follows the same path. */}
        <path
          d="M 0 0 L 100 0 L 100 60 Q 54 66, 24 72 L 0 72 Z"
          fill={C.green}
        />

        {/* 1. Bright lime green covers the upper third. Cut
              runs along TOP_VEIN's contour. */}
        <path
          d="M 0 0 L 100 0 L 100 34 Q 54 40, 22 52 L 0 52 Z"
          fill={C.lightGreen}
        />
      </g>

      {/* Dark navy vein strokes that visually separate the
          zones. Drawn AFTER the clipped fills so they appear
          on top. Clipped to the leaf so they don't extend
          past the silhouette. */}
      <g clipPath={`url(#${clipId})`}>
        <path
          d={TOP_VEIN}
          fill="none"
          stroke={C.navy}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d={BOT_VEIN}
          fill="none"
          stroke={C.navy}
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>

      {/* Outer leaf outline — a subtle dark-green stroke that
          gives the leaf an edge against the navy backdrop. */}
      <path
        d={LEAF_PATH}
        fill="none"
        stroke={C.darkGreen}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* Curved arrow shaft + chevron head, drawn on top of
          everything else so the navy reads cleanly across both
          green zones. */}
      <path
        d={ARROW_SHAFT}
        fill="none"
        stroke={C.navy}
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <polygon
        points={ARROW_HEAD}
        fill={C.navy}
        stroke={C.navy}
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
