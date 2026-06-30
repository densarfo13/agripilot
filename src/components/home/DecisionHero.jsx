/**
 * DecisionHero.jsx — FARROWAY DECISION ENGINE, §2.
 *
 * The ONE daily decision, above the fold: Today's Decision / Why / Confidence /
 * Time / [Start]. Reads the canonical FarmBrainState (single source of truth) +
 * farm context and asks FarrowayDecisionEngine for one primary decision. Empty
 * states show a localized CTA (never blank, never "not enough data").
 *
 * Self-contained + error-boundaried: never throws, never drops Home to blank.
 * Static labels are localized via tSafe; the CTA label is localized by action
 * (we never render the engine's raw English CTA string).
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { tSafe } from '../../i18n/tSafe.js';
import useFarmBrainState from '../../hooks/useFarmBrainState.js';
import { buildDailyDecision } from '../../runtime/decision/FarrowayDecisionEngine';
import { resolveCompletionCrop } from './resolveCompletionCrop.js';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

const CTA_LABEL = {
  add_crop: ['decision.cta.addCrop', 'Add your crop'],
  add_planting_date: ['decision.cta.addPlantingDate', 'Add planting date'],
  scan: ['decision.cta.scan', 'Run your first scan'],
};
const CTA_ROUTE = { add_crop: '/profile', add_planting_date: '/profile', scan: '/scan' };

function DecisionHeroInner({ farm }) {
  const navigate = useNavigate();
  const state = useFarmBrainState();

  const decision = _safe(() => buildDailyDecision({
    farmBrainState: state,
    crop: resolveCompletionCrop(farm) || null,
    cropId: (farm && (farm.cropId || farm.id)) || null,
    farmId: (farm && farm.id) || null,
    plantingDate: (farm && (farm.plantingDate || farm.plantedAt)) || null,
    latestScan: state && state.hasFirstScan ? {} : null,
  }), null);

  if (!decision) return null;

  const onStart = () => _safe(() => {
    if (decision.isEmptyState && decision.cta) {
      navigate(CTA_ROUTE[decision.cta.action] || '/scan');
    } else {
      navigate('/scan');
    }
  }, undefined);

  // Empty state — localized CTA, never the engine's English string.
  if (decision.isEmptyState && decision.cta) {
    const [key, fb] = CTA_LABEL[decision.cta.action] || CTA_LABEL.scan;
    return (
      <section style={S.card} data-testid="decision-hero" data-empty="true">
        <p style={S.eyebrow}>{tSafe('decision.eyebrow', 'Today’s Decision')}</p>
        <h2 style={S.decision}>{tSafe(key, fb)}</h2>
        <button type="button" style={S.start} onClick={onStart} data-testid="decision-start">
          {tSafe('decision.start', 'Start')}
        </button>
      </section>
    );
  }

  return (
    <section style={S.card} data-testid="decision-hero" data-empty="false">
      <p style={S.eyebrow}>{tSafe('decision.eyebrow', 'Today’s Decision')}</p>
      <h2 style={S.decision}>{decision.dailyDecision}</h2>
      {decision.reason ? (
        <p style={S.why}>
          <strong>{tSafe('decision.why', 'Why')}:</strong> {decision.reason}
        </p>
      ) : null}
      <div style={S.metaRow}>
        <span style={S.meta}>{tSafe('decision.confidence', 'Confidence')}: {decision.confidence}%</span>
        {decision.estimatedTimeMin != null ? (
          <span style={S.meta}>
            {tSafe('decision.time', 'Time')}: {decision.estimatedTimeMin} {tSafe('decision.minutes', 'min')}
          </span>
        ) : null}
      </div>
      {decision.evidence && decision.evidence.length ? (
        <ul style={S.evidence} data-testid="decision-evidence">
          {decision.evidence.slice(0, 4).map((e, i) => <li key={i} style={S.evItem}>{e}</li>)}
        </ul>
      ) : null}
      <button type="button" style={S.start} onClick={onStart} data-testid="decision-start">
        {tSafe('decision.start', 'Start')}
      </button>
    </section>
  );
}

export default class DecisionHero extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow — never drop Home */ }
  render() {
    if (this.state.failed) return null;
    try { return <DecisionHeroInner {...this.props} />; } catch { return null; }
  }
}

const S = {
  card: { border: '1px solid rgba(60,72,55,0.14)', borderRadius: 16,
    background: 'linear-gradient(180deg, rgba(47,122,58,0.06), rgba(255,255,255,0.9))',
    padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'system-ui' },
  eyebrow: { margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: '#2f7a3a' },
  decision: { margin: '2px 0 0', fontSize: 21, fontWeight: 800, color: '#1F2933', lineHeight: 1.25 },
  why: { margin: '2px 0 0', fontSize: 14, color: 'rgba(60,72,55,0.85)', lineHeight: 1.4 },
  metaRow: { display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 2 },
  meta: { fontSize: 13, fontWeight: 700, color: '#33503A' },
  evidence: { margin: '4px 0 0', padding: '0 0 0 2px', listStyle: 'none',
    display: 'flex', flexDirection: 'column', gap: 2 },
  evItem: { fontSize: 12.5, color: 'rgba(60,72,55,0.75)' },
  start: { marginTop: 8, alignSelf: 'flex-start', minHeight: 44, padding: '0 22px',
    borderRadius: 10, border: 'none', background: '#2f7a3a', color: '#fff',
    fontSize: 15, fontWeight: 800, cursor: 'pointer' },
};
