/**
 * FarrowayLogo \u2014 v11 (premium-logo migration).
 *
 * Renders the canonical brand asset. The bytes live as a base64
 * data URL in src/brand/farrowayMarkDataUrl.js so the deploy
 * pipeline cannot drop the file between local and the build
 * container. Last-resort fallback resolves to the new
 * /public/icons/logo-premium.svg path.
 *
 * To swap the asset:
 *   \u2022 Drop a new file at public/icons/logo-premium.{svg,png}
 *     and re-run scripts/bake-brand-mark.mjs to refresh the
 *     embedded data URL. No JSX changes required.
 *
 * API unchanged from v10 \u2014 props, the full lockup, and the
 * tagline composition all keep working.
 */

import React from 'react';
import { FARROWAY_BRAND } from '../brand/farrowayBrand.js';
// Brand asset baked into a JS module by
// scripts/bake-brand-mark.mjs. The JPG bytes live as a base64
// data URL inside src/brand/farrowayMarkDataUrl.js — no binary
// file in the build pipeline at all, so the deploy can't drop
// the asset between local and the build container. The
// previous approaches (Rollup import of /src/assets, plain
// path to /icons) both broke when the JPG didn't arrive in the
// deploy clone; this travels with the JS bundle.
import { FARROWAY_MARK_DATA_URL } from '../brand/farrowayMarkDataUrl.js';

const C = FARROWAY_BRAND.colors;

// Primary source — embedded data URL, always available.
const SRC = FARROWAY_MARK_DATA_URL;
// Last-resort fallback if some environment refuses to render
// the data URL (very old browsers, strict CSP without
// img-src 'data:'). The v9 SVG redraw ships in /public on
// every deploy.
const SRC_FALLBACK = '/icons/logo-premium.jpg';

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

  // Track whether the primary asset 404'd so we can swap to
  // the SVG fallback. One-shot: if the fallback also fails the
  // browser shows the standard broken-image placeholder, but
  // the rest of the UI keeps rendering.
  const [src, setSrc] = React.useState(SRC);
  const handleError = React.useCallback(() => {
    if (src !== SRC_FALLBACK) setSrc(SRC_FALLBACK);
  }, [src]);

  // When a tile is requested we wrap the asset in a rounded
  // square coloured tile (app-icon contexts). Otherwise the
  // bare image renders.
  if (tileFill) {
    return (
      <span
        role="img"
        aria-label={ariaLabel}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.22),
          background: tileFill,
          flexShrink: 0,
          overflow: 'hidden',
          ...(style || {}),
        }}
        {...rest}
      >
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          onError={handleError}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block',
          }}
        />
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={ariaLabel}
      width={size}
      height={size}
      onError={handleError}
      style={{
        display: 'block',
        flexShrink: 0,
        objectFit: 'contain',
        ...(style || {}),
      }}
      {...rest}
    />
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
