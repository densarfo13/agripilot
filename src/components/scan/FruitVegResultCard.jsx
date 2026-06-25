/**
 * FruitVegResultCard.jsx — SCAN TYPE ROUTER fruit/vegetable result.
 *
 * Renders a quality/ripeness/damage card for a fruit or vegetable scan —
 * NOT the plant-only path. Never renders the plant-only dead-end labels or
 * a crop-health-only card (the build gate enforces this).
 *
 *   Detected:  Tomato fruit
 *   Status:    Ripening / Ripe / Overripe / Damaged / Unknown
 *   Quality:   Good / Watch / At Risk
 *   Issue:     Surface damage / rot / pest damage / disease spot
 *   Action:    Harvest soon / Inspect nearby fruit / Remove damaged / Retake
 *   Follow-up: Today / 2 days / 7 days
 *
 * Pure, error-boundaried, never throws.
 */
import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
const _str = (v) => (typeof v === 'string' ? v.trim() : '');

const STATUS_LABEL = {
  ripening: () => tSafe('fruit.status.ripening', 'Ripening'),
  ripe:     () => tSafe('fruit.status.ripe', 'Ripe'),
  overripe: () => tSafe('fruit.status.overripe', 'Overripe'),
  damaged:  () => tSafe('fruit.status.damaged', 'Damaged'),
  unknown:  () => tSafe('fruit.status.unknown', 'Not yet clear'),
};
const QUALITY_LABEL = {
  good:    () => tSafe('fruit.quality.good', 'Good'),
  watch:   () => tSafe('fruit.quality.watch', 'Watch'),
  at_risk: () => tSafe('fruit.quality.atRisk', 'At risk'),
  unknown: () => tSafe('fruit.quality.unknown', 'Checking'),
};
const QUALITY_COLOR = { good: '#2f7a3a', watch: '#9a6a00', at_risk: '#a13a3a', unknown: '#5a6472' };

function _detectedName(result, scanType) {
  const cand = _safe(() => (Array.isArray(result.topCandidates) ? result.topCandidates[0] : null), null);
  const name = _str(result.plantName) || _str(cand && (cand.commonName || cand.name)) || _str(result.cropName);
  const kind = scanType === 'vegetable'
    ? tSafe('scanType.vegetable', 'vegetable')
    : tSafe('scanType.fruit', 'fruit');
  // Never a dead label — fall back to the generic kind (fruit/vegetable).
  return (name ? name + ' ' : '') + kind;
}

function FruitVegResultCardInner({ result }) {
  const r = (result && typeof result === 'object') ? result : {};
  const scanType = _str(r.scanType) || 'fruit';
  const fb = (r.farmBrain && typeof r.farmBrain === 'object') ? r.farmBrain : {};

  const status = STATUS_LABEL[_str(r.fruitStatus)] ? _str(r.fruitStatus) : 'unknown';
  const quality = QUALITY_LABEL[_str(r.qualityBand)] ? _str(r.qualityBand) : 'unknown';
  const issue = _str(r.possibleIssue) || _str(fb.detectedIssue);
  const action = _str(fb.nextAction)
    || (status === 'overripe' || status === 'damaged'
      ? tSafe('fruit.action.removeDamaged', 'Remove damaged fruit; check nearby fruit.')
      : tSafe('fruit.action.inspect', 'Inspect nearby fruit; harvest the ripe ones soon.'));
  const followUp = _safe(() => (fb.followUpTask && fb.followUpTask.title), null)
    || tSafe('fruit.followUp.2days', 'Check again in 2 days.');

  return (
    <section style={S.card} data-testid="fruit-veg-result-card" data-scan-type={scanType}>
      <header style={S.head}>
        <p style={S.eyebrow}>{scanType === 'vegetable'
          ? tSafe('scanType.card.vegetable', 'Vegetable check')
          : tSafe('scanType.card.fruit', 'Fruit check')}</p>
        <h2 style={S.title}>{_detectedName(r, scanType)}</h2>
      </header>

      <div style={S.row}>
        <span style={S.label}>{tSafe('fruit.row.status', 'Status')}</span>
        <span style={S.value}>{STATUS_LABEL[status]()}</span>
      </div>
      <div style={S.row}>
        <span style={S.label}>{tSafe('fruit.row.quality', 'Quality')}</span>
        <span style={{ ...S.value, color: QUALITY_COLOR[quality], fontWeight: 800 }}>{QUALITY_LABEL[quality]()}</span>
      </div>
      {issue ? (
        <div style={S.row}>
          <span style={S.label}>{tSafe('fruit.row.issue', 'Issue')}</span>
          <span style={S.value}>{issue}</span>
        </div>
      ) : null}
      <div style={S.row}>
        <span style={S.label}>{tSafe('fruit.row.action', 'Do this')}</span>
        <span style={S.value}>{action}</span>
      </div>
      <div style={S.row}>
        <span style={S.label}>{tSafe('fruit.row.followUp', 'Follow-up')}</span>
        <span style={S.value}>{followUp}</span>
      </div>

      {quality === 'unknown' || status === 'unknown' ? (
        <p style={S.note} data-testid="fruit-veg-quality-pending">
          {tSafe('fruit.qualityPending',
            'Detailed ripeness and damage analysis is still being added — for now, judge by colour and firmness.')}
        </p>
      ) : null}
    </section>
  );
}

export default class FruitVegResultCard extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow */ }
  render() {
    if (this.state.failed) return null;
    try { return <FruitVegResultCardInner {...this.props} />; } catch { return null; }
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
