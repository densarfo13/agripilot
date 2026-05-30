/**
 * ScanIntelligenceSections.jsx — wave-29 pure-presentational
 * sections that render the four V2 intelligence envelopes from
 * `result.intelligence`. Inserted into ScanResultCard between
 * the main result and the harvest card so the on-screen order
 * matches the wave-29 spec:
 *
 *   1. Plant Name (rendered by ScanResultCard header)
 *   2. Health Status / Issue (rendered above by ScanResultCard)
 *   3. Severity
 *   4. Growth Stage
 *   5. Harvest Readiness (separate card)
 *   6. Weather Risk
 *   7. Recommended Action (rendered with severity)
 *
 * Strict-rule audit
 *   • Pure presentation. No engine state, no calculation.
 *   • Safe wording only.
 *   • tStrict envelopes.
 */

import React from 'react';
import { tStrict } from '../../i18n/strictT.js';

const SEVERITY_TONE = {
  low:      { color: '#86EFAC', bg: 'rgba(34,197,94,0.10)',   border: 'rgba(34,197,94,0.32)' },
  medium:   { color: '#FDE68A', bg: 'rgba(245,158,11,0.10)',  border: 'rgba(245,158,11,0.32)' },
  high:     { color: '#FCA5A5', bg: 'rgba(239,68,68,0.10)',   border: 'rgba(239,68,68,0.32)' },
  critical: { color: '#FCA5A5', bg: 'rgba(239,68,68,0.18)',   border: 'rgba(239,68,68,0.55)' },
  unknown:  { color: '#9FB3C8', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.12)' },
};

const WEATHER_TONE = {
  low:     { color: '#86EFAC', bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.32)' },
  medium:  { color: '#FDE68A', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.32)' },
  high:    { color: '#FCA5A5', bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.32)' },
  unknown: { color: '#9FB3C8', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.10)' },
};

const COMPARISON_TONE = {
  improved:  { color: '#86EFAC', bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.32)' },
  unchanged: { color: '#FDE68A', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.32)' },
  worsened:  { color: '#FCA5A5', bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.32)' },
  unknown:   { color: '#9FB3C8', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.10)' },
};

const STAGE_LABEL = {
  // plant stages
  seedling:        'Seedling',
  young:           'Young',
  mature:          'Mature',
  // crop stages
  emergence:       'Emergence',
  vegetative:      'Vegetative',
  flowering:       'Flowering',
  fruiting:        'Fruiting',
  grain_fill:      'Grain Fill',
  harvest_ready:   'Harvest Ready',
  // flower stages
  bud:             'Bud',
  blooming:        'Blooming',
  peak_bloom:      'Peak Bloom',
  declining_bloom: 'Declining Bloom',
  unknown:         'Unclear',
};

const SEVERITY_LABEL = {
  low:      'Low',
  medium:   'Medium',
  high:     'High',
  critical: 'Critical',
  unknown:  'Unclear',
};

function _SectionCard({ tone, eyebrow, headline, body, dataTestId, dataKey, dataValue }) {
  return (
    <article
      data-testid={dataTestId}
      data-section-key={dataKey}
      data-section-value={dataValue}
      style={{
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        borderRadius: 14,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        color: '#EAF2FF',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700,
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                    color: tone.color }}>
        {eyebrow}
      </div>
      {headline ? (
        <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700,
                     color: '#fff', lineHeight: 1.3 }}>
          {headline}
        </h4>
      ) : null}
      {body ? (
        <p style={{ margin: 0, fontSize: 13, color: '#EAF2FF', lineHeight: 1.45 }}>
          {body}
        </p>
      ) : null}
    </article>
  );
}

export function SeveritySection({ severity }) {
  if (!severity || severity.level === 'unknown') return null;
  const tone = SEVERITY_TONE[severity.level] || SEVERITY_TONE.unknown;
  const label = SEVERITY_LABEL[severity.level] || 'Unclear';
  return (
    <_SectionCard
      tone={tone}
      eyebrow={tStrict('scanV2.severity.eyebrow', 'Severity')}
      headline={`${label} · ${tStrict('scanV2.severity.priority', 'Recommended priority')}: ${severity.recommendedPriority || ''}`}
      body={severity.recommendation}
      dataTestId="scan-v2-severity"
      dataKey="severity"
      dataValue={severity.level}
    />
  );
}

