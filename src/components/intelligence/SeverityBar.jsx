import React from 'react';
import { useTranslation } from '../../i18n/index.js';

function barColor(score) {
  if (score <= 25) return '#22C55E';
  if (score <= 50) return '#FBBF24';
  if (score <= 75) return '#FB923C';
  return '#EF4444';
}

export default function SeverityBar({ score, label }) {
  const { t } = useTranslation();
  const pct = Math.min(100, Math.max(0, score || 0));
  const color = barColor(pct);

  return (
    <div style={S.wrap}>
      {label && (
        <div style={S.labelRow}>
          <span style={S.label}>{label}</span>
          <span style={{ ...S.value, color }}>{pct}</span>
        </div>
      )}
      <div style={S.track}>
        <div
          style={{ ...S.fill, width: `${pct}%`, background: color }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}

const S = {
  wrap: {
    width: '100%',
  },
  labelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px',
  },
  label: {
    fontSize: '0.85rem',
    color: '#94A3B8',
  },
  value: {
    fontSize: '0.95rem',
    fontWeight: 700,
  },
  track: {
    width: '100%',
    height: '10px',
    borderRadius: '5px',
    background: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: '5px',
    transition: 'width 0.4s ease',
  },
};
