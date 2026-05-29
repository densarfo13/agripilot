/**
 * PlantImage.jsx — single image component used by every plant
 * surface (MyPlants / PlantProfile / Scan / Daily Briefing /
 * Recommendations).
 *
 *   <PlantImage
 *     plantId="rose"
 *     plantLibraryImage="/realism/flowers/rose.jpg"
 *     alt="Rose"
 *     size="hero"  // 'thumb' | 'card' | 'hero'
 *   />
 *
 * What this is
 * ────────────
 *   Renders the 4-tier-fallback resolved image (verified →
 *   library → scan → placeholder) as a responsive <img> with
 *   lazy loading, async decoding, and Cloudinary-aware srcset.
 *
 *   `size` maps to one of 3 default width caps so consumers
 *   don't need to think about pixel sizes:
 *     thumb  — 96..192   (list row)
 *     card   — 192..384  (grid card)
 *     hero   — 384..1280 (profile + cards)
 *
 *   Production-mode cartoon block — if the resolved URL matches
 *   cartoon / illustration / sketch substrings AND
 *   `NODE_ENV === 'production'`, the image is replaced by the
 *   placeholder; the resolver's source becomes 'placeholder'.
 *
 * Strict-rule audit
 *   • Pure render. SSR-safe (typeof window guards inside the
 *     image service if needed).
 *   • All copy via tSafe (alt attribute respects caller).
 *   • No fetch from the component layer; image URLs are passed
 *     to <img>, the browser handles lazy loading.
 */

import React, { useMemo } from 'react';
import {
  resolvePlantImage, PLACEHOLDER_DATA_URI,
} from '../../runtime/plants/images/PlantImageRegistry';
import {
  buildResponsiveSet, RESPONSIVE_WIDTHS,
} from '../../runtime/plants/images/PlantImageService';

const SIZE_WIDTHS = {
  thumb: [RESPONSIVE_WIDTHS[0], RESPONSIVE_WIDTHS[1]],          // 96, 192
  card:  [RESPONSIVE_WIDTHS[1], RESPONSIVE_WIDTHS[2]],          // 192, 384
  hero:  [RESPONSIVE_WIDTHS[2], RESPONSIVE_WIDTHS[3], RESPONSIVE_WIDTHS[4]],
                                                                // 384, 768, 1280
};

const SIZE_HINT = {
  thumb: '96px',
  card:  '(max-width: 640px) 50vw, 192px',
  hero:  '(max-width: 640px) 96vw, (max-width: 1024px) 48vw, 768px',
};

const SIZE_DEFAULTS = {
  thumb: { width: 48, height: 48,  borderRadius: 8 },
  card:  { width: '100%', height: 120, borderRadius: 10 },
  hero:  { width: '100%', height: 200, borderRadius: 14 },
};

export default function PlantImage({
  plantId,
  plantLibraryImage,
  scanImage,
  scanGallery,
  alt,
  size = 'card',
  style,
  testid,
}) {
  const resolved = useMemo(() => resolvePlantImage({
    plantId, plantLibraryImage, scanImage, scanGallery,
  }), [plantId, plantLibraryImage, scanImage, scanGallery]);

  const widths = SIZE_WIDTHS[size] || SIZE_WIDTHS.card;

  const set = useMemo(() => buildResponsiveSet(resolved.imageUrl, {
    widths,
    sizes: SIZE_HINT[size] || SIZE_HINT.card,
    alt,
  }), [resolved.imageUrl, widths, size, alt]);

  // Production-mode block degrades to placeholder (matches the
  // 4-tier fallback's last step).
  const useUrl = set.blocked
    ? PLACEHOLDER_DATA_URI
    : (set.src || resolved.imageUrl || PLACEHOLDER_DATA_URI);
  const useSrcSet = set.blocked ? '' : set.srcSet;
  const useSizes  = set.blocked ? ''  : set.sizes;

  const visualStyle = Object.assign(
    {
      display: 'block',
      objectFit: 'cover',
      background: 'rgba(31,41,51,0.04)',
    },
    SIZE_DEFAULTS[size] || SIZE_DEFAULTS.card,
    style || {}
  );

  return (
    <img
      src={useUrl}
      srcSet={useSrcSet || undefined}
      sizes={useSizes || undefined}
      alt={alt || 'Plant image'}
      loading="lazy"
      decoding="async"
      style={visualStyle}
      data-testid={testid || 'plant-image'}
      data-plant-image-source={resolved.source}
      data-plant-image-size={size}
    />
  );
}
