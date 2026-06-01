/**
 * CommandCenterDeck.jsx — Home top-of-page render of the 9 Command Center
 * fields. Single source of truth: consumes window.__commandCenterHealth()
 * via the CommandCenterRuntime dynamic import. NEVER recomputes locally.
 *
 * Pages consume the same envelope; this component is the canonical Home
 * presenter. Other pages can import the runtime directly and read the
 * same fields without duplicating display logic.
 *
 * Self-contained, error-boundaried, never blocks Home.
 */
import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

const BAND_COLORS = {
  high: '#1f6a3a',
  medium: '#9a6a00',
  low: '#a13a3a',
  unknown: 'rgba(60,72,55,0.55)',
};

function _fieldValue(v, fallback) {
  return (v === null || v === undefined || v === '') ? (fallback || 'Not enough data yet') : v;
}

function CommandCenterDeckInner() {
  const [env, setEnv] = React.useState(null);

  React.useEffect(() => {
    let alive = true;
    import('../../runtime/commandCenter/CommandCenterRuntime')
      .then(mod => {
        // Read once on mount; the runtime is pure-projection so re-reads
        // are cheap. Pages re-render on natural lifecycle.
        const out = _safe(() => mod.commandCenterHealth(), null);
        if (alive) setEnv(out);
      })
      .catch(() => { /* swallow — never block Home */ });
    return () => { alive = false; };
  }, []);

  if (!env) return null;

  const crop = _fieldValue(env.crop);
  const stage = _fieldValue(env.stage);
  const riskLevel = env.risk && env.risk.level;
  const riskBand = (riskLevel === 'high' ? 'low' : riskLevel === 'medium' ? 'medium' : riskLevel === 'low' ? 'high' : 'unknown');
  const healthBand = env.health && env.health.band ? env.health.band : 'unknown';
  const healthLabel = env.health && env.health.label
    ? env.health.label : 'Not enough data yet';
  const action = env.todaysAction || {};
  const daysToHarvest = (typeof env.daysToHarvest === 'number') ? env.daysToHarvest : null;
  const funding = env.fundingMatch || {};
  const market = env.marketDemand || {};
  const marketBand = market.level === 'high' ? 'high'
    : market.level === 'medium' ? 'medium'
    : market.level === 'low' ? 'low' : 'unknown';
  const sell = env.sellReadiness || {};

  const Tile = ({ label, value, sub, band, testId }) => (
    <div style={S.tile} data-testid={testId}>
      <p style={S.tileLabel}>{label}</p>
      <p style={{ ...S.tileValue, color: BAND_COLORS[band || 'unknown'] }}>{value}</p>
      {sub ? <p style={S.tileSub}>{sub}</p> : null}
    </div>
  );

  return (
    <section
      style={S.section}
      data-testid="command-center-deck"
      data-consumes="commandCenter"
      data-surface="home"
      data-command-center-ready={env.commandCenterReady ? 'true' : 'false'}
      data-integrated-count={env.integratedCount}
      data-total-fields={env.totalFields}>
      <p style={S.eyebrow}>{tSafe('commandCenter.eyebrow', 'Your Farm Today')}</p>
      <div style={S.grid}>
        <Tile
          label={tSafe('commandCenter.crop', 'Crop')}
          value={crop || tSafe('commandCenter.empty', 'Not enough data yet')}
          band={env.cropReady ? 'high' : 'unknown'}
          testId="cc-crop" />
        <Tile
          label={tSafe('commandCenter.stage', 'Stage')}
          value={stage || tSafe('commandCenter.empty', 'Not enough data yet')}
          band={env.stageReady ? 'high' : 'unknown'}
          testId="cc-stage" />
        <Tile
          label={tSafe('commandCenter.risk', 'Risk')}
          value={env.riskReady ? riskLevel : tSafe('commandCenter.empty', 'Not enough data yet')}
          sub={env.riskReady ? env.risk.explanation : ''}
          band={riskBand}
          testId="cc-risk" />
        <Tile
          label={tSafe('commandCenter.health', 'Farm Health')}
          value={healthLabel}
          sub={env.health && typeof env.health.score === 'number' ? `${env.health.score}/100` : ''}
          band={healthBand}
          testId="cc-health" />
        <Tile
          label={tSafe('commandCenter.todaysAction', "Today's Action")}
          value={action.title || tSafe('commandCenter.empty', 'Not enough data yet')}
          sub={action.why || ''}
          band={env.actionReady ? 'high' : 'unknown'}
          testId="cc-action" />
        <Tile
          label={tSafe('commandCenter.daysToHarvest', 'Days To Harvest')}
          value={daysToHarvest !== null ? String(daysToHarvest) : tSafe('commandCenter.empty', 'Not enough data yet')}
          band={env.harvestReady ? (daysToHarvest <= 14 ? 'medium' : 'high') : 'unknown'}
          testId="cc-harvest" />
        <Tile
          label={tSafe('commandCenter.fundingMatch', 'Funding Match')}
          value={funding.label || tSafe('commandCenter.empty', 'Not enough data yet')}
          sub={funding.reason || ''}
          band={funding.matched ? 'high' : 'unknown'}
          testId="cc-funding" />
        <Tile
          label={tSafe('commandCenter.marketDemand', 'Market Demand')}
          value={env.marketReady ? market.level : tSafe('commandCenter.empty', 'Not enough data yet')}
          sub={market.recommendedSellingWindow || ''}
          band={marketBand}
          testId="cc-market" />
        <Tile
          label={tSafe('commandCenter.sellReadiness', 'Sell Readiness')}
          value={sell.unlocked
            ? tSafe('commandCenter.sell.ready', 'Ready to sell')
            : tSafe('commandCenter.sell.notYet', 'Not yet')}
          sub={sell.reason || ''}
          band={sell.unlocked ? 'high' : 'unknown'}
          testId="cc-sell" />
      </div>
    </section>
  );
}

export default class CommandCenterDeck extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow — never block Home */ }
  render() {
    if (this.state.failed) return null;
    try { return <CommandCenterDeckInner />; } catch { return null; }
  }
}

const S = {
  section: { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 },
  eyebrow: { margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'rgba(60,72,55,0.62)' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 8,
  },
  tile: {
    background: 'rgba(255,255,255,0.85)',
    border: '1px solid rgba(60,72,55,0.10)',
    borderRadius: 12,
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  tileLabel: {
    margin: 0,
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'rgba(60,72,55,0.55)',
  },
  tileValue: {
    margin: 0,
    fontSize: 15,
    fontWeight: 700,
    lineHeight: 1.25,
    color: 'rgba(60,72,55,0.95)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  tileSub: {
    margin: 0,
    fontSize: 11,
    fontWeight: 500,
    lineHeight: 1.3,
    color: 'rgba(60,72,55,0.65)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  },
};
