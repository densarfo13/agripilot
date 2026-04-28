/**
 * FarrowayLogo — the v3 brand mark.
 *
 *   <FarrowayLogo />                  // 32px, dark-bg variant, with wordmark
 *   <FarrowayLogo size={48} />        // larger
 *   <FarrowayLogo showText={false} /> // icon-only (use this on small headers,
 *                                      // PWA tiles, favicons in-app)
 *   <FarrowayLogo variant="onLight"/> // navy wordmark on a light backdrop
 *   <FarrowayLogo iconOnly />         // alias for showText={false}
 *
 * Design — per the v3 brand spec:
 *   * Icon: rounded-square navy tile + green farmland hill +
 *     a lime arrow-path curving up through the field, ending
 *     in an upward arrow head. Communicates "guidance through
 *     the field that ends in growth".
 *   * Wordmark: bold modern sans-serif, navy on light bg /
 *     white on dark bg. Tracking tightened slightly so the
 *     mark reads as one unit.
 *
 * Strict-rule audit
 *   * Inline SVG so it ships in the bundle — no second network
 *     request, no race with the service worker, no broken
 *     image at first paint. (The PWA installer + apple-touch
 *     still uses the rasterised PNG under /icons/ — that's a
 *     separate asset, not this component.)
 *   * Backwards-compatible: the previous shape took
 *     `size / showText / textColor` and that contract is
 *     preserved so every existing call site (FarmerDashboard,
 *     FarmerRegister, sidebar Layout) keeps rendering.
 *   * Works on both light and dark backgrounds — the icon
 *     carries its own navy tile so it never visually melts
 *     into a dark page; the wordmark colour adapts via
 *     `variant` (or the legacy `textColor` prop).
 *   * Accessibility: <svg> has role="img" + an <title> so
 *     screen readers announce "Farroway logo".
 */

import React from 'react';
import { FARROWAY_BRAND } from '../brand/farrowayBrand.js';

const C = FARROWAY_BRAND.colors;

/**
 * Pure SVG icon — the arrow-path farmland mark, no wordmark.
 *
 * The viewBox is 0 0 64 64. All coordinates are tuned to
 * read clearly down to ~20 px and still stay crisp at 192 px.
 */
export function FarrowayIcon({
  size = 32,
  // Whether to draw the navy tile background. Keep ON by
  // default so the mark is recognisable on both light and
  // dark surfaces without extra wrapping.
  withTile = true,
  ariaLabel = 'Farroway',
  style,
  ...rest
}) {
  const tileColor = C.navy;
  const fieldGreen = C.green;
  const arrowGreen = C.lightGreen;

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', flexShrink: 0, ...(style || {}) }}
      {...rest}
    >
      <title>{ariaLabel}</title>

      {/* 1) navy tile (rounded square) — only drawn when
            withTile is on. Gives the icon its own colour
            context so it works on light + dark bg. */}
      {withTile && (
        <rect
          x="1" y="1" width="62" height="62"
          rx="14" ry="14"
          fill={tileColor}
        />
      )}

      {/* 2) green field — top-right hill curving down to the
            left. The shape evokes "rolling farmland" while
            keeping a lot of negative space for the path. */}
      <path
        d="
          M 6 38
          C 18 28, 28 22, 40 22
          C 50 22, 56 26, 60 30
          L 60 8
          L 6 8
          Z
        "
        fill={fieldGreen}
        opacity="0.92"
      />

      {/* 3) the arrow-path — a curved guide that starts at the
            lower-left of the field, sweeps up through the
            green, and exits with an upward arrowhead at the
            top-right. This is the "know what to do → grow
            better" gesture in geometry. */}
      <path
        d="M 10 52 C 22 48, 28 40, 34 34 S 48 22, 56 14"
        fill="none"
        stroke={arrowGreen}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* arrow head */}
      <path
        d="M 48 14 L 56 14 L 56 22"
        fill="none"
        stroke={arrowGreen}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Full lockup: icon + Farroway wordmark.
 *
 * Backwards-compatible props:
 *   size       — icon edge length in px (default 32)
 *   showText   — render the "Farroway" wordmark (default true)
 *   textColor  — explicit wordmark colour (overrides variant)
 *
 * New props:
 *   variant    — "onDark" (default, white wordmark) or
 *                "onLight" (navy wordmark)
 *   iconOnly   — alias for showText={false}, reads cleaner at
 *                call sites that just want the mark.
 */
export default function FarrowayLogo({
  size       = 32,
  showText   = true,
  textColor,
  variant    = 'onDark',
  iconOnly   = false,
  withTile   = true,
  ...rest
}) {
  const wordmarkColor = textColor
    || (variant === 'onLight' ? C.navy : C.white);

  const renderText = showText && !iconOnly;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: Math.max(6, Math.round(size * 0.28)),
        lineHeight: 1,
      }}
      {...rest}
    >
      <FarrowayIcon size={size} withTile={withTile} />
      {renderText && (
        <span
          style={{
            fontSize: Math.round(size * 0.72),
            fontWeight: 800,
            color: wordmarkColor,
            letterSpacing: '-0.015em',
            // Stay on a single line even in tight headers.
            whiteSpace: 'nowrap',
            fontFamily:
              'system-ui, -apple-system, "Segoe UI", Roboto, '
              + '"Helvetica Neue", Arial, sans-serif',
          }}
        >
          Farroway
        </span>
      )}
    </span>
  );
}
