/**
 * FarmBenchmarkCard — season-over-season performance comparison.
 *
 * Fetches benchmarks from GET /api/v2/farm-benchmarks/:farmId.
 * Shows: yield, revenue, costs, profit — current vs previous, with trends.
 * Farm-scoped: clears and re-fetches when currentFarmId changes.
 * Dark theme, low-literacy friendly.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useProfile } from '../context/ProfileContext.jsx';
import { useStrictTranslation as useTranslation } from '../i18n/useStrictTranslation.js';
import { useNetwork } from '../context/NetworkContext.jsx';
import { getFarmBenchmarks } from '../lib/api.js';

const TREND_ICONS = { up: '\u25B2', down: '\u25BC', flat: '\u25CF', no_data: '\u2014' };

function TrendBadge({ trend, changePercent, inverted }) {
  // inverted = true for costs (up is bad, down is good)
  let color = 'rgba(255,255,255,0.4)';
  if (trend === 'up') color = inverted ? '#FCA5A5' : '#86EFAC';
  if (trend === 'down') color = inverted ? '#86EFAC' : '#FCA5A5';
  if (trend === 'flat') color = '#FDBA74';

  return (
    <span style={{ color, fontSize: '0.75rem', fontWeight: 600 }}>
      {TREND_ICONS[trend] || '\u2014'}
      {changePercent != null && ` ${changePercent > 0 ? '+' : ''}${changePercent}%`}
    </span>
  );
}

export default function FarmBenchmarkCard() {
  const { currentFarmId, profile } = useProfile();
  const { isOnline } = useNetwork();
  const { t } = useTranslation();

  const [benchmark, setBenchmark] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const prevFarmIdRef = useRef(null);

  const fetchBenchmarks = useCallback(async (farmId) => {
    if (!farmId || !isOnline) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getFarmBenchmarks(farmId);
      setBenchmark(data.benchmark || null);
    } catch (err) {
      console.error('Failed to fetch benchmarks:', err);
      setError(err.message || 'Failed to load benchmarks');
      setBenchmark(null);
    } finally {
      setLoading(false);
    }
  }, [isOnline]);

  useEffect(() => {
    if (currentFarmId && currentFarmId !== prevFarmIdRef.current) {
      setBenchmark(null);
      prevFarmIdRef.current = currentFarmId;
      fetchBenchmarks(currentFarmId);
    } else if (currentFarmId && !prevFarmIdRef.current) {
      prevFarmIdRef.current = currentFarmId;
      fetchBenchmarks(currentFarmId);
    }
  }, [currentFarmId, fetchBenchmarks]);

  if (!profile) return null;

  if (loading) {
    return (
      <div style={S.card} data-testid="farm-benchmark-card">
        <h3 style={S.title}>{t('benchmark.title')}</h3>
        <div style={S.loadingText}>{t('benchmark.loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={S.card} data-testid="farm-benchmark-card">
        <h3 style={S.title}>{t('benchmark.title')}</h3>
        <div style={S.errorText}>{error}</div>
      </div>
    );
  }

  if (!benchmark) return null;

  // Not enough data
  if (!benchmark.hasEnoughData) {
    return (
      <div style={S.card} data-testid="farm-benchmark-card">
        <h3 style={S.title}>{t('benchmark.title')}</h3>
        <div style={S.noDataWrap}>
          <span style={S.noDataIcon}>📊</span>
          <div style={S.noDataText}>
            {benchmark.insufficientDataReason || t('benchmark.noData')}
          </div>
          <div style={S.noDataHint}>{t('benchmark.noDataHint')}</div>
        </div>

        {/* Still show current totals if available */}
        {benchmark.currentTotals && (benchmark.currentTotals.harvestCount > 0 || benchmark.currentTotals.costCount > 0) && (
          <div style={S.currentOnlySection}>
            <div style={S.currentOnlyTitle}>{t('benchmark.currentPeriod')}</div>
            <div style={S.currentOnlyGrid}>
              {benchmark.currentTotals.harvestCount > 0 && (
                <div style={S.miniStat}>
                  <div style={S.miniValue}>{benchmark.currentTotals.totalHarvested}</div>
                  <div style={S.miniLabel}>{t('benchmark.yield')}</div>
                </div>
              )}
              {benchmark.currentTotals.totalRevenue != null && (
                <div style={S.miniStat}>
                  <div style={S.miniValue}>{benchmark.currentTotals.totalRevenue.toLocaleString()}</div>
                  <div style={S.miniLabel}>{t('benchmark.revenue')}</div>
                </div>
              )}
              {benchmark.currentTotals.costCount > 0 && (
                <div style={S.miniStat}>
                  <div style={S.miniValue}>{benchmark.currentTotals.totalCosts.toLocaleString()}</div>
                  <div style={S.miniLabel}>{t('benchmark.costs')}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full comparison
  const metrics = [
    { key: 'yield', data: benchmark.yield, label: t('benchmark.yield'), inverted: false },
    { key: 'revenue', data: benchmark.revenue, label: t('benchmark.revenue'), inverted: false },
    { key: 'costs', data: benchmark.costs, label: t('benchmark.costs'), inverted: true },
    { key: 'profit', data: benchmark.profit, label: t('benchmark.profit'), inverted: false },
  ];

  return (
    <div style={S.card} data-testid="farm-benchmark-card">
      <div style={S.headerRow}>
        <h3 style={S.title}>{t('benchmark.title')}</h3>
        <span style={S.periodLabel}>
          {benchmark.currentPeriod?.label} {t('benchmark.vs')} {benchmark.previousPeriod?.label}
        </span>
      </div>

      <div style={S.metricsGrid}>
        {metrics.map(({ key, data, label, inverted }) => (
          <div key={key} style={S.metricCard}>
            <div style={S.metricLabel}>{label}</div>
            <div style={S.metricRow}>
              <div style={S.metricCurrent}>
                {data.current != null ? data.current.toLocaleString() : '--'}
              </div>
              <TrendBadge
                trend={data.trend}
                changePercent={data.changePercent}
                inverted={inverted}
              />
            </div>
            <div style={S.metricPrev}>
              {t('benchmark.prev')}: {data.previous != null ? data.previous.toLocaleString() : '--'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────

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
  periodLabel: {
    fontSize: '0.6875rem',
    color: 'rgba(255,255,255,0.4)',
    fontStyle: 'italic',
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
  // ─── No data state ──────────
  noDataWrap: {
    textAlign: 'center',
    marginTop: '1rem',
    padding: '1rem',
  },
  noDataIcon: {
    fontSize: '2rem',
  },
  noDataText: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.5)',
    marginTop: '0.5rem',
  },
  noDataHint: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.35)',
    marginTop: '0.25rem',
  },
  currentOnlySection: {
    marginTop: '0.75rem',
    padding: '0.75rem',
    borderRadius: '10px',
    background: '#111827',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  currentOnlyTitle: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: '0.5rem',
  },
  currentOnlyGrid: {
    display: 'flex',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  miniStat: {
    textAlign: 'center',
    flex: 1,
    minWidth: '4rem',
  },
  miniValue: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#fff',
  },
  miniLabel: {
    fontSize: '0.625rem',
    color: 'rgba(255,255,255,0.4)',
    marginTop: '0.125rem',
  },
  // ─── Full comparison ────────
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '0.625rem',
    marginTop: '1rem',
  },
  metricCard: {
    padding: '0.75rem',
    borderRadius: '10px',
    background: '#111827',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  metricLabel: {
    fontSize: '0.6875rem',
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    marginBottom: '0.25rem',
  },
  metricRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
  },
  metricCurrent: {
    fontSize: '1.125rem',
    fontWeight: 700,
    color: '#fff',
  },
  metricPrev: {
    fontSize: '0.6875rem',
    color: 'rgba(255,255,255,0.35)',
    marginTop: '0.25rem',
  },
};
