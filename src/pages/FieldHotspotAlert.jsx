import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n/index.js';
import { useProfile } from '../context/ProfileContext.jsx';
import { useFarmHotspots } from '../hooks/useIntelligence.js';
import RiskLevelBadge from '../components/intelligence/RiskLevelBadge.jsx';
import { COLORS } from '../constants/intelligence.js';

const SEVERITY_COLORS = {
  high: { bg: 'rgba(239,68,68,0.25)', border: COLORS.red, text: COLORS.red },
  moderate: { bg: 'rgba(245,158,11,0.2)', border: COLORS.amber, text: COLORS.amber },
  low: { bg: COLORS.greenLight, border: COLORS.green, text: COLORS.green },
};

const LEVEL_MAP = {
  watch: 'low',
  elevated: 'moderate',
  'high-risk': 'high',
  high_risk: 'high',
  urgent: 'urgent',
  low: 'low',
  moderate: 'moderate',
  high: 'high',
};

const TREND_ICONS = { up: '\u2191', down: '\u2193', stable: '\u2192' };
const TREND_COLORS = { up: COLORS.red, down: COLORS.green, stable: COLORS.amber };

const DEFAULT_ZONES = [
  { zone: 'NW', severity: 'low' },
  { zone: 'NE', severity: 'low' },
  { zone: 'SW', severity: 'low' },
  { zone: 'SE', severity: 'low' },
];

