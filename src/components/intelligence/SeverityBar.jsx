import React from 'react';
import { useTranslation } from '../../i18n/index.js';

function barColor(score) {
  if (score <= 25) return '#22C55E';
  if (score <= 50) return '#FBBF24';
  if (score <= 75) return '#FB923C';
  return '#EF4444';
}

export default function SeverityBar({ score, label, showValue = true, height = 8, animate = true }) {
  const { t } = useTranslation();
  const pct = Math.min(100, Math.max(0, score || 0));
  const color = barColor(pct);

  return (
    <div style={S.wrap}>
      {(label || showValue) && (
        <div style={S.labelRow}>
          {label && <span style={S.label}>{label}</span>}
          {showValue && <span style={{ ...S.value, color }}>{pct}</span>}
        </div>
      )}
      <div style={{ ...S.track, height: `${height}px`, borderRadius: `${height / 2}px` }}>
        <div
          style={{
            ...S.fill,
            width: `${pct}%`,
            background: color,
            borderRadius: `${height / 2}px`,
            transition: animate ? 'width 0.4s ease' : 'none',
          }}
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
    background: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
};
