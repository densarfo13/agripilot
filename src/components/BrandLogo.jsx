/**
 * BrandLogo — the canonical brand entry point used by every
 * surface in the app (admin, dashboard, farmer, NGO, landing,
 * auth pages, splash, error boundary, etc).
 *
 *   <BrandLogo />                                 // sm dark on light bg
 *   <BrandLogo variant="light" size="md" />       // for dark backgrounds
 *   <BrandLogo variant="dark"  size="md" showTagline />
 *   <BrandLogo iconOnly size="sm" />              // bare icon (sidebar, chips)
 *
 * Props (per the v3 brand spec):
 *   variant   "dark" | "light"
 *               • "dark"  = wordmark in navy — for white / light bg
 *               • "light" = wordmark in white — for dark bg
 *   size      "sm" | "md" | "lg"   (px: 20 / 32 / 48)
 *   iconOnly  boolean   — suppress wordmark, render the leaf only
 *   showTagline boolean — show the two-tone "Know what to do.
 *                         Grow better." line under the wordmark
 *
 * The actual SVG geometry + the two-tone tagline rendering
 * lives inside FarrowayLogo so we don't duplicate it. This
 * component just normalises the public prop API and is what
 * every page should import from now on.
 *
 * Strict-rule audit
 *   * Single source of truth: every other component imports
 *     `BrandLogo` from this file. No page should reach into
 *     `FarrowayLogo` directly.
 *   * Backwards-compatible: `FarrowayLogo` itself still
 *     exists and still works (it's the underlying primitive)
 *     so old imports don't break during migration.
 */

import React from 'react';
import FarrowayLogo from './FarrowayLogo.jsx';

const SIZE_PX = Object.freeze({
  sm: 20,
  md: 32,
  lg: 48,
});

export default function BrandLogo({
  variant     = 'dark',     // "dark" | "light"  (per spec semantics)
  size        = 'md',       // "sm" | "md" | "lg"
  iconOnly    = false,
  showTagline = false,
  ...rest
}) {
  // Map our public variant → FarrowayLogo's internal variant.
  // BrandLogo's "dark" = dark wordmark = on light bg.
  // BrandLogo's "light" = light wordmark = on dark bg.
  const innerVariant = variant === 'light' ? 'onDark' : 'onLight';
  const px = SIZE_PX[size] || SIZE_PX.md;

  return (
    <FarrowayLogo
      size={px}
      variant={innerVariant}
      iconOnly={iconOnly}
      showTagline={showTagline}
      {...rest}
    />
  );
}
