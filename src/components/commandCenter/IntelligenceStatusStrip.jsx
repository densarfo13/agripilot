/**
 * IntelligenceStatusStrip — compact 3-tile strip rendering soil / market /
 * regional status under the Command Center deck. Reads
 * __intelligenceIntegrationHealth — never recomputes locally.
 *
 * Spec rule: "Do NOT dominate screen. Today's Action remains primary."
 * Tiles are minimal — short label + 1-line value — no detail expansion.
 * Self-renders only when at least ONE system is available; otherwise
 * collapses to null so it never adds visual clutter on day 0.
 */
import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _readIntegration() {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const fn = window.__intelligenceIntegrationHealth;
    return typeof fn === 'function' ? fn() : null;
  }, null);
}

function IntelligenceStatusStripInner() {
  const [env, setEnv] = React.useState(null);

  React.useEffect(() => {
    let alive = true;
    if (alive) setEnv(_readIntegration());
    return () => { alive = false; };
  }, []);

  if (!env) return null;
  const anyAvailable = env.soilReady || env.marketReady || env.regionalReady;
  if (!anyAvailable) return null;

  const soil = env.soilStatus || {};
  const market = env.marketStatus || {};
  const regional = env.regionalStatus || {};

  const Tile = ({ label, primary, sub, testId }) => (
    <div style={S.tile} data-testid={testId}>
      <p style={S.tileLabel}>{label}</p>
      <p style={S.tilePrimary}>{primary}</p>
      {sub ? <p style={S.tileSub}>{sub}</p> : null}
    </div>
  );

  const soilPrimary = env.soilReady
    ? (soil.soilHealth || soil.soilType || tSafe('intelligence.soil.healthy', 'Healthy'))
    : tSafe('intelligence.soil.needsData', 'Not enough data yet');
  const soilSub = env.soilReady && soil.drainageRisk && soil.drainageRisk !== 'unknown'
    ? `Drainage: ${soil.drainageRisk}` : '';

  const marketPrimary = env.marketReady
    ? `${market.marketDemand} demand`
    : tSafe('intelligence.market.needsData', 'Market data unavailable');
  const marketSub = env.marketReady && market.recommendedSellingWindow
    && market.recommendedSellingWindow !== 'Not enough data yet'
    ? market.recommendedSellingWindow : '';

  const regionalPrimary = env.regionalReady && Array.isArray(regional.seasonalRisks)
    && regional.seasonalRisks.length > 0
    ? regional.seasonalRisks[0]
    : env.regionalReady && regional.plantingWindow !== 'Not enough data yet'
      ? regional.plantingWindow
      : tSafe('intelligence.regional.needsData', 'Not enough data yet');

  return (
    <section
      style={S.section}
      data-testid="intelligence-status-strip"
      data-consumes="intelligenceIntegration"
      data-surface="home-strip"
      data-no-dominate="true">
      <p style={S.eyebrow}>{tSafe('intelligence.strip.eyebrow', 'Farm Intelligence')}</p>
      <div style={S.grid}>
        <Tile
          label={tSafe('intelligence.soil.label', 'Soil')}
          primary={soilPrimary}
          sub={soilSub}
          testId="intel-soil" />
        <Tile
          label={tSafe('intelligence.market.label', 'Market')}
          primary={marketPrimary}
          sub={marketSub}
          testId="intel-market" />
        <Tile
          label={tSafe('intelligence.regional.label', 'Regional')}
          primary={regionalPrimary}
          sub=""
          testId="intel-regional" />
      </div>
    </section>
  );
}

export default class IntelligenceStatusStrip extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow */ }
  render() {
    if (this.state.failed) return null;
    try { return <IntelligenceStatusStripInner />; } catch { return null; }
  }
}

const S = {
  section: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 },
  eyebrow: { margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'rgba(60,72,55,0.55)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 6 },
  tile: { background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(60,72,55,0.08)',
    borderRadius: 10, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 1,
    minWidth: 0 },
  tileLabel: { margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: '0.05em',
    textTransform: 'uppercase', color: 'rgba(60,72,55,0.5)' },
  tilePrimary: { margin: 0, fontSize: 13, fontWeight: 700, lineHeight: 1.25,
    color: 'rgba(40,52,40,0.95)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  tileSub: { margin: 0, fontSize: 11, fontWeight: 500, lineHeight: 1.25,
    color: 'rgba(60,72,55,0.6)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
};
