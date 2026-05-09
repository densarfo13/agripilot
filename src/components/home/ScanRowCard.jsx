/**
 * ScanRowCard — full-width row card that replaces the small
 * pill-shaped ScanSecondaryButton on Home so the mockup's
 * "secondary scan card" lays out correctly:
 *
 *   ┌────────────────────────────────────────────────┐
 *   │  ⬛📷  Scan crop                          ›     │
 *   │        Check your crop health                  │
 *   └────────────────────────────────────────────────┘
 *
 * Sibling surface to OnTrackRowCard + FarmGardenProfileCard;
 * the three share padding, radius, shadow, chevron and icon
 * frame so Home reads as a single visual family.
 *
 * Behaviour
 *   * Tap → /scan (canonical scan route).
 *   * Mode-aware copy: "Scan crop" / "Check your crop health"
 *     vs "Scan plant" / "Check your plant health".
 *   * Fires `scan_cta_clicked` so the existing Home funnel
 *     keeps observing the click.
 *
 * Strict-rule audit
 *   * Pure presentational. Never throws.
 *   * Inline SVG camera icon — no emoji as primary visual.
 *   * Inline styles only.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { tSafe } from '../../i18n/tSafe.js';
import { trackSafeEvent } from '../../lib/safeEventTracker.js';
import { PREMIUM_TOKENS as T } from '../premium/tokens.js';

function _cameraIcon() {
  // Ochre stroke (Soft Ochre system) — scan/inspect is a primary
  // user action, not a health signal, so it lives on the ochre
  // accent rather than growth-green.
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 4 7 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3l-2-2H9z"
            stroke="#B9853F" strokeWidth="1.7" strokeLinejoin="round" fill="none"/>
      <circle cx="12" cy="13" r="3.6" stroke="#B9853F" strokeWidth="1.7" fill="none"/>
    </svg>
  );
}

export default function ScanRowCard({
  mode = 'farm',
  testId = 'home-scan-row',
}) {
  const navigate = useNavigate();
  const isGarden = mode === 'garden';

  const title = isGarden
    ? tSafe('home.scanPlant', 'Scan plant')
    : tSafe('home.scanCrop',  'Scan crop');
  const subtitle = isGarden
    ? tSafe('home.checkPlantHealth', 'Check your plant health')
    : tSafe('home.checkCropHealth',  'Check your crop health');

  function handleTap() {
    try {
      trackSafeEvent('scan_cta_clicked', {
        experience: isGarden ? 'garden' : 'farm',
        source:     'home-row',
      });
    } catch { /* swallow */ }
    try { navigate('/scan'); }
    catch { /* swallow */ }
  }

  return (
    <button
      type="button"
      onClick={handleTap}
      style={S.card}
      data-testid={testId}
      data-mode={isGarden ? 'garden' : 'farm'}
      aria-label={title + ' — ' + subtitle}
    >
      <span style={S.iconWrap} aria-hidden="true">{_cameraIcon()}</span>

      <span style={S.textCol}>
        <span style={S.title}>{title}</span>
        <span style={S.subtitle}>{subtitle}</span>
      </span>

      <span aria-hidden="true" style={S.chev}>{'›'}</span>
    </button>
  );
}

const S = {
  // Soft Ochre system: white-on-beige surface, warm shadow.
  card: {
    appearance: 'none',
    fontFamily: 'inherit',
    cursor: 'pointer',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
    padding: '0.95rem 1rem',
    background:    T.panelHi,
    border:        `1px solid ${T.border}`,
    borderRadius:  '16px',
    color:         T.ink,
    textAlign:     'left',
    boxShadow:     T.shadowCard,
    WebkitTapHighlightColor: 'transparent',
  },
  iconWrap: {
    width: 44, height: 44,
    flexShrink: 0,
    borderRadius: 12,
    background: T.ochreSoft,
    border: `1px solid ${T.ochreBorder}`,
    boxShadow: '0 0 0 4px rgba(212,163,95,0.06)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.15rem',
    minWidth: 0,
    flex: 1,
  },
  title: {
    fontSize: '1rem',
    fontWeight: 800,
    letterSpacing: '-0.005em',
    color: T.ink,
  },
  subtitle: {
    fontSize: '0.85rem',
    fontWeight: 500,
    color: T.inkDim,
    lineHeight: 1.4,
  },
  chev: {
    fontSize: '1.4rem',
    fontWeight: 700,
    color: T.inkFaint,
    lineHeight: 1,
    flexShrink: 0,
    paddingLeft: '0.4rem',
  },
};
