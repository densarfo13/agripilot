/**
 * RealisticIcon — single React entry for the premium line-icon
 * catalogue (May 2026 realism migration).
 *
 *   <RealisticIcon name="camera" size={48} />
 *   <RealisticIcon name="crop"   size={20} title="Maize" />
 *
 * EVERY icon below is hand-rolled SVG with a unified visual
 * language:
 *   • single-weight stroke (1.6 default, scales with `size`)
 *   • round line caps + joins
 *   • no fills — a calm "drawn with one pen" feel
 *   • inherits `currentColor` so callers control the tint via
 *     CSS / inline style without prop drilling.
 *
 * STRICT-RULE AUDIT
 *   • Pure presentational. Never throws.
 *   • SSR-safe — no DOM access at module load.
 *   • Inline SVG only — no network requests, no rasterisation.
 *   • Renders a 1×1 transparent placeholder for unknown names so
 *     a typo never crashes the host card.
 */

import React from 'react';

const STROKE = 1.6;

// ─── Path catalogue ──────────────────────────────────────────────
// Each entry returns the PATH content (not the wrapping <svg>) so
// the wrapper below can supply a consistent viewBox + sizing.
const PATHS = Object.freeze({
  // ─── Camera (replaces 📷 across scan surfaces) ────────────────
  camera: () => (
    <>
      <path d="M5 8.5h2.4l1.6-2H15l1.6 2H19a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18v-8A1.5 1.5 0 0 1 5 8.5Z" />
      <circle cx="12" cy="13.5" r="3.2" />
    </>
  ),

  // ─── Crop (a sprouting seedling — replaces 🌱) ────────────────
  crop: () => (
    <>
      <path d="M12 21V11" />
      <path d="M12 11c-3 0-5-2-5-5 3 0 5 2 5 5Z" />
      <path d="M12 11c3 0 5-2 5-5-3 0-5 2-5 5Z" />
    </>
  ),

  // ─── Leaf (replaces 🌿 / cartoon plant) ───────────────────────
  leaf: () => (
    <>
      <path d="M5 19c0-7 5-13 14-13 0 9-6 14-14 14Z" />
      <path d="M5 19c4-3 8-7 11-12" />
    </>
  ),

  // ─── Soil (layered earth horizon — replaces emoji soil tile) ──
  soil: () => (
    <>
      <path d="M3.5 15.5h17" />
      <path d="M5 18.5h14" />
      <path d="M8 11l2-2 2 2 2-2 2 2" />
    </>
  ),

  // ─── Sun (calm rays — replaces emoji sun) ─────────────────────
  sun: () => (
    <>
      <circle cx="12" cy="12" r="3.6" />
      <path d="M12 4.5V3M12 21v-1.5M19.5 12H21M3 12h1.5M17.7 6.3l1-1M5.3 18.7l1-1M17.7 17.7l1 1M5.3 5.3l1 1" />
    </>
  ),

  // ─── Cloud (soft cumulus) ─────────────────────────────────────
  cloud: () => (
    <>
      <path d="M8 17h8.5a3.5 3.5 0 0 0 .3-7 4.8 4.8 0 0 0-9-1A3.5 3.5 0 0 0 8 17Z" />
    </>
  ),

  // ─── Rain (cloud + 3 drops) ───────────────────────────────────
  rain: () => (
    <>
      <path d="M8 13h8.5a3.5 3.5 0 0 0 .3-7 4.8 4.8 0 0 0-9-1A3.5 3.5 0 0 0 8 13Z" />
      <path d="M9 17v2.5M12 17v2.5M15 17v2.5" />
    </>
  ),

  // ─── Scan (corner crosshair — replaces emoji scan visual) ─────
  scan: () => (
    <>
      <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8" />
      <path d="M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8" />
      <path d="M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16" />
      <path d="M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
      <path d="M8 12h8" />
    </>
  ),

  // ─── Tasks (clipboard with check — replaces ✅ on cards) ──────
  tasks: () => (
    <>
      <path d="M8.5 4h7M7 6h10v14H7z" />
      <path d="M9.5 13l2 2 3.5-4" />
    </>
  ),

  // ─── Funding (document + ribbon — replaces 💰) ────────────────
  funding: () => (
    <>
      <path d="M6 4h9l3 3v13H6z" />
      <path d="M15 4v3h3" />
      <path d="M9.5 12.5h5M9.5 15.5h5" />
    </>
  ),

  // ─── Sell (basket / produce crate — replaces 🧺) ──────────────
  sell: () => (
    <>
      <path d="M4 9h16l-1.5 10h-13Z" />
      <path d="M8 9V6a4 4 0 0 1 8 0v3" />
    </>
  ),

  // ─── Buyer (handshake / building — minimal storefront) ────────
  buyer: () => (
    <>
      <path d="M4 9l1.5-3h13L20 9" />
      <path d="M4 9v11h16V9" />
      <path d="M9 20v-5h6v5" />
    </>
  ),

  // ─── Spark (calm acknowledgement — replaces ✨) ───────────────
  spark: () => (
    <>
      <path d="M12 4v4M12 16v4M4 12h4M16 12h4" />
      <path d="M7 7l2.5 2.5M14.5 14.5L17 17M7 17l2.5-2.5M14.5 9.5L17 7" />
    </>
  ),
});

// ─── Wrapper component ───────────────────────────────────────────

/**
 * @param {Object} props
 * @param {string}        props.name      — one of the catalogue keys
 * @param {number}        [props.size=24]
 * @param {number|string} [props.stroke=STROKE]
 * @param {string}        [props.title]   — accessible label
 * @param {string}        [props.color]   — overrides currentColor when set
 * @param {object}        [props.style]
 * @param {string}        [props.className]
 * @param {string}        [props.testId]
 */
export default function RealisticIcon({
  name,
  size = 24,
  stroke = STROKE,
  title,
  color,
  style,
  className,
  testId,
}) {
  const renderer = PATHS[String(name)];
  // Unknown name → render a 1×1 transparent placeholder so the
  // host layout stays stable and a typo never crashes a card.
  if (typeof renderer !== 'function') {
    return (
      <span
        aria-hidden="true"
        style={{ display: 'inline-block', width: size, height: size, ...(style || {}) }}
        data-realistic-icon={`unknown:${String(name || '')}`}
      />
    );
  }
  const labelled = !!title;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color || 'currentColor'}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={labelled ? 'img' : 'presentation'}
      aria-hidden={labelled ? undefined : 'true'}
      aria-label={labelled ? title : undefined}
      style={style}
      className={className}
      data-testid={testId || `realistic-icon-${name}`}
    >
      {labelled ? <title>{title}</title> : null}
      {renderer()}
    </svg>
  );
}

/**
 * Snapshot of every catalogue key — used by tests to assert the
 * icon set is stable + by callers that want to enumerate available
 * icons (e.g. an admin debug panel).
 */
export const REALISTIC_ICON_NAMES = Object.freeze(Object.keys(PATHS));
