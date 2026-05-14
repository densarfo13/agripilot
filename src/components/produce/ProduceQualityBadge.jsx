/**
 * ProduceQualityBadge — calm, drop-in badge for the
 * ProduceIntelligenceEngine envelope.
 *
 *   <ProduceQualityBadge intel={intel} variant="seller" />
 *   <ProduceQualityBadge intel={intel} variant="buyer" />
 *
 * Used by:
 *   • Sell page         — shows the seller their latest scan's market
 *                         readiness so they don't have to re-scan.
 *   • Buyer listing card — shows the buyer the soft freshness signal
 *                         + scan recency so they can pick reliable
 *                         lots. Buyer variant suppresses the seller-
 *                         specific handling line.
 *
 * Strict-rule audit
 *   • Pure presentational. No localStorage, no network.
 *   • Never crashes on null / partial envelopes — returns null when
 *     there is nothing meaningful to render.
 *   • No raw AI scores / percentages / scientific wording.
 *   • Inline styles — matches the rest of the design system.
 */

import React from 'react';

const TONE = {
  excellent:     { color: '#86EFAC', bg: 'rgba(134,239,172,0.12)', border: 'rgba(134,239,172,0.40)' },
  good:          { color: '#86EFAC', bg: 'rgba(134,239,172,0.08)', border: 'rgba(134,239,172,0.30)' },
  fair:          { color: '#FCD34D', bg: 'rgba(252,211,77,0.10)',  border: 'rgba(252,211,77,0.35)'  },
  needs_sorting: { color: '#FCA5A5', bg: 'rgba(252,165,165,0.10)', border: 'rgba(252,165,165,0.35)' },
};

const READINESS_LABEL = {
  not_ready:         'Not ready',
  nearly_ready:      'Nearly ready',
  market_ready:      'Market ready',
  sell_soon:         'Sell soon',
  quality_declining: 'Quality declining',
};

const QUALITY_LABEL = {
  excellent:     'Excellent',
  good:          'Good',
  fair:          'Fair',
  needs_sorting: 'Needs sorting',
};

const S = {
  wrap: {
    display:       'inline-flex',
    flexDirection: 'column',
    gap:           4,
    padding:       '8px 10px',
    borderRadius:  10,
    fontSize:      12,
    lineHeight:    1.4,
  },
  pillRow: {
    display:    'flex',
    alignItems: 'center',
    gap:        6,
    fontWeight: 700,
    fontSize:   12,
    letterSpacing: '0.02em',
  },
  signal: {
    margin: 0,
    color:  'rgba(255,255,255,0.78)',
    fontSize: 12,
  },
  dot: {
    width: 8, height: 8, borderRadius: '50%',
    flexShrink: 0,
  },
  trend: {
    margin: 0,
    color:  'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontStyle: 'italic',
  },
};

function _readinessLabel(intel) {
  const key = intel && intel.marketReadiness;
  return READINESS_LABEL[key] || null;
}

function _qualityTone(intel) {
  const key = intel && intel.qualityState;
  return TONE[key] || TONE.good;
}

function _qualityLabel(intel) {
  const key = intel && intel.qualityState;
  return QUALITY_LABEL[key] || null;
}

function _trendNote(intel) {
  if (!intel || !intel.history) return null;
  const h = intel.history;
  if (h.trend === 'first_scan') return null;
  if (h.trend === 'improving')  return 'Improving since the last scan.';
  if (h.trend === 'declining')  return 'Worse than the previous scan.';
  return 'Stable since the last scan.';
}

export default function ProduceQualityBadge({ intel, variant }) {
  if (!intel || typeof intel !== 'object') return null;
  const quality = _qualityLabel(intel);
  const readiness = _readinessLabel(intel);
  if (!quality && !readiness) return null;

  const tone  = _qualityTone(intel);
  const signal = intel.buyerTrustSignal || null;
  const trend  = _trendNote(intel);
  const wrapStyle = {
    ...S.wrap,
    background: tone.bg,
    border:     `1px solid ${tone.border}`,
    color:      tone.color,
  };

  return (
    <div style={wrapStyle} data-testid="produce-quality-badge">
      <div style={S.pillRow}>
        <span aria-hidden="true" style={{ ...S.dot, background: tone.color }} />
        <span>
          {quality}
          {readiness ? ` · ${readiness}` : ''}
        </span>
      </div>
      {signal ? <p style={S.signal}>{signal}</p> : null}
      {variant !== 'buyer' && trend ? <p style={S.trend}>{trend}</p> : null}
    </div>
  );
}
