/**
 * FounderDashboardPage — /admin/founder-dashboard.
 *
 * Admin-only view of the 12 spec pilot metrics. Composes
 * window.__founderDashboardHealth (FounderDashboardRuntime) which is
 * a read-only projection over existing telemetry probes.
 *
 * Role-gated inside the page: non-admin sees "Not available".
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { tSafe } from '../i18n/tSafe.js';
import { useAuth } from '../context/AuthContext.jsx';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _readFounder() {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const fn = window.__founderDashboardHealth;
    return typeof fn === 'function' ? fn() : null;
  }, null);
}
function _readPilotHealth() {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const fn = window.__pilotHealth;
    return typeof fn === 'function' ? fn() : null;
  }, null);
}

const ALLOWED_ROLES = new Set(['admin']);

function FounderDashboardPageInner() {
  const navigate = useNavigate();
  const { user } = useAuth() || {};
  const role = String((user && user.role) || '').toLowerCase();
  const allowed = ALLOWED_ROLES.has(role);

  const [env, setEnv] = React.useState(null);
  const [pilot, setPilot] = React.useState(null);

  React.useEffect(() => {
    if (!allowed) return;
    let alive = true;
    if (alive) {
      setEnv(_readFounder());
      setPilot(_readPilotHealth());
    }
    return () => { alive = false; };
  }, [allowed]);

  if (!allowed) {
    return (
      <main style={S.page} data-testid="founder-dashboard-not-allowed">
        <p style={S.title}>{tSafe('founderDashboard.notAllowed.title', 'Not available')}</p>
        <p style={S.sub}>
          {tSafe('founderDashboard.notAllowed.body',
            'This view is for system admins only.')}
        </p>
        <button type="button" style={S.btnPrimary}
          onClick={() => _safe(() => navigate('/home'), null)}>
          {tSafe('common.goHome', 'Go to Home')}
        </button>
      </main>
    );
  }

  const metrics = (env && env.metrics) ? env.metrics : null;

  const Tile = ({ label, value, testId }) => (
    <div style={S.tile} data-testid={testId}>
      <p style={S.tileLabel}>{label}</p>
      <p style={S.tileValue}>
        {value === null || value === undefined
          ? tSafe('founderDashboard.needsData', 'Not enough data yet')
          : String(value)}
      </p>
    </div>
  );

  return (
    <main
      style={S.page}
      data-testid="founder-dashboard-page"
      data-consumes="founderDashboard"
      data-surface="founder"
      data-role-scoped="true">
      <header style={S.head}>
        <p style={S.eyebrow}>{tSafe('founderDashboard.eyebrow', 'Founder Console')}</p>
        <h1 style={S.h1}>{tSafe('founderDashboard.title', 'Pilot Observability')}</h1>
        <p style={S.sub}>
          {tSafe('founderDashboard.sub',
            'Real-time pilot telemetry. Counts reflect persisted artifacts only.')}
        </p>
      </header>

      <section style={S.section}>
        <p style={S.sectionEyebrow}>{tSafe('founderDashboard.section.activity', 'Activity')}</p>
        <div style={S.grid}>
          <Tile label={tSafe('founderDashboard.metric.activeFarmers', 'Active farmers')}
            value={metrics && metrics.activeFarmers} testId="fd-active-farmers" />
          <Tile label={tSafe('founderDashboard.metric.activeGardeners', 'Active gardeners')}
            value={metrics && metrics.activeGardeners} testId="fd-active-gardeners" />
          <Tile label={tSafe('founderDashboard.metric.organizations', 'Organizations')}
            value={metrics && metrics.organizations} testId="fd-orgs" />
        </div>
      </section>

      <section style={S.section}>
        <p style={S.sectionEyebrow}>{tSafe('founderDashboard.section.scans', 'Scans')}</p>
        <div style={S.grid}>
          <Tile label={tSafe('founderDashboard.metric.scansToday', 'Scans today')}
            value={metrics && metrics.scansToday} testId="fd-scans-today" />
          <Tile label={tSafe('founderDashboard.metric.scansThisWeek', 'Scans this week')}
            value={metrics && metrics.scansThisWeek} testId="fd-scans-week" />
          <Tile label={tSafe('founderDashboard.metric.followUpScansCompleted', 'Follow-up scans')}
            value={metrics && metrics.followUpScansCompleted} testId="fd-followup-scans" />
        </div>
      </section>

      <section style={S.section}>
        <p style={S.sectionEyebrow}>{tSafe('founderDashboard.section.outcomes', 'Outcomes')}</p>
        <div style={S.grid}>
          <Tile label={tSafe('founderDashboard.metric.tasksCompleted', 'Tasks completed')}
            value={metrics && metrics.tasksCompleted} testId="fd-tasks" />
          <Tile label={tSafe('founderDashboard.metric.outcomesRecorded', 'Outcomes recorded')}
            value={metrics && metrics.outcomesRecorded} testId="fd-outcomes" />
          <Tile label={tSafe('founderDashboard.metric.weeklyReviewsGenerated', 'Weekly reviews')}
            value={metrics && metrics.weeklyReviewsGenerated} testId="fd-weekly-reviews" />
        </div>
      </section>

      <section style={S.section}>
        <p style={S.sectionEyebrow}>{tSafe('founderDashboard.section.market', 'Market')}</p>
        <div style={S.grid}>
          <Tile label={tSafe('founderDashboard.metric.fundingViews', 'Funding views')}
            value={metrics && metrics.fundingViews} testId="fd-funding" />
          <Tile label={tSafe('founderDashboard.metric.listingsCreated', 'Listings created')}
            value={metrics && metrics.listingsCreated} testId="fd-listings" />
          <Tile label={tSafe('founderDashboard.metric.harvestEvents', 'Harvest events')}
            value={metrics && metrics.harvestEvents} testId="fd-harvest" />
        </div>
      </section>

      {pilot ? (
        <section style={S.section} data-testid="founder-dashboard-pilot-health">
          <p style={S.sectionEyebrow}>{tSafe('founderDashboard.section.health', 'Pilot Health')}</p>
          <p style={S.healthLine}>
            {pilot.pilotReady
              ? tSafe('founderDashboard.health.ready', 'Pilot ready — all 12 subsystems healthy.')
              : tSafe('founderDashboard.health.partial',
                  `Pilot partial — ${pilot.healthyCount}/${pilot.totalSubsystems} subsystems healthy.`)}
          </p>
        </section>
      ) : null}

      <p style={S.note}>
        {tSafe('founderDashboard.note.honest',
          'Null values mean "no data ingested yet" — never fabricated.')}
      </p>
    </main>
  );
}

export default class FounderDashboardPage extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow */ }
  render() {
    if (this.state.failed) return null;
    try { return <FounderDashboardPageInner />; } catch { return null; }
  }
}

