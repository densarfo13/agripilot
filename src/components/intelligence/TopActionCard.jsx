/**
 * TopActionCard.jsx — single highest-priority action surface.
 *
 * Renders the spec's 4 fields:
 *   1. Highest Priority Action (recommendation)
 *   2. Why (reason[])
 *   3. Expected Benefit
 *   4. Confidence
 *
 *   <TopActionCard />               default — fetches /api/recommendations/today
 *   <TopActionCard showTopThree />  also renders the next 2 actions
 *
 * Pure render. SSR-safe. Never throws. Self-hides when no inputs
 * are available (engine returns ok:true + topAction:null).
 */
import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import { fetchTodayRecommendation } from
  '../../runtime/intelligencePlatform/IntelligencePlatformRecommendationEngine';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _priorityLabel(score) {
  if (score == null) return '';
  if (score >= 70) return 'HIGH PRIORITY';
  if (score >= 45) return 'MEDIUM PRIORITY';
  return 'LOW PRIORITY';
}

function _priorityColor(score) {
  if (score == null) return '#9a6a00';
  if (score >= 70) return '#a13a3a';
  if (score >= 45) return '#9a6a00';
  return '#2f7a3a';
}

function _confidencePct(c) {
  if (typeof c !== 'number') return '—';
  return Math.round(c * 100) + '%';
}

function _timeframeLabel(days) {
  if (typeof days !== 'number' || days <= 0) return '';
  if (days === 1) return 'within 1 day';
  return 'within ' + days + ' days';
}

