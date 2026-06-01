/**
 * WeeklyReviewHomeCard.jsx — small Home card linking to the weekly
 * review page. ONLY renders when the user has at least 1 completed
 * task, 1 scan, or 1 outcome — per spec gating.
 *
 * Reads __weeklyFarmReviewHealth() to make the gating decision.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { tSafe } from '../../i18n/tSafe.js';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _readReview() {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const fn = window.__weeklyFarmReviewHealth;
    return typeof fn === 'function' ? fn() : null;
  }, null);
}

function WeeklyReviewHomeCardInner() {
  const navigate = useNavigate();
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    const env = _readReview();
    const hasData = env && (
      (typeof env.tasksCompleted === 'number' && env.tasksCompleted > 0)
      || (typeof env.scansCompleted === 'number' && env.scansCompleted > 0)
      || (typeof env.outcomesImproved === 'number' && env.outcomesImproved > 0)
    );
    if (alive && hasData) setShow(true);
    // Record home-card integration regardless of show state — the page
    // mounted, the surface is "wired" even if the gate hides it today.
    import('../../runtime/command-center/WeeklyReviewPageRuntime')
      .then((m) => { try { m.recordWeeklyReviewIntegration('home-card'); } catch { /* swallow */ } })
      .catch(() => { /* swallow */ });
    return () => { alive = false; };
  }, []);

  if (!show) return null;

  return (
    <button
      type="button"
      onClick={() => _safe(() => navigate('/activity/weekly-review'), null)}
      style={S.card}
      data-testid="weekly-review-home-card"
      data-consumes="weeklyReview"
      data-surface="home-card">
      <span style={S.eyebrow}>{tSafe('weeklyReview.homeCard.eyebrow', 'This week')}</span>
      <span style={S.title}>
        {tSafe('weeklyReview.homeCard.title', 'View weekly review')}
      </span>
      <span style={S.chev}>›</span>
    </button>
  );
}

export default class WeeklyReviewHomeCard extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow */ }
  render() {
    if (this.state.failed) return null;
    try { return <WeeklyReviewHomeCardInner />; } catch { return null; }
  }
}

const S = {
  card: {
    background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(60,72,55,0.10)',
    borderRadius: 12, padding: '12px 14px',
    display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 12, cursor: 'pointer', width: '100%',
    textAlign: 'left',
  },
  eyebrow: {
    flex: '0 0 auto', fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'rgba(60,72,55,0.55)',
  },
  title: {
    flex: 1, fontSize: 14, fontWeight: 700, color: 'rgba(40,52,40,0.95)',
  },
  chev: { flex: '0 0 auto', fontSize: 22, color: 'rgba(60,72,55,0.55)' },
};
