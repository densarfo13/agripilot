/**
 * FarrowayLogo — v4 brand mark, redrawn April 2026 to match the
 * official brand sheet:
 *
 *   USAGE ON DARK BACKGROUND   |   USAGE ON LIGHT BACKGROUND
 *   ─────────────────────────  |   ─────────────────────────
 *   green leaf + white "F"     |   green leaf + navy "Farroway"
 *   tagline: white + green     |   tagline: navy + green
 *
 * Because the SAME green mark sits on both dark and light tiles,
 * the mark itself is single-tone (brand green only). The arrow
 * inside the leaf is cut out as NEGATIVE SPACE, not painted —
 * the surface behind the leaf shows through, so the mark stays
 * legible on every backdrop.
 *
 * Composition:
 *   * Leaf silhouette, pointed top-right tip, rounded bottom-left.
 *     Filled with brand green (#22C55E).
 *   * Subtle leaf-vein highlight in lighter green (#A3E635) — a
 *     thin diagonal stroke from the base to the tip, hinting at
 *     the central rib.
 *   * Upward-pointing arrow (shaft + head) cut out of the leaf
 *     via an SVG <mask>. The cutout reveals whatever sits behind
 *     the SVG (white page, navy dashboard, brand-blue tile).
 *
 * Two-tone tagline support: "Know what to do." (navy on light
 * surfaces, white on dark) + "Grow better." (always green).
 *
 * App-icon contexts wrap the bare mark in a rounded square tile
 * via `tileVariant="light"` or `"dark"`. The PRIMARY logo is
 * the bare leaf — no tile — so it reads naturally on white
 * pages or dark dashboards alike.
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
 *                 wordmark (default false; set on splash /
 *                 email-signature presentations)
 *
 * Strict-rule audit
 *   * Inline SVG — no second network request, ships in the
 *     bundle, works offline.
 *   * Single brand colour — no clash with dark or light surfaces.
 *   * The arrow cutout uses a <mask>, so clip-path stacking on
 *     adjacent SVG instances is not affected.
 *   * Accessibility: <svg role="img"> + <title>; tagline keys
 *     read by screen readers in source order.
 */

import React from 'react';
import { FARROWAY_BRAND } from '../brand/farrowayBrand.js';

const C = FARROWAY_BRAND.colors;

// Stable IDs prefixed with the component name so multiple
// instances on the same page never collide on mask refs.
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
  // One unique id per render — required because mask refs are
  // scoped to the document, not the SVG.
  const maskId  = React.useMemo(() => nextId('farrowayArrow'), []);
  const tileFill =
    tileVariant === 'dark'  ? C.navy  :
    tileVariant === 'light' ? C.white : null;

  // Leaf silhouette: pointed top-right tip ~(86, 14), bulging
  // upper-left around (10, 48), rounded bottom curve through
  // (28, 90), back up the right side. Slightly tightened from
  // the v3 path so the leaf reads cleanly against the tagline.
  const LEAF_PATH =
    'M 86 14 '
    + 'Q 66 6, 44 14 '
    + 'Q 20 24, 10 48 '
    + 'Q 4 78, 28 90 '
    + 'Q 50 92, 66 76 '
    + 'Q 82 54, 86 14 Z';

  // Curved arrow geometry — drawn in BLACK on the mask so it
  // becomes a cutout when the leaf is painted. Shaft runs from
  // the lower-left of the leaf to the upper-right tip; the
  // arrowhead is a small filled triangle just inside the tip.
  const ARROW_SHAFT  = 'M 28 72 Q 46 56, 76 22';
  const ARROW_HEAD   = '78,18 60,22 68,34';

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
        {/* Mask: white = keep, black = cut out. We cut the arrow
            shaft + head out of the leaf so whatever surface sits
            behind the SVG (page, tile, dashboard) shows through. */}
        <mask id={maskId} maskUnits="userSpaceOnUse"
              x="0" y="0" width="100" height="100">
          <rect x="0" y="0" width="100" height="100" fill="white" />
          <path
            d={ARROW_SHAFT}
            stroke="black"
            strokeWidth="9"
            strokeLinecap="round"
            fill="none"
          />
          <polygon
            points={ARROW_HEAD}
            fill="black"
            stroke="black"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </mask>
      </defs>

      {/* Optional rounded-square tile (app-icon variants). */}
      {tileFill && (
        <rect
          x="0" y="0" width="100" height="100"
          rx="22" ry="22"
          fill={tileFill}
        />
      )}

      {/* Leaf body — single brand-green fill, masked so the
          arrow cuts through to whatever is behind. */}
      <path
        d={LEAF_PATH}
        fill={C.green}
        mask={`url(#${maskId})`}
      />

      {/* Leaf-vein accent in the lighter green tone — sits
          under the cutout, runs along the arrow shaft so the
          two read as a single integrated mark. The mask trims
          everything outside the leaf. */}
      <g
        clipPath={undefined}
        style={{ pointerEvents: 'none' }}
      >
        <path
          d="M 30 78 Q 48 60, 80 20"
          stroke={C.lightGreen}
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
          opacity="0.55"
        />
      </g>
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
