import React, { useState, useCallback, useRef } from 'react';
import { useTranslation } from '../i18n/index.js';
import { useMyAlerts } from '../hooks/useIntelligence.js';
import AlertCard from '../components/intelligence/AlertCard.jsx';
import { COLORS } from '../constants/intelligence.js';
import { tSafe } from '../i18n/tSafe.js';

const PAGE_SIZE = 10;

export default function RegionalWatch() {
  const { t } = useTranslation();
  const { alerts: rawAlerts, loading, error, refetch } = useMyAlerts();

  const [activeTab, setActiveTab] = useState('active');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [refreshing, setRefreshing] = useState(false);
  const touchStartY = useRef(null);

  const alerts = Array.isArray(rawAlerts) ? rawAlerts : (rawAlerts?.alerts || []);

  const activeAlerts = alerts.filter(
    a => a.sentStatus !== 'expired' && a.sentStatus !== 'suppressed'
  );
  const pastAlerts = alerts.filter(
    a => a.sentStatus === 'expired' || a.sentStatus === 'suppressed'
  );

  const currentList = activeTab === 'active' ? activeAlerts : pastAlerts;
  const visibleAlerts = currentList.slice(0, visibleCount);
  const hasMore = visibleCount < currentList.length;

  const lastUpdated = alerts.length > 0
    ? new Date(Math.max(...alerts.map(a => new Date(a.updatedAt || a.createdAt || 0).getTime())))
    : null;

  const handleTabSwitch = useCallback((tab) => {
    setActiveTab(tab);
    setVisibleCount(PAGE_SIZE);
  }, []);

  const handleLoadMore = useCallback(() => {
    setVisibleCount(prev => prev + PAGE_SIZE);
  }, []);

  const handleTouchStart = useCallback((e) => {
    if (window.scrollY === 0) {
      touchStartY.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchEnd = useCallback((e) => {
    if (touchStartY.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    touchStartY.current = null;
    if (deltaY > 80 && !refreshing) {
      setRefreshing(true);
      refetch()?.finally(() => setRefreshing(false)) || setRefreshing(false);
    }
  }, [refreshing, refetch]);

  const errorMsg = error ? (typeof error === 'string' ? error : error.message || t('pest.loadError')) : '';

  if (loading && alerts.length === 0) {
    return (
      <div style={S.page}>
        <div style={S.container}>
          <div style={S.loadingCenter}>
            <div style={S.spinner} />
            <p style={{ color: COLORS.subtext }}>{t('pest.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (errorMsg && alerts.length === 0) {
    return (
      <div style={S.page}>
        <div style={S.container}>
          <div style={S.errorBox}>{errorMsg}</div>
          <button style={S.retryBtn} onClick={() => refetch()}>
            {tSafe('pest.retry', '')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={S.page}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div style={S.container}>
        {/* Pull-to-refresh indicator */}
        {refreshing && (
          <div style={S.refreshIndicator}>
            <div style={S.spinnerSmall} />
            <span style={{ color: COLORS.subtext, fontSize: '0.8rem' }}>
              {tSafe('pest.refreshing', '')}
            </span>
          </div>
        )}

        {/* Header */}
        <h1 style={S.title}>{t('regional.title')}</h1>
        <p style={S.subtitle}>{t('regional.subtitle')}</p>

        {/* Last updated */}
        {lastUpdated && (
          <div style={S.lastUpdated}>
            {tSafe('regional.lastUpdated', '')}: {lastUpdated.toLocaleString()}
          </div>
        )}

        {/* Tabs */}
        <div style={S.tabRow}>
          <button
            style={{
              ...S.tab,
              background: activeTab === 'active' ? COLORS.green : 'transparent',
              color: activeTab === 'active' ? COLORS.text : COLORS.subtext,
              borderColor: activeTab === 'active' ? COLORS.green : 'rgba(255,255,255,0.12)',
            }}
            onClick={() => handleTabSwitch('active')}
          >
            {tSafe('regional.active', '')} ({activeAlerts.length})
          </button>
          <button
            style={{
              ...S.tab,
              background: activeTab === 'past' ? COLORS.muted : 'transparent',
              color: activeTab === 'past' ? COLORS.text : COLORS.subtext,
              borderColor: activeTab === 'past' ? COLORS.muted : 'rgba(255,255,255,0.12)',
            }}
            onClick={() => handleTabSwitch('past')}
          >
            {tSafe('regional.past', '')} ({pastAlerts.length})
          </button>
        </div>

        {/* Alert list */}
        {currentList.length === 0 ? (
          <div style={S.emptyCard}>
            <div style={S.emptyIcon}>
              {activeTab === 'active' ? '\u2705' : '\uD83D\uDCCB'}
            </div>
            <h2 style={S.emptyTitle}>
              {activeTab === 'active'
                ? (tSafe('regional.allClear', ''))
                : (tSafe('regional.noPast', ''))}
            </h2>
            <p style={S.emptyText}>
              {activeTab === 'active'
                ? (tSafe('regional.allClearMsg', ''))
                : (tSafe('regional.noPastMsg', ''))}
            </p>
          </div>
        ) : (
          <>
            {visibleAlerts.map(alert => (
              <div key={alert.id || alert._id} style={S.alertWrap}>
                <AlertCard
                  alert={alert}
                  dimmed={activeTab === 'past'}
                />
              </div>
            ))}

            {/* Load more */}
            {hasMore && (
              <button style={S.loadMoreBtn} onClick={handleLoadMore}>
                {tSafe('regional.loadMore', '')} ({currentList.length - visibleCount} {tSafe('regional.remaining', '')})
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: COLORS.bg,
    color: COLORS.text,
    padding: '1rem 1rem 2rem',
  },
  container: {
    maxWidth: '48rem',
    margin: '0 auto',
  },
  refreshIndicator: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '0.5rem',
    marginBottom: '0.5rem',
  },
  title: {
    fontSize: '1.4rem',
    fontWeight: 700,
    margin: '0 0 0.25rem',
  },
  subtitle: {
    fontSize: '0.9rem',
    color: COLORS.subtext,
    margin: '0 0 0.75rem',
  },
  lastUpdated: {
    fontSize: '0.75rem',
    color: COLORS.muted,
    marginBottom: '1rem',
  },
  tabRow: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '1.25rem',
  },
  tab: {
    flex: 1,
    padding: '12px',
    borderRadius: '10px',
    border: '1.5px solid',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: '44px',
    transition: 'all 0.15s',
  },
  alertWrap: {
    marginBottom: '0.75rem',
  },
  emptyCard: {
    borderRadius: '16px',
    background: COLORS.card,
    border: '1px solid ' + COLORS.cardBorder,
    padding: '2.5rem 1.5rem',
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: '2.5rem',
    marginBottom: '0.75rem',
  },
  emptyTitle: {
    fontSize: '1.15rem',
    fontWeight: 700,
    margin: '0 0 0.5rem',
  },
  emptyText: {
    fontSize: '0.9rem',
    color: COLORS.subtext,
    margin: 0,
    lineHeight: 1.5,
  },
  loadMoreBtn: {
    width: '100%',
    padding: '14px',
    borderRadius: '10px',
    border: '1.5px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.04)',
    color: COLORS.subtext,
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: '48px',
    marginTop: '0.5rem',
  },
  loadingCenter: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '50vh',
    gap: '1rem',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid rgba(255,255,255,0.15)',
    borderTopColor: COLORS.green,
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  spinnerSmall: {
    width: '18px',
    height: '18px',
    border: '2px solid rgba(255,255,255,0.15)',
    borderTopColor: COLORS.green,
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  errorBox: {
    background: 'rgba(252,165,165,0.1)',
    border: '1px solid #FCA5A5',
    borderRadius: '10px',
    padding: '0.75rem 1rem',
    color: '#FCA5A5',
    fontSize: '0.85rem',
    marginBottom: '1rem',
    marginTop: '2rem',
  },
  retryBtn: {
    padding: '12px 24px',
    borderRadius: '10px',
    border: '1.5px solid rgba(255,255,255,0.15)',
    background: 'transparent',
    color: COLORS.subtext,
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: '44px',
  },
};
