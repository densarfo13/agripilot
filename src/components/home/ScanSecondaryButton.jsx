/**
 * ScanSecondaryButton — soft outline scan CTA used as the SINGLE
 * secondary action on Home (after the WeatherHeroActionCard).
 *
 *   <ScanSecondaryButton mode="farm" />
 *   <ScanSecondaryButton mode="garden" />
 *
 * Why a separate, smaller button vs the legacy ScanHero card
 * ──────────────────────────────────────────────────────────
 *   The audit calls for ONE secondary action below the weather
 *   hero — alive but not dominant. ScanHero is a full-card CTA
 *   designed for empty-state surfaces; this button is the calmer
 *   inline version that fits next to the today-task card.
 *
 * Behaviour
 *   • Tap → /scan (canonical scan route).
 *   • Copy adapts via mode: "Scan crop" (farm) / "Scan plant" (garden).
 *   • Fires `scan_cta_clicked` so the existing Home funnel still
 *     observes the button.
 *
 * Strict-rule audit
 *   • Pure presentational. Never throws.
 *   • No emoji as primary visual — uses an inline SVG camera icon.
 *   • Inline styles only — zero CSS-module dependency.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { tSafe } from '../../i18n/tSafe.js';
import { trackSafeEvent } from '../../lib/safeEventTracker.js';

export default function ScanSecondaryButton({
  mode = 'farm',
  testId = 'home-scan-secondary',
}) {
  const navigate = useNavigate();
  const isGarden = mode === 'garden';

  const label = isGarden
    ? tSafe('actions.scanPlant', 'Scan plant')
    : tSafe('actions.scanCrop',  'Scan crop');

  function handleTap() {
    try {
      trackSafeEvent('scan_cta_clicked', {
        experience: isGarden ? 'garden' : 'farm',
        source:     'home-secondary',
      });
    } catch { /* swallow */ }
    try { navigate('/scan'); }
    catch { /* swallow */ }
  }

  return (
    <button
      type="button"
      onClick={handleTap}
      style={S.button}
      data-testid={testId}
      data-mode={isGarden ? 'garden' : 'farm'}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        style={S.icon}
      >
        <path
          d="M9 4 7 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3l-2-2H9z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
          fill="none"
        />
        <circle
          cx="12"
          cy="13"
          r="3.4"
          stroke="currentColor"
          strokeWidth="1.6"
          fill="none"
        />
      </svg>
      <span style={S.label}>{label}</span>
    </button>
  );
}

const S = {
  button: {
    appearance:    'none',
    fontFamily:    'inherit',
    cursor:        'pointer',
    display:       'inline-flex',
    alignItems:    'center',
    justifyContent:'center',
    gap:           '0.55rem',
    padding:       '0.7rem 1.15rem',
    background:    'rgba(200,148,77,0.08)',
    border:        '1px solid rgba(200,148,77,0.32)',
    borderRadius:  '999px',
    color:         '#86EFAC',
    fontSize:      '0.875rem',
    fontWeight:    700,
    minHeight:     42,
    boxShadow:     '0 0 0 1px rgba(200,148,77,0.04), 0 6px 16px -8px rgba(200,148,77,0.35)',
    transition:    'transform 160ms ease-out, box-shadow 200ms ease-out',
    letterSpacing: '0.01em',
    alignSelf:     'flex-start',
  },
  icon: {
    flexShrink: 0,
  },
  label: {
    whiteSpace: 'nowrap',
  },
};
