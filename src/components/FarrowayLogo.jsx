/**
 * FarrowayLogo — v10 (final).
 *
 * Renders the canonical brand asset shipped at
 *   /public/icons/farroway-mark.jpg
 * via a plain <img>. No more hand-drawn SVG — the file on disk
 * is the source of truth, so the on-screen mark is exactly
 * what the brand team supplied.
 *
 * To swap the asset:
 *   • Drop a new file at public/icons/farroway-mark.jpg (or
 *     .svg / .png — update SRC below to match the extension).
 *   • No JSX changes required; every caller picks it up
 *     automatically.
 *
 * API unchanged from v9 — props, the full lockup, and the
 * tagline composition all keep working.
 */

import React from 'react';
import { FARROWAY_BRAND } from '../brand/farrowayBrand.js';

const C = FARROWAY_BRAND.colors;

// Canonical brand asset path. Lives in /public so Vite serves
// it from the site root in dev AND copies it into the dist/
// output unchanged at build time. Older deployments only have
// the .svg variant — see SRC_FALLBACK below.
const SRC = '/icons/farroway-mark.jpg';
// Fallback used when the primary asset 404s. The SVG redraw
// has shipped for many releases, so this gives us a safe
// landing on any environment that hasn't yet picked up the
// new JPG. Spec §3 of the safe-session work — the UI must
// never depend on a specific deploy artefact being present.
const SRC_FALLBACK = '/icons/farroway-mark.svg';

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
