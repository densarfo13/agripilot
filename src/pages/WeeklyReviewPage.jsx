/**
 * WeeklyReviewPage — /activity/weekly-review.
 *
 * Renders the spec "This Week on Your Farm" summary, consuming
 * window.__weeklyFarmReviewHealth() ONLY. No fake metrics; honest
 * empty state when no data; localized; mobile-first.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { tSafe } from '../i18n/tSafe.js';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _readReview() {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const fn = window.__weeklyFarmReviewHealth;
    return typeof fn === 'function' ? fn() : null;
  }, null);
}

function _readCommandCenter() {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const fn = window.__commandCenterHealth;
    const env = typeof fn === 'function' ? fn() : null;
    return env && env.state ? env.state : null;
  }, null);
}

function _trendLabel(t) {
  if (t === 'improving') return tSafe('weeklyReview.trend.improving', 'Improving');
  if (t === 'declining') return tSafe('weeklyReview.trend.declining', 'Declining');
  if (t === 'stable')    return tSafe('weeklyReview.trend.stable', 'Stable');
  return tSafe('weeklyReview.trend.unknown', 'Not enough data yet');
}

function WeeklyReviewPageInner() {
  const navigate = useNavigate();
  const [env, setEnv] = React.useState(null);
  const [cc, setCC] = React.useState(null);

  React.useEffect(() => {
    let alive = true;
    Promise.all([
      import('../runtime/command-center/WeeklyReviewPageRuntime'),
    ]).then(([mod]) => {
      if (!alive) return;
      setEnv(_readReview());
      setCC(_readCommandCenter());
      _safe(() => mod.recordWeeklyReviewIntegration('page'), null);
    }).catch(() => {
      if (!alive) return;
      setEnv(_readReview());
      setCC(_readCommandCenter());
    });
    return () => { alive = false; };
  }, []);

  const tasks = (env && typeof env.tasksCompleted === 'number') ? env.tasksCompleted : 0;
  const scans = (env && typeof env.scansCompleted === 'number') ? env.scansCompleted : 0;
  const outcomes = (env && typeof env.outcomesImproved === 'number') ? env.outcomesImproved : 0;
  const healthTrend = (env && env.healthTrend) ? env.healthTrend : 'unknown';
  const riskTrend = (env && env.riskTrend) ? env.riskTrend : 'unknown';
  const nextFocus = (env && typeof env.nextWeekFocus === 'string') ? env.nextWeekFocus
    : tSafe('weeklyReview.nextFocus.default', 'Keep up your daily check-ins.');
  const nextAction = cc && cc.nextAction && cc.nextAction.title ? cc.nextAction.title : '';

  const hasAnyData = (tasks > 0) || (scans > 0) || (outcomes > 0);

  const Row = ({ label, value }) => (
    <div style={S.row}>
      <span style={S.rowLabel}>{label}</span>
      <span style={S.rowValue}>{value}</span>
    </div>
  );

  return (
    <main
      style={S.page}
      data-testid="weekly-review-page"
      data-consumes="weeklyReview"
      data-surface="page">
      <button
        type="button"
        onClick={() => _safe(() => navigate('/activity'), null)}
        style={S.back}>
        {'← '}{tSafe('weeklyReview.back', 'Back to Activity')}
      </button>

      <header style={S.head}>
        <p style={S.eyebrow}>{tSafe('weeklyReview.eyebrow', 'This Week on Your Farm')}</p>
        <h1 style={S.title}>{tSafe('weeklyReview.title', 'Your week, in summary')}</h1>
        <p style={S.sub}>
          {tSafe('weeklyReview.sub',
            'Based on the past 7 days of activity on your farm.')}
        </p>
      </header>

      {!hasAnyData ? (
        <section style={S.empty} data-testid="weekly-review-empty">
          <p style={S.emptyTitle}>
            {tSafe('weeklyReview.empty.title', 'Nothing to review yet.')}
          </p>
          <p style={S.emptyBody}>
            {tSafe('weeklyReview.empty.body',
              'Complete a task, scan a plant, or record an outcome — your review will appear here next week.')}
          </p>
        </section>
      ) : (
        <>
          <section style={S.card}>
            <p style={S.cardEyebrow}>{tSafe('weeklyReview.this.week', 'This week:')}</p>
            <Row
              label={tSafe('weeklyReview.tasksCompleted', 'Tasks completed')}
              value={String(tasks)} />
            <Row
              label={tSafe('weeklyReview.scansCompleted', 'Scans completed')}
              value={String(scans)} />
            <Row
              label={tSafe('weeklyReview.outcomesImproved', 'Outcomes improved')}
              value={String(outcomes)} />
            <Row
              label={tSafe('weeklyReview.healthTrend', 'Health trend')}
              value={_trendLabel(healthTrend)} />
            <Row
              label={tSafe('weeklyReview.riskTrend', 'Risk trend')}
              value={_trendLabel(riskTrend)} />
          </section>

          <section style={S.card}>
            <p style={S.cardEyebrow}>{tSafe('weeklyReview.next.week', 'Next week:')}</p>
            <p style={S.nextLine}>{nextFocus}</p>
            {nextAction ? (
              <p style={S.nextActionLine}>
                {tSafe('weeklyReview.nextAction', 'Next action')}: {nextAction}
              </p>
            ) : null}
          </section>
        </>
      )}
    </main>
  );
}

export default class WeeklyReviewPage extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow */ }
  render() {
    if (this.state.failed) return null;
    try { return <WeeklyReviewPageInner />; } catch { return null; }
  }
}

const S = {
  page: { minHeight: '100vh', background: '#FAF7F0', color: '#2C3A26',
    fontFamily: 'system-ui', padding: '20px 16px 96px', maxWidth: 560,
    margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 },
  back: { background: 'transparent', border: 'none', color: 'rgba(60,72,55,0.7)',
    padding: '6px 0', fontSize: 13, fontWeight: 600, textAlign: 'left', cursor: 'pointer' },
  head: { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 4 },
  eyebrow: { margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'rgba(60,72,55,0.55)' },
  title: { margin: 0, fontSize: 22, fontWeight: 800, lineHeight: 1.2 },
  sub: { margin: 0, fontSize: 13, color: 'rgba(60,72,55,0.7)' },
  card: { background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(60,72,55,0.10)',
    borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 },
  cardEyebrow: { margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'rgba(60,72,55,0.62)' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
    padding: '6px 0', borderTop: '1px solid rgba(60,72,55,0.06)' },
  rowLabel: { fontSize: 13, fontWeight: 600, color: 'rgba(60,72,55,0.78)' },
  rowValue: { fontSize: 15, fontWeight: 700, color: 'rgba(40,52,40,0.95)' },
  nextLine: { margin: 0, fontSize: 14, lineHeight: 1.4 },
  nextActionLine: { margin: 0, fontSize: 13, fontWeight: 600, color: 'rgba(60,72,55,0.7)' },
  empty: { background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(60,72,55,0.10)',
    borderRadius: 14, padding: '18px 18px', display: 'flex', flexDirection: 'column', gap: 6 },
  emptyTitle: { margin: 0, fontSize: 16, fontWeight: 700 },
  emptyBody: { margin: 0, fontSize: 13, color: 'rgba(60,72,55,0.7)', lineHeight: 1.4 },
};
