/**
 * FarmHarvestCard — compact harvest & post-harvest workflow display.
 *
 * Fetches recommendations from GET /api/v2/farm-harvest/:farmId.
 * Shows title, priority, dueLabel, reason, recommended action.
 * Farm-scoped: clears and re-fetches when currentFarmId changes.
 * Dark theme, low-literacy friendly.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useProfile } from '../context/ProfileContext.jsx';
import { useTranslation } from '../i18n/index.js';
import { getFarmHarvest } from '../lib/api.js';
import { useNetwork } from '../context/NetworkContext.jsx';

const PRIORITY_COLORS = {
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#6B7280',
};

const CATEGORY_ICONS = {
  'harvest-readiness': '🌾',
  'post-harvest': '📦',
};

export default function FarmHarvestCard() {
  const { currentFarmId, profile } = useProfile();
  const { isOnline } = useNetwork();
  const { t } = useTranslation();
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const prevFarmIdRef = useRef(null);

  const fetchHarvest = useCallback(async (farmId) => {
    if (!farmId || !isOnline) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getFarmHarvest(farmId);
      setRecs(data.recommendations || []);
    } catch (err) {
      console.error('Failed to fetch harvest recommendations:', err);
      setError(err.message || 'Failed to load recommendations');
      setRecs([]);
    } finally {
      setLoading(false);
    }
  }, [isOnline]);

  useEffect(() => {
    if (currentFarmId && currentFarmId !== prevFarmIdRef.current) {
      setRecs([]);
      prevFarmIdRef.current = currentFarmId;
      fetchHarvest(currentFarmId);
    } else if (currentFarmId && !prevFarmIdRef.current) {
      prevFarmIdRef.current = currentFarmId;
      fetchHarvest(currentFarmId);
    }
  }, [currentFarmId, fetchHarvest]);

  if (!profile) return null;

  if (loading) {
    return (
      <div style={S.card} data-testid="farm-harvest-card">
        <h3 style={S.title}>{t('harvest.title')}</h3>
        <div style={S.loadingText}>{t('harvest.loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={S.card} data-testid="farm-harvest-card">
        <h3 style={S.title}>{t('harvest.title')}</h3>
        <div style={S.errorText}>{error}</div>
      </div>
    );
  }

  if (recs.length === 0) {
    return (
      <div style={S.card} data-testid="farm-harvest-card">
        <h3 style={S.title}>{t('harvest.title')}</h3>
        <div style={S.emptyText}>{t('harvest.noRecs')}</div>
      </div>
    );
  }

  const readiness = recs.filter((r) => r.category === 'harvest-readiness');
  const postHarvest = recs.filter((r) => r.category === 'post-harvest');

  return (
    <div style={S.card} data-testid="farm-harvest-card">
      <div style={S.headerRow}>
        <h3 style={S.title}>{t('harvest.title')}</h3>
        <span style={S.countBadge}>{recs.length} {t('harvest.items')}</span>
      </div>

      <div style={S.recList}>
        {[...readiness, ...postHarvest].map((rec) => (
          <div key={rec.id} style={S.recItem}>
            <div style={S.recHeader}>
              <div style={S.recTitleRow}>
                <span style={S.catIcon}>{CATEGORY_ICONS[rec.category] || '🌾'}</span>
                <span style={S.recTitle}>{rec.title}</span>
              </div>
              <div style={S.recMeta}>
                <span style={{
                  ...S.priorityLabel,
                  color: PRIORITY_COLORS[rec.priority] || PRIORITY_COLORS.low,
                }}>
                  {t(`harvest.priority.${rec.priority}`)}
                </span>
                <span style={S.dueLabel}>{rec.dueLabel}</span>
              </div>
            </div>

            <div style={S.recReason}>{rec.reason}</div>

            <div style={S.recAction}>
              <span style={S.actionIcon}>💡</span>
              <span>{rec.action}</span>
            </div>

            {rec.category === 'post-harvest' && (
              <div style={S.postHarvestTag}>{t('harvest.postHarvestTag')}</div>
            )}

            {rec.confidenceNote && (
              <div style={S.confidenceNote}>
                <span style={S.actionIcon}>ℹ</span>
                <span>{rec.confidenceNote}</span>
              </div>
            )}

            {rec.weatherAdjusted && (
              <div style={S.weatherTag}>{t('harvest.weatherAdjusted')}</div>
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
  countBadge: {
    fontSize: '0.8125rem',
    color: '#FDBA74',
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
  recList: {
    marginTop: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  recItem: {
    borderRadius: '12px',
    background: '#111827',
    border: '1px solid rgba(255,255,255,0.08)',
    padding: '1rem',
  },
  recHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  recTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  catIcon: {
    fontSize: '1rem',
    flexShrink: 0,
  },
  recTitle: {
    fontWeight: 600,
    color: '#fff',
    fontSize: '0.9375rem',
  },
  recMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexShrink: 0,
  },
  priorityLabel: {
    fontSize: '0.6875rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  dueLabel: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.45)',
  },
  recReason: {
    fontSize: '0.8125rem',
    color: 'rgba(255,255,255,0.6)',
    marginTop: '0.5rem',
    lineHeight: 1.5,
  },
  recAction: {
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
  postHarvestTag: {
    marginTop: '0.375rem',
    fontSize: '0.625rem',
    color: '#FDBA74',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
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
