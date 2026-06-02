/**
 * FarmerOutcomesPage.jsx — /outcomes — the farmer's own outcome
 * dashboard.
 *
 * Shows: Tasks Completed · Outcomes Recorded · Improvement Rate ·
 * Farm Health Score. Self-handles auth (signed-out farmers see a
 * sign-in CTA).
 *
 * Pure render. Never throws.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { tSafe } from '../i18n/tSafe.js';
import { useAuth } from '../context/AuthContext.jsx';
import { fetchFarmerDashboard } from
  '../runtime/outcomeIntelligence/OutcomeIntelligencePlatformTracker';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _fmtPct(n) {
  if (n == null) return tSafe('outcomes.farmer.empty', 'Not enough data');
  return Math.round(Number(n) * 10) / 10 + '%';
}

function _scoreColor(n) {
  if (n == null) return '#9a6a00';
  if (n >= 70) return '#2f7a3a';
  if (n >= 40) return '#9a6a00';
  return '#a13a3a';
}

function FarmerOutcomesInner() {
  const navigate = useNavigate();
  const auth = useAuth() || {};
  const user = auth.user;
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!user || !user.id) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const d = await fetchFarmerDashboard();
      if (cancelled) return;
      setData(d); setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  if (!user || !user.id) {
    return (
      <main style={S.page} data-testid="farmer-outcomes-not-signed-in">
        <p style={S.title}>{tSafe('outcomes.farmer.signInTitle', 'Sign in to see your outcomes')}</p>
        <button type="button" style={S.btnPrimary}
          onClick={() => _safe(() => navigate('/login'), null)}>
          {tSafe('common.signIn', 'Sign In')}
        </button>
      </main>
    );
  }

  return (
    <main
      style={S.page}
      data-testid="farmer-outcomes-page"
      data-consumes="outcomeIntelligence"
      data-surface="farmer-outcomes">
      <header style={S.head}>
        <p style={S.eyebrow}>{tSafe('outcomes.farmer.eyebrow', 'Your Outcomes')}</p>
        <h1 style={S.h1}>{tSafe('outcomes.farmer.title', 'How is it going?')}</h1>
      </header>
      {loading && !data ? (
        <p style={S.loading}>{tSafe('outcomes.farmer.loading', 'Loading…')}</p>
      ) : null}
      {data && data.ok ? (
        <section style={S.grid}>
          <Tile label={tSafe('outcomes.farmer.tasks', 'Tasks Completed')}
            value={data.tasksCompleted}
            sub={data.tasksTotal ? '/ ' + data.tasksTotal : ''} />
          <Tile label={tSafe('outcomes.farmer.outcomes', 'Outcomes Recorded')}
            value={data.outcomesRecorded} />
          <Tile label={tSafe('outcomes.farmer.improvement', 'Improvement Rate')}
            value={_fmtPct(data.improvementRatePct)}
            color={_scoreColor(data.improvementRatePct)} />
          <Tile label={tSafe('outcomes.farmer.health', 'Farm Health Score')}
            value={data.farmHealthScore != null
              ? data.farmHealthScore + ' / 100'
              : tSafe('outcomes.farmer.empty', 'Not enough data')}
            color={_scoreColor(data.farmHealthScore)}
            sub={data.farmHealthTrend !== 'unknown' ? data.farmHealthTrend : ''} />
        </section>
      ) : null}
      <p style={S.note}>
        {tSafe('outcomes.farmer.note',
          'Numbers show null when there are not enough outcomes to compute. Decision support, not a guarantee.')}
      </p>
    </main>
  );
}

function Tile({ label, value, sub, color }) {
  return (
    <div style={S.tile}>
      <p style={S.tileLabel}>{label}</p>
      <p style={{ ...S.tileValue, color: color || '#1F2933' }}>{value}</p>
      {sub ? <p style={S.tileSub}>{sub}</p> : null}
    </div>
  );
}

export default class FarmerOutcomesPage extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow */ }
  render() {
    if (this.state.failed) return null;
    try { return <FarmerOutcomesInner />; } catch { return null; }
  }
}

const S = {
  page: { minHeight: '100vh', background: '#FAF7F0', color: '#2C3A26',
    fontFamily: 'system-ui', padding: '20px 16px 96px', maxWidth: 720,
    margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 },
  head: { display: 'flex', flexDirection: 'column', gap: 4 },
  eyebrow: { margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'rgba(60,72,55,0.55)' },
  h1: { margin: 0, fontSize: 22, fontWeight: 800 },
  title: { margin: 0, fontSize: 18, fontWeight: 700 },
  grid: { display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 },
  tile: { background: 'rgba(255,255,255,0.95)',
    border: '1px solid rgba(60,72,55,0.10)', borderRadius: 12,
    padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 },
  tileLabel: { margin: 0, fontSize: 10, fontWeight: 800,
    letterSpacing: '0.08em', textTransform: 'uppercase',
    color: 'rgba(60,72,55,0.55)' },
  tileValue: { margin: 0, fontSize: 24, fontWeight: 800 },
  tileSub: { margin: 0, fontSize: 11, color: 'rgba(60,72,55,0.6)' },
  loading: { fontSize: 13, color: 'rgba(60,72,55,0.6)' },
  note: { margin: 0, fontSize: 11, color: 'rgba(60,72,55,0.55)' },
  btnPrimary: { minHeight: 40, padding: '0 18px', borderRadius: 10, border: 'none',
    background: '#2f7a3a', color: '#fff', fontSize: 14, fontWeight: 700,
    cursor: 'pointer', alignSelf: 'flex-start' },
};