export function GrowthStageSection({ growthStage }) {
  if (!growthStage || growthStage.stage === 'unknown') return null;
  const label = STAGE_LABEL[growthStage.stage] || growthStage.stage;
  const nextLabel = growthStage.nextExpectedStage
    ? (STAGE_LABEL[growthStage.nextExpectedStage] || growthStage.nextExpectedStage)
    : null;
  const days = growthStage.estimatedDaysToNextStage;
  const body = nextLabel
    ? `${tStrict('scanV2.growth.next', 'Next expected stage:')} ${nextLabel}` +
      (typeof days === 'number'
        ? ` · ${tStrict('scanV2.growth.daysToNext', 'in ~')}` + `${days} ${tStrict('scanV2.growth.daysSuffix', 'days')}`
        : '')
    : '';
  return (
    <_SectionCard
      tone={{ color: '#FDE6C5',
              bg: 'rgba(200,148,77,0.10)',
              border: 'rgba(200,148,77,0.28)' }}
      eyebrow={tStrict('scanV2.growth.eyebrow', 'Growth stage')}
      headline={label}
      body={body}
      dataTestId="scan-v2-growth-stage"
      dataKey="growth_stage"
      dataValue={growthStage.stage}
    />
  );
}

export function WeatherRiskSection({ weatherRisk }) {
  if (!weatherRisk || !Array.isArray(weatherRisk.advisories)
      || weatherRisk.advisories.length === 0) return null;
  const tone = WEATHER_TONE[weatherRisk.overallRisk] || WEATHER_TONE.unknown;
  // Render the highest-priority advisory's headline + body; if
  // more exist, append a count line.
  const sorted = [...weatherRisk.advisories].sort((a, b) => {
    const o = { high: 3, medium: 2, low: 1, unknown: 0 };
    return (o[b.level] || 0) - (o[a.level] || 0);
  });
  const top = sorted[0];
  const moreCount = sorted.length - 1;
  return (
    <_SectionCard
      tone={tone}
      eyebrow={tStrict('scanV2.weather.eyebrow', 'Weather risk')}
      headline={top.headline}
      body={top.body + (moreCount > 0
        ? `\n${tStrict('scanV2.weather.more', '+')}${moreCount} ${tStrict('scanV2.weather.advisoryWord', 'more advisory')}`
        : '')}
      dataTestId="scan-v2-weather-risk"
      dataKey="weather_risk"
      dataValue={weatherRisk.overallRisk}
    />
  );
}

