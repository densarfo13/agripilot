/**
 * FarmIntelligenceCard.jsx — Phase 10 farm-intelligence surface.
 *
 *   <FarmIntelligenceCard intel={useFarmIntelligence({...})} />
 *
 * What this is
 * ────────────
 *   Renders the composite farm-intelligence envelope returned by
 *   `useFarmIntelligence` as a stacked farmer-friendly card:
 *
 *     1. Farm Health Score        — large dial + band label
 *     2. Field Risk Summary       — per-risk pills (only graded ones)
 *     3. Weather Action Hints     — short action list
 *     4. Crop Stage               — current + days + next
 *     5. Trust Profile            — band label only (no raw number
 *                                   below 'verified')
 *
 *   The "Farmer Rule" is enforced — no raw scores below 'verified'
 *   tier, no algorithm names, no JSON. When a sub-engine returns
 *   null (insufficient data) its section self-hides.
 *
 * Strict-rule audit
 *   • Pure render. SSR-safe.
 *   • All copy via tSafe.
 *   • Caller-owned data input — no fetch, no localStorage.
 */

import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';

const _isObj = (v) => v != null && typeof v === 'object';
const _arr  = (v) => (Array.isArray(v) ? v : []);

const STYLES = {
  page: {
    background: '#FFFFFF',
    borderRadius: 16,
    padding: '18px 18px 14px',
    margin: '16px 0',
    border: '1px solid rgba(31,41,51,0.06)',
    boxShadow: '0 1px 2px rgba(31,41,51,0.04)',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  block: {
    paddingBottom: 12,
    borderBottom: '1px solid rgba(31,41,51,0.06)',
    marginBottom: 12,
  },
  blockLast: {
    paddingBottom: 0,
    borderBottom: 'none',
    marginBottom: 0,
  },
  blockTitle: {
    margin: '0 0 6px',
    fontSize: 11,
    fontWeight: 700,
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  scoreRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  scoreNum: {
    fontSize: 32,
    fontWeight: 800,
    color: '#1F2933',
    lineHeight: 1,
    minWidth: 64,
  },
  scoreText: {
    fontSize: 14,
    fontWeight: 600,
    color: '#1F2933',
  },
  hint: {
    fontSize: 13,
    color: '#475569',
    marginTop: 4,
    lineHeight: 1.4,
  },
  pillRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  pill: (level) => {
    const bg = level === 'high'
        ? 'rgba(239,68,68,0.12)'
      : level === 'medium'
        ? 'rgba(245,158,11,0.12)'
      : 'rgba(16,185,129,0.12)';
    const fg = level === 'high'
        ? '#991B1B'
      : level === 'medium'
        ? '#92400E'
      : '#047857';
    return {
      fontSize: 11,
      fontWeight: 700,
      padding: '4px 9px',
      borderRadius: 999,
      background: bg,
      color: fg,
      border: '1px solid rgba(31,41,51,0.06)',
      whiteSpace: 'nowrap',
    };
  },
  list: {
    margin: '6px 0 0',
    paddingLeft: 18,
    fontSize: 13,
    color: '#1F2933',
    lineHeight: 1.5,
  },
  bandPill: (band) => {
    const map = {
      excellent: { bg: '#DCFCE7', fg: '#166534' },
      good:       { bg: '#E0F2FE', fg: '#075985' },
      verified:   { bg: '#DCFCE7', fg: '#166534' },
      established: { bg: '#E0F2FE', fg: '#075985' },
      building:   { bg: '#FEF3C7', fg: '#854D0E' },
      new:        { bg: '#F1F5F9', fg: '#475569' },
      needs_attention: { bg: '#FEF3C7', fg: '#854D0E' },
      critical:   { bg: '#FEE2E2', fg: '#991B1B' },
      insufficient: { bg: '#F1F5F9', fg: '#475569' },
    }[band] || { bg: '#F1F5F9', fg: '#475569' };
    return {
      display: 'inline-block',
      fontSize: 11,
      fontWeight: 700,
      padding: '3px 9px',
      borderRadius: 999,
      background: map.bg,
      color: map.fg,
    };
  },
};

function _bandHumanKey(band) {
  return 'farm.intelligence.band.' + band;
}
const BAND_HUMAN_DEFAULT = {
  excellent: 'Excellent',
  good: 'Good',
  needs_attention: 'Needs attention',
  critical: 'Critical',
  insufficient: 'Awaiting data',
  verified: 'Verified',
  established: 'Established',
  building: 'Building',
  new: 'New',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

function _riskLabelKey(kind) { return 'farm.intelligence.risk.' + kind; }
const RISK_LABEL_DEFAULT = {
  disease:              'Disease',
  drought:              'Drought',
  flooding:             'Flooding',
  heat_stress:          'Heat stress',
  nutrient_deficiency:  'Nutrient deficiency',
  pest_outbreak:        'Pest outbreak',
};

function _stageLabelKey(stage) { return 'farm.intelligence.stage.' + stage; }
const STAGE_LABEL_DEFAULT = {
  seed:              'Seed',
  germination:       'Germination',
  vegetative:        'Vegetative growth',
  flowering:         'Flowering',
  fruit_development: 'Fruit development',
  harvest:           'Harvest',
};

function HealthBlock({ intel }) {
  const h = intel && intel.farmHealth;
  if (!_isObj(h)) return null;
  return (
    <div style={STYLES.block} data-testid="farm-intel-health">
      <div style={STYLES.blockTitle}>
        {tSafe('farm.intelligence.healthTitle', 'Farm Health')}
      </div>
      <div style={STYLES.scoreRow}>
        <div style={STYLES.scoreNum}>
          {h.score != null ? h.score : '—'}
        </div>
        <div>
          <div style={STYLES.bandPill(h.band)}>
            {tSafe(_bandHumanKey(h.band),
              BAND_HUMAN_DEFAULT[h.band] || h.band)}
          </div>
          <div style={STYLES.hint}>
            {tSafe(h.headlineKey, h.headlineDefault)}
          </div>
        </div>
      </div>
      <div style={{ ...STYLES.hint, fontStyle: 'italic' }}>
        {tSafe('farm.intelligence.healthSuggestion', h.suggestionDefault)}
      </div>
    </div>
  );
}

function RiskBlock({ intel }) {
  const r = intel && intel.fieldRisk;
  if (!_isObj(r)) return null;
  const graded = Object.values(r.risks || {})
    .filter((x) => x && x.level != null);
  if (graded.length === 0) return null;
  return (
    <div style={STYLES.block} data-testid="farm-intel-risk">
      <div style={STYLES.blockTitle}>
        {tSafe('farm.intelligence.riskTitle', 'Today’s field risks')}
      </div>
      <div style={STYLES.pillRow}>
        {graded.map((risk) => (
          <span key={risk.kind} style={STYLES.pill(risk.level)}
            data-testid={`farm-intel-risk-${risk.kind}`}>
            {tSafe(_riskLabelKey(risk.kind),
              RISK_LABEL_DEFAULT[risk.kind] || risk.kind)}
            {' · '}
            {tSafe(_bandHumanKey(risk.level),
              BAND_HUMAN_DEFAULT[risk.level] || risk.level)}
          </span>
        ))}
      </div>
    </div>
  );
}

function WeatherActionsBlock({ intel }) {
  const acts = _arr(intel && intel.weatherActions);
  if (acts.length === 0) return null;
  return (
    <div style={STYLES.block} data-testid="farm-intel-weather">
      <div style={STYLES.blockTitle}>
        {tSafe('farm.intelligence.weatherTitle', 'Weather signals')}
      </div>
      <ul style={STYLES.list}>
        {acts.slice(0, 4).map((a) => (
          <li key={a.kind} data-testid={`farm-intel-weather-${a.kind}`}>
            <strong>{tSafe(a.headlineKey, a.headlineDefault)}</strong>
            {' — '}
            {tSafe(a.bodyKey, a.bodyDefault)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CropStageBlock({ intel }) {
  const s = intel && intel.cropStage;
  if (!_isObj(s) || !s.stage) return null;
  return (
    <div style={STYLES.block} data-testid="farm-intel-stage">
      <div style={STYLES.blockTitle}>
        {tSafe('farm.intelligence.stageTitle', 'Crop stage')}
      </div>
      <div style={STYLES.scoreText}>
        {tSafe(_stageLabelKey(s.stage),
          STAGE_LABEL_DEFAULT[s.stage] || s.stage)}
        {' · '}
        {s.daysInStage} {tSafe('farm.intelligence.daysIn', 'days in')}
      </div>
      {s.nextStage && s.expectedDaysToNext != null ? (
        <div style={STYLES.hint}>
          {tSafe('farm.intelligence.nextStage', 'Next')}: {' '}
          {tSafe(_stageLabelKey(s.nextStage),
            STAGE_LABEL_DEFAULT[s.nextStage] || s.nextStage)}
          {' · '}
          {s.expectedDaysToNext} {tSafe('farm.intelligence.daysAway', 'days away')}
        </div>
      ) : null}
    </div>
  );
}

function TrustBlock({ intel }) {
  const t = intel && intel.trustScore;
  if (!_isObj(t)) return null;
  // Farmer rule: never show a raw <40 number to the farmer — only
  // the band. Verified / established / building farmers see the
  // band; nobody sees the contributions array.
  return (
    <div style={{ ...STYLES.block, ...STYLES.blockLast }}
      data-testid="farm-intel-trust">
      <div style={STYLES.blockTitle}>
        {tSafe('farm.intelligence.trustTitle', 'Trust profile')}
      </div>
      <div style={STYLES.bandPill(t.band)}>
        {tSafe(_bandHumanKey(t.band),
          BAND_HUMAN_DEFAULT[t.band] || t.band)}
      </div>
      <div style={STYLES.hint}>
        {tSafe(t.headlineKey, t.headlineDefault)}
      </div>
    </div>
  );
}

export default function FarmIntelligenceCard({ intel }) {
  if (!_isObj(intel)) return null;
  // If every sub-block would be empty, render nothing.
  const hasAnything = !!(
       (intel.farmHealth     && intel.farmHealth.band     !== 'insufficient')
    || (intel.fieldRisk      && intel.fieldRisk.topLevel  !== 'insufficient')
    || _arr(intel.weatherActions).length > 0
    || (intel.cropStage      && intel.cropStage.stage     != null)
    || (intel.trustScore     && intel.trustScore.band     !== 'insufficient')
  );
  if (!hasAnything) return null;
  return (
    <section style={STYLES.page}
      data-testid="farm-intelligence-card"
      role="region"
      aria-label={tSafe('farm.intelligence.title', 'Farm intelligence')}
    >
      <HealthBlock intel={intel} />
      <RiskBlock intel={intel} />
      <WeatherActionsBlock intel={intel} />
      <CropStageBlock intel={intel} />
      <TrustBlock intel={intel} />
    </section>
  );
}
