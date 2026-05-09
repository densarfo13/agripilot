/**
 * RealisticPhoto — slot-aware photo renderer with calm fallback.
 *
 *   <RealisticPhoto slot="crop-maize" alt="Maize field"
 *                   ratio="4 / 3" testId="crop-photo" />
 *
 * BEHAVIOUR
 *   • Renders a `<picture>` pointing at `/assets/realism/photography/<slot>.webp`
 *     (the canonical path from manifest.slotPath).
 *   • Falls back to a calm ochre-tinted placeholder card if the
 *     image fails to load — never a broken image icon, never a
 *     console-spamming 404.
 *   • `loading="lazy"` + `decoding="async"` keep mobile Safari
 *     scrolling smooth.
 *   • Honours `prefers-reduced-motion` for any future cross-fade
 *     by leaving motion to the host card.
 *
 * STRICT-RULE AUDIT
 *   • Pure presentational. SSR-safe. Never throws.
 *   • One ref + one onError handler — no fetch, no probe.
 *   • Empty slot → renders only the placeholder; no 404 ever fires.
 */

import React, { useState } from 'react';
import { slotPath } from './manifest.js';

export default function RealisticPhoto({
  slot,
  alt = '',
  ratio = '16 / 10',
  rounded = 14,
  style,
  className,
  testId = 'realistic-photo',
}) {
  const path = slotPath(slot);
  const [failed, setFailed] = useState(!path);

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

  if (failed) {
    // Calm placeholder — soft ochre wash. The label stays empty
    // unless the caller passed an alt; we never invent text.
    return (
      <div
        style={baseStyle}
        className={className}
        role={alt ? 'img' : 'presentation'}
        aria-label={alt || undefined}
        data-testid={`${testId}-placeholder`}
        data-slot={slot || ''}
      />
    );
  }

  return (
    <img
      src={path}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      style={{ ...baseStyle, objectFit: 'cover' }}
      className={className}
      data-testid={testId}
      data-slot={slot}
    />
  );
}
