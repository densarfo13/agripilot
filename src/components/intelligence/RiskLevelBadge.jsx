import React from 'react';
import { useTranslation } from '../../i18n/index.js';

const LEVEL_COLORS = {
  low: '#22C55E',
  moderate: '#FBBF24',
  high: '#FB923C',
  urgent: '#EF4444',
};

const FALLBACK_COLOR = '#64748B';

const SIZES = {
  sm: { fontSize: '0.75rem', padding: '4px 10px', iconSize: '0.85rem' },
  md: { fontSize: '0.875rem', padding: '6px 14px', iconSize: '1rem' },
  lg: { fontSize: '1rem', padding: '8px 18px', iconSize: '1.2rem' },
};

export default function RiskLevelBadge({ level, score, size = 'md', variant = 'pill' }) {
  const { t } = useTranslation();
  const color = LEVEL_COLORS[level] || FALLBACK_COLOR;
  const sz = SIZES[size] || SIZES.md;
  const isPill = variant !== 'tag';

  const levelKey = `pest.level.${level}`;
  const displayLabel = LEVEL_COLORS[level] ? t(levelKey) : (level || 'unknown');

  const variantStyle = isPill
    ? { borderRadius: '999px', padding: sz.padding }
    : { borderRadius: '6px', padding: `${parseInt(sz.padding) + 2}px ${parseInt(sz.padding.split(' ')[1]) + 4}px` };

  const tagPadding = isPill
    ? sz.padding
    : (() => {
        const parts = sz.padding.split(' ');
        const v = parseInt(parts[0]) + 2;
        const h = parseInt(parts[1]) + 4;
        return `${v}px ${h}px`;
      })();

  return (
    <span
      style={{
        ...S.badge,
        background: `${color}22`,
        border: `1.5px solid ${color}`,
        padding: tagPadding,
        fontSize: sz.fontSize,
        borderRadius: isPill ? '999px' : '6px',
      }}
    >
      <span style={{ ...S.dot, background: color, width: sz.iconSize, height: sz.iconSize }} />
      <span style={{ color, fontWeight: 700 }}>{displayLabel}</span>
      {score != null && <span style={{ ...S.score, color }}>{score}</span>}
    </span>
  );
}

const S = {
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
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