export default function FieldHotspotAlert() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useProfile();
  const profileId = profile?.id || profile?._id;
  const { hotspots: data, loading, error, refetch } = useFarmHotspots(profileId);

  const [refreshing, setRefreshing] = useState(false);
  const touchStartY = useRef(null);

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

  if (loading && !data) {
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

  const errorMsg = error ? (typeof error === 'string' ? error : error.message || t('pest.loadError')) : '';

  if (errorMsg && !data) {
    return (
      <div style={S.page}>
        <div style={S.container}>
          <div style={S.errorBox}>{errorMsg}</div>
          <button style={S.retryBtn} onClick={() => refetch()}>
            {t('pest.retry') || 'Retry'}
          </button>
        </div>
      </div>
    );
  }

  // data is an array of hotspot zone records from the store
  const hotspots = Array.isArray(data) ? data : (data?.hotspots || data?.data || []);

  // Derive alert level from worst hotspot severity
  const worstSeverity = hotspots.reduce((worst, h) => {
    const sev = h.severity || 'low';
    const rank = { critical: 4, high: 3, moderate: 2, low: 1 };
    return (rank[sev] || 0) > (rank[worst] || 0) ? sev : worst;
  }, 'low');
  const alertLevel = worstSeverity === 'critical' ? 'urgent' : worstSeverity;
  const badgeLevel = LEVEL_MAP[alertLevel.toLowerCase()] || 'moderate';

  // Derive trend from majority of hotspot trends
  const trendCounts = { rising: 0, stable: 0, declining: 0 };
  hotspots.forEach(h => { if (h.trend) trendCounts[h.trend] = (trendCounts[h.trend] || 0) + 1; });
  const trend = trendCounts.rising >= trendCounts.stable ? 'rising'
    : trendCounts.declining > trendCounts.stable ? 'declining' : 'stable';

  const isEmpty = hotspots.length === 0;
  const priorityZone = hotspots.length > 0 ? (hotspots[0].zone || hotspots[0].sourceType || null) : null;
  const affectedArea = null;
  const gridZones = hotspots.length > 0 ? hotspots : DEFAULT_ZONES;

  const trendColor = TREND_COLORS[trend] || COLORS.amber;
  const trendIcon = TREND_ICONS[trend] || TREND_ICONS.stable;

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
              {t('pest.refreshing') || 'Refreshing...'}
            </span>
          </div>
        )}

        {/* Overall alert level banner */}
        <div style={{
          ...S.alertBanner,
          borderColor: isEmpty ? COLORS.green : trendColor,
          background: isEmpty ? COLORS.greenLight : `${trendColor}12`,
        }}>
          <RiskLevelBadge level={badgeLevel} size="md" />
          <span style={S.alertBannerLabel}>
            {t(`pest.alertLevel.${alertLevel}`) || alertLevel}
          </span>
          {!isEmpty && (
            <span style={{ ...S.trendBadge, color: trendColor }}>
              {trendIcon} {t(`pest.trend.${trend}`) || trend}
            </span>
          )}
        </div>

        {/* Header */}
        <h1 style={S.title}>
          {isEmpty ? (t('pest.noHotspotsTitle') || 'Field Status') : t('pest.stressDetected')}
        </h1>
        <p style={S.subtitle}>
          {isEmpty
            ? (t('pest.noHotspotsSubtitle') || 'No hotspots detected in your fields. Keep monitoring regularly.')
            : t('pest.stressSubtitle')}
        </p>

        {/* Empty state */}
        {isEmpty && (
          <div style={S.emptyCard}>
            <div style={S.emptyIcon}>{'\u2705'}</div>
            <h2 style={S.emptyTitle}>{t('pest.noHotspots') || 'No Hotspots Detected'}</h2>
            <p style={S.emptyText}>
              {t('pest.noHotspotsMsg') || 'Your fields look healthy. Continue regular scouting to catch issues early.'}
            </p>
            <button style={S.ctaBtn} onClick={() => navigate('/pest-risk-check')}>
              {t('pest.runCheck') || 'Run a Pest Check'}
            </button>
          </div>
        )}

        {/* Field grid visualization */}
        {!isEmpty && (
          <>
            <div style={S.mapCard}>
              <h3 style={S.sectionTitle}>{t('pest.fieldOverview') || 'Field Overview'}</h3>
              <div style={S.mapGrid}>
                {gridZones.map((hs, i) => {
                  const sev = hs.severity || 'low';
                  const sc = SEVERITY_COLORS[sev] || SEVERITY_COLORS.low;
                  return (
                    <div
                      key={i}
                      style={{
                        ...S.mapZone,
                        background: sc.bg,
                        border: `2px solid ${sc.border}`,
                      }}
                    >
                      <span style={{ ...S.zoneLabel, color: sc.text }}>
                        {hs.zone || t('pest.zone', { n: i + 1 }) || `Zone ${i + 1}`}
                      </span>
                      <span style={{ ...S.zoneSeverity, color: sc.text }}>
                        {t(`pest.severity.${sev}`) || sev}
                      </span>
                      {hs.areaAffected && (
                        <span style={S.zoneArea}>{hs.areaAffected}</span>
                      )}
                      {hs.detectedAt && (
                        <span style={S.zoneDate}>
                          {new Date(hs.detectedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Hotspot detail cards */}
            {hotspots.map((hs, i) => {
              const sev = hs.severity || 'low';
              const sc = SEVERITY_COLORS[sev] || SEVERITY_COLORS.low;
              return (
                <div key={i} style={{ ...S.card, borderLeft: `4px solid ${sc.border}` }}>
                  <div style={S.hotspotHeader}>
                    <div>
                      <h3 style={S.hotspotZoneName}>
                        {hs.zone || t('pest.zone', { n: i + 1 }) || `Zone ${i + 1}`}
                      </h3>
                      {hs.areaAffected && (
                        <span style={S.hotspotArea}>
                          {t('pest.areaAffected') || 'Area affected'}: {hs.areaAffected}
                        </span>
                      )}
                    </div>
                    <RiskLevelBadge level={LEVEL_MAP[sev] || sev} size="sm" />
                  </div>
                  {hs.detectedAt && (
                    <span style={S.hotspotDate}>
                      {t('pest.detected') || 'Detected'}: {new Date(hs.detectedAt).toLocaleDateString()}
                    </span>
                  )}
                  {hs.description && (
                    <p style={S.hotspotDesc}>{hs.description}</p>
                  )}
                  <div style={S.hotspotActions}>
                    <button
                      style={S.actionBtn}
                      onClick={() => navigate('/pest-risk-check')}
                    >
                      {t('pest.reportPest') || 'Report Pest'}
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Affected area summary */}
            {affectedArea && (
              <div style={S.card}>
                <h3 style={S.sectionTitle}>{t('pest.affectedArea')}</h3>
                <p style={S.areaText}>{affectedArea}</p>
              </div>
            )}

            {/* Priority zone */}
            {priorityZone && (
              <div style={{ ...S.card, borderLeft: '4px solid #FB923C' }}>
                <h3 style={S.sectionTitle}>{t('pest.inspectFirst')}</h3>
                <p style={S.zoneHighlight}>{priorityZone}</p>
              </div>
            )}

            {/* Trend */}
            <div style={S.card}>
              <h3 style={S.sectionTitle}>{t('pest.riskTrend')}</h3>
              <div style={S.trendRow}>
                <span style={{ fontSize: '1.6rem', color: trendColor }}>
                  {trendIcon}
                </span>
                <div>
                  <div style={{ fontWeight: 600, color: trendColor }}>
                    {t(`pest.trend.${trend}`) || trend}
                  </div>
                  <div style={S.trendSub}>{t('pest.trendSinceLast')}</div>
                </div>
              </div>
            </div>

            {/* Report pest CTA */}
            <button style={S.ctaBtn} onClick={() => navigate('/pest-risk-check')}>
              {t('pest.uploadFromArea') || 'Report Pest from This Area'}
            </button>
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
  alertBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 1rem',
    borderRadius: '12px',
    border: '1.5px solid',
    marginBottom: '1rem',
  },
  alertBannerLabel: {
    fontSize: '0.9rem',
    fontWeight: 600,
    color: '#E2E8F0',
    flex: 1,
  },
  trendBadge: {
    fontSize: '0.8rem',
    fontWeight: 700,
  },
  title: {
    fontSize: '1.4rem',
    fontWeight: 700,
    margin: '0 0 0.25rem',
  },
  subtitle: {
    fontSize: '0.9rem',
    color: COLORS.subtext,
    margin: '0 0 1.25rem',
  },
  emptyCard: {
    borderRadius: '16px',
    background: COLORS.card,
    border: '1px solid rgba(34,197,94,0.2)',
    padding: '2.5rem 1.5rem',
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: '3rem',
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
    margin: '0 0 1.5rem',
    lineHeight: 1.5,
  },
  mapCard: {
    borderRadius: '12px',
    background: COLORS.card,
    border: '1px solid rgba(255,255,255,0.08)',
    padding: '1rem',
    marginBottom: '0.75rem',
  },
  sectionTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#F1F5F9',
    margin: '0 0 0.75rem',
  },
  mapGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
    width: '100%',
    maxWidth: '320px',
    margin: '0 auto',
  },
  mapZone: {
    borderRadius: '10px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem 0.5rem',
    minHeight: '90px',
    gap: '4px',
  },
  zoneLabel: {
    fontSize: '0.85rem',
    fontWeight: 700,
  },
  zoneSeverity: {
    fontSize: '0.7rem',
    fontWeight: 600,
    textTransform: 'uppercase',
  },
  zoneArea: {
    fontSize: '0.7rem',
    color: COLORS.subtext,
  },
  zoneDate: {
    fontSize: '0.65rem',
    color: COLORS.muted,
  },
  card: {
    borderRadius: '12px',
    background: COLORS.card,
    border: '1px solid rgba(255,255,255,0.08)',
    padding: '1rem 1.25rem',
    marginBottom: '0.75rem',
  },
  hotspotHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '0.5rem',
  },
  hotspotZoneName: {
    fontSize: '1rem',
    fontWeight: 700,
    margin: '0 0 0.25rem',
    color: '#F1F5F9',
  },
  hotspotArea: {
    fontSize: '0.8rem',
    color: COLORS.subtext,
  },
  hotspotDate: {
    fontSize: '0.75rem',
    color: COLORS.muted,
    display: 'block',
    marginBottom: '0.5rem',
  },
  hotspotDesc: {
    fontSize: '0.85rem',
    color: '#CBD5E1',
    margin: '0 0 0.75rem',
    lineHeight: 1.5,
  },
  hotspotActions: {
    display: 'flex',
    gap: '0.5rem',
  },
  actionBtn: {
    padding: '10px 20px',
    borderRadius: '8px',
    border: '1.5px solid ' + COLORS.green,
    background: COLORS.greenLight,
    color: COLORS.green,
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: '44px',
  },
  areaText: {
    fontSize: '0.95rem',
    color: '#CBD5E1',
    margin: 0,
    lineHeight: 1.5,
  },
  zoneHighlight: {
    fontSize: '0.9rem',
    color: '#FB923C',
    fontWeight: 600,
    margin: 0,
  },
  trendRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  trendSub: {
    fontSize: '0.8rem',
    color: COLORS.muted,
    marginTop: '2px',
  },
  ctaBtn: {
    width: '100%',
    padding: '16px',
    borderRadius: '12px',
    border: 'none',
    background: COLORS.green,
    color: COLORS.text,
    fontSize: '1.05rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: '52px',
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
