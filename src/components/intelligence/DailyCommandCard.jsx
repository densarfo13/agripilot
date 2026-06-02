/**
 * DailyCommandCard.jsx — focused 5-field command center surface.
 *
 * Spec V1 Command Center: show ONLY
 *   1. Current Crop
 *   2. Growth Stage
 *   3. Health
 *   4. Risk
 *   5. Today's Action
 *
 * Reads /api/daily-action (which already composes crop + growthStage)
 * and surfaces the 5 fields. Pure render.
 */
import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import { fetchDailyAction } from
  '../../runtime/dailyAction/RecommendationEngine';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _healthLabel(priority) {
  if (priority === 'high')   return 'Needs attention';
  if (priority === 'medium') return 'Watch';
  return 'Stable';
}

function _healthColor(priority) {
  if (priority === 'high')   return '#a13a3a';
  if (priority === 'medium') return '#9a6a00';
  return '#2f7a3a';
}

function _riskLabel(priority, confidence) {
  if (priority === 'high')   return 'High';
  if (priority === 'medium') return 'Medium';
  if (confidence != null && confidence < 35) return 'Unknown';
  return 'Low';
}

function DailyCommandCardInner() {
  const [data, setData] = React.useState(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const env = await fetchDailyAction();
      if (cancelled) return;
      setData(env);
    })();
    return () => { cancelled = true; };
  }, []);

  if (!data) {
    return (
      <section style={S.wrap} data-testid="daily-command-card-loading"
        data-consumes="dailyAction">
        <p style={S.eyebrow}>{tSafe('dailyCommand.eyebrow', 'Command Center')}</p>
        <p style={S.empty}>{tSafe('dailyCommand.loading', 'Loading…')}</p>
      </section>
    );
  }

  // Spec scope — render ONLY these 5 fields. Anything else lives
  // in other surfaces.
  const crop      = (data.sources && data.sources.crop)
    || tSafe('dailyCommand.cropUnknown', '—');
  const stage     = data.category === 'growth'
    ? (data.action || '').toLowerCase()
    : null;
  const priority  = data.priority || 'low';
  const health    = _healthLabel(priority);
  const risk      = _riskLabel(priority, data.confidence);
  const action    = data.action;

  return (
    <section
      style={S.wrap}
      data-testid="daily-command-card"
      data-consumes="dailyAction"
      data-surface="daily-command">
      <p style={S.eyebrow}>{tSafe('dailyCommand.eyebrow', 'Command Center')}</p>
      <div style={S.grid}>
        <Row label={tSafe('dailyCommand.crop', 'Current Crop')}
          value={String(crop)} testid="daily-command-crop" />
        <Row label={tSafe('dailyCommand.stage', 'Growth Stage')}
          value={stage || (data.sources && data.sources.growthStage
            ? (tSafe('dailyCommand.stageActive', 'Active')) : '—')}
          testid="daily-command-stage" />
        <Row label={tSafe('dailyCommand.health', 'Health')}
          value={health} color={_healthColor(priority)}
          testid="daily-command-health" />
        <Row label={tSafe('dailyCommand.risk', 'Risk')}
          value={risk} color={_healthColor(priority)}
          testid="daily-command-risk" />
        <Row label={tSafe('dailyCommand.action', "Today's Action")}
          value={action} testid="daily-command-action" wide />
      </div>
    </section>
  );
}

function Row({ label, value, color, testid, wide }) {
  return (
    <div style={wide ? { ...S.row, ...S.rowWide } : S.row}
      data-testid={testid}>
      <span style={S.k}>{label}</span>
      <span style={{ ...S.v, color: color || '#1F2933' }}>{value}</span>
    </div>
  );
}

export default class DailyCommandCard extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow */ }
  render() {
    if (this.state.failed) return null;
    try { return <DailyCommandCardInner {...this.props} />; }
    catch { return null; }
  }
}

const S = {
  wrap: {
    background: 'rgba(255,255,255,0.92)',
    border: '1px solid rgba(60,72,55,0.10)',
    borderRadius: 12, padding: '12px 14px',
    display: 'flex', flexDirection: 'column', gap: 8,
    fontFamily: 'system-ui', margin: '8px 0',
  },
  eyebrow: { margin: 0, fontSize: 10, fontWeight: 800,
    letterSpacing: '0.08em', textTransform: 'uppercase',
    color: 'rgba(60,72,55,0.55)' },
  grid: { display: 'flex', flexDirection: 'column', gap: 6 },
  row: { display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12,
    fontSize: 13, padding: '4px 0',
    borderBottom: '1px solid rgba(60,72,55,0.06)' },
  rowWide: { gridTemplateColumns: '120px 1fr',
    borderBottom: 'none', paddingTop: 6 },
  k: { fontSize: 11, fontWeight: 800, letterSpacing: '0.05em',
    textTransform: 'uppercase', color: 'rgba(60,72,55,0.7)',
    alignSelf: 'center' },
  v: { fontSize: 13, fontWeight: 600 },
  empty: { margin: 0, fontSize: 12, color: 'rgba(60,72,55,0.6)' },
};
