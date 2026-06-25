/**
 * InsectResultCard.jsx — SCAN TYPE ROUTER insect/pest result.
 *
 * Renders a pest card for an insect scan — never the plant-only label.
 * Shows the detected pest, confidence, threat level, likely crop impact, a
 * safe next action, and a follow-up.
 *
 * Honest degrade: Insect.id is the route's provider; until its key is
 * configured the card shows "Pest not yet identified" + coaching rather
 * than a fabricated pest. Pure, error-boundaried, never throws.
 */
import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
const _str = (v) => (typeof v === 'string' ? v.trim() : '');
const _num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

const THREAT = {
  low:      { label: () => tSafe('insect.threat.low', 'Low'), color: '#2f7a3a' },
  moderate: { label: () => tSafe('insect.threat.moderate', 'Moderate'), color: '#9a6a00' },
  high:     { label: () => tSafe('insect.threat.high', 'High'), color: '#a13a3a' },
  unknown:  { label: () => tSafe('insect.threat.unknown', 'Not yet clear'), color: '#5a6472' },
};

function InsectResultCardInner({ result }) {
  const r = (result && typeof result === 'object') ? result : {};
  const fb = (r.farmBrain && typeof r.farmBrain === 'object') ? r.farmBrain : {};

  const cand = _safe(() => (Array.isArray(r.topCandidates) ? r.topCandidates[0] : null), null);
  const pest = _str(r.detectedInsect) || _str(fb.detectedInsect)
    || _str(cand && (cand.commonName || cand.name)) || _str(r.possibleIssue);
  const identified = !!pest;
  const confPct = _num(r.confidencePct) ?? _num(fb.confidenceScore);
  const threatKey = THREAT[_str(r.threatLevel)] ? _str(r.threatLevel) : 'unknown';

  const impact = _str(r.cropImpact)
    || (identified ? tSafe('insect.impact.generic', 'May feed on leaves, fruit, or stems and spread to nearby plants.')
      : '');
  const action = _str(fb.nextAction)
    || (identified
      ? tSafe('insect.action.identified', 'Inspect under leaves at dusk; remove what you can by hand first.')
      : tSafe('insect.action.unidentified', 'Take a closer, well-lit photo of the insect so we can identify it.'));
  const followUp = _safe(() => (fb.followUpTask && fb.followUpTask.title), null)
    || tSafe('insect.followUp.2days', 'Check the plant again in 2 days.');

  return (
    <section style={S.card} data-testid="insect-result-card" data-scan-type="insect" data-route="insect_pest">
      <header style={S.head}>
        <p style={S.eyebrow}>{tSafe('scanType.card.insect', 'Pest check')}</p>
        <h2 style={S.title}>
          {identified ? pest : tSafe('insect.notIdentified', 'Pest not yet identified')}
        </h2>
      </header>

      {identified && confPct != null ? (
        <div style={S.row}>
          <span style={S.label}>{tSafe('insect.row.confidence', 'Confidence')}</span>
          <span style={S.value}>{Math.round(confPct)}%</span>
        </div>
      ) : null}
      <div style={S.row}>
        <span style={S.label}>{tSafe('insect.row.threat', 'Threat')}</span>
        <span style={{ ...S.value, color: THREAT[threatKey].color, fontWeight: 800 }}>{THREAT[threatKey].label()}</span>
      </div>
      {impact ? (
        <div style={S.row}>
          <span style={S.label}>{tSafe('insect.row.impact', 'Crop impact')}</span>
          <span style={S.value}>{impact}</span>
        </div>
      ) : null}
      <div style={S.row}>
        <span style={S.label}>{tSafe('insect.row.action', 'Do this')}</span>
        <span style={S.value}>{action}</span>
      </div>
      <div style={S.row}>
        <span style={S.label}>{tSafe('insect.row.followUp', 'Follow-up')}</span>
        <span style={S.value}>{followUp}</span>
      </div>

      <p style={S.note}>
        {tSafe('insect.safetyNote',
          'Start with hand-picking and traps. Only use a spray if the problem spreads, and follow the label.')}
      </p>
    </section>
  );
}

export default class InsectResultCard extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow */ }
  render() {
    if (this.state.failed) return null;
    try { return <InsectResultCardInner {...this.props} />; } catch { return null; }
  }
}

const S = {
  card: { background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(60,72,55,0.12)',
    borderRadius: 14, padding: '16px 18px', margin: '12px 0',
    display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'system-ui' },
  head: { display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 4 },
  eyebrow: { margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'rgba(60,72,55,0.55)' },
  title: { margin: 0, fontSize: 20, fontWeight: 800, color: '#1F2933' },
  row: { display: 'grid', gridTemplateColumns: '92px 1fr', gap: 12, alignItems: 'baseline',
    padding: '6px 0', borderBottom: '1px solid rgba(60,72,55,0.06)' },
  label: { fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase',
    color: 'rgba(60,72,55,0.7)' },
  value: { fontSize: 14, color: '#1F2933', lineHeight: 1.4 },
  note: { margin: '8px 0 0', fontSize: 12, color: 'rgba(60,72,55,0.6)', lineHeight: 1.45 },
};
