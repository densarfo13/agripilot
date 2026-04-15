/**
 * FarmPestRiskCard — compact pest & disease risk display for a specific farm.
 *
 * Fetches risks from GET /api/v2/farm-risks/:farmId.
 * Shows risk title, severity, reason, recommended action.
 * Farm-scoped: clears and re-fetches when currentFarmId changes.
 * Dark theme, low-literacy friendly.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useProfile } from '../context/ProfileContext.jsx';
import { useTranslation } from '../i18n/index.js';
import { getFarmRisks } from '../lib/api.js';
import { useNetwork } from '../context/NetworkContext.jsx';

const SEVERITY_COLORS = {
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#6B7280',
};

const SEVERITY_BG = {
  high: 'rgba(239,68,68,0.12)',
  medium: 'rgba(245,158,11,0.12)',
  low: 'rgba(107,114,128,0.08)',
};

export default function FarmPestRiskCard() {
  const { currentFarmId, profile } = useProfile();
  const { isOnline } = useNetwork();
  const { t } = useTranslation();
  const [risks, setRisks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const prevFarmIdRef = useRef(null);

  const fetchRisks = useCallback(async (farmId) => {
    if (!farmId || !isOnline) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getFarmRisks(farmId);
      setRisks(data.risks || []);
    } catch (err) {
      console.error('Failed to fetch farm risks:', err);
      setError(err.message || 'Failed to load risks');
      setRisks([]);
    } finally {
      setLoading(false);
    }
  }, [isOnline]);

  useEffect(() => {
    if (currentFarmId && currentFarmId !== prevFarmIdRef.current) {
      setRisks([]);
      prevFarmIdRef.current = currentFarmId;
      fetchRisks(currentFarmId);
    } else if (currentFarmId && !prevFarmIdRef.current) {
      prevFarmIdRef.current = currentFarmId;
      fetchRisks(currentFarmId);
    }
  }, [currentFarmId, fetchRisks]);

  if (!profile) return null;

  if (loading) {
    return (
      <div style={S.card} data-testid="farm-pest-risk-card">
        <h3 style={S.title}>{t('pestRisk.title')}</h3>
        <div style={S.loadingText}>{t('pestRisk.loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={S.card} data-testid="farm-pest-risk-card">
        <h3 style={S.title}>{t('pestRisk.title')}</h3>
        <div style={S.errorText}>{error}</div>
      </div>
    );
  }

  if (risks.length === 0) {
    return (
      <div style={S.card} data-testid="farm-pest-risk-card">
        <h3 style={S.title}>{t('pestRisk.title')}</h3>
        <div style={S.emptyText}>{t('pestRisk.noRisks')}</div>
      </div>
    );
  }

  const highRisks = risks.filter((r) => r.severity === 'high');
  const otherRisks = risks.filter((r) => r.severity !== 'high');

  return (
    <div style={S.card} data-testid="farm-pest-risk-card">
      <div style={S.headerRow}>
        <h3 style={S.title}>{t('pestRisk.title')}</h3>
        {highRisks.length > 0 && (
          <span style={S.alertCount}>{highRisks.length} {t('pestRisk.highAlerts')}</span>
        )}
      </div>

      <div style={S.riskList}>
        {[...highRisks, ...otherRisks].map((risk) => (
          <div
            key={risk.id}
            style={{
              ...S.riskItem,
              borderLeft: `3px solid ${SEVERITY_COLORS[risk.severity] || SEVERITY_COLORS.low}`,
            }}
          >
            <div style={S.riskHeader}>
              <div style={S.riskTitleRow}>
                <span style={S.riskIcon}>{risk.type === 'pest' ? '🐛' : '🦠'}</span>
                <span style={S.riskTitle}>{risk.title}</span>
              </div>
              <span style={{
                ...S.severityBadge,
                color: SEVERITY_COLORS[risk.severity] || SEVERITY_COLORS.low,
                background: SEVERITY_BG[risk.severity] || SEVERITY_BG.low,
              }}>
                {t(`pestRisk.severity.${risk.severity}`)}
              </span>
            </div>

            <div style={S.riskReason}>{risk.reason}</div>

            <div style={S.riskAction}>
              <span style={S.actionIcon}>💡</span>
              <span>{risk.action}</span>
            </div>

            {risk.confidenceNote && (
              <div style={S.confidenceNote}>
                <span style={S.actionIcon}>ℹ</span>
                <span>{risk.confidenceNote}</span>
              </div>
            )}

            {risk.weatherAdjusted && (
              <div style={S.weatherTag}>{t('pestRisk.weatherAdjusted')}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const S = {
  card: {
    borderRadius: '16px',
    background: '#1B2330',
    padding: '1.25rem',
    boxShadow: '0 10px 15px rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  title: {
    fontSize: '1.125rem',
    fontWeight: 600,
    margin: 0,
    color: '#fff',
  },
  alertCount: {
    fontSize: '0.8125rem',
    color: '#FCA5A5',
    fontWeight: 600,
  },
  loadingText: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.6)',
    marginTop: '0.75rem',
  },
  errorText: {
    fontSize: '0.875rem',
    color: '#FCA5A5',
    marginTop: '0.75rem',
  },
  emptyText: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.5)',
    marginTop: '0.75rem',
  },
  riskList: {
    marginTop: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  riskItem: {
    borderRadius: '12px',
    background: '#111827',
    border: '1px solid rgba(255,255,255,0.08)',
    padding: '1rem',
  },
  riskHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  riskTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  riskIcon: {
    fontSize: '1rem',
    flexShrink: 0,
  },
  riskTitle: {
    fontWeight: 600,
    color: '#fff',
    fontSize: '0.9375rem',
  },
  severityBadge: {
    fontSize: '0.6875rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    padding: '0.2rem 0.5rem',
    borderRadius: '6px',
    flexShrink: 0,
  },
  riskReason: {
    fontSize: '0.8125rem',
    color: 'rgba(255,255,255,0.6)',
    marginTop: '0.5rem',
    lineHeight: 1.5,
  },
  riskAction: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.375rem',
    marginTop: '0.5rem',
    fontSize: '0.75rem',
    color: '#FDE68A',
    lineHeight: 1.4,
  },
  actionIcon: {
    flexShrink: 0,
    fontSize: '0.75rem',
  },
  confidenceNote: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.375rem',
    marginTop: '0.375rem',
    fontSize: '0.6875rem',
    color: 'rgba(255,255,255,0.4)',
    lineHeight: 1.4,
    fontStyle: 'italic',
  },
  weatherTag: {
    marginTop: '0.375rem',
    fontSize: '0.625rem',
    color: '#93C5FD',
    fontStyle: 'italic',
  },
};
