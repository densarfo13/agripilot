import React from 'react';
import { useTranslation } from '../../i18n/index.js';
import RiskLevelBadge from './RiskLevelBadge.jsx';

const BORDER_COLORS = {
  low: '#22C55E',
  moderate: '#FBBF24',
  high: '#FB923C',
  urgent: '#EF4444',
  watch: '#22C55E',
  elevated: '#FBBF24',
  'high-risk': '#FB923C',
};

function mapAlertLevel(level) {
  if (!level) return 'moderate';
  const l = level.toLowerCase();
  if (l === 'watch') return 'low';
  if (l === 'elevated') return 'moderate';
  if (l === 'high-risk' || l === 'high_risk') return 'high';
  if (l === 'urgent') return 'urgent';
  return l;
}

export default function AlertCard({ alert }) {
  const { t } = useTranslation();

  if (!alert) return null;

  const level = mapAlertLevel(alert.level);
  const borderColor = BORDER_COLORS[alert.level?.toLowerCase()] || BORDER_COLORS[level] || '#FBBF24';
  const timeStr = alert.timestamp
    ? new Date(alert.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div style={{ ...S.card, borderLeftColor: borderColor }}>
      <div style={S.header}>
        <RiskLevelBadge level={level} size="sm" />
        {timeStr && <span style={S.time}>{timeStr}</span>}
      </div>

      {alert.reason && <div style={S.reason}>{alert.reason}</div>}
      {alert.message && <p style={S.message}>{alert.message}</p>}

      {alert.action && (
        <div style={S.actionBox}>
          <span style={S.actionLabel}>{t('pest.whatToDo')}</span>
          <p style={S.actionText}>{alert.action}</p>
        </div>
      )}
    </div>
  );
}

const S = {
  card: {
    borderRadius: '12px',
    background: '#1B2330',
    border: '1px solid rgba(255,255,255,0.08)',
    borderLeftWidth: '4px',
    borderLeftStyle: 'solid',
    borderLeftColor: '#FBBF24',
    padding: '1rem',
    marginBottom: '0.75rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
  },
  time: {
    fontSize: '0.75rem',
    color: '#64748B',
  },
  reason: {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: '#F1F5F9',
    marginBottom: '0.35rem',
  },
  message: {
    fontSize: '0.85rem',
    color: '#94A3B8',
    margin: '0 0 0.75rem',
    lineHeight: 1.5,
  },
  actionBox: {
    background: 'rgba(34,197,94,0.08)',
    border: '1px solid rgba(34,197,94,0.2)',
    borderRadius: '8px',
    padding: '0.75rem',
  },
  actionLabel: {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#22C55E',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  actionText: {
    fontSize: '0.85rem',
    color: '#CBD5E1',
    margin: '0.35rem 0 0',
    lineHeight: 1.5,
  },
};