export function OutcomeComparisonSection({ outcomeComparison }) {
  if (!outcomeComparison) return null;
  // Wave-35 H5 — when this is the first scan for the plant, the
  // runtime returns status:'unknown' because there's nothing to
  // compare against. Previously the section silently hid. Now we
  // surface a helpful "still learning" hint so the user knows
  // outcome comparison is set up and will activate on the next scan.
  if (outcomeComparison.status === 'unknown') {
    return (
      <article
        data-testid="scan-v2-outcome-comparison"
        data-section-key="outcome_comparison"
        data-section-value="learning"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px dashed rgba(255,255,255,0.14)',
          borderRadius: 14,
          padding: '10px 14px',
          color: '#9FB3C8',
          fontSize: 12.5,
          lineHeight: 1.45,
        }}
      >
        <span style={{ fontWeight: 700, marginRight: 6, color: '#FDE6C5' }}>
          {tStrict('scanV2.compare.eyebrow', 'Compared to last scan')}:
        </span>
        {tStrict(
          'scanV2.compare.learning',
          'Scan this plant again in a few days and we’ll track if it’s improving or worsening.'
        )}
      </article>
    );
  }
  const tone = COMPARISON_TONE[outcomeComparison.status] || COMPARISON_TONE.unknown;
  const labels = {
    improved:  tStrict('scanV2.compare.improved',  'Improved since last scan'),
    unchanged: tStrict('scanV2.compare.unchanged', 'Unchanged since last scan'),
    worsened:  tStrict('scanV2.compare.worsened',  'Worse than last scan'),
    unknown:   tStrict('scanV2.compare.unknown',   'Not enough history to compare'),
  };
  // Wave-30 gap-fix #2 — render before/after photos when the
  // runtime surfaced them on the envelope. Photos are URL strings
  // sourced from the canonical scan history; never the bytes.
  // Pure presentation — no engine state, no fetch.
  const before = outcomeComparison.beforePhoto;
  const after  = outcomeComparison.afterPhoto;
  const showPhotos = !!(before || after);
  return (
    <article
      data-testid="scan-v2-outcome-comparison"
      data-section-key="outcome_comparison"
      data-section-value={outcomeComparison.status}
      style={{
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        borderRadius: 14,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        color: '#EAF2FF',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700,
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                    color: tone.color }}>
        {tStrict('scanV2.compare.eyebrow', 'Compared to last scan')}
      </div>
      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700,
                   color: '#fff', lineHeight: 1.3 }}>
        {labels[outcomeComparison.status]}
      </h4>
      {outcomeComparison.recommendation ? (
        <p style={{ margin: 0, fontSize: 13, color: '#EAF2FF', lineHeight: 1.45 }}>
          {outcomeComparison.recommendation}
        </p>
      ) : null}
      {showPhotos ? (
        <div style={{ display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 8, marginTop: 4 }}
             data-testid="scan-v2-outcome-photos">
          {before ? (
            <figure style={{ margin: 0, display: 'flex',
                             flexDirection: 'column', gap: 4 }}>
              <img src={before}
                   alt={tStrict('scanV2.compare.beforeAlt', 'Previous scan')}
                   loading="lazy"
                   style={{ width: '100%', height: 100, objectFit: 'cover',
                            borderRadius: 8,
                            border: '1px solid rgba(255,255,255,0.10)' }} />
              <figcaption style={{ fontSize: 11, color: '#9FB3C8',
                                   fontWeight: 600,
                                   textTransform: 'uppercase',
                                   letterSpacing: '0.04em' }}>
                {tStrict('scanV2.compare.before', 'Before')}
                {outcomeComparison.beforeSeverity
                  ? <> {' · '}<span style={{ textTransform: 'capitalize' }}>{outcomeComparison.beforeSeverity}</span></>
                  : null}
              </figcaption>
            </figure>
          ) : <div />}
          {after ? (
            <figure style={{ margin: 0, display: 'flex',
                             flexDirection: 'column', gap: 4 }}>
              <img src={after}
                   alt={tStrict('scanV2.compare.afterAlt', 'Current scan')}
                   loading="lazy"
                   style={{ width: '100%', height: 100, objectFit: 'cover',
                            borderRadius: 8,
                            border: '1px solid rgba(255,255,255,0.10)' }} />
              <figcaption style={{ fontSize: 11, color: '#9FB3C8',
                                   fontWeight: 600,
                                   textTransform: 'uppercase',
                                   letterSpacing: '0.04em' }}>
                {tStrict('scanV2.compare.after', 'After')}
                {outcomeComparison.afterSeverity
                  ? <> {' · '}<span style={{ textTransform: 'capitalize' }}>{outcomeComparison.afterSeverity}</span></>
                  : null}
              </figcaption>
            </figure>
          ) : <div />}
        </div>
      ) : null}
    </article>
  );
}

// ─── Wave-36 V5 — Yield + Satellite cards ────────────────────────
// Pure presentation. Reads ONLY safeMessage + risk level from the
// frozen runtime envelope. NEVER exposes risk drivers, raw scores,
// NDVI numbers, or "guaranteed" wording. Gated on hasEnoughData.

