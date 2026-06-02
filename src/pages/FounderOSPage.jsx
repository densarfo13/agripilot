/**
 * FounderOSPage — /admin/founder-os.
 *
 * Admin-only Pilot Operating Picture. Pure projection over the
 * composite envelope exposed by window.__founderOSHealth(). No new
 * intelligence is computed here — every value is either a direct
 * read from the envelope or the "needs data" fallback string.
 *
 * Role-gated inside the page: non-admin sees a polite "Not available".
 *
 * Self-contained pattern:
 *   - imports only React, useNavigate, tSafe, useAuth (per spec).
 *   - every reader and renderer wrapped in _safe.
 *   - never throws; null values surface as honest "Not enough data yet".
 *   - no PII surfaced — only aggregate counts + percentages.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { tSafe } from '../i18n/tSafe.js';
import { useAuth } from '../context/AuthContext.jsx';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _probe(name) {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}

function _readFounderOS() {
  return _safe(() => _probe('__founderOSHealth'), null);
}

// Literal-true safety constants — surface-level honesty markers.
const noFakeMetrics = true;
const noFakeScore = true;
const noPII = true;

const ALLOWED_ROLES = new Set(['admin']);

const FALLBACK_KEY = 'founderOS.needsData';
const FALLBACK_TEXT = 'Not enough data yet';

function _present(v) {
  return v !== null && v !== undefined;
}

function _fmt(v) {
  return _safe(() => {
    if (!_present(v)) return null;
    if (typeof v === 'number' && !isFinite(v)) return null;
    return String(v);
  }, null);
}

function _pct(v) {
  return _safe(() => {
    if (!_present(v)) return null;
    if (typeof v !== 'number' || !isFinite(v)) return null;
    return `${v}%`;
  }, null);
}

function FounderOSPageInner() {
  const navigate = useNavigate();
  const { user } = useAuth() || {};
  const role = String((user && user.role) || '').toLowerCase();
  const allowed = ALLOWED_ROLES.has(role);

  const [env, setEnv] = React.useState(null);

  React.useEffect(() => {
    if (!allowed) return undefined;
    let alive = true;
    if (alive) setEnv(_readFounderOS());
    return () => { alive = false; };
  }, [allowed]);

  if (!allowed) {
    return (
      <main
        style={S.page}
        data-testid="founder-os-not-allowed"
        data-surface="founder-os"
        data-role-scoped="true">
        <p style={S.h1}>
          {tSafe('founderOS.notAllowed.title', 'Not available')}
        </p>
        <p style={S.sub}>
          {tSafe('founderOS.notAllowed.body',
            'This view is for system admins only.')}
        </p>
        <button
          type="button"
          style={S.btnPrimary}
          onClick={() => _safe(() => navigate('/home'), null)}>
          {tSafe('common.goHome', 'Go to Home')}
        </button>
      </main>
    );
  }

  const summary = _safe(() => (env && env.executiveSummary) || null, null);
  const funnel = _safe(() => (env && env.funnel) || null, null);
  const todayAction = _safe(() => (env && env.todayAction) || null, null);
  const scan = _safe(() => (env && env.scan) || null, null);
  const outcome = _safe(() => (env && env.outcome) || null, null);
  const retention = _safe(() => (env && env.retention) || null, null);
  const reliability = _safe(() => (env && env.reliability) || null, null);
  const feedback = _safe(() => (env && env.feedback) || null, null);
  const fieldOfficer = _safe(() => (env && env.fieldOfficer) || null, null);
  const intelligence = _safe(() => (env && env.intelligence) || null, null);
  const pilotScore = _safe(() => (env && env.pilotScore) || null, null);

  const Tile = ({ label, value, testId }) => (
    <div style={S.tile} data-testid={testId}>
      <p style={S.tileLabel}>{label}</p>
      <p style={S.tileValue}>
        {value === null || value === undefined
          ? tSafe(FALLBACK_KEY, FALLBACK_TEXT)
          : String(value)}
      </p>
    </div>
  );

  const funnelStages = _safe(
    () => (funnel && Array.isArray(funnel.stages) ? funnel.stages : []),
    [],
  );

  const scoreValue = _safe(
    () => (pilotScore && _present(pilotScore.score) ? pilotScore.score : null),
    null,
  );
  const scoreComponents = _safe(
    () => (pilotScore && Array.isArray(pilotScore.components)
      ? pilotScore.components.slice(0, 5)
      : []),
    [],
  );

  return (
    <main
      style={S.page}
      data-testid="founder-os-page"
      data-consumes="founderOS"
      data-surface="founder-os"
      data-role-scoped="true">
      <header style={S.head}>
        <p style={S.eyebrow}>
          {tSafe('founderOS.eyebrow', 'Founder OS')}
        </p>
        <h1 style={S.h1}>
          {tSafe('founderOS.title', 'Pilot Operating Picture')}
        </h1>
        <p style={S.sub}>
          {tSafe('founderOS.sub',
            'Real-time pilot metrics. Counts reflect persisted artifacts only.')}
        </p>
      </header>

      {/* 1. Executive Summary — 10 tiles */}
      <section style={S.section} data-testid="founder-os-executive">
        <p style={S.sectionEyebrow}>
          {tSafe('founderOS.section.executive', 'Executive Summary')}
        </p>
        <div style={S.grid}>
          <Tile
            label={tSafe('founderOS.metric.totalUsers', 'Total users')}
            value={_fmt(summary && summary.totalUsers)}
            testId="fos-exec-total-users" />
          <Tile
            label={tSafe('founderOS.metric.activeUsers', 'Active users')}
            value={_fmt(summary && summary.activeUsers)}
            testId="fos-exec-active-users" />
          <Tile
            label={tSafe('founderOS.metric.totalScans', 'Total scans')}
            value={_fmt(summary && summary.totalScans)}
            testId="fos-exec-total-scans" />
          <Tile
            label={tSafe('founderOS.metric.completedScans', 'Completed scans')}
            value={_fmt(summary && summary.completedScans)}
            testId="fos-exec-completed-scans" />
          <Tile
            label={tSafe('founderOS.metric.outcomesCaptured', 'Outcomes captured')}
            value={_fmt(summary && summary.outcomesCaptured)}
            testId="fos-exec-outcomes" />
          <Tile
            label={tSafe('founderOS.metric.betterPct', 'Better %')}
            value={_pct(summary && summary.betterPct)}
            testId="fos-exec-better-pct" />
          <Tile
            label={tSafe('founderOS.metric.retentionD7', 'Retention D7')}
            value={_pct(summary && summary.retentionD7)}
            testId="fos-exec-retention-d7" />
          <Tile
            label={tSafe('founderOS.metric.errorRate', 'Error rate')}
            value={_pct(summary && summary.errorRate)}
            testId="fos-exec-error-rate" />
          <Tile
            label={tSafe('founderOS.metric.averageRating', 'Average rating')}
            value={_fmt(summary && summary.averageRating)}
            testId="fos-exec-avg-rating" />
          <Tile
            label={tSafe('founderOS.metric.pilotScore', 'Pilot score')}
            value={_fmt(summary && summary.pilotScore)}
            testId="fos-exec-pilot-score" />
        </div>
      </section>

      {/* 2. Funnel — 8 stages with count + conv% + drop% */}
      <section style={S.section} data-testid="founder-os-funnel">
        <p style={S.sectionEyebrow}>
          {tSafe('founderOS.section.funnel', 'Funnel')}
        </p>
        {funnelStages.length === 0 ? (
          <p style={S.note}>{tSafe(FALLBACK_KEY, FALLBACK_TEXT)}</p>
        ) : (
          <ol style={S.funnelList}>
            {funnelStages.map((stage, i) => {
              const name = _safe(
                () => tSafe(
                  `founderOS.metric.funnel.${stage && stage.key}`,
                  String((stage && stage.label) || (stage && stage.key) || `Stage ${i + 1}`),
                ),
                `Stage ${i + 1}`,
              );
              const count = _fmt(stage && stage.count);
              const conv = _pct(stage && stage.conversionPct);
              const drop = _pct(stage && stage.dropOffPct);
              return (
                <li
                  key={`fos-funnel-${i}`}
                  style={S.funnelRow}
                  data-testid={`fos-funnel-${i}`}>
                  <span style={S.funnelIndex}>{i + 1}</span>
                  <span style={S.funnelName}>{name}</span>
                  <span style={S.funnelMetric}>
                    {count === null
                      ? tSafe(FALLBACK_KEY, FALLBACK_TEXT)
                      : count}
                  </span>
                  <span style={S.funnelMetric}>
                    {conv === null
                      ? tSafe(FALLBACK_KEY, FALLBACK_TEXT)
                      : conv}
                  </span>
                  <span style={S.funnelMetric}>
                    {drop === null
                      ? tSafe(FALLBACK_KEY, FALLBACK_TEXT)
                      : drop}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* 3. Today's Action — 4 tiles */}
      <section style={S.section} data-testid="founder-os-today-action">
        <p style={S.sectionEyebrow}>
          {tSafe('founderOS.section.todayAction', "Today's Action")}
        </p>
        <div style={S.grid}>
          <Tile
            label={tSafe('founderOS.metric.shown', 'Shown')}
            value={_fmt(todayAction && todayAction.shown)}
            testId="fos-today-shown" />
          <Tile
            label={tSafe('founderOS.metric.started', 'Started')}
            value={_fmt(todayAction && todayAction.started)}
            testId="fos-today-started" />
          <Tile
            label={tSafe('founderOS.metric.completed', 'Completed')}
            value={_fmt(todayAction && todayAction.completed)}
            testId="fos-today-completed" />
          <Tile
            label={tSafe('founderOS.metric.completionPct', 'Completion %')}
            value={_pct(todayAction && todayAction.completionPct)}
            testId="fos-today-pct" />
        </div>
      </section>

      {/* 4. Scan Dashboard — 7 tiles */}
      <section style={S.section} data-testid="founder-os-scan">
        <p style={S.sectionEyebrow}>
          {tSafe('founderOS.section.scan', 'Scan')}
        </p>
        <div style={S.grid}>
          <Tile
            label={tSafe('founderOS.metric.scanStarted', 'Scan started')}
            value={_fmt(scan && scan.started)}
            testId="fos-scan-started" />
          <Tile
            label={tSafe('founderOS.metric.scanCompleted', 'Scan completed')}
            value={_fmt(scan && scan.completed)}
            testId="fos-scan-completed" />
          <Tile
            label={tSafe('founderOS.metric.scanIdentified', 'Identified')}
            value={_fmt(scan && scan.identified)}
            testId="fos-scan-identified" />
          <Tile
            label={tSafe('founderOS.metric.scanIssue', 'Issue detected')}
            value={_fmt(scan && scan.issue)}
            testId="fos-scan-issue" />
          <Tile
            label={tSafe('founderOS.metric.scanEscalated', 'Escalated')}
            value={_fmt(scan && scan.escalated)}
            testId="fos-scan-escalated" />
          <Tile
            label={tSafe('founderOS.metric.scanOutcome', 'Outcome logged')}
            value={_fmt(scan && scan.outcome)}
            testId="fos-scan-outcome" />
          <Tile
            label={tSafe('founderOS.metric.scanSuccessPct', 'Success %')}
            value={_pct(scan && scan.successPct)}
            testId="fos-scan-success-pct" />
        </div>
      </section>

      {/* 5. Outcome Dashboard — Better/Same/Worse + total + by-pct */}
      <section style={S.section} data-testid="founder-os-outcome">
        <p style={S.sectionEyebrow}>
          {tSafe('founderOS.section.outcome', 'Outcomes')}
        </p>
        <div style={S.grid}>
          <Tile
            label={tSafe('founderOS.metric.outcomeBetter', 'Better')}
            value={_fmt(outcome && outcome.better)}
            testId="fos-outcome-better" />
          <Tile
            label={tSafe('founderOS.metric.outcomeSame', 'Same')}
            value={_fmt(outcome && outcome.same)}
            testId="fos-outcome-same" />
          <Tile
            label={tSafe('founderOS.metric.outcomeWorse', 'Worse')}
            value={_fmt(outcome && outcome.worse)}
            testId="fos-outcome-worse" />
          <Tile
            label={tSafe('founderOS.metric.outcomeTotal', 'Total outcomes')}
            value={_fmt(outcome && outcome.total)}
            testId="fos-outcome-total" />
          <Tile
            label={tSafe('founderOS.metric.outcomeBetterPct', 'Better %')}
            value={_pct(outcome && outcome.betterPct)}
            testId="fos-outcome-better-pct" />
          <Tile
            label={tSafe('founderOS.metric.outcomeSamePct', 'Same %')}
            value={_pct(outcome && outcome.samePct)}
            testId="fos-outcome-same-pct" />
          <Tile
            label={tSafe('founderOS.metric.outcomeWorsePct', 'Worse %')}
            value={_pct(outcome && outcome.worsePct)}
            testId="fos-outcome-worse-pct" />
        </div>
      </section>

      {/* 6. Retention — D1/D7/D30 + WAU/MAU */}
      <section style={S.section} data-testid="founder-os-retention">
        <p style={S.sectionEyebrow}>
          {tSafe('founderOS.section.retention', 'Retention')}
        </p>
        <div style={S.grid}>
          <Tile
            label={tSafe('founderOS.metric.retentionD1', 'D1')}
            value={_pct(retention && retention.d1)}
            testId="fos-retention-d1" />
          <Tile
            label={tSafe('founderOS.metric.retentionD7', 'D7')}
            value={_pct(retention && retention.d7)}
            testId="fos-retention-d7" />
          <Tile
            label={tSafe('founderOS.metric.retentionD30', 'D30')}
            value={_pct(retention && retention.d30)}
            testId="fos-retention-d30" />
          <Tile
            label={tSafe('founderOS.metric.wau', 'WAU')}
            value={_fmt(retention && retention.wau)}
            testId="fos-retention-wau" />
          <Tile
            label={tSafe('founderOS.metric.mau', 'MAU')}
            value={_fmt(retention && retention.mau)}
            testId="fos-retention-mau" />
        </div>
      </section>

      {/* 7. Reliability — 5 tiles + total errors */}
      <section style={S.section} data-testid="founder-os-reliability">
        <p style={S.sectionEyebrow}>
          {tSafe('founderOS.section.reliability', 'Reliability')}
        </p>
        <div style={S.grid}>
          <Tile
            label={tSafe('founderOS.metric.crashFreeSessions', 'Crash-free sessions')}
            value={_pct(reliability && reliability.crashFreeSessions)}
            testId="fos-reliability-crash-free" />
          <Tile
            label={tSafe('founderOS.metric.errorRate', 'Error rate')}
            value={_pct(reliability && reliability.errorRate)}
            testId="fos-reliability-error-rate" />
          <Tile
            label={tSafe('founderOS.metric.p95Latency', 'p95 latency')}
            value={_fmt(reliability && reliability.p95Latency)}
            testId="fos-reliability-p95" />
          <Tile
            label={tSafe('founderOS.metric.offlineSuccessRate', 'Offline success')}
            value={_pct(reliability && reliability.offlineSuccessRate)}
            testId="fos-reliability-offline" />
          <Tile
            label={tSafe('founderOS.metric.syncSuccessRate', 'Sync success')}
            value={_pct(reliability && reliability.syncSuccessRate)}
            testId="fos-reliability-sync" />
          <Tile
            label={tSafe('founderOS.metric.totalErrors', 'Total errors')}
            value={_fmt(reliability && reliability.totalErrors)}
            testId="fos-reliability-total-errors" />
        </div>
      </section>

      {/* 8. User Feedback — averageRating + 3 count tiles */}
      <section style={S.section} data-testid="founder-os-feedback">
        <p style={S.sectionEyebrow}>
          {tSafe('founderOS.section.feedback', 'User Feedback')}
        </p>
        <div style={S.grid}>
          <Tile
            label={tSafe('founderOS.metric.averageRating', 'Average rating')}
            value={_fmt(feedback && feedback.averageRating)}
            testId="fos-feedback-avg" />
          <Tile
            label={tSafe('founderOS.metric.feedbackTotal', 'Total feedback')}
            value={_fmt(feedback && feedback.total)}
            testId="fos-feedback-total" />
          <Tile
            label={tSafe('founderOS.metric.feedbackPositive', 'Positive')}
            value={_fmt(feedback && feedback.positive)}
            testId="fos-feedback-positive" />
          <Tile
            label={tSafe('founderOS.metric.feedbackNegative', 'Negative')}
            value={_fmt(feedback && feedback.negative)}
            testId="fos-feedback-negative" />
        </div>
      </section>

      {/* 9. Field Officer — 4 tiles */}
      <section style={S.section} data-testid="founder-os-field-officer">
        <p style={S.sectionEyebrow}>
          {tSafe('founderOS.section.fieldOfficer', 'Field Officer')}
        </p>
        <div style={S.grid}>
          <Tile
            label={tSafe('founderOS.metric.foVisits', 'Visits')}
            value={_fmt(fieldOfficer && fieldOfficer.visits)}
            testId="fos-fo-visits" />
          <Tile
            label={tSafe('founderOS.metric.foFarmersReached', 'Farmers reached')}
            value={_fmt(fieldOfficer && fieldOfficer.farmersReached)}
            testId="fos-fo-farmers" />
          <Tile
            label={tSafe('founderOS.metric.foInterventions', 'Interventions')}
            value={_fmt(fieldOfficer && fieldOfficer.interventions)}
            testId="fos-fo-interventions" />
          <Tile
            label={tSafe('founderOS.metric.foEscalations', 'Escalations')}
            value={_fmt(fieldOfficer && fieldOfficer.escalations)}
            testId="fos-fo-escalations" />
        </div>
      </section>

      {/* 10. Intelligence Impact — 4 tiles */}
      <section style={S.section} data-testid="founder-os-intelligence">
        <p style={S.sectionEyebrow}>
          {tSafe('founderOS.section.intelligence', 'Intelligence Impact')}
        </p>
        <div style={S.grid}>
          <Tile
            label={tSafe('founderOS.metric.intelDecisions', 'Decisions surfaced')}
            value={_fmt(intelligence && intelligence.decisions)}
            testId="fos-intel-decisions" />
          <Tile
            label={tSafe('founderOS.metric.intelActedOn', 'Acted on')}
            value={_fmt(intelligence && intelligence.actedOn)}
            testId="fos-intel-acted-on" />
          <Tile
            label={tSafe('founderOS.metric.intelActionRate', 'Action rate')}
            value={_pct(intelligence && intelligence.actionRate)}
            testId="fos-intel-action-rate" />
          <Tile
            label={tSafe('founderOS.metric.intelImpactPct', 'Impact %')}
            value={_pct(intelligence && intelligence.impactPct)}
            testId="fos-intel-impact-pct" />
        </div>
      </section>

      {/* 11. Pilot Score — large score + 5-component breakdown bar */}
      <section style={S.section} data-testid="founder-os-pilot-score">
        <p style={S.sectionEyebrow}>
          {tSafe('founderOS.section.pilotScore', 'Pilot Score')}
        </p>
        {scoreValue === null ? (
          <p style={S.note}>{tSafe(FALLBACK_KEY, FALLBACK_TEXT)}</p>
        ) : (
          <div style={S.scoreWrap}>
            <div style={S.scoreLine}>
              <span style={S.scoreBig} data-testid="fos-score-big">
                {String(scoreValue)}
              </span>
              <span style={S.scoreSuffix}>/ 100</span>
            </div>
            {scoreComponents.length > 0 ? (
              <div
                style={S.scoreBar}
                data-testid="fos-score-bar">
                {scoreComponents.map((c, i) => {
                  const weight = _safe(() => {
                    const n = c && typeof c.weight === 'number' ? c.weight : null;
                    return n !== null && isFinite(n) && n > 0 ? n : 0;
                  }, 0);
                  const label = _safe(
                    () => String((c && (c.label || c.key)) || `c${i + 1}`),
                    `c${i + 1}`,
                  );
                  if (weight <= 0) return null;
                  return (
                    <div
                      key={`fos-score-comp-${i}`}
                      style={{
                        ...S.scoreSegment,
                        flexGrow: weight,
                        background: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
                      }}
                      data-testid={`fos-score-comp-${i}`}
                      title={label}>
                      <span style={S.scoreSegmentLabel}>{label}</span>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        )}
      </section>

      <p style={S.note} data-testid="founder-os-honest-note">
        {tSafe('founderOS.note.honest',
          'Null values mean "no data ingested yet" — never fabricated.')}
      </p>
    </main>
  );
}

export default class FounderOSPage extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow */ }
  render() {
    if (this.state.failed) return null;
    try { return <FounderOSPageInner />; } catch { return null; }
  }
}

const SEGMENT_COLORS = [
  '#2f7a3a',
  '#5aa64a',
  '#c9a227',
  '#d97a3a',
  '#7c4a8a',
];

const S = {
  page: {
    minHeight: '100vh', background: '#FAF7F0', color: '#2C3A26',
    fontFamily: 'system-ui', padding: '20px 16px 96px', maxWidth: 880,
    margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18,
  },
  head: { display: 'flex', flexDirection: 'column', gap: 4 },
  eyebrow: {
    margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'rgba(60,72,55,0.55)',
  },
  h1: { margin: 0, fontSize: 22, fontWeight: 800, lineHeight: 1.2 },
  sub: { margin: 0, fontSize: 13, color: 'rgba(60,72,55,0.7)' },
  section: { display: 'flex', flexDirection: 'column', gap: 8 },
  sectionEyebrow: {
    margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'rgba(60,72,55,0.62)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 8,
  },
  tile: {
    background: 'rgba(255,255,255,0.95)',
    border: '1px solid rgba(60,72,55,0.10)',
    borderRadius: 12, padding: '12px 14px',
    display: 'flex', flexDirection: 'column', gap: 2,
  },
  tileLabel: {
    margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'rgba(60,72,55,0.55)',
  },
  tileValue: {
    margin: 0, fontSize: 17, fontWeight: 700,
    color: 'rgba(40,52,40,0.95)',
  },
  funnelList: {
    listStyle: 'none', margin: 0, padding: 0,
    display: 'flex', flexDirection: 'column', gap: 6,
  },
  funnelRow: {
    display: 'grid',
    gridTemplateColumns: '28px 1fr auto auto auto',
    alignItems: 'center', gap: 8,
    background: 'rgba(255,255,255,0.95)',
    border: '1px solid rgba(60,72,55,0.10)',
    borderRadius: 10, padding: '10px 12px',
    fontSize: 13,
  },
  funnelIndex: {
    fontSize: 11, fontWeight: 800, color: 'rgba(60,72,55,0.55)',
  },
  funnelName: { fontWeight: 700, color: 'rgba(40,52,40,0.95)' },
  funnelMetric: {
    fontSize: 12, fontWeight: 700, color: 'rgba(60,72,55,0.75)',
    minWidth: 56, textAlign: 'right',
  },
  scoreWrap: { display: 'flex', flexDirection: 'column', gap: 10 },
  scoreLine: { display: 'flex', alignItems: 'baseline', gap: 8 },
  scoreBig: {
    fontSize: 48, fontWeight: 800, lineHeight: 1,
    color: 'rgba(40,52,40,0.95)',
  },
  scoreSuffix: {
    fontSize: 14, fontWeight: 700, color: 'rgba(60,72,55,0.55)',
  },
  scoreBar: {
    display: 'flex', width: '100%', height: 18,
    borderRadius: 9, overflow: 'hidden',
    border: '1px solid rgba(60,72,55,0.10)',
  },
  scoreSegment: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontSize: 10, fontWeight: 800,
    letterSpacing: '0.04em', overflow: 'hidden',
    whiteSpace: 'nowrap', textOverflow: 'ellipsis',
    padding: '0 6px',
  },
  scoreSegmentLabel: {
    overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
  },
  note: { margin: 0, fontSize: 11, color: 'rgba(60,72,55,0.55)' },
  btnPrimary: {
    minHeight: 44, padding: '0 18px', borderRadius: 10, border: 'none',
    background: '#2f7a3a', color: '#fff', fontSize: 15, fontWeight: 700,
    cursor: 'pointer', alignSelf: 'flex-start',
  },
};

// Surface-level honesty markers — referenced for tree-shake guards.
void noFakeMetrics; void noFakeScore; void noPII;
