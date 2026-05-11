/**
 * LandHealthCard — compact satellite-derived land status for Home (Farm mode).
 *
 *   <LandHealthCard location={{ lat, lng }} onAction={() => navigate('/scan')} />
 *
 * Three sealed display states (per spec §7):
 *
 *   Healthy   → "Keep monitoring"
 *   Watch     → "Check irrigation and crop stress"
 *   Critical  → "Inspect crop area today"
 *
 * When no coordinates are available, renders a calm prompt:
 *   "Add farm location to unlock land health."
 *
 * Strict-rule audit
 *   • Pure presentational on top of useFarmHealth.
 *   • Never throws. Loading + error states render calm placeholders.
 *   • Never exposes raw NDVI percentages — only the sealed label.
 *     (The 0..1 NDVI is still available on the hook for admin views.)
 *   • Soft Ochre / olive tone palette so the card sits next to
 *     FarmHealthCard without competing for attention.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { tSafe } from '../../i18n/tSafe.js';
import { PREMIUM_TOKENS as T } from '../premium/tokens.js';
import useFarmHealth from '../../hooks/useFarmHealth.js';

const STATUS_TONES = {
  healthy:  { bg: 'rgba(110,139,97,0.16)',  border: 'rgba(110,139,97,0.40)',  ink: '#86EFAC' },
  watch:    { bg: 'rgba(200,148,77,0.16)',  border: 'rgba(200,148,77,0.40)',  ink: '#F5C97D' },
  critical: { bg: 'rgba(198,90,75,0.16)',   border: 'rgba(198,90,75,0.42)',   ink: '#F5A8A0' },
  unknown:  { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.12)', ink: 'rgba(255,255,255,0.78)' },
};

function _statusCopy(status) {
  switch (status) {
    case 'healthy':
      return {
        label:  tSafe('landHealth.status.healthy',  'Healthy'),
        action: tSafe('landHealth.action.healthy',  'Keep monitoring — fields look stable.'),
      };
    case 'watch':
      return {
        label:  tSafe('landHealth.status.watch',    'Watch'),
        action: tSafe('landHealth.action.watch',    'Check irrigation and crop stress.'),
      };
    case 'critical':
      return {
        label:  tSafe('landHealth.status.critical', 'Critical'),
        action: tSafe('landHealth.action.critical', 'Inspect crop area today.'),
      };
    default:
      return {
        label:  tSafe('landHealth.status.unknown',  'Limited data'),
        action: tSafe('landHealth.action.unknown',  'Walk the fields when the light is good.'),
      };
  }
}

function _LeafIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 19c4 0 8-1 11-4s4-7 4-11c-4 0-8 1-11 4S5 15 5 19z"
            stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" fill="none"/>
      <path d="M5 19c3-3 6-5 11-9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

function _SatelliteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 14l6-6 4 4-6 6-4-4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" fill="none"/>
      <path d="M14 4l6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <circle cx="17" cy="7" r="1.4" fill="currentColor"/>
      <path d="M14 18a4 4 0 0 0 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
    </svg>
  );
}

export default function LandHealthCard({
  location = null,
  onAction = null,
  testId = 'land-health-card',
}) {
  const { health, loading, hasCoords } = useFarmHealth(location);

  // No coordinates → calm prompt with deep-link to /my-farm where
  // the user can add the field location. Never shows the section
  // header alone with no actionable content.
  if (!hasCoords) {
    return (
      <section style={S.card} data-testid={testId} data-state="no-location">
        <header style={S.header}>
          <span style={S.headerIcon} aria-hidden="true"><_SatelliteIcon /></span>
          <h3 style={S.title}>{tSafe('landHealth.title', 'Land health')}</h3>
        </header>
        <p style={S.emptyBody}>
          {tSafe(
            'landHealth.emptyNoLocation',
            'Add farm location to unlock land health.',
          )}
        </p>
        <Link to="/my-farm" style={S.emptyCta} data-testid={`${testId}-cta-add-location`}>
          {tSafe('landHealth.addLocation', 'Add farm location')}
          <span aria-hidden="true" style={S.chev}>{'›'}</span>
        </Link>
      </section>
    );
  }

  if (loading && !health) {
    return (
      <section style={S.card} data-testid={testId} data-state="loading">
        <header style={S.header}>
          <span style={S.headerIcon} aria-hidden="true"><_SatelliteIcon /></span>
          <h3 style={S.title}>{tSafe('landHealth.title', 'Land health')}</h3>
        </header>
        <p style={S.emptyBody}>
          {tSafe('landHealth.checking', 'Checking satellite signal…')}
        </p>
      </section>
    );
  }

  const status = (health && health.status) || 'unknown';
  const tone = STATUS_TONES[status] || STATUS_TONES.unknown;
  const copy = _statusCopy(status);

  function handleAction() {
    if (typeof onAction === 'function') {
      try { onAction({ status }); } catch { /* swallow — UI must not crash */ }
    }
  }

  return (
    <section style={S.card} data-testid={testId} data-state={status}>
      <header style={S.header}>
        <span style={S.headerIcon} aria-hidden="true"><_SatelliteIcon /></span>
        <h3 style={S.title}>{tSafe('landHealth.title', 'Land health')}</h3>
        <span
          style={{
            ...S.statusPill,
            background: tone.bg,
            border: `1px solid ${tone.border}`,
            color: tone.ink,
          }}
          data-testid={`${testId}-status`}
        >
          <_LeafIcon />
          <span style={{ marginLeft: 4 }}>{copy.label}</span>
        </span>
      </header>

      <p style={S.actionLine} data-testid={`${testId}-action`}>
        {copy.action}
      </p>

      {typeof onAction === 'function' && (
        <button
          type="button"
          onClick={handleAction}
          style={S.actionBtn}
          data-testid={`${testId}-cta`}
        >
          <span>{tSafe('landHealth.openScan', 'Scan crop area')}</span>
          <span aria-hidden="true" style={S.chev}>{'›'}</span>
        </button>
      )}
    </section>
  );
}

