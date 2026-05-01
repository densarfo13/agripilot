/**
 * MarketInsightCard — demand level / average price / nearby buyers
 * for the seller's chosen crop + region.
 *
 * Spec coverage (Sell screen V2 §1, §6)
 *   • demand level (high / medium / low — bucketed)
 *   • average price (priceEngine reference)
 *   • nearby buyers count
 *   • headline message: "X buyers are looking for this crop"
 *
 * Sources (all existing — no new stores)
 *   • marketDemand.getDemandForCrop()  → buyer interest aggregation
 *   • priceEngine.getReferencePrice()  → suggested per-unit price
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Pure presentational; never writes localStorage.
 *   • Self-suppresses each metric when its data is missing — the
 *     card is never rendered with placeholder dashes.
 *   • When `crop` is empty, the card returns null (no signal yet).
 */

import { useMemo } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { getDemandForCrop } from '../../market/marketDemand.js';
import useAutoPriceSuggestion from '../../hooks/useAutoPriceSuggestion.js';

const TONES = {
  high:   { color: '#86EFAC', bg: 'rgba(34,197,94,0.14)',  border: 'rgba(34,197,94,0.45)' },
  medium: { color: '#FCD34D', bg: 'rgba(252,211,77,0.10)', border: 'rgba(252,211,77,0.35)' },
  low:    { color: 'rgba(255,255,255,0.85)', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.18)' },
};

const S = {
  card: {
    background: '#162033',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: '14px 16px',
    color: '#EAF2FF',
    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  headRow: { display: 'flex', alignItems: 'center', gap: 8 },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#86EFAC',
  },
  headline: {
    margin: 0,
    fontSize: 15,
    fontWeight: 700,
    color: '#fff',
    lineHeight: 1.45,
  },
  metaRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: 8,
  },
  metaCard: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 12,
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minWidth: 0,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.6)',
  },
  metaValue: {
    fontSize: 14,
    fontWeight: 700,
    color: '#fff',
  },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
  },
  pillIcon: { fontSize: 11, lineHeight: 1 },
};

/**
 * @param {object} props
 * @param {string} props.crop
 * @param {string} [props.country]
 * @param {string} [props.region]
 * @param {object} [props.style]
 */
export default function MarketInsightCard({
  crop = '',
  country = '',
  region = '',
  style,
}) {
  useTranslation();

  const demand = useMemo(
    () => (crop ? getDemandForCrop({ crop, country, region }) : null),
    [crop, country, region],
  );
  const { formatted: priceFormatted, suggestion } = useAutoPriceSuggestion({ crop, country });

  if (!crop) return null;

  const buyers = demand?.count || 0;
  const level = demand?.level || 'low';
  const tone = TONES[level];

  const headline = buyers > 0
    ? tStrict('sell.insights.headline.buyers',
        '{count} buyers are looking for this crop')
        .replace('{count}', String(buyers))
    : tStrict('sell.insights.headline.empty',
        'List your produce so buyers can find you.');

  const demandLabel = tStrict(
    `sell.insights.demand.${level}`,
    level === 'high' ? 'High demand' : level === 'medium' ? 'Medium demand' : 'Low demand',
  );

  const showPrice  = !!priceFormatted;
  const showBuyers = buyers > 0;

  return (
    <section
      style={{ ...S.card, ...(style || null) }}
      data-testid="sell-market-insight-card"
      data-demand-level={level}
    >
      <div style={S.headRow}>
        <span style={S.eyebrow}>
          {tStrict('sell.insights.title', 'Market insight')}
        </span>
        <span
          style={{
            ...S.pill,
            color: tone.color,
            background: tone.bg,
            border: `1px solid ${tone.border}`,
          }}
          data-testid="sell-demand-pill"
        >
          <span style={S.pillIcon} aria-hidden="true">{'\u25CF'}</span>
          <span>{demandLabel}</span>
        </span>
      </div>

      <p style={S.headline} data-testid="sell-insight-headline">
        {headline}
      </p>

      <div style={S.metaRow}>
        <div style={S.metaCard} data-testid="sell-insight-demand">
          <span style={S.metaLabel}>
            {tStrict('sell.insights.demandLabel', 'Demand')}
          </span>
          <span style={S.metaValue}>{demandLabel}</span>
        </div>

        {showPrice ? (
          <div style={S.metaCard} data-testid="sell-insight-price">
            <span style={S.metaLabel}>
              {tStrict('sell.insights.avgPrice', 'Average price')}
            </span>
            <span style={S.metaValue}>{priceFormatted}</span>
          </div>
        ) : null}

        {showBuyers ? (
          <div style={S.metaCard} data-testid="sell-insight-buyers">
            <span style={S.metaLabel}>
              {tStrict('sell.insights.nearbyBuyers', 'Nearby buyers')}
            </span>
            <span style={S.metaValue}>{buyers}</span>
          </div>
        ) : null}
      </div>

      {/* Suppress unused-var warning when only one branch renders */}
      <span hidden data-suggestion={suggestion ? 'present' : 'absent'} />
    </section>
  );
}
