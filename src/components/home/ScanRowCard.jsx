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

function _cameraIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 4 7 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3l-2-2H9z"
            stroke="#86EFAC" strokeWidth="1.7" strokeLinejoin="round" fill="none"/>
      <circle cx="12" cy="13" r="3.6" stroke="#86EFAC" strokeWidth="1.7" fill="none"/>
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
  card: {
    appearance: 'none',
    fontFamily: 'inherit',
    cursor: 'pointer',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
    padding: '0.95rem 1rem',
    background:    'linear-gradient(180deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.02) 100%)',
    border:        '1px solid rgba(255,255,255,0.07)',
    borderRadius:  '16px',
    color:         'rgba(255,255,255,0.95)',
    textAlign:     'left',
    boxShadow:     '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 8px 18px -8px rgba(0,0,0,0.35)',
    WebkitTapHighlightColor: 'transparent',
  },
  iconWrap: {
    width: 44, height: 44,
    flexShrink: 0,
    borderRadius: 12,
    background: 'rgba(34,197,94,0.18)',
    border: '1px solid rgba(34,197,94,0.45)',
    boxShadow: '0 0 0 4px rgba(34,197,94,0.05)',
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
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: '0.85rem',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.62)',
    lineHeight: 1.4,
  },
  chev: {
    fontSize: '1.4rem',
    fontWeight: 700,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 1,
    flexShrink: 0,
    paddingLeft: '0.4rem',
  },
};
