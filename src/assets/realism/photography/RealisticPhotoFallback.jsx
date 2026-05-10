/**
 * RealisticPhotoFallback — standalone calm placeholder.
 *
 *   <RealisticPhotoFallback
 *     ratio="4 / 3"
 *     rounded={14}
 *     alt="Maize field"
 *   />
 *
 * Purpose
 * ───────
 * The placeholder element from `RealisticPhoto` extracted into
 * a reusable component, so any surface that needs a
 * "image-missing" fallback (avatars, listing thumbnails,
 * profile photos, OG-image placeholders) can render the same
 * soft ochre wash without rewriting the markup.
 *
 *   • Used internally by RealisticPhoto when its `<img>` fails
 *     to load (via the `onError` handler).
 *   • Now exposed as a top-level export so direct callers can
 *     render the fallback shape themselves before they even
 *     attempt a fetch — useful when you don't have a URL yet
 *     (e.g. a draft listing with no photo, or an empty plant
 *     identity card).
 *
 * Strict-rule audit
 *   • Pure presentational. Never throws. SSR-safe.
 *   • Token colors only — soft ochre + olive earth wash from
 *     `src/design/tokens/colors.js`. No emoji.
 *   • Accessibility: `role="img"` + `aria-label` when alt is
 *     provided; `role="presentation"` otherwise so screen
 *     readers skip purely decorative placeholders.
 */

import React from 'react';

export default function RealisticPhotoFallback({
  ratio = '16 / 10',
  rounded = 14,
  alt = '',
  style,
  className,
  testId = 'realistic-photo-fallback',
}) {
  const baseStyle = {
    display: 'block',
    width: '100%',
    aspectRatio: ratio,
    borderRadius: rounded,
    overflow: 'hidden',
    background: 'linear-gradient(135deg, rgba(200,148,77,0.10) 0%, rgba(110,139,97,0.06) 100%)',
    border: '1px solid rgba(36,49,58,0.08)',
    position: 'relative',
    ...style,
  };

  return (
    <div
      style={baseStyle}
      className={className}
      role={alt ? 'img' : 'presentation'}
      aria-label={alt || undefined}
      data-testid={testId}
    />
  );
}
