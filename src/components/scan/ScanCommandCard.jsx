/**
 * ScanCommandCard.jsx — single-card command center for a scan
 * result.
 *
 * Scan V3 §9.
 *
 *   <ScanCommandCard result={resultEnvelope} />
 *
 * Renders 7 stacked sections from the v4 scanRecovery envelope:
 *   Plant · Disease · Pest · Soil · Market · Region · Satellite
 *
 * Each section self-hides when its data is absent. Confidence is
 * shown as a percent. Honest copy — never claims certainty above
 * what the envelope reports.
 *
 * Pure render. SSR-safe. Never throws.
 */
import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
const _isObj = (v) => v != null && typeof v === 'object';
const _str   = (v) => (typeof v === 'string' ? v : '');
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _arr   = (v) => (Array.isArray(v) ? v : []);

function _fmtPct(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '';
  return Math.round(n) + '%';
}

function _confidenceColor(band) {
  if (band === 'high')   return '#2f7a3a';
  if (band === 'medium') return '#9a6a00';
  return '#a13a3a';
}

function _stageLabel(stage) {
  return stage ? String(stage).replace(/_/g, ' ') : '';
}

function ScanCommandCardInner({ result }) {
  if (!_isObj(result)) return null;

  const rawPlantName   = _str(result.plantName) || _str(result.commonName);
  const scientificName = _str(result.scientificName);
  const confidencePct  = _num(result.confidence);
  const confidenceBand = _str(result.confidenceBand)
    || (confidencePct != null
        ? (confidencePct >= 75 ? 'high'
           : confidencePct >= 45 ? 'medium' : 'low')
        : 'low');

  // PRODUCTION ROOT-CAUSE FIX (sprint #179):
  //   The legacy `plantName || '—'` pattern caused production
  //   to render "Plant: —" whenever the v5 envelope mirror dropped
  //   plantName. Replace with the spec invariant — honest fallback
  //   ALWAYS, never bare dash, never "Unknown Plant".
  //
  // Resolution order:
  //   1. real plantName (any non-empty species name)
  //   2. top candidate common/scientific name (if candidates present)
  //   3. 'Needs confirmation' (when candidates exist but no name)
  //   4. 'Scan unclear'      (when no signal at all)
  //
  // The component NEVER renders bare '—' or 'Unknown Plant'.
  const _topCandidates = _arr(result.topCandidates);
  const _topCand = _topCandidates[0] || null;
  const plantName =
       rawPlantName
    || _str(_topCand && (_topCand.commonName || _topCand.name))
    || _str(_topCand && _topCand.scientificName)
    || (_topCandidates.length > 0 ? 'Needs confirmation' : 'Scan unclear');

  const diseaseCandidates = _arr(result.diseaseCandidates);
  const topDisease = diseaseCandidates[0] || null;

  const pest        = _isObj(result.pest) ? result.pest : null;
  const soil        = _isObj(result.soil) ? result.soil : null;
  const market      = _isObj(result.market) ? result.market : null;
  const regional    = _isObj(result.regional) ? result.regional : null;
  const fieldHealth = _isObj(result.fieldHealth) ? result.fieldHealth : null;
  const growthStage = _isObj(result.growthStage) ? result.growthStage : null;

  return (
    <section
      style={S.wrap}
      data-testid="scan-command-card"
      data-consumes="scanRecovery"
      data-surface="scan-command"
    >
      <header style={S.header}>
        <p style={S.eyebrow}>{tSafe('scanCommand.eyebrow', 'Scan Command Center')}</p>
        <h2 style={S.title}>{plantName}</h2>
        {scientificName ? <p style={S.scientific}>{scientificName}</p> : null}
      </header>

      {/* Plant + confidence — `plantName` is the resolved fallback
          ladder above, NEVER bare '—' (sprint #179 production fix). */}
      <div style={S.row} data-testid="scan-command-plant">
        <span style={S.rowLabel}>{tSafe('scanCommand.row.plant', 'Plant')}</span>
        <span style={S.rowValue}>
          {plantName}
          {confidencePct != null ? (
            <span style={{ ...S.confBadge, color: _confidenceColor(confidenceBand) }}>
              {' · '}{_fmtPct(confidencePct)}
            </span>
          ) : null}
        </span>
      </div>

      {/* Disease */}
      {topDisease && topDisease.name ? (
        <div style={S.row} data-testid="scan-command-disease">
          <span style={S.rowLabel}>{tSafe('scanCommand.row.disease', 'Disease')}</span>
          <span style={S.rowValue}>
            {topDisease.name}
            {' · '}
            <span style={{ color: _confidenceColor(
              topDisease.score >= 0.75 ? 'high' : topDisease.score >= 0.45 ? 'medium' : 'low'
            )}}>
              {_fmtPct((topDisease.score || 0) * 100)}
            </span>
          </span>
        </div>
      ) : null}

      {/* Pest */}
      {pest && pest.pest ? (
        <div style={S.row} data-testid="scan-command-pest">
          <span style={S.rowLabel}>{tSafe('scanCommand.row.pest', 'Pest')}</span>
          <span style={S.rowValue}>
            {pest.pest}
            {pest.pestCategory && pest.pestCategory !== 'unknown'
              ? ' · ' + String(pest.pestCategory).replace(/_/g, ' ') : ''}
            {pest.severity ? ' · ' + pest.severity : ''}
          </span>
        </div>
      ) : null}

      {/* Soil */}
      {soil && (soil.soilTexture || soil.ph != null || soil.fertilityScore != null) ? (
        <div style={S.row} data-testid="scan-command-soil">
          <span style={S.rowLabel}>{tSafe('scanCommand.row.soil', 'Soil')}</span>
          <span style={S.rowValue}>
            {soil.soilTexture && soil.soilTexture.label
              ? soil.soilTexture.label : ''}
            {soil.ph != null ? ' · pH ' + soil.ph : ''}
            {soil.fertilityScore != null
              ? ' · fertility ' + soil.fertilityScore + '/100' : ''}
            {soil.drainageRisk && soil.drainageRisk !== 'unknown'
              ? ' · ' + soil.drainageRisk + ' drainage' : ''}
          </span>
        </div>
      ) : null}

      {/* Market */}
      {market && (market.currentPrice != null || market.demandScore != null) ? (
        <div style={S.row} data-testid="scan-command-market">
          <span style={S.rowLabel}>{tSafe('scanCommand.row.market', 'Market')}</span>
          <span style={S.rowValue}>
            {market.currentPrice != null
              ? '$' + market.currentPrice + ' ' + (market.unit || 'per kg')
                + (market.referenceOnly ? ' (reference)' : '')
              : ''}
            {market.priceTrend && market.priceTrend !== 'unknown'
              ? ' · ' + market.priceTrend : ''}
            {market.demandScore != null
              ? ' · demand ' + market.demandScore + '/100' : ''}
          </span>
        </div>
      ) : null}

      {/* Region */}
      {regional && (regional.diseasePressure !== 'unknown'
                    || regional.pestPressure !== 'unknown'
                    || regional.rainfallTrend) ? (
        <div style={S.row} data-testid="scan-command-region">
          <span style={S.rowLabel}>{tSafe('scanCommand.row.region', 'Region')}</span>
          <span style={S.rowValue}>
            {regional.diseasePressure !== 'unknown'
              ? 'disease ' + regional.diseasePressure : ''}
            {regional.pestPressure !== 'unknown'
              ? (regional.diseasePressure !== 'unknown' ? ' · ' : '')
                + 'pest ' + regional.pestPressure : ''}
            {regional.rainfallTrend
              ? ' · rain ' + regional.rainfallTrend.direction : ''}
          </span>
        </div>
      ) : null}

      {/* Satellite */}
      {fieldHealth && fieldHealth.ndvi != null ? (
        <div style={S.row} data-testid="scan-command-satellite">
          <span style={S.rowLabel}>{tSafe('scanCommand.row.satellite', 'Satellite')}</span>
          <span style={S.rowValue}>
            NDVI {Number(fieldHealth.ndvi).toFixed(2)}
            {fieldHealth.vigor ? ' · ' + fieldHealth.vigor + ' vigor' : ''}
            {fieldHealth.trend ? ' · trend ' + fieldHealth.trend : ''}
            {fieldHealth.stressLevel
              ? ' · stress ' + fieldHealth.stressLevel : ''}
          </span>
        </div>
      ) : null}

      {/* Growth stage chip — when present */}
      {growthStage && growthStage.stage && growthStage.stage !== 'unknown' ? (
        <div style={S.row} data-testid="scan-command-growth">
          <span style={S.rowLabel}>{tSafe('scanCommand.row.growth', 'Stage')}</span>
          <span style={S.rowValue}>
            {_stageLabel(growthStage.stage)}
            {growthStage.nextMilestone && growthStage.nextMilestone.daysAway != null
              ? ' · next in ' + growthStage.nextMilestone.daysAway + ' days'
              : ''}
          </span>
        </div>
      ) : null}

      <p style={S.footnote}>
        {tSafe('scanCommand.footnote', 'Decision support, not a guarantee.')}
      </p>
    </section>
  );
}

