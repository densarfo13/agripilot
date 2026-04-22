/**
 * CropImage — canonical crop-image renderer.
 *
 *   <CropImage cropKey="MAIZE" alt="Your maize farm" size={64} circular />
 *
 * Props:
 *   cropKey   — canonical crop identifier (case-insensitive). Supports
 *               uppercase storage codes ('MAIZE'), lowercase
 *               ('maize'), display strings ('Maize') and structured
 *               "other" values (falls back to the placeholder).
 *   alt       — required. Accessibility label describing what the
 *               image represents for the current farmer. Callers
 *               typically pass the localised crop label.
 *   size      — square side length in px (default 64). Enforced via
 *               fixed width + height + object-fit: cover so the image
 *               never squishes.
 *   circular  — boolean (default false). When true, renders inside a
 *               perfect circle — matches the existing Farroway crop
 *               card look.
 *   style     — optional inline overrides merged onto the wrapper.
 *   imgStyle  — optional inline overrides merged onto the <img>.
 *   testId    — optional data-testid forwarded to the wrapper.
 *   onLoadedSrc — optional callback receiving the resolved URL after
 *                 the image successfully loads (placeholder vs actual).
 *
 * Behaviour:
 *   1. `getCropImagePath(cropKey)` picks the webp for that crop.
 *   2. If the catalog has no mapping, we render the placeholder
 *      straight away — no broken-image flash.
 *   3. If the mapping exists but the asset doesn't physically resolve
 *      at runtime (404), the <img>'s onError swaps in the
 *      placeholder once and sets a guard so we never loop.
 *   4. Loading is `loading="lazy"` + `decoding="async"` — safe for
 *      long lists and mobile data.
 */

import { useState } from 'react';
import {
  getCropImagePath, CROP_IMAGE_PLACEHOLDER,
} from '../config/cropImages.js';

export default function CropImage({
  cropKey,
  alt,
  size = 96,             // Spec §CSS: 72–96 px default. 96 reads
                         //   cleanly in top-crop grids + crop info.
  circular = false,
  style = null,
  imgStyle = null,
  testId = null,
  onLoadedSrc = null,
  className = '',
} = {}) {
  const mapped = getCropImagePath(cropKey);
  const initial = mapped || CROP_IMAGE_PLACEHOLDER;
  const [src, setSrc] = useState(initial);
  const [fellBack, setFellBack] = useState(!mapped);

  function handleError() {
    if (fellBack) return;   // already tried the fallback — stop
    setFellBack(true);
    setSrc(CROP_IMAGE_PLACEHOLDER);
  }

  function handleLoad() {
    if (typeof onLoadedSrc === 'function') onLoadedSrc(src);
  }

  const radius = circular ? '50%' : '14px';
  const wrapperStyle = {
    ...S.wrap,
    width:  `${size}px`,
    height: `${size}px`,
    borderRadius: radius,
    ...(style || {}),
  };

  const imgAriaLabel = alt && alt.length > 0 ? alt : 'Crop image';
  const wrapperClass = `crop-image${className ? ' ' + className : ''}`;

  return (
    <div
      className={wrapperClass}
      style={wrapperStyle}
      data-testid={testId || 'crop-image'}
      data-crop-key={String(cropKey || '').toLowerCase() || 'unknown'}
      data-fallback={fellBack ? 'true' : undefined}
    >
      <img
        src={src}
        alt={imgAriaLabel}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        onError={handleError}
        onLoad={handleLoad}
        style={{
          ...S.img,
          borderRadius: radius,
          ...(imgStyle || {}),
        }}
      />
    </div>
  );
}

const S = {
  wrap: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    // Subtle depth — matches the Farroway card family shadow so the
    // image reads as "a crop thumbnail" not "a floating emoji".
    boxShadow: '0 6px 14px rgba(0,0,0,0.28)',
    flexShrink: 0,
  },
  img: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center',
    display: 'block',
  },
};
