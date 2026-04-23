/**
 * FarmEconomicsForecast — compact forecast card for a single farm.
 *
 * Pure presentation: takes a farm + optional weather/seasonal context,
 * runs the intelligence pipeline, and renders the yield + value +
 * profit estimates as a single dark-mobile card. No network calls —
 * the engine is deterministic from the inputs.
 *
 * Intentional scope:
 *   • One card, two rows of metrics (yield / value|profit) + a short
 *     drivers list. Matches the existing Farroway card style.
 *   • Confidence chip makes uncertainty visible.
 *   • All copy goes through t(); canonical crop id is never rewritten.
 *
 * Usage:
 *   <FarmEconomicsForecast farm={farm} seasonFit={fit} rainfallFit={rf} />
 *
 * Drop into Home / MyFarm / FarmDetail. Nothing else to wire.
 */

import { useMemo } from 'react';
import { useTranslation } from '../i18n/index.js';
import { estimateFarmEconomics } from '../lib/intelligence/farmEconomicsEngine.js';

export default function FarmEconomicsForecast({
  farm, cropId, country, state,
  seasonFit, rainfallFit, normalizedAreaSqm,
  currentStage, farmType,
}) {
  const { t } = useTranslation();

  const econ = useMemo(() => estimateFarmEconomics({
    farm, cropId, country, state,
    seasonFit, rainfallFit, normalizedAreaSqm,
    currentStage, farmType,
  }), [farm, cropId, country, state, seasonFit, rainfallFit,
      normalizedAreaSqm, currentStage, farmType]);

  if (!econ) return null;

  const isBackyard = (farmType || (farm && farm.farmType)) === 'backyard';
  const yieldLabel = isBackyard
    ? (t('econ.label.estimatedYield') || 'Estimated harvest')
    : (t('econ.label.estimatedYield') || 'Estimated yield');

  const fmtYield = (kg) => {
    if (!Number.isFinite(kg)) return '—';
    if (kg >= 1000) return `${(kg / 1000).toFixed(1)} t`;
    return `${Math.round(kg)} kg`;
  };
  const fmtMoney = (n, curr) => {
    if (!Number.isFinite(n)) return '—';
    const sign = n < 0 ? '-' : '';
    const abs = Math.abs(n);
    return `${sign}${curr || ''} ${abs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  const y = econ.yield;
  const v = econ.value;
  const p = econ.profit;
  const confLabel = {
    high:   t('econ.confidence.high')   || 'High',
    medium: t('econ.confidence.medium') || 'Medium',
    low:    t('econ.confidence.low')    || 'Low',
  }[econ.confidence] || '';

  return (
    <div style={S.card} data-testid="farm-economics-forecast">
      <div style={S.headerRow}>
        <div style={S.title}>{yieldLabel}</div>
        <span style={{ ...S.confChip, ...confChipColor(econ.confidence) }}
              data-testid="econ-confidence">
          {t('econ.label.confidence') || 'Confidence'}: {confLabel}
        </span>
      </div>

      {/* Yield row */}
      {y && (
        <div style={S.metricRow} data-testid="econ-yield-row">
          <div style={S.metricValue}>
            {fmtYield(y.lowYield)} – {fmtYield(y.highYield)}
          </div>
        </div>
      )}

      {/* Value + Profit row */}
      {(v || p) && (
        <div style={S.splitRow}>
          {v && (
            <div style={S.splitBox} data-testid="econ-value-row">
              <div style={S.metricLabel}>
                {t('econ.label.estimatedValue') || 'Estimated value'}
              </div>
              <div style={S.metricValue}>
                {fmtMoney(v.lowValue, v.currency)} – {fmtMoney(v.highValue, v.currency)}
              </div>
            </div>
          )}
          {p && (
            <div style={S.splitBox} data-testid="econ-profit-row">
              <div style={S.metricLabel}>
                {t('econ.label.estimatedProfit') || 'Estimated profit'}
              </div>
              <div style={{
                ...S.metricValue,
                color: p.highProfit > 0 ? '#86EFAC'
                     : p.highProfit < 0 ? '#FCA5A5'
                     : '#9FB3C8',
              }}>
                {fmtMoney(p.lowProfit, p.currency)} – {fmtMoney(p.highProfit, p.currency)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Drivers / explanation */}
      {econ.drivers && econ.drivers.length > 0 && (
        <ul style={S.drivers} data-testid="econ-drivers">
          {econ.drivers.slice(0, 3).map((key) => (
            <li key={key} style={S.driverItem}>{t(key) || key}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function confChipColor(level) {
  if (level === 'high')   return { color: '#86EFAC', borderColor: 'rgba(34,197,94,0.35)' };
  if (level === 'medium') return { color: '#FCD34D', borderColor: 'rgba(251,191,36,0.35)' };
  return { color: '#FCA5A5', borderColor: 'rgba(248,113,113,0.35)' };
}

// ─── Styles ────────────────────────────────────────────────
const S = {
  card: {
    borderRadius: '16px',
    background: '#1B2330',
    border: '1px solid rgba(255,255,255,0.08)',
    padding: '1rem 1.125rem',
    boxShadow: '0 10px 24px rgba(0,0,0,0.25)',
    color: '#EAF2FF',
    display: 'flex', flexDirection: 'column', gap: '0.75rem',
  },
  headerRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: '0.5rem', flexWrap: 'wrap',
  },
  title: {
    fontSize: '0.875rem', fontWeight: 700, color: '#EAF2FF',
  },
  confChip: {
    fontSize: '0.6875rem', fontWeight: 700,
    padding: '0.125rem 0.5rem', borderRadius: '999px',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
    letterSpacing: '0.02em',
  },
  metricRow: {
    display: 'flex', alignItems: 'baseline', gap: '0.375rem',
  },
  metricValue: {
    fontSize: '1.0625rem', fontWeight: 800, color: '#EAF2FF',
    letterSpacing: '0.01em',
  },
  splitRow: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem',
    padding: '0.625rem 0.75rem', borderRadius: '12px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  splitBox: { display: 'flex', flexDirection: 'column', gap: '0.125rem' },
  metricLabel: {
    fontSize: '0.625rem', color: '#9FB3C8',
    textTransform: 'uppercase', letterSpacing: '0.06em',
    fontWeight: 700,
  },
  drivers: {
    margin: 0, padding: '0.125rem 0 0 1rem',
    display: 'flex', flexDirection: 'column', gap: '0.1875rem',
  },
  driverItem: {
    fontSize: '0.75rem', color: '#9FB3C8', lineHeight: 1.4,
  },
};