const S = {
  page: { minHeight: '100vh', background: '#FAF7F0', color: '#2C3A26',
    fontFamily: 'system-ui', padding: '20px 16px 96px', maxWidth: 880,
    margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 },
  head: { display: 'flex', flexDirection: 'column', gap: 4 },
  eyebrow: { margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'rgba(60,72,55,0.55)' },
  h1: { margin: 0, fontSize: 22, fontWeight: 800, lineHeight: 1.2 },
  title: { margin: 0, fontSize: 18, fontWeight: 700 },
  sub: { margin: 0, fontSize: 13, color: 'rgba(60,72,55,0.7)' },
  section: { display: 'flex', flexDirection: 'column', gap: 8 },
  sectionEyebrow: { margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'rgba(60,72,55,0.62)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 },
  tile: { background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(60,72,55,0.10)',
    borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 2 },
  tileLabel: { margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'rgba(60,72,55,0.55)' },
  tileValue: { margin: 0, fontSize: 17, fontWeight: 700, color: 'rgba(40,52,40,0.95)' },
  healthLine: { margin: 0, fontSize: 14, fontWeight: 600, color: 'rgba(60,72,55,0.85)' },
  note: { margin: 0, fontSize: 11, color: 'rgba(60,72,55,0.55)' },
  btnPrimary: { minHeight: 44, padding: '0 18px', borderRadius: 10, border: 'none',
    background: '#2f7a3a', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
    alignSelf: 'flex-start' },
};
