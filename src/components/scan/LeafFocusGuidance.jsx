/**
 * LeafFocusGuidance — localized chip row that surfaces the
 * leafFocusEngine's guidance flags during scan analysis.
 *
 *   <LeafFocusGuidance guidance={focusContext?.guidance} />
 *
 * Renders one calm chip per active flag. Self-suppresses when all
 * flags are false (nothing to say) — the analyzing surface stays
 * minimal in the common-case "perfect scan" path.
 *
 * Strict-rule audit
 *   • Pure JSX. Hooks-free. Never throws.
 *   • Self-suppress on null / undefined / no-flag-set input.
 *   • Strings via tSafe — all 6 locales covered by
 *     productionGapTranslations.js entries.
 *   • No emoji per design system. Inline SVG glyphs only.
 */

import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';

// One row per flag. Order matters — the most-actionable hint
// goes first so the user reads it first even on a narrow viewport.
const FLAG_ROWS = Object.freeze([
  { key: 'moveCloser',      tKey: 'scan.focus.guidance.moveCloser',
    tFallback: 'Move closer to the leaf' },
  { key: 'leafNotCentered', tKey: 'scan.focus.guidance.leafNotCentered',
    tFallback: 'Center the leaf in the frame' },
  { key: 'multipleLeaves',  tKey: 'scan.focus.guidance.multipleLeaves',
    tFallback: 'Multiple leaves detected — pick one' },
  { key: 'lightingDark',    tKey: 'scan.focus.guidance.lightingDark',
    tFallback: 'Lighting is too dark — move into brighter light' },
  { key: 'lightingBright',  tKey: 'scan.focus.guidance.lightingBright',
    tFallback: 'Glare detected — angle the camera away from light' },
  { key: 'noLeafDetected',  tKey: 'scan.focus.guidance.noLeafDetected',
    tFallback: 'No leaf detected — point camera at a leaf' },
]);

export default function LeafFocusGuidance({ guidance }) {
  if (!guidance || typeof guidance !== 'object') return null;
  const activeRows = FLAG_ROWS.filter((r) => !!guidance[r.key]);
  if (activeRows.length === 0) return null;
  return (
    <div
      style={S.row}
      role="status"
      aria-live="polite"
      data-testid="leaf-focus-guidance"
    >
      {activeRows.map((r) => (
        <span
          key={r.key}
          style={S.chip}
          data-testid={`leaf-focus-chip-${r.key}`}
        >
          <_HintGlyph />
          <span style={S.chipText}>{tSafe(r.tKey, r.tFallback)}</span>
        </span>
      ))}
    </div>
  );
}

function _HintGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"
         style={{ flexShrink: 0 }}>
      <path d="M12 3v18M3 12h18" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" />
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

const S = {
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    padding: '0 16px',
    maxWidth: '32rem',
    margin: '12px auto 0',
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    borderRadius: 999,
    background: 'rgba(200, 148, 77, 0.14)',
    border: '1px solid rgba(200, 148, 77, 0.32)',
    color: 'rgba(45, 32, 16, 0.88)',
    fontSize: '0.8125rem',
    fontWeight: 600,
    lineHeight: 1.3,
  },
  chipText: {
    whiteSpace: 'nowrap',
  },
};
