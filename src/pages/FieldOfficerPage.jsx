/**
 * FieldOfficerPage — /field-officer (alias /organization/field-officer).
 *
 * Role-gated: visible to field_officer / organization_admin / admin.
 * Other roles see a polite "Not available" message and a back button —
 * no metrics, no leakage.
 *
 * Reads ONLY:
 *   • __fieldOfficerDashboardHealth (5 main metrics)
 *   • __fieldOfficerSupervisorMetricsHealth (7 supervisor metrics —
 *     rendered only when role is organization_admin OR admin)
 *
 * Never crosses org boundaries — composes upstream probes that
 * tenant-isolate at ingest. NEEDS_DATA when probes return null.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { tSafe } from '../i18n/tSafe.js';
import { useAuth } from '../context/AuthContext.jsx';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _readDash() {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const fn = window.__fieldOfficerDashboardHealth;
    return typeof fn === 'function' ? fn() : null;
  }, null);
}
function _readSupervisor() {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const fn = window.__fieldOfficerSupervisorMetricsHealth;
    return typeof fn === 'function' ? fn() : null;
  }, null);
}

const ALLOWED_ROLES = new Set(['field_officer', 'organization_admin', 'admin']);
const SUPERVISOR_ROLES = new Set(['organization_admin', 'admin']);

function FieldOfficerPageInner() {
  const navigate = useNavigate();
  const { user } = useAuth() || {};
  const role = String((user && user.role) || '').toLowerCase();
  const allowed = ALLOWED_ROLES.has(role);
  const supervisor = SUPERVISOR_ROLES.has(role);

  const [dash, setDash] = React.useState(null);
  const [sup, setSup] = React.useState(null);

  React.useEffect(() => {
    if (!allowed) return;
    let alive = true;
    if (alive) { setDash(_readDash()); setSup(_readSupervisor()); }
    return () => { alive = false; };
  }, [allowed]);

  if (!allowed) {
    return (
      <main style={S.page} data-testid="field-officer-not-allowed">
        <p style={S.title}>{tSafe('fieldOfficer.notAllowed.title', 'Not available')}</p>
        <p style={S.sub}>
          {tSafe('fieldOfficer.notAllowed.body',
            'This page is for field officers and organization admins.')}
        </p>
        <button type="button" style={S.btnPrimary}
          onClick={() => _safe(() => navigate('/home'), null)}>
          {tSafe('common.goHome', 'Go to Home')}
        </button>
      </main>
    );
  }

  const Tile = ({ label, value, testId }) => (
    <div style={S.tile} data-testid={testId}>
      <p style={S.tileLabel}>{label}</p>
      <p style={S.tileValue}>
        {value === null || value === undefined
          ? tSafe('fieldOfficer.needsData', 'Not enough data yet')
          : String(value)}
      </p>
    </div>
  );

  return (
    <main
      style={S.page}
      data-testid="field-officer-page"
      data-consumes="fieldOfficer"
      data-surface="dashboard"
      data-role-scoped="true"
      data-org-scoped="true">
      <header style={S.head}>
        <p style={S.eyebrow}>{tSafe('fieldOfficer.eyebrow', 'Field Officer')}</p>
        <h1 style={S.h1}>
          {supervisor
            ? tSafe('fieldOfficer.title.supervisor', 'Field Operations')
            : tSafe('fieldOfficer.title.officer', 'Your Farmers')}
        </h1>
        <p style={S.sub}>
          {supervisor
            ? tSafe('fieldOfficer.sub.supervisor',
                'Monitor field-officer performance and high-risk farms across your organization.')
            : tSafe('fieldOfficer.sub.officer',
                'Your assigned farmers and what needs attention this week.')}
        </p>
      </header>

      {/* ── §3 Officer dashboard metrics ── */}
      <section style={S.section}>
        <p style={S.sectionEyebrow}>
          {tSafe('fieldOfficer.section.assigned', 'Assigned farmers')}
        </p>
        <div style={S.grid}>
          <Tile
            label={tSafe('fieldOfficer.metric.farmersAssigned', 'Farmers assigned')}
            value={dash && dash.farmersAssigned} testId="fo-farmers-assigned" />
          <Tile
            label={tSafe('fieldOfficer.metric.activeFarmers', 'Active farmers')}
            value={dash && dash.activeFarmers} testId="fo-active-farmers" />
          <Tile
            label={tSafe('fieldOfficer.metric.inactiveFarmers', 'Inactive farmers')}
            value={dash && dash.inactiveFarmers} testId="fo-inactive-farmers" />
          <Tile
            label={tSafe('fieldOfficer.metric.highRiskFarms', 'High-risk farms')}
            value={dash && dash.highRiskFarms} testId="fo-high-risk-farms" />
        </div>
      </section>

      <section style={S.section}>
        <p style={S.sectionEyebrow}>
          {tSafe('fieldOfficer.section.followups', 'Follow-ups & outcomes')}
        </p>
        <div style={S.grid}>
          <Tile
            label={tSafe('fieldOfficer.metric.pendingFollowUpScans', 'Pending follow-up scans')}
            value={dash && dash.pendingFollowUpScans} testId="fo-pending-followups" />
          <Tile
            label={tSafe('fieldOfficer.metric.missingOutcomes', 'Missing outcomes')}
            value={dash && dash.missingOutcomes} testId="fo-missing-outcomes" />
          <Tile
            label={tSafe('fieldOfficer.metric.overdueTasks', 'Overdue tasks')}
            value={dash && dash.overdueTasks} testId="fo-overdue-tasks" />
          <Tile
            label={tSafe('fieldOfficer.metric.interventionsNeeded', 'Interventions needed')}
            value={dash && dash.interventionsNeeded} testId="fo-interventions-needed" />
          <Tile
            label={tSafe('fieldOfficer.metric.recentWorsening', 'Recent worsening outcomes')}
            value={dash && dash.recentWorseningOutcomes} testId="fo-recent-worsening" />
        </div>
      </section>

      {/* ── §4 Supervisor metrics — admin / org_admin only ── */}
      {supervisor ? (
        <section
          style={S.section}
          data-testid="field-officer-supervisor-section"
          data-supervisor="true">
          <p style={S.sectionEyebrow}>
            {tSafe('fieldOfficer.section.supervisor', 'Supervisor metrics')}
          </p>
          <div style={S.grid}>
            <Tile
              label={tSafe('fieldOfficer.metric.fieldOfficersTotal', 'Field officers')}
              value={sup && sup.fieldOfficersTotal} testId="fo-officers-total" />
            <Tile
              label={tSafe('fieldOfficer.metric.farmersPerOfficer', 'Farmers per officer')}
              value={sup && sup.farmersPerOfficer} testId="fo-farmers-per-officer" />
            <Tile
              label={tSafe('fieldOfficer.metric.followUpCompletionRate', 'Follow-up completion')}
              value={sup && sup.followUpCompletionRate !== null
                ? `${sup.followUpCompletionRate}%` : null}
              testId="fo-followup-rate" />
            <Tile
              label={tSafe('fieldOfficer.metric.outcomeCaptureRate', 'Outcome capture')}
              value={sup && sup.outcomeCaptureRate !== null
                ? `${sup.outcomeCaptureRate}%` : null}
              testId="fo-outcome-capture-rate" />
            <Tile
              label={tSafe('fieldOfficer.metric.averageResponseTime', 'Avg response time (hrs)')}
              value={sup && sup.averageResponseTimeHours} testId="fo-avg-response" />
          </div>
          <p style={S.note}>
            {tSafe('fieldOfficer.note.honest',
              'Null values mean "no data ingested yet" — never fabricated percentages.')}
          </p>
        </section>
      ) : null}

      {/* ── §3 Actions row — stub buttons. Each is an authorized
            navigation, never a destructive direct write here. ── */}
      <section style={S.section}>
        <p style={S.sectionEyebrow}>{tSafe('fieldOfficer.section.actions', 'Actions')}</p>
        <div style={S.btnRow}>
          <button type="button" style={S.btn}
            data-testid="fo-action-view-farmer"
            onClick={() => _safe(() => navigate('/admin/farmers'), null)}>
            {tSafe('fieldOfficer.action.viewFarmer', 'View farmer')}
          </button>
          <button type="button" style={S.btn}
            data-testid="fo-action-send-reminder"
            onClick={() => _safe(() => navigate('/admin/notifications'), null)}>
            {tSafe('fieldOfficer.action.sendReminder', 'Send reminder')}
          </button>
          <button type="button" style={S.btn}
            data-testid="fo-action-schedule-visit"
            onClick={() => _safe(() => navigate('/admin/visits'), null)}>
            {tSafe('fieldOfficer.action.scheduleVisit', 'Schedule visit')}
          </button>
        </div>
      </section>
    </main>
  );
}

export default class FieldOfficerPage extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow */ }
  render() {
    if (this.state.failed) return null;
    try { return <FieldOfficerPageInner />; } catch { return null; }
  }
}

const S = {
  page: { minHeight: '100vh', background: '#FAF7F0', color: '#2C3A26',
    fontFamily: 'system-ui', padding: '20px 16px 96px', maxWidth: 720,
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
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 },
  tile: { background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(60,72,55,0.10)',
    borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 2 },
  tileLabel: { margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'rgba(60,72,55,0.55)' },
  tileValue: { margin: 0, fontSize: 15, fontWeight: 700, color: 'rgba(40,52,40,0.95)' },
  note: { margin: 0, fontSize: 11, color: 'rgba(60,72,55,0.55)' },
  btnRow: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  btn: { minHeight: 40, padding: '0 14px', borderRadius: 10,
    border: '1px solid rgba(60,72,55,0.18)', background: 'rgba(255,255,255,0.9)',
    fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  btnPrimary: { minHeight: 44, padding: '0 18px', borderRadius: 10, border: 'none',
    background: '#2f7a3a', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
    alignSelf: 'flex-start' },
};
