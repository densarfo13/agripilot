/**
 * FarmerScoring — table of per-farmer scorecards, filterable by band.
 */
import { useState } from 'react';
import { useTranslation } from '../../i18n/index.js';
import useSafeData, { API_ERROR_TYPES } from '../../hooks/useSafeData.js';
import {
  ErrorState, SessionExpiredState, MfaRequiredState, NetworkErrorState,
} from '../../components/admin/AdminState.jsx';

async function getJSON(p) {
  const r = await fetch(p, { credentials: 'include' });
  if (!r.ok) {
    const err = new Error(`failed_${r.status}`);
    err.status   = r.status;
    err.response = { status: r.status };
    throw err;
  }
  return r.json();
}

const BAND_COLOR = { excellent: '#22C55E', good: '#0EA5E9', fair: '#F59E0B', weak: '#EF4444' };

export default function FarmerScoring() {
  const { t } = useTranslation();
  const [band, setBand] = useState('');

  // Reruns automatically via deps when band filter changes.
  // retry() is also wired to the recompute() POST below so a
  // successful recompute re-fetches the table.
  const {
    data, loading, error, errorType, retry,
  } = useSafeData(
    () => {
      const q = band ? `?band=${encodeURIComponent(band)}` : '';
      return getJSON(`/api/v2/ngo/farmer-scores${q}`).then((d) => d.items || []);
    },
    { fallbackData: [], deps: [band] },
  );
  const items = Array.isArray(data) ? data : [];

  async function recompute() {
    try {
      await fetch('/api/v2/ngo/farmer-scores/recompute', { method: 'POST', credentials: 'include' });
    } catch { /* ignore */ }
    retry();
  }

  return (
    <div style={S.page}>
      <div style={S.container}>
        <h1 style={S.title}>{t('ngoV2.scores.title')}</h1>
        <p style={S.subtitle}>{t('ngoV2.scores.subtitle')}</p>

        <div style={S.filterRow}>
          <label style={S.filterLabel}>{t('ngoV2.scores.filterBand')}:</label>
          <select value={band} onChange={(e) => setBand(e.target.value)} style={S.select}>
            <option value="">{t('ngoV2.scores.allBands')}</option>
            <option value="excellent">{t('ngoV2.band.excellent')}</option>
            <option value="good">{t('ngoV2.band.good')}</option>
            <option value="fair">{t('ngoV2.band.fair')}</option>
            <option value="weak">{t('ngoV2.band.weak')}</option>
          </select>
          <button type="button" onClick={recompute} style={S.btn}>{t('ngoV2.recompute')}</button>
        </div>

        {loading && <p>{t('common.loading')}</p>}
        {error && (() => {
          const m = (typeof error === 'string') && error.match(/failed_(\d+)/);
          const code = m ? Number(m[1]) : null;
          if (code === 403) return <p style={S.err}>{t('ngo.forbidden')}</p>;
          if (errorType === API_ERROR_TYPES.SESSION_EXPIRED) return <SessionExpiredState testId="farmer-scoring-error" />;
          if (errorType === API_ERROR_TYPES.MFA_REQUIRED)    return <MfaRequiredState testId="farmer-scoring-error" />;
          if (errorType === API_ERROR_TYPES.NETWORK_ERROR)   return <NetworkErrorState onRetry={retry} testId="farmer-scoring-error" />;
          return <ErrorState
                   message={t('ngo.error') || 'We could not load farmer scores. Try again in a moment.'}
                   onRetry={retry}
                   testId="farmer-scoring-error" />;
        })()}

        {!loading && !error && items.length === 0 && (
          <p style={S.muted}>{t('ngoV2.scores.empty')}</p>
        )}

        {!loading && items.length > 0 && (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>{t('ngoV2.scores.band')}</th>
                <th style={S.thRight}>{t('ngoV2.scores.health')}</th>
                <th style={S.thRight}>{t('ngoV2.scores.performance')}</th>
                <th style={S.thRight}>{t('ngoV2.scores.consistency')}</th>
                <th style={S.thRight}>{t('ngoV2.scores.risk')}</th>
                <th style={S.thRight}>{t('ngoV2.scores.verification')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td style={S.td}>
                    <span style={{ ...S.chip, background: BAND_COLOR[it.scoreBand] || '#9FB3C8' }}>
                      {t(`ngoV2.band.${it.scoreBand}`)}
                    </span>
                  </td>
                  <td style={S.tdRight}><b>{it.healthScore}</b></td>
                  <td style={S.tdRight}>{it.performanceScore}</td>
                  <td style={S.tdRight}>{it.consistencyScore}</td>
                  <td style={S.tdRight}>{it.riskScore}</td>
                  <td style={S.tdRight}>{it.verificationScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// Soft Ochre body wash (May 2026 production audit).
const S = {
  page: { minHeight: '100vh', background: 'linear-gradient(180deg, #F6F1E7 0%, #EFE7D5 100%)', color: '#1F2933', padding: '1rem 0 3rem' },
  container: { maxWidth: '72rem', margin: '0 auto', padding: '0 1rem', color: '#1F2933' },
  title: { fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.25rem', color: '#1F2933' },
  subtitle: { color: '#667085', fontSize: '0.9375rem', margin: '0 0 1rem' },
  filterRow: { display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap' },
  filterLabel: { fontSize: '0.7rem', color: '#667085', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 },
  select: { padding: '0.55rem 0.7rem', borderRadius: '10px', border: '1px solid rgba(31,41,51,0.14)', background: '#FFFFFF', color: '#1F2933', fontSize: '0.9375rem' },
  btn: { padding: '0.55rem 0.9rem', borderRadius: '999px', border: '1px solid rgba(212,163,95,0.42)', background: 'rgba(212,163,95,0.12)', color: '#7A5A28', fontSize: '0.8125rem', fontWeight: 800, cursor: 'pointer' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', background: '#FFF9F0', borderRadius: 14, overflow: 'hidden' },
  th: { textAlign: 'left', color: '#1F2933', fontWeight: 800, padding: '0.6rem 0.75rem', borderBottom: '1px solid rgba(31,41,51,0.10)' },
  thRight: { textAlign: 'right', color: '#1F2933', fontWeight: 800, padding: '0.6rem 0.75rem', borderBottom: '1px solid rgba(31,41,51,0.10)' },
  td: { padding: '0.55rem 0.75rem', borderBottom: '1px solid rgba(31,41,51,0.06)', color: '#1F2933' },
  tdRight: { padding: '0.55rem 0.75rem', borderBottom: '1px solid rgba(31,41,51,0.06)', color: '#1F2933', textAlign: 'right' },
  chip: { padding: '0.125rem 0.625rem', borderRadius: '999px', fontSize: '0.6875rem', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase' },
  muted: { color: '#667085', fontSize: '0.875rem' },
  err: { color: '#9B2A2A' },
};