export default class ScanCommandCard extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow */ }
  render() {
    if (this.state.failed) return null;
    try { return <ScanCommandCardInner {...this.props} />; }
    catch { return null; }
  }
}

const S = {
  wrap: {
    background: 'rgba(255,255,255,0.95)',
    border: '1px solid rgba(60,72,55,0.10)',
    borderRadius: 14,
    padding: '16px 18px',
    margin: '12px 0',
    display: 'flex', flexDirection: 'column', gap: 8,
    fontFamily: 'system-ui',
  },
  header: { display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 4 },
  eyebrow: {
    margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'rgba(60,72,55,0.55)',
  },
  title: { margin: 0, fontSize: 20, fontWeight: 800, color: '#1F2933' },
  scientific: {
    margin: 0, fontSize: 12, color: 'rgba(60,72,55,0.6)',
    fontStyle: 'italic',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '90px 1fr',
    gap: 12, alignItems: 'baseline',
    padding: '6px 0',
    borderBottom: '1px solid rgba(60,72,55,0.06)',
  },
  rowLabel: {
    fontSize: 11, fontWeight: 800, letterSpacing: '0.05em',
    textTransform: 'uppercase', color: 'rgba(60,72,55,0.7)',
  },
  rowValue: {
    fontSize: 13, color: '#1F2933', lineHeight: 1.4,
    overflow: 'hidden', textOverflow: 'ellipsis',
  },
  confBadge: { fontWeight: 700 },
  footnote: {
    margin: '8px 0 0', fontSize: 10,
    color: 'rgba(60,72,55,0.5)', textAlign: 'right',
  },
};
