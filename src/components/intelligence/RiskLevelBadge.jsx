import React from 'react';
import { useTranslation } from '../../i18n/index.js';

const LEVEL_COLORS = {
  low: '#22C55E',
  moderate: '#FBBF24',
  high: '#FB923C',
  urgent: '#EF4444',
};

const SIZES = {
  sm: { fontSize: '0.75rem', padding: '4px 10px', iconSize: '0.85rem' },
  md: { fontSize: '0.875rem', padding: '6px 14px', iconSize: '1rem' },
  lg: { fontSize: '1rem', padding: '8px 18px', iconSize: '1.2rem' },
};

export default function RiskLevelBadge({ level, score, size = 'md' }) {
  const { t } = useTranslation();
  const color = LEVEL_COLORS[level] || LEVEL_COLORS.moderate;
  const sz = SIZES[size] || SIZES.md;

  const levelKey = `pest.level.${level}`;

  return (
    <span style={{ ...S.badge, background: `${color}22`, border: `1.5px solid ${color}`, padding: sz.padding, fontSize: sz.fontSize }}>
      <span style={{ ...S.dot, background: color, width: sz.iconSize, height: sz.iconSize }} />
      <span style={{ color, fontWeight: 700 }}>{t(levelKey)}</span>
      {score != null && <span style={{ ...S.score, color }}>{score}</span>}
    </span>
  );
}

const S = {
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    borderRadius: '999px',
    whiteSpace: 'nowrap',
  },
  dot: {
    borderRadius: '50%',
    flexShrink: 0,
  },
  score: {
    fontWeight: 600,
    marginLeft: '2px',
  },
};
