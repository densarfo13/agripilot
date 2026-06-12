/**
 * CommandCenterDeck.jsx — Home top-of-page Farm Command Center.
 *
 * Single source of truth: consumes the spec-canonical
 * `src/runtime/command-center/CommandCenterRuntime` (v2) via dynamic
 * import. NEVER probes upstream globals directly — all values come
 * through the runtime envelope or the Selectors module.
 *
 * Renders the spec FARM COMMAND CENTER shape:
 *   • Top row: Crop / Stage / Health / Risk / Days To Harvest
 *   • Today's Action card: title + why + estimated time + Start/Scan buttons
 *   • Next Action sub-line
 *
 * Self-contained, error-boundaried, never blocks Home.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { tSafe } from '../../i18n/tSafe.js';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

const BAND = {
  high: '#1f6a3a',
  medium: '#9a6a00',
  low: '#a13a3a',
  unknown: 'rgba(60,72,55,0.55)',
};

function _fieldOr(v, fallback) {
  return (v === null || v === undefined || v === '') ? fallback : v;
}

function CommandCenterDeckInner() {
  const navigate = useNavigate();
  const [env, setEnv] = React.useState(null);

  React.useEffect(() => {
    let alive = true;
    Promise.all([
      import('../../runtime/command-center/CommandCenterRuntime'),
      import('../../runtime/command-center/CommandCenterSelectors'),
    ]).then(([rtMod]) => {
      const out = _safe(() => rtMod.commandCenterHealth(), null);
      if (alive) setEnv(out);
      // Record consumer integration so __commandCenterHealth's
      // homeIntegrated flag persists across re-renders.
      _safe(() => rtMod.recordCommandCenterIntegration('home'), null);
    }).catch(() => { /* swallow — never block Home */ });
    return () => { alive = false; };
  }, []);

  if (!env || !env.state) return null;
  const s = env.state;

  const crop = _fieldOr(s.crop, tSafe('commandCenter.empty', 'Not enough data yet'));
  const stage = _fieldOr(s.cropStage, tSafe('commandCenter.empty', 'Not enough data yet'));
  const health = s.farmHealth || {};
  const risk = s.riskLevel || {};
  const riskBand = risk.level === 'high' ? 'low'
    : risk.level === 'medium' ? 'medium'
    : risk.level === 'low' ? 'high' : 'unknown';
  const daysToHarvest = (typeof s.daysToHarvest === 'number') ? s.daysToHarvest : null;
  const action = s.todayAction || {};
  const next = s.nextAction || {};
  const market = s.marketDemand || {};
  const marketBand = market.level === 'high' ? 'high'
    : market.level === 'medium' ? 'medium'
    : market.level === 'low' ? 'low' : 'unknown';
  const sell = s.sellReadiness || {};

  const startAction = () => _safe(() => navigate('/tasks'), null);
  const scanAction = () => _safe(() => navigate('/scan'), null);

  // Sprint #193 — Farm Health breakout. Read the FarmRisk composite's
  // sub-risk categories (weather / disease / soil≈water / market)
  // straight from the pinned global so the deck shows WHY the risk
  // level is what it is. Honest: categories the composite reports as
  // 'unknown' render the neutral band, never a fabricated level.
  const subRisks = _safe(() => {
    const fn = typeof window !== 'undefined' && window.__farmRiskHealth;
    if (typeof fn !== 'function') return [];
    const fr = fn();
    if (!fr || typeof fr !== 'object') return [];
    const cats = fr.categories || fr.subRisks || fr;
    const pick = (k, label) => {
      const v = cats && (cats[k + 'Risk'] || cats[k]);
      const level = typeof v === 'string' ? v
        : (v && typeof v.level === 'string' ? v.level : null);
      return level ? { key: k, label, level } : null;
    };
    return [
      pick('disease', tSafe('commandCenter.risk.disease', 'Disease')),
      pick('weather', tSafe('commandCenter.risk.weather', 'Weather')),
      pick('soil',    tSafe('commandCenter.risk.water',   'Water')),
      pick('market',  tSafe('commandCenter.risk.market',  'Market')),
    ].filter(Boolean);
  }, []);

  // Action confidence — the DailyAction envelope carries 0-100; the
  // deck never surfaced it. Display only when present and < 100
  // (never claim certainty; banned-wording gates forbid 100% claims).
  const actionConfidence = _safe(() => {
    const c = action && action.confidence;
    return (typeof c === 'number' && Number.isFinite(c) && c > 0 && c < 100)
      ? Math.round(c) : null;
  }, null);

  const Tile = ({ label, value, sub, band, testId }) => (
    <div style={S.tile} data-testid={testId}>
      <p style={S.tileLabel}>{label}</p>
      <p style={{ ...S.tileValue, color: BAND[band || 'unknown'] }}>{value}</p>
      {sub ? <p style={S.tileSub}>{sub}</p> : null}
    </div>
  );

  return (
    <section
      style={S.section}
      data-testid="command-center-deck"
      data-consumes="commandCenter"
      data-surface="home"
      data-cc-initialized={env.initialized ? 'true' : 'false'}
      data-cc-readiness-count={env.readinessCount}
      data-cc-integrated-count={env.integratedSurfaceCount}>
      <p style={S.eyebrow}>{tSafe('commandCenter.title', 'Farm Command Center')}</p>

      {/* TOP ROW — Crop / Stage / Health / Risk / Days To Harvest */}
      <div style={S.grid}>
        <Tile
          label={tSafe('commandCenter.crop', 'Crop')}
          value={crop}
          band={env.cropReady ? 'high' : 'unknown'}
          testId="cc-crop" />
        <Tile
          label={tSafe('commandCenter.stage', 'Stage')}
          value={stage}
          band={env.stageReady ? 'high' : 'unknown'}
          testId="cc-stage" />
        <Tile
          label={tSafe('commandCenter.health', 'Health')}
          value={health.label || tSafe('commandCenter.empty', 'Not enough data yet')}
          sub={typeof health.score === 'number' ? `${health.score}/100` : ''}
          band={health.band || 'unknown'}
          testId="cc-health" />
        <Tile
          label={tSafe('commandCenter.risk', 'Risk')}
          value={env.riskReady ? risk.level
            : tSafe('commandCenter.empty', 'Not enough data yet')}
          sub={env.riskReady ? risk.explanation : ''}
          band={riskBand}
          testId="cc-risk" />
        <Tile
          label={tSafe('commandCenter.daysToHarvest', 'Days To Harvest')}
          value={daysToHarvest !== null ? String(daysToHarvest)
            : tSafe('commandCenter.empty', 'Not enough data yet')}
          band={env.harvestReady ? (daysToHarvest <= 14 ? 'medium' : 'high') : 'unknown'}
          testId="cc-harvest" />
      </div>

      {/* SUB-RISK CHIPS (sprint #193) — why the Risk tile says what
          it says. Inverted band like the Risk tile: high risk = red. */}
      {subRisks.length > 0 ? (
        <div style={S.chipRow} data-testid="cc-sub-risks">
          {subRisks.map((r) => {
            const chipBand = r.level === 'high' ? 'low'
              : r.level === 'medium' ? 'medium'
              : r.level === 'low' ? 'high' : 'unknown';
            return (
              <span key={r.key} style={{ ...S.chip, color: BAND[chipBand] }}
                data-testid={'cc-risk-' + r.key}>
                {r.label}: {r.level}
              </span>
            );
          })}
        </div>
      ) : null}

      {/* TODAY'S ACTION card with Start + Scan */}
      <div style={S.actionCard} data-testid="cc-today-action">
        <p style={S.actionLabel}>{tSafe('commandCenter.todaysAction', "Today's Action")}</p>
        <p style={S.actionTitle}>
          {action.title || tSafe('commandCenter.empty', 'Not enough data yet')}
        </p>
        {action.why ? (
          <p style={S.actionWhy}>{action.why}</p>
        ) : null}
        {action.estimatedTime ? (
          <p style={S.actionTime}>
            {tSafe('commandCenter.timeRequired', 'Time required')}: {action.estimatedTime}
          </p>
        ) : null}
        {actionConfidence !== null ? (
          <p style={S.actionTime} data-testid="cc-action-confidence">
            {tSafe('commandCenter.confidence', 'Confidence')}: {actionConfidence}%
          </p>
        ) : null}
        <div style={S.btnRow}>
          <button
            type="button"
            style={S.btnPrimary}
            onClick={startAction}
            data-testid="cc-btn-start"
            disabled={!env.actionReady}>
            {tSafe('commandCenter.btn.start', 'Start')}
          </button>
          <button
            type="button"
            style={S.btnSecondary}
            onClick={scanAction}
            data-testid="cc-btn-scan">
            {tSafe('commandCenter.btn.scan', 'Scan')}
          </button>
        </div>
        {next && next.title ? (
          <p style={S.nextLine} data-testid="cc-next-action">
            {tSafe('commandCenter.nextAction', 'Next')}: {next.title}
          </p>
        ) : null}
      </div>

      {/* SUB STRIP — Market / Sell / Funding mini lines */}
      <div style={S.subStrip}>
        {env.marketReady ? (
          <p style={S.subLine} data-testid="cc-market-line">
            {tSafe('commandCenter.marketDemand', 'Market Demand')}: <strong style={{ color: BAND[marketBand] }}>{market.level}</strong>
            {market.recommendedSellingWindow && market.recommendedSellingWindow !== 'Not enough data yet'
              ? ` · ${market.recommendedSellingWindow}` : ''}
          </p>
        ) : null}
        {sell.unlocked ? (
          <p style={{ ...S.subLine, color: BAND.high }} data-testid="cc-sell-line">
            {tSafe('commandCenter.sell.ready', 'Ready to sell')} · {sell.reason}
          </p>
        ) : null}
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
  section: { display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 },
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
    margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'rgba(60,72,55,0.55)',
  },
  tileValue: {
    margin: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.25,
    overflow: 'hidden', textOverflow: 'ellipsis',
  },
  tileSub: {
    margin: 0, fontSize: 11, fontWeight: 500, lineHeight: 1.3,
    color: 'rgba(60,72,55,0.65)', overflow: 'hidden', textOverflow: 'ellipsis',
    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
  },
  // Sprint #193 — sub-risk chips (Disease / Weather / Water / Market).
  chipRow: {
    display: 'flex', flexWrap: 'wrap', gap: 6,
  },
  chip: {
    fontSize: 11, fontWeight: 700,
    padding: '4px 10px', borderRadius: 999,
    background: 'rgba(255,255,255,0.85)',
    border: '1px solid rgba(60,72,55,0.10)',
    textTransform: 'capitalize',
  },
  actionCard: {
    background: 'rgba(255,255,255,0.95)',
    border: '1px solid rgba(60,72,55,0.10)',
    borderRadius: 14,
    padding: '14px 16px',
    display: 'flex', flexDirection: 'column', gap: 4,
  },
  actionLabel: {
    margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'rgba(60,72,55,0.55)',
  },
  actionTitle: {
    margin: 0, fontSize: 18, fontWeight: 700, lineHeight: 1.25,
    color: 'rgba(40,52,40,0.95)',
  },
  actionWhy: {
    margin: 0, fontSize: 13, lineHeight: 1.35,
    color: 'rgba(60,72,55,0.78)',
  },
  actionTime: {
    margin: '4px 0 0 0', fontSize: 12, fontWeight: 600,
    color: 'rgba(60,72,55,0.65)',
  },
  btnRow: { display: 'flex', gap: 8, marginTop: 8 },
  btnPrimary: {
    flex: 1, minHeight: 44, borderRadius: 10, border: 'none',
    background: '#2f7a3a', color: '#fff', fontSize: 15, fontWeight: 700,
    cursor: 'pointer',
  },
  btnSecondary: {
    flex: 1, minHeight: 44, borderRadius: 10,
    border: '1px solid rgba(60,72,55,0.18)',
    background: 'rgba(255,255,255,0.9)', color: 'rgba(40,52,40,0.95)',
    fontSize: 15, fontWeight: 700, cursor: 'pointer',
  },
  nextLine: {
    margin: '6px 0 0 0', fontSize: 12, fontWeight: 600,
    color: 'rgba(60,72,55,0.6)',
  },
  subStrip: { display: 'flex', flexDirection: 'column', gap: 4 },
  subLine: { margin: 0, fontSize: 12, color: 'rgba(60,72,55,0.75)' },
};
