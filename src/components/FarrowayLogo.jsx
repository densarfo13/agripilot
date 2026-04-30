/**
 * FarrowayLogo — v3 brand mark, redrawn to match the official
 * brand sheet (April 2026):
 *
 *   * Leaf-shaped silhouette (pointed top-right tip, rounded base)
 *   * Inside the leaf, three faceted green slabs (lightest top
 *     → medium green → darker green) plus a navy wedge at the
 *     lower-left
 *   * A white upward arrow piercing through the leaf from
 *     lower-left to upper-right
 *
 * Two-tone tagline support: "Know what to do." (navy on light
 * surfaces, white on dark) + "Grow better." (always green).
 *
 * App-icon contexts wrap the bare mark in a rounded square
 * tile via `tileVariant="light"` or `"dark"`. The PRIMARY
 * logo is the bare leaf — no tile — so it sits naturally on
 * white pages or dark dashboards alike.
 *
 * Backwards-compatible API:
 *   size       — icon edge in px (default 32)
 *   showText   — wordmark on/off (default true)
 *   textColor  — explicit wordmark colour (overrides variant)
 *   variant    — "onDark" (white wordmark) | "onLight" (navy)
 *   iconOnly   — alias for showText={false}
 *   withTile   — legacy alias; if true, behaves like
 *                tileVariant="dark"
 *
 * New props:
 *   tileVariant — "none" (default) | "light" | "dark"
 *   showTagline — render the two-tone tagline beneath the
 *                 wordmark (default false; set on splash /
 *                 email-signature presentations)
 *
 * Strict-rule audit
 *   * Inline SVG — no second network request, ships in the
 *     bundle, works offline. (Rasterised PWA tile lives at
 *     /icons/icon-{192,512}.png — that's a separate asset.)
 *   * Works on light AND dark backgrounds without an external
 *     tile: the leaf's own navy section + lime arrow keep it
 *     readable in both contexts.
 *   * Accessibility: <svg role="img"> + <title>; tagline keys
 *     read by screen readers in source order.
 */

import React from 'react';
import { FARROWAY_BRAND } from '../brand/farrowayBrand.js';

const C = FARROWAY_BRAND.colors;

// Stable IDs prefixed with the component name so multiple
// instances on the same page never collide on clip-path refs.
let _uid = 0;
function nextId(prefix) {
  _uid += 1;
  return `${prefix}_${_uid}`;
}

/**
 * The bare leaf mark — no wordmark, no tile.
 *
 * viewBox is 0 0 100 100. All coordinates tuned so the mark
 * stays crisp from ~20 px (sidebar) up to 192 px (PWA tile).
 */
export function FarrowayMark({
  size = 32,
  tileVariant = 'none', // 'none' | 'light' | 'dark'
  ariaLabel = 'Farroway',
  style,
  ...rest
}) {
  // One unique id per render — required because clipPath refs
  // are scoped to the document, not the SVG.
  const clipId = React.useMemo(() => nextId('farrowayLeaf'), []);

  const tileFill =
    tileVariant === 'dark'  ? C.navy  :
    tileVariant === 'light' ? C.white : null;

  // Leaf silhouette: pointed top-right tip ~(88, 14), bulging
  // upper-left around (10, 50), rounded bottom curve through
  // (28, 90), back up the right side.
  const LEAF_PATH =
    'M 88 14 '
    + 'Q 70 6, 48 12 '
    + 'Q 22 22, 10 50 '
    + 'Q 4 80, 28 90 '
    + 'Q 50 92, 66 76 '
    + 'Q 82 56, 88 14 Z';

  // Inside the leaf, draw faceted slabs from back (lightest)
  // to front (navy wedge). Each polygon extends past the
  // leaf bounds; the clipPath trims them to the silhouette.
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

      {/* Leaf body — simplified two-zone composition (Apr 2026
          brand-asset refresh, matching the supplied app-icon
          design):
            * upper-right band : lighter green (#A3E635)
            * main body        : medium green  (#22C55E)
            * lower-left wedge : navy          (#0B1220)
          The cut between the two greens runs from (-10, 32) to
          (110, 6) so the lighter band hugs the upper-right
          tip. The navy wedge cut runs from (-10, 92) up to
          (110, 50) so the wedge occupies the lower-left third
          of the leaf — exactly where the supplied design puts
          it. */}
      <g clipPath={`url(#${clipId})`}>
        {/* 1. medium green base — fills the whole leaf */}
        <rect x="0" y="0" width="100" height="100" fill={C.green} />

        {/* 2. lighter green band at the upper-right */}
        <polygon
          points="-10,-20 110,-20 110,6 -10,32"
          fill={C.lightGreen}
        />

        {/* 3. navy wedge — slants up to the right so it sits in
              the lower-LEFT of the leaf, matching the new mark. */}
        <polygon
          points="-10,92 110,50 110,120 -10,120"
          fill={C.navy}
        />
      </g>

      {/* Two-tone curved arrow — drawn AFTER the clipped group
          so the arrowhead can sit at the upper-right tip without
          getting trimmed. The shaft is a single quadratic curve
          from (24, 74) to (78, 22); we draw it twice with two
          different clip regions so the segment over the navy
          wedge renders white and the segment over the green
          renders navy. The arrowhead is a small triangle drawn
          last, in navy. */}

      {/* Per-render clip definitions for the two arrow halves. */}
      <defs>
        <clipPath id={`${clipId}_navyZone`}>
          {/* Same wedge polygon as #3 above — the arrow shaft is
              white where it overlaps this region. */}
          <polygon points="-10,92 110,50 110,120 -10,120" />
        </clipPath>
        <clipPath id={`${clipId}_greenZone`}>
          {/* Everything inside the leaf that is NOT the wedge.
              Drawn as a 5-point polygon roughly tracing the
              leaf bounds minus the wedge — the leaf clip-path
              still trims the outer edges. */}
          <polygon points="-10,-20 110,-20 110,50 -10,92" />
        </clipPath>
      </defs>

      {/* Shaft over the navy wedge → render white */}
      <g clipPath={`url(#${clipId}_navyZone)`}>
        <path
          d="M 24 74 Q 44 60, 78 22"
          stroke={C.white}
          strokeWidth="3.2"
          strokeLinecap="round"
          fill="none"
        />
      </g>

      {/* Shaft over the green portion → render navy */}
      <g clipPath={`url(#${clipId}_greenZone)`}>
        <path
          d="M 24 74 Q 44 60, 78 22"
          stroke={C.navy}
          strokeWidth="3.2"
          strokeLinecap="round"
          fill="none"
        />
      </g>

      {/* Arrowhead at the upper-right tip — small filled triangle
          in navy. Pointing up-and-to-the-right along the curve's
          tangent at (78, 22). */}
      <polygon
        points="80,18 66,22 72,30"
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
  // Resolve effective tile mode. Old callers passed
  // `withTile=true/false`; new callers pass `tileVariant`.
  const effectiveTile =
    tileVariant
      ? tileVariant
      : (withTile === true ? 'dark' : 'none');

  const onDark = variant !== 'onLight';
  const wordmarkColor = textColor
    || (onDark ? C.white : C.navy);

  // Tagline colours: the brand sheet shows
  //   "Know what to do." in navy (light bg) / white (dark bg)
  //   "Grow better."     always in brand green
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
