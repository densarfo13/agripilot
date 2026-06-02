/**
 * OrganizationOutcomesPage.jsx — /admin/organization-outcomes.
 *
 * Admin-only org dashboard. Aggregates across all farms; never
 * shows per-farmer PII (farmIds only).
 *
 *   High-risk farms · Improved farms · Pending follow-ups · Program impact %
 *
 * Plus a Command Center strip with: Outcome Success % ·
 * Recommendation Accuracy % · Follow-up Completion %.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { tSafe } from '../../i18n/tSafe.js';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  fetchOrgDashboard, fetchCommandCenterMetrics,
} from '../../runtime/outcomeIntelligence/OutcomeIntelligencePlatformTracker';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
const ALLOWED_ROLES = new Set(['admin', 'super_admin', 'ngo', 'field_officer']);

function _fmtPct(n) {
  if (n == null) return tSafe('outcomes.org.empty', 'Not enough data');
  return Math.round(Number(n) * 10) / 10 + '%';
}

function OrganizationOutcomesInner() {
  const navigate = useNavigate();
  const auth = useAuth() || {};
  const role = String((auth.user && auth.user.role) || '').toLowerCase();
  const allowed = ALLOWED_ROLES.has(role);

  const [org, setOrg] = React.useState(null);
  const [cc, setCc] = React.useState(null);

  const refresh = React.useCallback(async () => {
    if (!allowed) return;
    const [o, c] = await Promise.all([
      fetchOrgDashboard(),
      fetchCommandCenterMetrics(30),
    ]);
    setOrg(o); setCc(c);
  }, [allowed]);

  React.useEffect(() => { refresh(); }, [refresh]);

  if (!allowed) {
    return (
      <main style={S.page} data-testid="org-outcomes-not-allowed">
        <p style={S.title}>{tSafe('outcomes.org.notAllowed.title', 'Not available')}</p>
        <p style={S.sub}>
          {tSafe('outcomes.org.notAllowed.body', 'Organization outcomes are for admins only.')}
        </p>
        <button type="button" style={S.btnPrimary}
          onClick={() => _safe(() => navigate('/home'), null)}>
          {tSafe('common.goHome', 'Go to Home')}
        </button>
      </main>
    );
  }

  return (
    <main
      style={S.page}
      data-testid="org-outcomes-page"
      data-consumes="outcomeIntelligence"
      data-surface="organization-outcomes"
      data-role-scoped="true">
      <header style={S.head}>
        <p style={S.eyebrow}>{tSafe('outcomes.org.eyebrow', 'Organization Outcomes')}</p>
        <h1 style={S.h1}>{tSafe('outcomes.org.title', 'Program Impact')}</h1>
        <p style={S.sub}>
          {tSafe('outcomes.org.sub',
            'Aggregated across all tracked farms. Never includes farmer names, phones, or exact coords.')}
        </p>
      </header>

      {/* Command Center strip */}
      <section style={S.section} data-testid="org-outcomes-command-center">
        <h2 style={S.h2}>{tSafe('outcomes.org.cc', 'Command Center (30d)')}</h2>
        {cc && cc.ok ? (
          <div style={S.grid}>
            <Tile label={tSafe('outcomes.org.cc.success', 'Outcome Success')}
              value={_fmtPct(cc.outcomeSuccessPct)} />
            <Tile label={tSafe('outcomes.org.cc.accuracy', 'Recommendation Accuracy')}
              value={_fmtPct(cc.recommendationAccuracyPct)} />
            <Tile label={tSafe('outcomes.org.cc.followup', 'Follow-up Completion')}
              value={_fmtPct(cc.followUpCompletionPct)} />
          </div>
        ) : (
          <p style={S.empty}>{tSafe('outcomes.org.empty.cc', 'Not enough data yet.')}</p>
        )}
      </section>

      {/* Org rollup */}
      <section style={S.section} data-testid="org-outcomes-rollup">
        <h2 style={S.h2}>{tSafe('outcomes.org.rollup', 'Farm Roll-up (30d)')}</h2>
        {org && org.ok ? (
          <div style={S.grid}>
            <Tile label={tSafe('outcomes.org.tracked', 'Farms Tracked')}
              value={org.totalFarmsTracked} />
            <Tile label={tSafe('outcomes.org.highRisk', 'High-risk Farms')}
              value={org.highRiskFarms}
              color={org.highRiskFarms > 0 ? '#a13a3a' : '#2f7a3a'} />
            <Tile label={tSafe('outcomes.org.improved', 'Improved Farms')}
              value={org.improvedFarms} color="#2f7a3a" />
            <Tile label={tSafe('outcomes.org.pending', 'Pending Follow-ups')}
              value={org.pendingFollowUps}
              color={org.pendingFollowUps > 0 ? '#9a6a00' : '#2f7a3a'} />
            <Tile label={tSafe('outcomes.org.impact', 'Program Impact')}
              value={_fmtPct(org.programImpactPct)} />
          </div>
        ) : (
          <p style={S.empty}>{tSafe('outcomes.org.empty.rollup', 'No data yet.')}</p>
        )}
      </section>

      <p style={S.note}>
        {tSafe('outcomes.org.note',
          'All metrics show "Not enough data" until enough outcomes are recorded. Decision support, not a guarantee.')}
      </p>
    </main>
  );
}

function Tile({ label, value, color }) {
  return (
    <div style={S.tile}>
      <p style={S.tileLabel}>{label}</p>
      <p style={{ ...S.tileValue, color: color || '#1F2933' }}>{value}</p>
    </div>
  );
}

export default class OrganizationOutcomesPage extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow */ }
  render() {
    if (this.state.failed) return null;
    try { return <OrganizationOutcomesInner />; } catch { return null; }
  }
}

const S = {
  page: { minHeight: '100vh', background: '#FAF7F0', color: '#2C3A26',
    fontFamily: 'system-ui', padding: '20px 16px 96px', maxWidth: 920,
    margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 },
  head: { display: 'flex', flexDirection: 'column', gap: 4 },
  eyebrow: { margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'rgba(60,72,55,0.55)' },
  h1: { margin: 0, fontSize: 22, fontWeight: 800 },
  h2: { margin: '0 0 6px', fontSize: 16, fontWeight: 700 },
  title: { margin: 0, fontSize: 18, fontWeight: 700 },
  sub: { margin: 0, fontSize: 13, color: 'rgba(60,72,55,0.7)' },
  section: { background: 'rgba(255,255,255,0.95)',
    border: '1px solid rgba(60,72,55,0.10)', borderRadius: 12,
    padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 },
  grid: { display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 },
  tile: { background: 'rgba(255,255,255,0.85)',
    border: '1px solid rgba(60,72,55,0.10)', borderRadius: 10,
    padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 },
  tileLabel: { margin: 0, fontSize: 10, fontWeight: 800,
    letterSpacing: '0.08em', textTransform: 'uppercase',
    color: 'rgba(60,72,55,0.55)' },
  tileValue: { margin: 0, fontSize: 24, fontWeight: 800 },
  empty: { margin: 0, fontSize: 12, color: 'rgba(60,72,55,0.55)' },
  note: { margin: 0, fontSize: 11, color: 'rgba(60,72,55,0.55)' },
  btnPrimary: { minHeight: 40, padding: '0 18px', borderRadius: 10, border: 'none',
    background: '#2f7a3a', color: '#fff', fontSize: 14, fontWeight: 700,
    cursor: 'pointer', alignSelf: 'flex-start' },
};
