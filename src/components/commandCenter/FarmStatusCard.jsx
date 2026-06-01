/**
 * FarmStatusCard.jsx — top "Farm Status" card for /my-farm.
 *
 * Consumes CommandCenterRuntime's selectFarmStatus() ONLY. Never probes
 * upstream globals; never recomputes health/risk locally. Renders:
 *   Crop · Stage · Health · Risk · Harvest Window
 *
 * Page-integration marker: data-consumes="commandCenter" data-surface="my-farm"
 * lets __commandCenterHealth attest the MyFarm integration is live.
 *
 * Self-contained, error-boundaried, never blocks render.
 */
import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
const BAND = {
  high: '#1f6a3a', medium: '#9a6a00', low: '#a13a3a',
  unknown: 'rgba(60,72,55,0.55)',
};

function FarmStatusCardInner() {
  const [status, setStatus] = React.useState(null);

  React.useEffect(() => {
    let alive = true;
    Promise.all([
      import('../../runtime/command-center/CommandCenterSelectors'),
      import('../../runtime/command-center/CommandCenterRuntime'),
    ]).then(([selMod, rtMod]) => {
      const out = _safe(() => selMod.selectFarmStatus(), null);
      if (alive) setStatus(out);
      _safe(() => rtMod.recordCommandCenterIntegration('my-farm'), null);
    }).catch(() => { /* swallow */ });
    return () => { alive = false; };
  }, []);

  if (!status) return null;

  const crop = status.crop || tSafe('commandCenter.empty', 'Not enough data yet');
  const stage = status.stage || tSafe('commandCenter.empty', 'Not enough data yet');
  const health = status.health || {};
  const risk = status.risk || {};
  const riskBand = risk.level === 'high' ? 'low'
    : risk.level === 'medium' ? 'medium'
    : risk.level === 'low' ? 'high' : 'unknown';

  const Row = ({ label, value, sub, band }) => (
    <div style={S.row}>
      <span style={S.rowLabel}>{label}</span>
      <span style={{ ...S.rowValue, color: BAND[band || 'unknown'] }}>{value}</span>
      {sub ? <span style={S.rowSub}>{sub}</span> : null}
    </div>
  );

  return (
    <section
      style={S.card}
      data-testid="farm-status-card"
      data-consumes="commandCenter"
      data-surface="my-farm">
      <p style={S.eyebrow}>{tSafe('myFarm.status.title', 'Farm Status')}</p>
      <Row
        label={tSafe('commandCenter.crop', 'Crop')}
        value={crop}
        band={status.crop ? 'high' : 'unknown'} />
      <Row
        label={tSafe('commandCenter.stage', 'Stage')}
        value={stage}
        band={status.stage ? 'high' : 'unknown'} />
      <Row
        label={tSafe('commandCenter.health', 'Health')}
        value={health.label || tSafe('commandCenter.empty', 'Not enough data yet')}
        sub={typeof health.score === 'number' ? `${health.score}/100` : ''}
        band={health.band || 'unknown'} />
      <Row
        label={tSafe('commandCenter.risk', 'Risk')}
        value={risk.level !== 'unknown' ? risk.level
          : tSafe('commandCenter.empty', 'Not enough data yet')}
        sub={risk.level !== 'unknown' ? risk.explanation : ''}
        band={riskBand} />
      <Row
        label={tSafe('myFarm.status.harvestWindow', 'Harvest Window')}
        value={status.harvestWindow || tSafe('commandCenter.empty', 'Not enough data yet')}
        band={status.daysToHarvest !== null ? 'high' : 'unknown'} />
    </section>
  );
}

export default class FarmStatusCard extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow */ }
  render() {
    if (this.state.failed) return null;
    try { return <FarmStatusCardInner />; } catch { return null; }
  }
}

const S = {
  card: {
    background: 'rgba(255,255,255,0.95)',
    border: '1px solid rgba(60,72,55,0.10)',
    borderRadius: 14,
    padding: '14px 16px',
    display: 'flex', flexDirection: 'column', gap: 8,
    marginBottom: 16,
  },
  eyebrow: {
    margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'rgba(60,72,55,0.62)',
  },
  row: {
    display: 'flex', alignItems: 'baseline', gap: 8,
    padding: '6px 0',
    borderTop: '1px solid rgba(60,72,55,0.06)',
  },
  rowLabel: {
    flex: '0 0 32%', fontSize: 12, fontWeight: 700,
    color: 'rgba(60,72,55,0.7)', textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  rowValue: { flex: '0 0 auto', fontSize: 14, fontWeight: 700 },
  rowSub: {
    marginLeft: 'auto', fontSize: 11, fontWeight: 500,
    color: 'rgba(60,72,55,0.55)',
  },
};
