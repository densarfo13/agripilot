/**
 * YieldBadge — display the lightweight yield estimate for a single
 * farm. Shows tons + a confidence chip. Tooltip surfaces the
 * `reason` string from estimateYield() so the user understands
 * why confidence is low/medium/high.
 *
 *   <YieldBadge farm={farm} />              ← reads farm fields directly
 *   <YieldBadge crop="maize" areaHectares={1.2} score={72} />
 */

import { estimateYield } from '../../lib/farmer/yieldEstimate.js';

const CONF_STYLES = Object.freeze({
  low:    { bg: 'rgba(239,68,68,0.12)',  fg: '#FCA5A5' },
  medium: { bg: 'rgba(245,158,11,0.12)', fg: '#FDE68A' },
  high:   { bg: 'rgba(34,197,94,0.12)',  fg: '#86EFAC' },
});

export default function YieldBadge({
  farm = null,
  crop = null,
  areaHectares = null,
  score = null,
  storedEstimate = null,
}) {
  const args = farm
    ? {
        crop:           farm.crop || farm.cropType || crop,
        areaHectares:   farm.landSizeHectares
                          ?? (farm.normalizedAreaSqm != null ? farm.normalizedAreaSqm / 10000 : null)
                          ?? farm.areaHectares
                          ?? areaHectares,
        score:          farm.score ?? farm.farmerScore ?? score,
        storedEstimate: farm.estimatedYield ?? farm.estimatedYieldTons ?? storedEstimate,
      }
    : { crop, areaHectares, score, storedEstimate };

  const r = estimateYield(args);
  const c = CONF_STYLES[r.confidence] || CONF_STYLES.medium;

  return (
    <span
      style={S.wrap}
      title={`Expected: ${r.tons} tons (Confidence: ${r.confidence})\n${r.reason}`}
      data-testid="yield-badge"
      data-confidence={r.confidence}
    >
      <strong style={S.tons}>{r.tons} t</strong>
      <span style={{ ...S.conf, background: c.bg, color: c.fg }}>
        {r.confidence === 'high' ? 'High' : r.confidence === 'medium' ? 'Med' : 'Low'}
      </span>
    </span>
  );
}

const S = {
  wrap: {
    display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
    fontSize: '0.75rem', whiteSpace: 'nowrap', cursor: 'help',
  },
  tons:  { fontWeight: 700, color: '#F8FAFC' },
  conf:  {
    fontSize: '0.625rem', fontWeight: 700,
    padding: '0.125rem 0.4375rem', borderRadius: 999,
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
};
