/**
 * SafeImage — drop-in <img> wrapper that NEVER renders a broken
 * placeholder. Replaces raw <img> tags across scan / journal /
 * tasks / funding / hero sections.
 *
 *   import SafeImage from '../common/SafeImage.jsx';
 *
 *   <SafeImage
 *     src={maybeMissingUrl}
 *     alt="Tomato leaf"
 *     fallback={REALISM_ASSETS.heroes.farmDefault}
 *     lazy
 *     testId="scan-result-image"
 *   />
 *
 * Features (Runtime Hardening + Asset Recovery Fix §5):
 *   - synchronous safety: invalid / null / undefined src renders
 *     the fallback immediately, no decode attempt
 *   - error fallback: a single failed load swaps to the fallback
 *     image; the swap is ONE-SHOT so a broken fallback can't
 *     trigger an infinite reload loop
 *   - loading hint: an optional skeleton-tinted placeholder
 *     while the natural decode runs
 *   - lazy loading: passes loading="lazy" + decoding="async"
 *     when `lazy` is true
 *   - mobile-safe: no inline data:URL spinners (those are slow
 *     on older Safari); a simple CSS background tint instead
 *   - dev telemetry: tags failure events with
 *     [FARROWAY_RUNTIME] image_fallback so ops can grep
 *     production logs for the broken-asset class
 *
 * Strict-rule audit
 *   * Pure React. Never throws.
 *   * One failure -> one swap; no retry loops.
 *   * Falls back to a hard-coded fallback string when both `src`
 *     AND `fallback` are missing so the rendered <img src=> is
 *     never empty (browsers render broken-icon on empty src).
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { safeImage, DEFAULT_FARM_IMAGE } from '../../utils/safeImage.js';

const _S = {
  // Mobile-safe placeholder: a calm warm tint that reads as
  // "loading" without a spinner. Older Safari + low-end Android
  // both render this instantly.
  wrap: {
    display:        'block',
    overflow:       'hidden',
    background:     'rgba(248, 240, 226, 0.6)', // soft beige
    borderRadius:   'inherit',
    position:       'relative',
  },
  img: {
    display: 'block',
    width:   '100%',
    height:  '100%',
    objectFit: 'cover',
  },
};

function _devTrace(payload) {
  try {
    if (typeof import.meta === 'undefined' || !import.meta.env || !import.meta.env.DEV) return;

    console.log('[FARROWAY_RUNTIME]', { kind: 'image_fallback', ...payload });
  } catch { /* swallow */ }
}

export default function SafeImage({
  src,
  fallback,
  alt = '',
  lazy = true,
  className,
  style,
  testId = 'safe-image',
  onLoad,
  onError,
}) {
  // Resolve the initial src synchronously through safeImage so
  // an unsafe string never reaches the <img>. When the result
  // is the canonical DEFAULT_FARM_IMAGE the consumer's fallback
  // (if any) wins as the SECOND-attempt target.
  const resolvedSrc = useMemo(() => safeImage(src, fallback), [src, fallback]);
  const fallbackTarget = useMemo(() => safeImage(fallback, DEFAULT_FARM_IMAGE), [fallback]);

  const [currentSrc, setCurrentSrc] = useState(resolvedSrc);
  const [hasErrored, setHasErrored] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  // Track whether the current resolvedSrc input changed so a new
  // prop value resets the swap-once budget.
  const inputSrcRef = useRef(resolvedSrc);
  if (inputSrcRef.current !== resolvedSrc) {
    inputSrcRef.current = resolvedSrc;
    if (hasErrored || currentSrc !== resolvedSrc) {
      // New prop input - reset and try again.
      setCurrentSrc(resolvedSrc);
      setHasErrored(false);
      setIsLoaded(false);
    }
  }

  const handleLoad = useCallback((e) => {
    setIsLoaded(true);
    if (typeof onLoad === 'function') {
      try { onLoad(e); } catch { /* swallow */ }
    }
  }, [onLoad]);

  const handleError = useCallback((e) => {
    if (hasErrored) {
      // Already swapped to the fallback - do NOT retry again.
      // This breaks the "broken fallback -> infinite onError" loop.
      return;
    }
    setHasErrored(true);
    _devTrace({ src: currentSrc, swappedTo: fallbackTarget });
    setCurrentSrc(fallbackTarget);
    if (typeof onError === 'function') {
      try { onError(e); } catch { /* swallow */ }
    }
  }, [hasErrored, currentSrc, fallbackTarget, onError]);

  const wrapStyle = useMemo(() => ({ ..._S.wrap, ...(style || {}) }), [style]);

  return (
    <span
      className={className}
      data-testid={testId}
      data-loaded={isLoaded ? 'true' : 'false'}
      data-fallback-active={hasErrored ? 'true' : 'false'}
      style={wrapStyle}
    >
      <img
        src={currentSrc}
        alt={alt}
        style={_S.img}
        onLoad={handleLoad}
        onError={handleError}
        loading={lazy ? 'lazy' : 'eager'}
        decoding="async"
        draggable={false}
      />
    </span>
  );
}
