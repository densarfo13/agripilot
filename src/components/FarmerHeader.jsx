/**
 * FarmerHeader — compact welcome with avatar, name, weather chip + trust signal.
 *
 * Layout: [avatar] [name + subtitle] ......... [weather chip]
 *         [last updated line — small, right-aligned]
 * Tap weather chip → expand inline advice card.
 */
import { useState, useEffect, useRef } from 'react';
import { getCropLabel } from '../utils/crops.js';
import { getAvatar } from '../utils/avatarStorage.js';
import FarmerAvatar from './FarmerAvatar.jsx';

export default function FarmerHeader({ user, profile, t, weatherDecision, onRefreshWeather }) {
  const [expanded, setExpanded] = useState(false);

  // Force re-render every 60s so "Updated X min ago" stays current
  const [, setTick] = useState(0);
  const tickRef = useRef(null);
  useEffect(() => {
    tickRef.current = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(tickRef.current);
  }, []);

  const name = user?.fullName || profile?.farmerName || '';
  const displayName = name || t('dashboard.welcome') || 'Welcome';
  const rawCrop = profile?.cropType || profile?.crop || '';
  const cropDisplay = getCropLabel(rawCrop);
  const locationName = profile?.location || profile?.locationLabel || profile?.locationName || '';
  const subtitle = [locationName, cropDisplay].filter(Boolean).join(' \u2022 ');

  const wd = weatherDecision;
  const hasChip = wd && (wd.chipIcon || wd.chipTemp);
  const guidance = wd?.guidance;

  return (
    <div>
      <div style={S.row}>
        {/* Left: avatar + name */}
        <FarmerAvatar fullName={name} profileImageUrl={getAvatar()} size={40} />
        <div style={S.nameCol}>
          <h1 style={S.name}>{t('dashboard.hello', { name: displayName })}</h1>
          {subtitle && <p style={S.subtitle}>{subtitle}</p>}
        </div>

        {/* Right: weather chip */}
        {hasChip && (
          <button onClick={() => setExpanded(!expanded)} style={S.wxChip} aria-label="Weather">
            <span style={S.wxIcon}>{wd.chipIcon}</span>
            {wd.chipTemp && <span style={S.wxTemp}>{wd.chipTemp}</span>}
            <span style={S.wxInsight}>{wd.chipLabel}</span>
          </button>
        )}
      </div>

      {/* Last updated trust line */}
      {wd && wd.lastUpdatedLabel && (
        <div style={{
          ...S.updatedLine,
          color: wd.isStale ? 'rgba(250,204,21,0.6)' : 'rgba(255,255,255,0.25)',
        }}>
          {wd.isStale && <span style={S.staleIcon}>{'\u26A0\uFE0F'}</span>}
          <span>{wd.isStale ? t('wx.stale') : wd.lastUpdatedLabel}</span>
          {wd.isAging && <span> \u2022 {wd.lastUpdatedLabel}</span>}
        </div>
      )}

      {/* Expanded weather advice card */}
      {expanded && guidance && (
        <div style={S.wxCard}>
          <div style={S.wxCardRow}>
            <span style={S.wxCardIcon}>{guidance.icon}</span>
            <div style={S.wxCardText}>
              <div style={S.wxCardTitle}>{t(guidance.recommendationKey, guidance.params)}</div>
              {guidance.reasonKey && (
                <div style={S.wxCardReason}>{t(guidance.reasonKey, guidance.params)}</div>
              )}
            </div>
          </div>
          {wd.lastUpdatedLabel && (
            <div style={S.wxCardUpdated}>{wd.lastUpdatedLabel}</div>
          )}
          <button onClick={() => setExpanded(false)} style={S.wxClose}>{t('common.close') || 'Close'}</button>
        </div>
      )}
    </div>
  );
}

const S = {
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.25rem 0',
  },
  nameCol: { flex: 1, minWidth: 0 },
  name: {
    fontSize: '1.25rem', fontWeight: 700, margin: 0, lineHeight: 1.2,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  subtitle: {
    fontSize: '0.8125rem', color: 'rgba(255,255,255,0.45)',
    margin: 0, marginTop: '0.15rem',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  // Weather chip
  wxChip: {
    display: 'flex', alignItems: 'center', gap: '0.25rem',
    padding: '0.3rem 0.5rem', borderRadius: '10px',
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
    cursor: 'pointer', flexShrink: 0,
    WebkitTapHighlightColor: 'transparent',
    minHeight: '36px',
  },
  wxIcon: { fontSize: '1rem' },
  wxTemp: { fontSize: '0.8125rem', fontWeight: 700, color: '#fff' },
  wxInsight: { fontSize: '0.6875rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)' },
  // Last updated line
  updatedLine: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    justifyContent: 'flex-end',
    fontSize: '0.625rem',
    fontWeight: 500,
    padding: '0.15rem 0 0',
  },
  staleIcon: { fontSize: '0.6875rem' },
  // Expanded card
  wxCard: {
    marginTop: '0.5rem', padding: '0.875rem 1rem',
    borderRadius: '14px', background: '#1B2330',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  wxCardRow: { display: 'flex', alignItems: 'flex-start', gap: '0.625rem' },
  wxCardIcon: { fontSize: '1.5rem', flexShrink: 0, marginTop: '0.1rem' },
  wxCardText: { flex: 1 },
  wxCardTitle: { fontSize: '0.9375rem', fontWeight: 700, color: '#fff', lineHeight: 1.3 },
  wxCardReason: { fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', marginTop: '0.2rem', lineHeight: 1.4 },
  wxCardUpdated: {
    fontSize: '0.625rem', color: 'rgba(255,255,255,0.25)',
    marginTop: '0.5rem', textAlign: 'right',
  },
  wxClose: {
    marginTop: '0.625rem', padding: '0.375rem 0.75rem',
    borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)',
    background: 'transparent', color: 'rgba(255,255,255,0.4)',
    fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
};
