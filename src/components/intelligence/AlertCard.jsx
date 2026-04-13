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

const LEVEL_ICONS = {
  watch: '\uD83D\uDC41\uFE0F',
  elevated: '\u26A0\uFE0F',
  high_risk: '\uD83D\uDD25',
  'high-risk': '\uD83D\uDD25',
  high: '\uD83D\uDD25',
  urgent: '\uD83D\uDEA8',
  low: '\uD83D\uDC41\uFE0F',
  moderate: '\u26A0\uFE0F',
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

function formatTimeAgo(timestamp) {
  if (!timestamp) return null;
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  if (isNaN(then)) return null;
  const diffMs = now - then;
  if (diffMs < 0) return null;

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export default function AlertCard({ alert, dimmed = false, onAction }) {
  const { t } = useTranslation();

  if (!alert) return null;

  const level = mapAlertLevel(alert.level);
  const borderColor = BORDER_COLORS[alert.level?.toLowerCase()] || BORDER_COLORS[level] || '#FBBF24';
  const timeAgo = formatTimeAgo(alert.timestamp);
  const icon = LEVEL_ICONS[alert.level?.toLowerCase()] || LEVEL_ICONS[level] || '';

  return (
    <div style={{ ...S.card, borderLeftColor: borderColor, opacity: dimmed ? 0.6 : 1 }}>
      <div style={S.header}>
        <div style={S.headerLeft}>
          {icon && <span style={S.icon}>{icon}</span>}
          <RiskLevelBadge level={level} size="sm" />
        </div>
        {timeAgo && <span style={S.time}>{timeAgo}</span>}
      </div>

      {alert.reason && <div style={S.reason}>{alert.reason}</div>}
      {alert.message && <p style={S.message}>{alert.message}</p>}

      {alert.action && (
        <div style={S.actionBox}>
          <span style={S.actionLabel}>{t('pest.whatToDo')}</span>
          <p style={S.actionText}>{alert.action}</p>
        </div>
      )}

      {onAction && alert.actionLabel && (
        <button style={S.ctaButton} onClick={() => onAction(alert)}>
          {alert.actionLabel}
        </button>
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
    transition: 'opacity 0.2s ease',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  icon: {
    fontSize: '1.1rem',
    lineHeight: 1,
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
  ctaButton: {
    marginTop: '0.75rem',
    padding: '8px 16px',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#FFFFFF',
    background: '#22C55E',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background 0.2s ease',
  },
};