function YieldRiskCard({ yieldIntel }) {
  if (!yieldIntel) return null;
  if (!yieldIntel.hasEnoughData) {
    return (
      <article
        data-testid="scan-v5-yield-empty"
        data-section-key="yield_risk"
        data-section-value="not_enough_data"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px dashed rgba(255,255,255,0.14)',
          borderRadius: 14,
          padding: '10px 14px',
          color: '#9FB3C8',
          fontSize: 12.5,
          lineHeight: 1.45,
        }}
      >
        <span style={{ fontWeight: 700, marginRight: 6, color: '#FDE6C5' }}>
          {tStrict('scanV5.yield.eyebrow', 'Yield risk')}:
        </span>
        {yieldIntel.safeMessage}
      </article>
    );
  }
  const riskTone =
    yieldIntel.yieldRisk === 'high'   ? { color: '#FCA5A5', bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.32)' } :
    yieldIntel.yieldRisk === 'medium' ? { color: '#FDE68A', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.32)' } :
    yieldIntel.yieldRisk === 'low'    ? { color: '#86EFAC', bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.32)' } :
                                        { color: '#9FB3C8', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.12)' };
  const label =
    yieldIntel.yieldRisk === 'high'   ? tStrict('scanV5.yield.high',    'High') :
    yieldIntel.yieldRisk === 'medium' ? tStrict('scanV5.yield.medium',  'Medium') :
    yieldIntel.yieldRisk === 'low'    ? tStrict('scanV5.yield.low',     'Low') :
                                        tStrict('scanV5.yield.unclear', 'Unclear');
  const band = yieldIntel.forecastBand || {};
  const showBand = typeof band.low === 'number' && typeof band.high === 'number';
  return (
    <article
      data-testid="scan-v5-yield-risk"
      data-section-key="yield_risk"
      data-section-value={yieldIntel.yieldRisk}
      style={{
        background: riskTone.bg,
        border: `1px solid ${riskTone.border}`,
        borderRadius: 14,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        color: '#EAF2FF',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700,
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                    color: riskTone.color }}>
        {tStrict('scanV5.yield.eyebrow', 'Yield risk')}
      </div>
      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700,
                   color: '#fff', lineHeight: 1.3 }}>
        {label}
      </h4>
      <p style={{ margin: 0, fontSize: 13, color: '#EAF2FF', lineHeight: 1.45 }}>
        {yieldIntel.safeMessage}
      </p>
      {showBand ? (
        <div style={{ fontSize: 11, color: '#9FB3C8' }}>
          {tStrict('scanV5.yield.forecastBand', 'Estimated yield range')}:{' '}
          <strong style={{ color: '#FDE6C5' }}>
            {band.low.toLocaleString()} – {band.high.toLocaleString()} {band.unit || 'kg'}
          </strong>{' '}
          <span style={{ opacity: 0.7 }}>
            ({tStrict('scanV5.yield.estimatedNote', 'estimated band')})
          </span>
        </div>
      ) : null}
    </article>
  );
}

function SatelliteSignalCard({ satellite }) {
  if (!satellite) return null;
  if (satellite.unavailable && !satellite.providerConfigured) {
    return (
      <article
        data-testid="scan-v5-satellite-unavailable"
        data-section-key="satellite_signal"
        data-section-value="unavailable"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px dashed rgba(255,255,255,0.12)',
          borderRadius: 10,
          padding: '8px 12px',
          color: '#9FB3C8',
          fontSize: 12,
          lineHeight: 1.45,
        }}
      >
        {satellite.safeMessage}
      </article>
    );
  }
  if (satellite.unavailable) return null;
  return (
    <article
      data-testid="scan-v5-satellite-signal"
      data-section-key="satellite_signal"
      data-section-value={satellite.vegetationHealth}
      style={{
        background: 'rgba(34,197,94,0.06)',
        border: '1px solid rgba(34,197,94,0.22)',
        borderRadius: 12,
        padding: '10px 14px',
        color: '#EAF2FF',
        fontSize: 13,
        lineHeight: 1.45,
      }}
    >
      <span style={{ fontWeight: 700, marginRight: 6, color: '#86EFAC' }}>
        {tStrict('scanV5.satellite.eyebrow', 'Field signal')}:
      </span>
      {satellite.safeMessage}
    </article>
  );
}

export default function ScanIntelligenceSections({ intelligence }) {
  if (!intelligence) return null;
  const v5 = intelligence.v5 || null;
  return (
    <>
      <SeveritySection         severity={intelligence.severity} />
      <GrowthStageSection      growthStage={intelligence.growthStage} />
      <WeatherRiskSection      weatherRisk={intelligence.weatherRisk} />
      <OutcomeComparisonSection outcomeComparison={intelligence.outcomeComparison} />
      {/* Wave-36 V5 — yield + satellite simple cards. Knowledge
          graph is intentionally invisible to growers. */}
      {v5 ? <YieldRiskCard yieldIntel={v5.yieldIntel} /> : null}
      {v5 ? <SatelliteSignalCard satellite={v5.satellite} /> : null}
    </>
  );
}
