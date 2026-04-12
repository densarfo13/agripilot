import React, { useEffect, useState } from 'react';
import { useTranslation } from '../i18n/index.js';
import { useProfile } from '../context/ProfileContext.jsx';
import { getMyAlerts } from '../lib/intelligenceApi.js';
import AlertCard from '../components/intelligence/AlertCard.jsx';

export default function RegionalWatch() {
  const { t } = useTranslation();
  const { profile } = useProfile();
  const profileId = profile?.id || profile?._id;

  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!profileId) return;
    setLoading(true);
    getMyAlerts()
      .then(res => { setAlerts(res.alerts || res || []); setError(''); })
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

  const activeAlerts = alerts.filter(a => a.sentStatus !== 'expired' && a.sentStatus !== 'suppressed');
  const pastAlerts = alerts.filter(a => a.sentStatus === 'expired' || a.sentStatus === 'suppressed');

  return (
    <div style={S.page}>
      <div style={S.container}>
        <h1 style={S.title}>{t('regional.title')}</h1>
        <p style={S.subtitle}>{t('regional.subtitle')}</p>

        {activeAlerts.length === 0 && pastAlerts.length === 0 && (
          <div style={S.emptyCard}>
            <div style={S.emptyIcon}>{'\u2705'}</div>
            <p style={S.emptyText}>{t('regional.noAlerts')}</p>
          </div>
        )}

        {activeAlerts.length > 0 && (
          <>
            <h2 style={S.sectionTitle}>{t('regional.active')}</h2>
            {activeAlerts.map(alert => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </>
        )}

        {pastAlerts.length > 0 && (
          <>
            <h2 style={{ ...S.sectionTitle, marginTop: '1.5rem' }}>{t('regional.past')}</h2>
            {pastAlerts.map(alert => (
              <AlertCard key={alert.id} alert={alert} dimmed />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', background: '#0F172A', color: '#fff', padding: '1rem 1rem 2rem' },
  container: { maxWidth: '48rem', margin: '0 auto' },
  title: { fontSize: '1.4rem', fontWeight: 700, margin: '0 0 0.25rem' },
  subtitle: { fontSize: '0.9rem', color: '#94A3B8', margin: '0 0 1.25rem' },
  sectionTitle: { fontSize: '1rem', fontWeight: 700, color: '#CBD5E1', margin: '0 0 0.75rem' },
  emptyCard: { borderRadius: '16px', background: '#1B2330', border: '1px solid rgba(255,255,255,0.1)', padding: '2.5rem 1.5rem', textAlign: 'center' },
  emptyIcon: { fontSize: '2.5rem', marginBottom: '0.75rem' },
  emptyText: { fontSize: '1rem', color: '#94A3B8', margin: 0 },
  loadingCenter: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '1rem' },
  spinner: { width: '32px', height: '32px', border: '3px solid rgba(255,255,255,0.15)', borderTopColor: '#22C55E', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  errorBox: { background: 'rgba(252,165,165,0.1)', border: '1px solid #FCA5A5', borderRadius: '10px', padding: '0.75rem 1rem', color: '#FCA5A5', fontSize: '0.85rem', marginBottom: '1rem', marginTop: '2rem' },
  retryBtn: { padding: '12px 24px', borderRadius: '10px', border: '1.5px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#94A3B8', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', minHeight: '44px' },
};
