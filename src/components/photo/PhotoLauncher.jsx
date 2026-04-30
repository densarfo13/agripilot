/**
 * PhotoLauncher — "Scan crop" entry chip / FAB that opens the
 * PhotoIntelligence sheet.
 *
 * Variants (matching VoiceLauncher conventions):
 *   chip      — compact pill, in-line on cards
 *   inline    — link-style for header / row use
 *   floating  — circular FAB that sits BESIDE the voice FAB
 *               on Home / Tasks / My Farm (right-aligned at
 *               left of the voice FAB so they don't overlap)
 *
 * Hides quietly when FEATURE_PHOTO_INTELLIGENCE is off.
 */

import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import { isFeatureEnabled } from '../../utils/featureFlags.js';
import PhotoIntelligence from './PhotoIntelligence.jsx';

export default function PhotoLauncher({
  variant = 'chip',
  farmId = null,
  cropId = null,
  label,
  style,
}) {
  const [open, setOpen] = React.useState(false);

  if (!isFeatureEnabled('FEATURE_PHOTO_INTELLIGENCE')) return null;

  const text = label || tSafe('photo.scanCrop', 'Scan crop');
  const styles = pickStyles(variant);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ ...styles.btn, ...(style || {}) }}
        aria-label={text}
        data-testid="photo-launcher"
      >
        <span style={styles.icon} aria-hidden="true">{'\uD83D\uDCF7'}</span>
        {variant !== 'floating' && (
          <span style={styles.text}>{text}</span>
        )}
      </button>
      <PhotoIntelligence
        open={open}
        onClose={() => setOpen(false)}
        farmId={farmId}
        cropId={cropId}
      />
    </>
  );
}

function pickStyles(variant) {
  if (variant === 'floating') return FLOATING;
  if (variant === 'inline')   return INLINE;
  return CHIP;
}

const CHIP = {
  btn: {
    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
    padding: '0.5rem 0.875rem',
    borderRadius: 999,
    border: '1px solid rgba(59,130,246,0.32)',
    background: 'rgba(59,130,246,0.10)',
    color: '#93C5FD',
    fontSize: '0.8125rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 36,
  },
  icon: { fontSize: '0.95rem', lineHeight: 1 },
  text: { lineHeight: 1 },
};

const FLOATING = {
  btn: {
    position: 'fixed',
    // Sits to the LEFT of the voice FAB so the two don't
    // overlap. Voice FAB is `right: 1rem`; the photo FAB is
    // 1rem + 56 (FAB size) + 12 gap = ~84px right offset.
    right: 'calc(1rem + 68px)',
    bottom: 'calc(74px + env(safe-area-inset-bottom, 0px))',
    width: 56, height: 56,
    borderRadius: 999,
    border: 'none',
    background: '#3B82F6',
    color: '#fff',
    fontSize: '1.4rem',
    cursor: 'pointer',
    boxShadow: '0 12px 24px rgba(0,0,0,0.35)',
    zIndex: 90,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: '1.4rem', lineHeight: 1 },
  text: {},
};

const INLINE = {
  btn: {
    display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
    padding: '0.375rem 0.625rem',
    borderRadius: 8,
    border: 'none',
    background: 'transparent',
    color: '#93C5FD',
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: 32,
  },
  icon: { fontSize: '0.95rem', lineHeight: 1 },
  text: { lineHeight: 1 },
};
