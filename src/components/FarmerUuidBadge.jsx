import React from 'react';

/**
 * Displays the farmer's persistent UUID badge.
 * Receives profile from parent — no independent fetch needed.
 */
export default function FarmerUuidBadge({ profile, loading }) {
  if (loading) {
    return (
      <div style={S.badge}>
        <span style={S.label}>Farmer ID</span>
        <span style={S.uuidLoading}>Loading...</span>
      </div>
    );
  }

  return (
    <div style={S.badge}>
      <span style={S.label}>Farmer UUID</span>
      <span style={S.uuid}>{profile?.farmerUuid || 'Not assigned'}</span>
      {(profile?.farmerName || profile?.farmName) && (
        <span style={S.sub}>
          {[profile?.farmerName, profile?.farmName].filter(Boolean).join(' \u2022 ')}
        </span>
      )}
    </div>
  );
}

const S = {
  badge: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.15rem',
    background: '#162033',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    padding: '0.5rem 0.75rem',
  },
  label: {
    fontSize: '0.65rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'rgba(255,255,255,0.4)',
  },
  uuid: {
    fontSize: '0.85rem',
    fontWeight: 700,
    color: '#22C55E',
    fontFamily: 'monospace',
  },
  uuidLoading: {
    fontSize: '0.8rem',
    color: 'rgba(255,255,255,0.5)',
  },
  sub: {
    fontSize: '0.7rem',
    color: 'rgba(255,255,255,0.4)',
  },
};
