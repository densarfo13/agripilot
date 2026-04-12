import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n/index.js';
import { useProfile } from '../context/ProfileContext.jsx';
import { getFarmHotspots } from '../lib/intelligenceApi.js';
import RiskLevelBadge from '../components/intelligence/RiskLevelBadge.jsx';

const LEVEL_MAP = {
  watch: 'low',
  elevated: 'moderate',
  'high-risk': 'high',
  high_risk: 'high',
  urgent: 'urgent',
};

const TREND_ICONS = { up: '\u2191', down: '\u2193', stable: '\u2192' };
const TREND_COLORS = { up: '#EF4444', down: '#22C55E', stable: '#FBBF24' };

export default function FieldHotspotAlert() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useProfile();
  const profileId = profile?.id || profile?._id;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!profileId) return;
    setLoading(true);
    getFarmHotspots(profileId)
      .then(res => { setData(res); setError(''); })
      .catch(err => setError(err.message || t('pest.loadError')))
      .finally(() => setLoading(false));
  }, [profileId, t]);

  if (loading) {
    return (
      <div style={S.page}>
        <div style={S.container}>
          <div style={S.loadingCenter}>
            <div style={S.spinner} />
            <p style={{ color: '#94A3B8' }}>{t('pest.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={S.page}>
        <div style={S.container}>
          <div style={S.errorBox}>{error}</div>
          <button style={S.retryBtn} onClick={() => window.location.reload()}>
            {t('pest.retry')}
          </button>
        </div>
      </div>
    );
  }

  const alertLevel = data?.alertLevel || 'watch';
  const badgeLevel = LEVEL_MAP[alertLevel.toLowerCase()] || 'moderate';
  const hotspots = data?.hotspots || [];
  const trend = data?.trend || 'stable';
  const affectedArea = data?.affectedArea || t('pest.unknownArea');
  const priorityZone = data?.priorityZone || null;

  return (
    <div style={S.page}>
      <div style={S.container}>
        {/* Alert banner */}
        <div style={{ ...S.alertBanner, borderColor: TREND_COLORS[trend] || '#FBBF24' }}>
          <RiskLevelBadge level={badgeLevel} size="md" />
          <span style={S.alertBannerLabel}>{t(`pest.alertLevel.${alertLevel}`)}</span>
        </div>

        {/* Header */}
        <h1 style={S.title}>{t('pest.stressDetected')}</h1>
        <p style={S.subtitle}>{t('pest.stressSubtitle')}</p>

        {/* Affected area */}
        <div style={S.card}>
          <h3 style={S.sectionTitle}>{t('pest.affectedArea')}</h3>
          <p style={S.areaText}>{affectedArea}</p>
        </div>

        {/* Priority zone */}
        <div style={{ ...S.card, borderLeft: '4px solid #FB923C' }}>
          <h3 style={S.sectionTitle}>{t('pest.inspectFirst')}</h3>
          {priorityZone ? (
            <p style={S.zoneText}>{priorityZone}</p>
          ) : (
            <p style={S.placeholder}>{t('pest.inspectFullField')}</p>
          )}
        </div>

        {/* Map placeholder */}
        <div style={S.mapCard}>
          <div style={S.mapPlaceholder}>
            <div style={S.mapGrid}>
              {/* Simple colored zone diagram */}
              {hotspots.length > 0 ? hotspots.map((hs, i) => (
                <div
                  key={i}
                  style={{
                    ...S.mapZone,
                    background: hs.severity === 'high' ? 'rgba(239,68,68,0.3)' : hs.severity === 'moderate' ? 'rgba(251,191,36,0.3)' : 'rgba(34,197,94,0.15)',
                    border: `1.5px solid ${hs.severity === 'high' ? '#EF4444' : hs.severity === 'moderate' ? '#FBBF24' : '#22C55E'}`,
                  }}
                >
                  <span style={S.zoneLabel}>{hs.zone || t('pest.zone', { n: i + 1 })}</span>
                </div>
              )) : (
                <>
                  <div style={{ ...S.mapZone, background: 'rgba(34,197,94,0.15)', border: '1.5px solid #22C55E' }}>
                    <span style={S.zoneLabel}>NW</span>
                  </div>
                  <div style={{ ...S.mapZone, background: 'rgba(251,191,36,0.3)', border: '1.5px solid #FBBF24' }}>
                    <span style={S.zoneLabel}>NE</span>
                  </div>
                  <div style={{ ...S.mapZone, background: 'rgba(34,197,94,0.15)', border: '1.5px solid #22C55E' }}>
                    <span style={S.zoneLabel}>SW</span>
                  </div>
                  <div style={{ ...S.mapZone, background: 'rgba(239,68,68,0.3)', border: '1.5px solid #EF4444' }}>
                    <span style={S.zoneLabel}>SE</span>
                  </div>
                </>
              )}
            </div>
            <p style={S.mapLabel}>{t('pest.fieldOverview')}</p>
          </div>
        </div>

        {/* Trend */}
        <div style={S.card}>
          <h3 style={S.sectionTitle}>{t('pest.riskTrend')}</h3>
          <div style={S.trendRow}>
            <span style={{ fontSize: '1.6rem', color: TREND_COLORS[trend] || '#FBBF24' }}>
              {TREND_ICONS[trend] || TREND_ICONS.stable}
            </span>
            <div>
              <div style={{ fontWeight: 600, color: TREND_COLORS[trend] || '#FBBF24' }}>
                {t(`pest.trend.${trend}`)}
              </div>
              <div style={S.trendSub}>{t('pest.trendSinceLast')}</div>
            </div>
          </div>
        </div>

        {/* Upload CTA */}
        <button
          style={S.ctaBtn}
          onClick={() => navigate('/pest-risk-check')}
        >
          {t('pest.uploadFromArea')}
        </button>
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: '#0F172A',
    color: '#fff',
    padding: '1rem 1rem 2rem',
  },
  container: {
    maxWidth: '48rem',
    margin: '0 auto',
  },
  alertBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 1rem',
    borderRadius: '12px',
    background: 'rgba(251,191,36,0.08)',
    border: '1.5px solid',
    marginBottom: '1rem',
  },
  alertBannerLabel: {
    fontSize: '0.9rem',
    fontWeight: 600,
    color: '#E2E8F0',
  },
  title: {
    fontSize: '1.4rem',
    fontWeight: 700,
    margin: '0 0 0.25rem',
  },
  subtitle: {
    fontSize: '0.9rem',
    color: '#94A3B8',
    margin: '0 0 1.25rem',
  },
  card: {
    borderRadius: '12px',
    background: '#1B2330',
    border: '1px solid rgba(255,255,255,0.08)',
    padding: '1rem 1.25rem',
    marginBottom: '0.75rem',
  },
  sectionTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#F1F5F9',
    margin: '0 0 0.5rem',
  },
  areaText: {
    fontSize: '0.95rem',
    color: '#CBD5E1',
    margin: 0,
    lineHeight: 1.5,
  },
  zoneText: {
    fontSize: '0.9rem',
    color: '#FB923C',
    fontWeight: 600,
    margin: 0,
  },
  placeholder: {
    fontSize: '0.85rem',
    color: '#64748B',
    margin: 0,
  },
  mapCard: {
    borderRadius: '12px',
    background: '#1B2330',
    border: '1px solid rgba(255,255,255,0.08)',
    padding: '1rem',
    marginBottom: '0.75rem',
  },
  mapPlaceholder: {
    textAlign: 'center',
  },
  mapGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '6px',
    width: '100%',
    maxWidth: '280px',
    margin: '0 auto',
    aspectRatio: '1',
  },
  mapZone: {
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '80px',
  },
  zoneLabel: {
    fontSize: '0.8rem',
    fontWeight: 700,
    color: '#CBD5E1',
  },
  mapLabel: {
    fontSize: '0.75rem',
    color: '#64748B',
    marginTop: '0.5rem',
  },
  trendRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  trendSub: {
    fontSize: '0.8rem',
    color: '#64748B',
    marginTop: '2px',
  },
  ctaBtn: {
    width: '100%',
    padding: '16px',
    borderRadius: '12px',
    border: 'none',
    background: '#22C55E',
    color: '#fff',
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
    borderTopColor: '#22C55E',
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
    color: '#94A3B8',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: '44px',
  },
};
