/**
 * FarmInsightCard — drop-in panel that renders the farm-intelligence
 * orchestrator output. Shows yield, value, weather-action and risk
 * cards produced by src/lib/intelligence/farmInsightEngine.js.
 *
 * Pure React + inline styles, matching the existing Farroway dark /
 * green aesthetic. Mobile-first: single column stack, tight spacing.
 *
 * Props:
 *   farm    — the profile/farm row. The component maps legacy fields
 *             (cropType, country) onto the canonical shape the engine
 *             expects so existing pages can pass their raw farm.
 *   weather — optional weather payload (see summarizeWeather shape)
 *   tasks   — optional task list for the risk engine
 *   issues  — optional issues list for the risk engine
 *   title   — optional override for the panel headline
 *   hideWhenEmpty — return null when no cards produced (default: true)
 */

import { useFarmInsight } from '../lib/intelligence/useFarmInsight.js';
import { useTranslation } from '../i18n/index.js';
import { tSafe } from '../i18n/tSafe.js';

const TONE = {
  danger: { bg: 'rgba(252,165,165,0.08)', border: 'rgba(252,165,165,0.35)', fg: '#FCA5A5' },
  warn:   { bg: 'rgba(253,224,71,0.08)',  border: 'rgba(253,224,71,0.35)',  fg: '#FDE68A' },
  info:   { bg: 'rgba(134,239,172,0.08)', border: 'rgba(134,239,172,0.25)', fg: '#86EFAC' },
};

function toneStyle(tone) { return TONE[tone] || TONE.info; }

function normaliseFarmForEngine(farm) {
  if (!farm || typeof farm !== 'object') return null;
  return {
    id:                 farm.id || farm._id || null,
    name:               farm.name || farm.farmName || null,
    // `crop` is canonical (canonicalizeFarmPayload in lib/api.js).
    crop:               farm.crop || null,
    farmType:           farm.farmType || farm.farm_type || 'small_farm',
    cropStage:          farm.cropStage || farm.stage || null,
    normalizedAreaSqm:  farm.normalizedAreaSqm || null,
    size:               farm.size || farm.sizeNumber || null,
    sizeUnit:           farm.sizeUnit || farm.size_unit || null,
    countryCode:        farm.countryCode || farm.country || null,
  };
}

export default function FarmInsightCard({
  farm, weather = null, tasks = [], issues = [],
  title = null, hideWhenEmpty = true,
} = {}) {
  const { t } = useTranslation();
  const mapped = normaliseFarmForEngine(farm);
  const insight = useFarmInsight({ farm: mapped, weather, tasks, issues });

  if (!insight || !insight.summaryCards || insight.summaryCards.length === 0) {
    return hideWhenEmpty ? null : (
      <div style={S.wrap}>
        <div style={S.header}>{title || (tSafe('farmer.insight.panel.title', ''))}</div>
        <div style={S.emptyText}>
          {tSafe('farmer.insight.panel.empty', '')}
        </div>
      </div>
    );
  }

  return (
    <div style={S.wrap} data-testid="farm-insight-panel">
      <div style={S.header}>
        <span>{title || (tSafe('farmer.insight.panel.title', ''))}</span>
        {insight.confidenceLevel && (
          <span style={S.confidence}>
            {`${tSafe('farmer.insight.panel.confidence', '')}: ${insight.confidenceLevel}`}
          </span>
        )}
      </div>

      <div style={S.stack}>
        {insight.summaryCards.map((card) => {
          const tone = toneStyle(card.tone);
          return (
            <div
              key={card.id}
              style={{
                ...S.card,
                background: tone.bg,
                border: `1px solid ${tone.border}`,
              }}
              data-testid={`farm-insight-card-${card.kind}`}
            >
              <div style={{ ...S.cardTitle, color: tone.fg }}>{card.title}</div>

              {/* Yield card: show range + unit */}
              {card.kind === 'yield' && (
                <div style={S.valueRow}>
                  <span style={S.valuePrimary}>
                    {`${card.valueLow}–${card.valueHigh} ${card.unit}`}
                  </span>
                  {card.tonsHigh >= 1 && (
                    <span style={S.valueSub}>
                      {`(~${card.tonsLow}–${card.tonsHigh} t)`}
                    </span>
                  )}
                </div>
              )}

              {/* Value card: show formatted currency range */}
              {card.kind === 'value' && card.formatted && (
                <div style={S.valueRow}>
                  <span style={S.valuePrimary}>
                    {`${card.formatted.low} – ${card.formatted.high}`}
                  </span>
                </div>
              )}

              {/* Weather / risk card: show time window + primary action */}
              {(card.kind === 'weather_action' || card.kind === 'risk') && (
                <>
                  {card.timeWindow && (
                    <div style={S.meta}>{card.timeWindow}</div>
                  )}
                  {card.primary && (
                    <div style={S.primaryAction}>→ {card.primary}</div>
                  )}
                  {card.secondary && (
                    <div style={S.secondaryAction}>→ {card.secondary}</div>
                  )}
                </>
              )}

              {card.why && (
                <div style={S.why}>
                  <span style={S.whyLabel}>
                    {tSafe('farmer.insight.panel.why', '')}
                  </span>
                  {' '}{card.why}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const S = {
  wrap: {
    width: '100%',
    background: '#111D2E',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    padding: '1rem 1.125rem 1.125rem',
    marginTop: '1rem',
    color: '#fff',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    fontSize: '0.9375rem', fontWeight: 700, marginBottom: '0.75rem',
    color: '#E2E8F0',
  },
  confidence: {
    fontSize: '0.6875rem', color: 'rgba(255,255,255,0.55)',
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  stack: { display: 'flex', flexDirection: 'column', gap: '0.625rem' },
  card: {
    borderRadius: '12px',
    padding: '0.75rem 0.875rem',
    display: 'flex', flexDirection: 'column', gap: '0.375rem',
  },
  cardTitle: { fontSize: '0.875rem', fontWeight: 700, lineHeight: 1.3 },
  meta: { fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)' },
  primaryAction: { fontSize: '0.875rem', color: '#F8FAFC', lineHeight: 1.4 },
  secondaryAction: { fontSize: '0.8125rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.4 },
  valueRow: { display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' },
  valuePrimary: { fontSize: '1.125rem', fontWeight: 700, color: '#F8FAFC' },
  valueSub: { fontSize: '0.8125rem', color: 'rgba(255,255,255,0.65)' },
  why: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 1.45,
    marginTop: '0.125rem',
  },
  whyLabel: { color: 'rgba(255,255,255,0.75)', fontWeight: 600 },
  emptyText: { fontSize: '0.875rem', color: 'rgba(255,255,255,0.55)' },
};
