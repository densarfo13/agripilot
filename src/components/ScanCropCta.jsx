/**
 * ScanCropCta — bottom-of-Today affordance for ad-hoc problem
 * reporting.
 *
 *   <ScanCropCta onScan={() => ...} />
 *
 *   ┌──────────────────────────────────────────────┐
 *   │ 📷  See something wrong? Scan your crop  ›   │
 *   └──────────────────────────────────────────────┘
 *
 * Strict-rule audit
 *   * One short line; never overflows on phone width
 *   * Tap target ≥ 56px tall
 *   * tSafe friendly: every visible string routes through tSafe
 *   * Coexists with the daily task flow — this is a SECONDARY
 *     entry point so a farmer who notices a problem mid-day can
 *     act without waiting for tomorrow's task
 *   * Defensive: onScan can be null; the component still renders
 *     and silently no-ops on tap (callers that haven't wired up
 *     a handler shouldn't see runtime errors)
 */

import React from 'react';
import { tSafe } from '../i18n/tSafe.js';

export default function ScanCropCta({ onScan = null }) {
  function handleClick() {
    if (typeof onScan === 'function') {
      try { onScan(); }
      catch { /* never propagate from a CTA click */ }
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      style={S.btn}
      data-testid="scan-crop-cta"
    >
      <span style={S.icon} aria-hidden="true">{'\uD83D\uDCF7'}</span>
      <span style={S.text}>
        {tSafe('today.scan.cta', 'See something wrong? Scan your crop')}
      </span>
      <span style={S.chevron} aria-hidden="true">{'\u203A'}</span>
    </button>
  );
}

const S = {
  btn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.625rem',
    width: '100%',
    minHeight: '56px',
    padding: '0.75rem 1rem',
    borderRadius: '14px',
    border: '1px dashed rgba(255,255,255,0.18)',
    background: 'rgba(255,255,255,0.04)',
    color: '#EAF2FF',
    fontSize: '0.9375rem',
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'left',
    WebkitTapHighlightColor: 'transparent',
    transition: 'background 0.15s ease',
    overflowWrap: 'break-word',
    wordBreak: 'break-word',
  },
  icon: {
    fontSize: '1.125rem',
    lineHeight: 1,
    flexShrink: 0,
  },
  text: {
    flex: 1,
    minWidth: 0,
    overflowWrap: 'break-word',
  },
  chevron: {
    fontSize: '1.25rem',
    lineHeight: 1,
    color: 'rgba(255,255,255,0.45)',
    flexShrink: 0,
  },
};
