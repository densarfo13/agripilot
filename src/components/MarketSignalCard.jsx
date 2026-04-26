/**
 * MarketSignalCard — compact crop price trend display.
 *
 * Shows active price signals for the farmer's country.
 * Designed as a subtle supporting layer — not the main dashboard focus.
 *
 * Displays:
 *   - "Market Signals" header
 *   - Up to 5 crops with trend arrows (rising / stable / falling)
 *   - Short farmer-friendly note per signal
 *   - Disclaimer: "Based on seasonal patterns, not live prices"
 *
 * Only renders when market data exists for the country.
 */
import { useMarket } from '../context/MarketContext.jsx';
import { useStrictTranslation as useTranslation } from '../i18n/useStrictTranslation.js';

/**
 * Convert crop code to i18n key.
 * MAIZE → crop.maize, SWEET_POTATO → crop.sweetPotato, etc.
 */
function cropI18nKey(code) {
  const lower = code.toLowerCase();
  const camel = lower.replace(/_(\w)/g, (_, c) => c.toUpperCase());
  return `crop.${camel}`;
}

function trendIcon(trend) {
  if (trend === 'rising') return '\u2197\u{FE0F}';   // ↗️
  if (trend === 'falling') return '\u2198\u{FE0F}';   // ↘️
  return '\u2194\u{FE0F}';                             // ↔️
}

function trendColor(trend) {
  if (trend === 'rising') return '#22C55E';
  if (trend === 'falling') return '#F87171';
  return 'rgba(255,255,255,0.5)';
}

function trendLabelKey(trend) {
  if (trend === 'rising') return 'market.trend.rising';
  if (trend === 'falling') return 'market.trend.falling';
  return 'market.trend.stable';
}

export default function MarketSignalCard() {
  const { signals, hasMarketData } = useMarket();
  const { t } = useTranslation();

  if (!hasMarketData || !signals.length) return null;

  // Show max 5 signals to keep it compact
  const visible = signals.slice(0, 5);

  return (
    <div style={S.card}>
      <div style={S.headerRow}>
        <h3 style={S.title}>{t('market.title')}</h3>
        <span style={S.badge}>{t('market.seasonal')}</span>
      </div>

      <div style={S.signalList}>
        {visible.map((sig) => (
          <div key={sig.cropCode} style={S.signalRow}>
            <span style={S.cropName}>{t(cropI18nKey(sig.cropCode))}</span>
            <span style={{ ...S.trend, color: trendColor(sig.trend) }}>
              {trendIcon(sig.trend)} {t(trendLabelKey(sig.trend))}
            </span>
          </div>
        ))}
      </div>

      <p style={S.disclaimer}>{t('market.disclaimer')}</p>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const S = {
  card: {
    borderRadius: '16px',
    background: '#1B2330',
    padding: '1rem 1.25rem',
    boxShadow: '0 10px 15px rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    marginBottom: '0.625rem',
  },
  title: {
    fontWeight: 600,
    fontSize: '1rem',
    margin: 0,
    color: '#EAF2FF',
  },
  badge: {
    fontSize: '0.625rem',
    color: 'rgba(255,255,255,0.4)',
    background: 'rgba(255,255,255,0.06)',
    borderRadius: '6px',
    padding: '0.15rem 0.4rem',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    fontWeight: 600,
  },
  signalList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
  },
  signalRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.375rem 0.5rem',
    borderRadius: '10px',
    background: 'rgba(255,255,255,0.03)',
  },
  cropName: {
    fontSize: '0.8125rem',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.8)',
  },
  trend: {
    fontSize: '0.75rem',
    fontWeight: 600,
  },
  disclaimer: {
    fontSize: '0.6875rem',
    color: 'rgba(255,255,255,0.3)',
    margin: '0.625rem 0 0',
    textAlign: 'center',
    lineHeight: 1.4,
  },
};
