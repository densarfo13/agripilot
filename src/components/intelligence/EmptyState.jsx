import React from 'react';

const ICON_MAP = {
  shield: '\uD83D\uDEE1\uFE0F',
  search: '\uD83D\uDD0D',
  alert: '\uD83D\uDD14',
  chart: '\uD83D\uDCCA',
  leaf: '\uD83C\uDF3F',
  bug: '\uD83D\uDC1B',
  sun: '\u2600\uFE0F',
  rain: '\uD83C\uDF27\uFE0F',
  check: '\u2705',
  empty: '\uD83D\uDCED',
};

export default function EmptyState({ icon, title, subtitle, actionLabel, onAction }) {
  const displayIcon = ICON_MAP[icon] || icon || '\uD83D\uDCED';

  return (
    <div style={S.container}>
      <div style={S.icon}>{displayIcon}</div>
      {title && <div style={S.title}>{title}</div>}
      {subtitle && <p style={S.subtitle}>{subtitle}</p>}
      {actionLabel && onAction && (
        <button style={S.button} onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

const S = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem 1.5rem',
    textAlign: 'center',
  },
  icon: {
    fontSize: '2.5rem',
    marginBottom: '1rem',
    lineHeight: 1,
  },
  title: {
    fontSize: '1.1rem',
    fontWeight: 600,
    color: '#F1F5F9',
    marginBottom: '0.5rem',
  },
  subtitle: {
    fontSize: '0.875rem',
    color: '#64748B',
    margin: '0 0 1.25rem',
    lineHeight: 1.5,
    maxWidth: '300px',
  },
  button: {
    padding: '10px 20px',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#FFFFFF',
    background: '#22C55E',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
};
