/**
 * FarmerScoring — table of per-farmer scorecards, filterable by band.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/index.js';

async function getJSON(p) {
  const r = await fetch(p, { credentials: 'include' });
  if (!r.ok) throw new Error(`failed_${r.status}`);
  return r.json();
}

const BAND_COLOR = { excellent: '#22C55E', good: '#0EA5E9', fair: '#F59E0B', weak: '#EF4444' };

export default function FarmerScoring() {
  const { t } = useTranslation();
  const [band, setBand] = useState('');
  const [state, setState] = useState({ loading: true, items: [], error: null });

  useEffect(() => {
    (async () => {
      setState((s) => ({ ...s, loading: true }));
      try {
        const q = band ? `?band=${encodeURIComponent(band)}` : '';
        const data = await getJSON(`/api/v2/ngo/farmer-scores${q}`);
        setState({ loading: false, items: data.items, error: null });
      } catch (err) {
        setState({ loading: false, items: [], error: err.message });
      }
    })();
  }, [band]);

  async function recompute() {
    await fetch('/api/v2/ngo/farmer-scores/recompute', { method: 'POST', credentials: 'include' });
    // trigger reload
    setBand((b) => b ? '' : '');
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

        {state.loading && <p>{t('common.loading')}</p>}
        {state.error && <p style={S.err}>{state.error === 'failed_403' ? t('ngo.forbidden') : t('ngo.error')}</p>}

        {!state.loading && !state.error && state.items.length === 0 && (
          <p style={S.muted}>{t('ngoV2.scores.empty')}</p>
        )}

        {!state.loading && state.items.length > 0 && (
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
              {state.items.map((it) => (
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

const S = {
  page: { minHeight: '100vh', background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)', padding: '1rem 0 3rem' },
  container: { maxWidth: '72rem', margin: '0 auto', padding: '0 1rem', color: '#EAF2FF' },
  title: { fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.25rem' },
  subtitle: { color: '#9FB3C8', fontSize: '0.9375rem', margin: '0 0 1rem' },
  filterRow: { display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap' },
  filterLabel: { fontSize: '0.75rem', color: '#9FB3C8', textTransform: 'uppercase', letterSpacing: '0.04em' },
  select: { padding: '0.5rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#EAF2FF', fontSize: '0.9375rem' },
  btn: { padding: '0.5rem 0.75rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#EAF2FF', fontSize: '0.8125rem', cursor: 'pointer' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' },
  th: { textAlign: 'left', color: '#9FB3C8', fontWeight: 600, padding: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)' },
  thRight: { textAlign: 'right', color: '#9FB3C8', fontWeight: 600, padding: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)' },
  td: { padding: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.04)' },
  tdRight: { padding: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'right' },
  chip: { padding: '0.125rem 0.625rem', borderRadius: '999px', fontSize: '0.6875rem', fontWeight: 700, color: '#0B1D34', textTransform: 'uppercase' },
  muted: { color: '#9FB3C8', fontSize: '0.875rem' },
  err: { color: '#FCA5A5' },
};
