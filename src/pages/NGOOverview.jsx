/**
 * NGOOverview — dashboard landing for NGO / reviewer staff.
 *
 * Fetches /api/v2/ngo/overview + /api/v2/ngo/risk-summary +
 * /api/v2/ngo/crop-analytics + /api/v2/ngo/harvest-analytics in
 * parallel and renders:
 *
 *   - 4 headline cards (total / active / high-risk / crops in progress)
 *   - a "Risk this week" list with farmer + severity
 *   - a compact crop analytics table
 *   - a harvest totals strip
 *
 * Role-gated server-side — the route is 403 for non-reviewers, so
 * the UI treats 403 as an access-denied state rather than a spinner.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n/index.js';

async function getJSON(path) {
  const res = await fetch(path, { credentials: 'include' });
  if (res.status === 403) { const e = new Error('forbidden'); e.code = 'forbidden'; throw e; }
  if (!res.ok) { const e = new Error(`failed_${res.status}`); e.code = `failed_${res.status}`; throw e; }
  return res.json();
}

export default function NGOOverview() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, error: null, overview: null, risk: null, crops: null, harvest: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [overview, risk, crops, harvest] = await Promise.all([
          getJSON('/api/v2/ngo/overview'),
          getJSON('/api/v2/ngo/risk-summary'),
          getJSON('/api/v2/ngo/crop-analytics'),
          getJSON('/api/v2/ngo/harvest-analytics'),
        ]);
        if (!cancelled) setState({ loading: false, error: null, overview, risk, crops, harvest });
      } catch (err) {
        if (!cancelled) setState((s) => ({ ...s, loading: false, error: err.code || 'error' }));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (state.loading) return <div style={S.page}><div style={S.container}><p>{t('common.loading')}</p></div></div>;
  if (state.error === 'forbidden') return (
    <div style={S.page}><div style={S.container}><p style={S.err}>{t('ngo.forbidden')}</p></div></div>
  );
  if (state.error) return (
    <div style={S.page}><div style={S.container}><p style={S.err}>{t('ngo.error')}</p></div></div>
  );

  const { overview, risk, crops, harvest } = state;
  const totals = harvest?.totals || { count: 0, totalQuantityKg: 0, totalLossesKg: 0 };

  return (
    <div style={S.page}>
      <div style={S.container}>
        <h1 style={S.title}>{t('ngo.title')}</h1>
        <p style={S.subtitle}>{t('ngo.subtitle')}</p>

        {/* ─── Overview cards ───────────────────────────── */}
        <div style={S.cardGrid}>
          <Card label={t('ngo.card.total')}        value={overview.totalFarmers}    accent="#0EA5E9" />
          <Card label={t('ngo.card.active')}       value={overview.activeFarmers}   accent="#22C55E" />
          <Card label={t('ngo.card.highRisk')}     value={overview.highRiskFarmers} accent="#EF4444" />
          <Card label={t('ngo.card.cropsInProgress')} value={overview.cropsInProgress} accent="#A78BFA" />
        </div>

        {/* ─── Risk summary ─────────────────────────────── */}
        <Section title={t('ngo.risk.title')} accent="#EF4444">
          {risk.items?.length ? (
            <ul style={S.riskList}>
              {risk.items.slice(0, 12).map((it) => (
                <li key={it.id} style={S.riskItem}>
                  <div>
                    <span style={{ ...S.sevDot, background: sevColor(it.severity) }} />
                    <span style={S.riskTitle}>
                      {(it.farm?.farmName) || t('ngo.risk.unnamedFarm')}
                    </span>
                    {it.farm?.stateCode && (
                      <span style={S.riskState}> · {it.farm.stateCode}</span>
                    )}
                  </div>
                  <div style={S.riskMeta}>
                    {t(`issue.category.${it.category}`)} · {t(`usRec.risk.${it.severity}`)}
                  </div>
                  <div style={S.riskDesc}>{it.description}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p style={S.muted}>{t('ngo.risk.empty')}</p>
          )}
        </Section>

        {/* ─── Crop analytics ───────────────────────────── */}
        <Section title={t('ngo.crops.title')} accent="#A78BFA">
          {crops?.byCrop && Object.keys(crops.byCrop).length ? (
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>{t('ngo.crops.crop')}</th>
                  <th style={S.thRight}>{t('ngo.crops.total')}</th>
                  <th style={S.thRight}>{t('ngo.crops.growing')}</th>
                  <th style={S.thRight}>{t('ngo.crops.harvestReady')}</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(crops.byCrop).map(([crop, counts]) => (
                  <tr key={crop}>
                    <td style={S.td}>{crop}</td>
                    <td style={S.tdRight}>{counts.total || 0}</td>
                    <td style={S.tdRight}>{counts.growing || 0}</td>
                    <td style={S.tdRight}>{counts.harvest_ready || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={S.muted}>{t('ngo.crops.empty')}</p>
          )}
        </Section>

        {/* ─── Harvest analytics ────────────────────────── */}
        <Section title={t('ngo.harvest.title')} accent="#22C55E">
          <div style={S.harvestStrip}>
            <Stat label={t('ngo.harvest.reports')} value={totals.count} />
            <Stat label={t('ngo.harvest.totalKg')} value={Math.round(totals.totalQuantityKg)} />
            <Stat label={t('ngo.harvest.lossesKg')} value={Math.round(totals.totalLossesKg)} />
          </div>
        </Section>

        <div style={S.footerRow}>
          <button style={S.linkBtn} onClick={() => navigate('/admin/farmers')}>
            {t('ngo.openFarmers')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Card({ label, value, accent }) {
  return (
    <div style={{ ...S.card, borderColor: accent }}>
      <div style={S.cardLabel}>{label}</div>
      <div style={{ ...S.cardValue, color: accent }}>{value ?? 0}</div>
    </div>
  );
}

function Section({ title, accent, children }) {
  return (
    <section style={S.section}>
      <h2 style={{ ...S.sectionTitle, color: accent }}>{title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value }) {
  return (
    <div style={S.stat}>
      <div style={S.statValue}>{value}</div>
      <div style={S.statLabel}>{label}</div>
    </div>
  );
}

function sevColor(s) {
  return s === 'high' ? '#EF4444' : s === 'medium' ? '#F59E0B' : '#22C55E';
}

const S = {
  page: { minHeight: '100vh', background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)', padding: '1rem 0 3rem' },
  container: { maxWidth: '60rem', margin: '0 auto', padding: '0 1rem', color: '#EAF2FF' },
  title: { fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.25rem' },
  subtitle: { color: '#9FB3C8', fontSize: '0.9375rem', margin: '0 0 1.25rem' },
  err: { color: '#FCA5A5' },
  cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.625rem', marginBottom: '1rem' },
  card: {
    padding: '1rem',
    borderRadius: '16px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  cardLabel: { fontSize: '0.75rem', color: '#9FB3C8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' },
  cardValue: { fontSize: '1.75rem', fontWeight: 700, marginTop: '0.25rem' },
  section: {
    padding: '1rem',
    borderRadius: '16px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    marginBottom: '0.875rem',
  },
  sectionTitle: { fontSize: '1rem', fontWeight: 700, margin: '0 0 0.625rem' },
  riskList: { margin: 0, paddingLeft: 0, listStyle: 'none' },
  riskItem: { padding: '0.625rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  sevDot: { display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', marginRight: '0.5rem', verticalAlign: 'middle' },
  riskTitle: { fontWeight: 700, fontSize: '0.9375rem' },
  riskState: { color: '#9FB3C8', fontSize: '0.8125rem' },
  riskMeta: { fontSize: '0.75rem', color: '#9FB3C8', marginTop: '0.125rem' },
  riskDesc: { fontSize: '0.875rem', marginTop: '0.25rem', lineHeight: 1.4 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' },
  th: { textAlign: 'left', color: '#9FB3C8', fontWeight: 600, padding: '0.375rem 0.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)' },
  thRight: { textAlign: 'right', color: '#9FB3C8', fontWeight: 600, padding: '0.375rem 0.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)' },
  td: { padding: '0.375rem 0.5rem', borderBottom: '1px solid rgba(255,255,255,0.04)' },
  tdRight: { padding: '0.375rem 0.5rem', borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'right' },
  harvestStrip: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.625rem' },
  stat: { padding: '0.75rem', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' },
  statValue: { fontSize: '1.25rem', fontWeight: 700, color: '#EAF2FF' },
  statLabel: { fontSize: '0.6875rem', color: '#9FB3C8', textTransform: 'uppercase', letterSpacing: '0.04em' },
  muted: { color: '#9FB3C8', fontSize: '0.875rem' },
  footerRow: { display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' },
  linkBtn: {
    padding: '0.625rem 1rem',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: '#EAF2FF',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
};