const S = {
  card: {
    background: T.panelHi,
    border: `1px solid ${T.border}`,
    borderRadius: 14,
    padding: '0.95rem 1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.55rem',
    boxShadow: T.shadowCard,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  headerIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: T.ochreSoft,
    color: T.ochreInk,
    border: `1px solid ${T.ochreBorder}`,
    flexShrink: 0,
  },
  title: {
    margin: 0,
    fontSize: '0.95rem',
    fontWeight: 800,
    letterSpacing: '-0.005em',
    color: T.ink,
    flex: 1,
  },
  statusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.25rem 0.55rem',
    borderRadius: 999,
    fontSize: '0.78rem',
    fontWeight: 700,
  },
  actionLine: {
    margin: 0,
    fontSize: '0.92rem',
    fontWeight: 600,
    color: T.ink,
    lineHeight: 1.35,
  },
  emptyBody: {
    margin: 0,
    fontSize: '0.88rem',
    fontWeight: 500,
    color: T.inkDim,
    lineHeight: 1.4,
  },
  emptyCta: {
    alignSelf: 'flex-start',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    marginTop: '0.15rem',
    fontSize: '0.85rem',
    fontWeight: 700,
    color: T.ochreInk,
    textDecoration: 'none',
  },
  actionBtn: {
    alignSelf: 'flex-start',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    padding: '0.45rem 0.75rem',
    border: `1px solid ${T.ochreBorder}`,
    borderRadius: 999,
    background: T.ochreSoft,
    color: T.ochreInk,
    fontSize: '0.85rem',
    fontWeight: 700,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  chev: {
    fontSize: '1rem',
    fontWeight: 700,
    lineHeight: 1,
  },
};