function TopActionCardInner({ showTopThree }) {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const env = await fetchTodayRecommendation();
      if (cancelled) return;
      setData(env); setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading && !data) {
    return (
      <section
        style={S.wrap}
        data-testid="top-action-card-loading"
        data-consumes="intelligencePlatform">
        <p style={S.eyebrow}>{tSafe('intelligencePlatform.eyebrow', 'Today’s Best Action')}</p>
        <p style={S.loading}>{tSafe('intelligencePlatform.loading', 'Computing…')}</p>
      </section>
    );
  }

  if (!data || !data.ok || !data.topAction) {
    // Honest empty state — never invents a recommendation.
    const msg = (data && data.message)
      || tSafe('intelligencePlatform.empty', 'Scan a plant or add your farm location to see personalized actions.');
    return (
      <section
        style={S.wrap}
        data-testid="top-action-card-empty"
        data-consumes="intelligencePlatform"
        data-surface="top-action">
        <p style={S.eyebrow}>{tSafe('intelligencePlatform.eyebrow', 'Today’s Best Action')}</p>
        <p style={S.empty}>{msg}</p>
      </section>
    );
  }

  const top = data.topAction;
  const reasonList = Array.isArray(top.reason) ? top.reason : [];

  return (
    <section
      style={S.wrap}
      data-testid="top-action-card"
      data-consumes="intelligencePlatform"
      data-surface="top-action">
      <header style={S.head}>
        <span
          style={{ ...S.priorityBadge, color: _priorityColor(top.priorityScore) }}
          data-testid="top-action-priority">
          {_priorityLabel(top.priorityScore)}
          {' · '}
          {top.priorityScore}/100
        </span>
        {top.timeframeDays
          ? <span style={S.timeframe}>{_timeframeLabel(top.timeframeDays)}</span>
          : null}
      </header>

      {/* 1. Highest Priority Action */}
      <h2 style={S.action} data-testid="top-action-recommendation">
        {top.recommendation}
      </h2>

      {/* 2. Why */}
      {reasonList.length > 0 ? (
        <div style={S.section} data-testid="top-action-reason">
          <p style={S.sectionLabel}>{tSafe('intelligencePlatform.why', 'Why')}</p>
          <ul style={S.reasonList}>
            {reasonList.map((r, i) => (
              <li key={i} style={S.reasonItem}>{r}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* 3. Expected Benefit */}
      {top.expectedBenefit ? (
        <div style={S.section} data-testid="top-action-benefit">
          <p style={S.sectionLabel}>{tSafe('intelligencePlatform.benefit', 'Expected Benefit')}</p>
          <p style={S.benefitText}>{top.expectedBenefit}</p>
        </div>
      ) : null}

      {/* 4. Confidence */}
      <div style={S.confidenceRow} data-testid="top-action-confidence">
        <span style={S.confidenceLabel}>{tSafe('intelligencePlatform.confidence', 'Confidence')}</span>
        <span style={S.confidenceValue}>{_confidencePct(top.confidence)}</span>
        {top.outcomeLift && top.outcomeLift.successRate != null ? (
          <span style={S.outcomeBoost}>
            ↑ {Math.round(top.outcomeLift.successRate)}% historical success
            (n={top.outcomeLift.sampleSize})
          </span>
        ) : null}
      </div>

      {/* Optional Top 3 strip */}
      {showTopThree && data.topThree && data.topThree.length > 1 ? (
        <div style={S.topThreeWrap} data-testid="top-action-top-three">
          <p style={S.sectionLabel}>{tSafe('intelligencePlatform.next', 'Next 2 actions')}</p>
          {data.topThree.slice(1, 3).map((a, i) => (
            <div key={i} style={S.topThreeRow}>
              <span style={S.topThreeScore}>{a.priorityScore}/100</span>
              <span style={S.topThreeText}>{a.recommendation}</span>
            </div>
          ))}
        </div>
      ) : null}

      <p style={S.footnote}>
        {tSafe('intelligencePlatform.footnote', 'Decision support, not a guarantee.')}
      </p>
    </section>
  );
}

export default class TopActionCard extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow */ }
  render() {
    if (this.state.failed) return null;
    try { return <TopActionCardInner {...this.props} />; }
    catch { return null; }
  }
}

const S = {
  wrap: {
    background: 'rgba(255,255,255,0.95)',
    border: '1px solid rgba(60,72,55,0.12)',
    borderRadius: 14, padding: '16px 18px',
    display: 'flex', flexDirection: 'column', gap: 10,
    fontFamily: 'system-ui',
    margin: '12px 0',
  },
  eyebrow: {
    margin: 0, fontSize: 10, fontWeight: 800,
    letterSpacing: '0.08em', textTransform: 'uppercase',
    color: 'rgba(60,72,55,0.55)',
  },
  head: { display: 'flex', flexDirection: 'row', gap: 12,
    alignItems: 'baseline', flexWrap: 'wrap' },
  priorityBadge: { fontSize: 11, fontWeight: 800,
    letterSpacing: '0.08em', textTransform: 'uppercase' },
  timeframe: { fontSize: 11, color: 'rgba(60,72,55,0.6)' },
  action: { margin: 0, fontSize: 18, fontWeight: 800,
    color: '#1F2933', lineHeight: 1.3 },
  section: { display: 'flex', flexDirection: 'column', gap: 4 },
  sectionLabel: { margin: 0, fontSize: 10, fontWeight: 800,
    letterSpacing: '0.08em', textTransform: 'uppercase',
    color: 'rgba(60,72,55,0.55)' },
  reasonList: { listStyle: 'disc', margin: 0,
    paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 2 },
  reasonItem: { fontSize: 13, color: '#1F2933', lineHeight: 1.4 },
  benefitText: { margin: 0, fontSize: 13, color: '#1F2933', lineHeight: 1.4 },
  confidenceRow: { display: 'flex', flexDirection: 'row',
    gap: 10, alignItems: 'baseline', flexWrap: 'wrap',
    borderTop: '1px solid rgba(60,72,55,0.08)', paddingTop: 8 },
  confidenceLabel: { fontSize: 10, fontWeight: 800,
    letterSpacing: '0.08em', textTransform: 'uppercase',
    color: 'rgba(60,72,55,0.55)' },
  confidenceValue: { fontSize: 16, fontWeight: 800, color: '#1F2933' },
  outcomeBoost: { fontSize: 11, color: '#2f7a3a' },
  topThreeWrap: { display: 'flex', flexDirection: 'column', gap: 4,
    borderTop: '1px solid rgba(60,72,55,0.08)', paddingTop: 8 },
  topThreeRow: { display: 'flex', flexDirection: 'row', gap: 10,
    fontSize: 12 },
  topThreeScore: { fontWeight: 800, color: '#9a6a00',
    minWidth: 50 },
  topThreeText: { color: '#1F2933', flex: 1 },
  loading: { margin: 0, fontSize: 12, color: 'rgba(60,72,55,0.6)' },
  empty: { margin: 0, fontSize: 13, color: 'rgba(60,72,55,0.7)',
    lineHeight: 1.4 },
  footnote: { margin: 0, fontSize: 10,
    color: 'rgba(60,72,55,0.5)', textAlign: 'right' },
};
