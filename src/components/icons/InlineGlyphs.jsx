/**
 * InlineGlyphs — small, consistent SVG glyphs that replace the
 * emoji icons scattered across legacy components.
 *
 * Each export is a pure component that renders a single inline
 * SVG and accepts only a `size` prop (default 18). They use
 * `currentColor` for strokes so the calling card's text colour
 * automatically flows through — no per-callsite palette plumbing
 * needed.
 *
 * Why a separate file instead of inlining everywhere
 * ──────────────────────────────────────────────────
 *   The UI tightening pass §9 calls for replacing emoji with
 *   real icons. Forty-plus surfaces inlining the same wheat /
 *   seedling / tractor glyph drifts immediately. Centralising
 *   them means a future tweak (stroke weight, viewbox) flows
 *   through all callsites at once.
 *
 * Naming: each glyph matches the emoji it replaces so a search
 * for the original emoji in git history lands on the right
 * import.
 */

import React from 'react';

const COMMON = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

/** Wheat stalk — replaces 🌾 */
export function WheatGlyph({ size = 18, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...rest}>
      <path d="M12 21V8" {...COMMON}/>
      <path d="M12 8c-2-1.4-3-3-3-5 2 0 3.6 1 4 3" {...COMMON}/>
      <path d="M12 11c-2.4-1.6-3.6-3.4-3.6-5.4 2.4 0 4 1.2 4.4 3.4" {...COMMON}/>
      <path d="M12 14c-2.4-1.6-3.6-3.4-3.6-5.4 2.4 0 4 1.2 4.4 3.4" {...COMMON}/>
      <path d="M12 8c2-1.4 3-3 3-5-2 0-3.6 1-4 3" {...COMMON}/>
      <path d="M12 11c2.4-1.6 3.6-3.4 3.6-5.4-2.4 0-4 1.2-4.4 3.4" {...COMMON}/>
      <path d="M12 14c2.4-1.6 3.6-3.4 3.6-5.4-2.4 0-4 1.2-4.4 3.4" {...COMMON}/>
    </svg>
  );
}

/** Seedling sprout — replaces 🌱 */
export function SeedlingGlyph({ size = 18, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...rest}>
      <path d="M12 21V12" {...COMMON}/>
      <path d="M12 12c-3 0-5-2-5-5 3 0 5 2 5 5z" {...COMMON}/>
      <path d="M12 14c3 0 5-2 5-5-3 0-5 2-5 5z" {...COMMON}/>
      <path d="M8 21h8" {...COMMON}/>
    </svg>
  );
}

/** Leaf — replaces 🌿 */
export function LeafGlyph({ size = 18, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...rest}>
      <path d="M5 19c4 0 8-1 11-4s4-7 4-11c-4 0-8 1-11 4S5 15 5 19z" {...COMMON}/>
      <path d="M5 19c3-3 6-5 11-9" {...COMMON} strokeWidth={1.3}/>
    </svg>
  );
}

/** Tractor / vehicle — replaces 🚜 */
export function TractorGlyph({ size = 18, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...rest}>
      <circle cx="7" cy="18" r="3" {...COMMON}/>
      <circle cx="17" cy="18" r="2" {...COMMON}/>
      <path d="M3 15h10l2-6h4l1 3v6" {...COMMON}/>
      <path d="M13 9V6h-3v3" {...COMMON}/>
    </svg>
  );
}

/** Camera — replaces 📷 */
export function CameraGlyph({ size = 18, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...rest}>
      <path d="M4 8h3l2-2h6l2 2h3v11H4z" {...COMMON}/>
      <circle cx="12" cy="13" r="3.5" {...COMMON}/>
    </svg>
  );
}

/** Check / done — replaces ✅ */
export function CheckGlyph({ size = 18, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...rest}>
      <circle cx="12" cy="12" r="9" {...COMMON}/>
      <path d="M8 12.5l3 3 5-6" {...COMMON} strokeWidth={1.8}/>
    </svg>
  );
}

/** Cross / failed — replaces ❌ */
export function CrossGlyph({ size = 18, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...rest}>
      <circle cx="12" cy="12" r="9" {...COMMON}/>
      <path d="M9 9l6 6M15 9l-6 6" {...COMMON} strokeWidth={1.8}/>
    </svg>
  );
}

/** Pencil / write — replaces 📝 */
export function PencilGlyph({ size = 18, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...rest}>
      <path d="M4 20h4l10-10-4-4L4 16z" {...COMMON}/>
      <path d="M14 6l4 4" {...COMMON}/>
    </svg>
  );
}

/** Bar chart — replaces 📊 */
export function ChartGlyph({ size = 18, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...rest}>
      <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" {...COMMON}/>
    </svg>
  );
}

/** Sparkle / celebrate — replaces 🎉 */
export function SparkleGlyph({ size = 18, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...rest}>
      <path d="M12 4v4M12 16v4M4 12h4M16 12h4" {...COMMON}/>
      <path d="M7 7l2 2M15 15l2 2M7 17l2-2M15 9l2-2" {...COMMON} strokeWidth={1.3}/>
      <circle cx="12" cy="12" r="2.5" {...COMMON}/>
    </svg>
  );
}

export default {
  WheatGlyph,
  SeedlingGlyph,
  LeafGlyph,
  TractorGlyph,
  CameraGlyph,
  CheckGlyph,
  CrossGlyph,
  PencilGlyph,
  ChartGlyph,
  SparkleGlyph,
};
