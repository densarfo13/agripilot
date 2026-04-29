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
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n/index.js';
import useSafeData, { API_ERROR_TYPES } from '../hooks/useSafeData.js';
import {
  ErrorState, SessionExpiredState, MfaRequiredState, NetworkErrorState,
} from '../components/admin/AdminState.jsx';

// Bare-fetch helper kept for the four NGO endpoints. The
// useSafeData wrapper around it classifies the resulting
// errors via apiClient.structureError, so the 403 / 401 /
// network split is handled by the hook + AdminState UI rather
// than ad-hoc state machine here.
async function getJSON(path) {
  const res = await fetch(path, { credentials: 'include' });
  if (!res.ok) {
    // Surface HTTP status on the thrown error so structureError
    // (inside useSafeData) can map it into the right errorType.
    const err = new Error(`failed_${res.status}`);
    err.status   = res.status;
    err.response = { status: res.status };
    throw err;
  }
  return res.json();
}

export default function NGOOverview() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Single combined fetcher — keeps the four endpoints in one
  // lifecycle so retry re-runs all four together. Page renders
  // a single error surface instead of four parallel banners.
  const {
    data, loading, error, errorType, retry,
  } = useSafeData(
    async () => {
      const [overview, risk, crops, harvest] = await Promise.all([
        getJSON('/api/v2/ngo/overview'),
        getJSON('/api/v2/ngo/risk-summary'),
        getJSON('/api/v2/ngo/crop-analytics'),
        getJSON('/api/v2/ngo/harvest-analytics'),
      ]);
      return { overview, risk, crops, harvest };
    },
    { fallbackData: null },
  );

  if (loading) {
    return (
      <div style={S.page}><div style={S.container}>
        <p>{t('common.loading')}</p>
      </div></div>
    );
  }

  // 403 stays special-cased — role-gated server-side, so it's
  // an access-denied state, not a generic API error. Everything
  // else routes through the v3 AdminState components so the
  // user gets the right CTA per errorType.
  if (error) {
    const status = (typeof error === 'string' && error.match(/failed_(\d+)/));
    const code   = status ? Number(status[1]) : null;
    return (
      <div style={S.page}><div style={S.container}>
        {code === 403 ? (
          <p style={S.err}>{t('ngo.forbidden')}</p>
        ) : errorType === API_ERROR_TYPES.SESSION_EXPIRED ? (
          <SessionExpiredState testId="ngo-overview-error" />
        ) : errorType === API_ERROR_TYPES.MFA_REQUIRED ? (
          <MfaRequiredState testId="ngo-overview-error" />
        ) : errorType === API_ERROR_TYPES.NETWORK_ERROR ? (
          <NetworkErrorState onRetry={retry} testId="ngo-overview-error" />
        ) : (
          <ErrorState
            message={t('ngo.error') || 'We could not load the dashboard. Try again in a moment.'}
            onRetry={retry}
            testId="ngo-overview-error"
          />
        )}
      </div></div>
    );
  }

  const { overview, risk, crops, harvest } = data || {};
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
          {/* Browse page lives at /farmers (STAFF_ROLES gate),
              not /admin/farmers — the latter was a stale route
              that didn't exist in App.jsx and 404'd on click. */}
          <button style={S.linkBtn} onClick={() => navigate('/farmers')}>
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
