/**
 * RiskBadge — small risk-band pill driven by the simple
 * NGO-decision partition in `lib/intelligence/riskFromScore.js`.
 *
 *   <RiskBadge score={37} />     → red "High Risk" pill
 *   <RiskBadge score={52} />     → amber "Medium" pill
 *   <RiskBadge score={71} />     → green "Low" pill
 *   <RiskBadge band="medium" />  → caller can supply the band directly
 *
 * Used on:
 *   • AdminDashboard scoring rows
 *   • FarmerIntelligenceSummary header / detail tiles
 *   • InterventionList & PrioritySupplyList row chips
 *   • BuyerView (shown next to the existing 4-band ScoreBadge)
 *
 * The pill renders nothing when the band is 'unknown' — better to
 * show no signal than a misleading "Low" for a brand-new farm.
 *
 * Visible text routes through tStrict so non-English UIs never
 * leak English fallback strings.
 */

import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import {
  riskFromScore,
  RISK_BANDS,
  RISK_FALLBACKS,
} from '../../lib/intelligence/riskFromScore.js';

const TONE = Object.freeze({
  high:    { bg: 'rgba(239,68,68,0.18)',  fg: '#FCA5A5', border: 'rgba(239,68,68,0.45)'  },
  medium:  { bg: 'rgba(245,158,11,0.18)', fg: '#FDE68A', border: 'rgba(245,158,11,0.45)' },
  low:     { bg: 'rgba(34,197,94,0.18)',  fg: '#86EFAC', border: 'rgba(34,197,94,0.45)'  },
});

export default function RiskBadge({
  score,
  band: bandOverride,
  size = 'sm',
  withLabel = true,
  className = '',
}) {
  // Subscribe to language change so the label refreshes live.
  useTranslation();
  const band = bandOverride || riskFromScore(score);
  if (band === RISK_BANDS.UNKNOWN) return null;

  const labelKey = `risk.label.${band}`;
  const label = tStrict(labelKey, RISK_FALLBACKS[band]);
  const tone = TONE[band] || TONE.low;

  const padding = size === 'lg' ? '4px 12px'
                 : size === 'md' ? '3px 10px'
                 :                  '2px 8px';
  const fontSize = size === 'lg' ? 13 : size === 'md' ? 12 : 11;

  const style = {
    display: 'inline-block',
    padding,
    borderRadius: 999,
    background: tone.bg,
    color: tone.fg,
    border: `1px solid ${tone.border}`,
    fontSize,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  };

  return (
    <span
      className={('risk-badge risk-badge--' + band + ' ' + className).trim()}
      data-risk-band={band}
      style={style}
      aria-label={label}
    >
      {withLabel ? label : null}
    </span>
  );
}
