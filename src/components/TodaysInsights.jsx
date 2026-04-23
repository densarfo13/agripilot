/**
 * TodaysInsights — dashboard strip showing today's top 3–5 farm
 * insights from insightEngine.buildFarmInsights().
 *
 * Pure presentation — takes a farm + weather/seasonal/economics
 * context, runs the insight engine, renders a prioritised list.
 * Matches the existing Farroway dark-mobile card style.
 *
 * Props:
 *   farm                — farm record (cropType, farmType, country, stage, …)
 *   seasonFit           — 'high' | 'medium' | 'low' | 'unknown'
 *   rainfallFit         — 'high' | 'medium' | 'low' | 'unknown'
 *   weatherState        — canonical rainfall state
 *   yieldEstimate       — optional
 *   profitEstimate      — optional
 *   confidence          — overall rollup
 *
 * Insights are translation-key-driven; the fallback English copy
 * renders only when the i18n key is missing.
 */

import { useMemo } from 'react';
import { useTranslation } from '../i18n/index.js';
import { buildFarmInsights } from '../lib/intelligence/insightEngine.js';

const ICONS = {
  warning:  '\u26A0\uFE0F',   // ⚠️
  action:   '\uD83C\uDF31',   // 🌱
  info:     '\u2139\uFE0F',   // ℹ️
  water:    '\uD83D\uDCA7',   // 💧
  drain:    '\uD83D\uDEBF',   // 🚿 (closest to drainage)
  stage:    '\uD83C\uDF31',   // 🌱
  money:    '\uD83D\uDCB0',   // 💰
  calendar: '\uD83D\uDCC5',   // 📅
};

const TONE = {
  warning: { border: 'rgba(252,165,165,0.35)', fg: '#FCA5A5',
              chipBg: 'rgba(252,165,165,0.08)' },
  action:  { border: 'rgba(134,239,172,0.28)', fg: '#86EFAC',
              chipBg: 'rgba(134,239,172,0.08)' },
  info:    { border: 'rgba(148,163,184,0.28)', fg: '#EAF2FF',
              chipBg: 'rgba(255,255,255,0.04)' },
};

export default function TodaysInsights({
  farm, seasonFit, rainfallFit, weatherState,
  yieldEstimate, profitEstimate, confidence,
  onTaskTap,
}) {
  const { t } = useTranslation();

  const insights = useMemo(() => buildFarmInsights({
    cropId:  farm && (farm.cropType || farm.crop || farm.cropId),
    stage:   farm && (farm.cropStage || farm.stage),
    farmType: farm && farm.farmType,
    location: {
      country: farm && (farm.country || farm.countryCode),
      state:   farm && (farm.state || farm.region),
    },
    seasonFit, rainfallFit, weatherState,
    yieldEstimate, profitEstimate, confidence,
  }), [farm, seasonFit, rainfallFit, weatherState,
      yieldEstimate, profitEstimate, confidence]);

  if (!insights || insights.length === 0) return null;

  return (
    <section style={S.card} data-testid="todays-insights">
      <header style={S.header}>
        <h3 style={S.title}>
          {t('insights.title') && t('insights.title') !== 'insights.title'
            ? t('insights.title')
            : 'Today\u2019s Insights'}
        </h3>
        <span style={S.count} data-testid="insights-count">
          {insights.length}
        </span>
      </header>
      <ul style={S.list}>
        {insights.map((insight) => (
          <InsightRow
            key={insight.id}
            insight={insight}
            t={t}
            onTaskTap={onTaskTap}
          />
        ))}
      </ul>
    </section>
  );
}

function InsightRow({ insight, t, onTaskTap }) {
  const tone = TONE[insight.type] || TONE.info;
  const icon = ICONS[insight.icon] || ICONS[insight.type] || ICONS.info;

  const translate = (key, fallback) => {
    if (!key) return fallback;
    const v = t(key);
    return v && v !== key ? v : fallback;
  };

  const msg    = translate(insight.messageKey,        insight.fallbackMessage || '');
  const reason = translate(insight.reasonKey,         insight.reason || '');
  const action = translate(insight.recommendedActionKey, insight.recommendedAction || '');

  return (
    <li
      style={{ ...S.row, borderColor: tone.border, background: tone.chipBg }}
      data-testid={`insight-${insight.id}`}
      data-insight-type={insight.type}
      data-insight-priority={insight.priority}>
      <div style={S.rowIcon} aria-hidden="true">{icon}</div>
      <div style={S.rowBody}>
        <div style={{ ...S.rowMsg, color: tone.fg }}>{msg}</div>
        {reason && <div style={S.rowReason}>{reason}</div>}
        {action && (
          <button
            type="button"
            style={S.rowCta}
            onClick={() => {
              if (onTaskTap && insight.linkedTaskTemplateId) {
                onTaskTap(insight);
              }
            }}
            data-testid={`insight-cta-${insight.id}`}>
            {'\u2192 '}{action}
          </button>
        )}
      </div>
    </li>
  );
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
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  title: {
    margin: 0, fontSize: '0.9375rem', fontWeight: 800,
    color: '#EAF2FF', letterSpacing: '0.01em',
  },
  count: {
    fontSize: '0.6875rem', fontWeight: 700, color: '#9FB3C8',
    padding: '0.125rem 0.5rem', borderRadius: '999px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  list: {
    listStyle: 'none', margin: 0, padding: 0,
    display: 'flex', flexDirection: 'column', gap: '0.5rem',
  },
  row: {
    display: 'flex', gap: '0.625rem', alignItems: 'flex-start',
    padding: '0.625rem 0.75rem',
    borderRadius: '12px',
    border: '1px solid',
  },
  rowIcon: { fontSize: '1.125rem', flexShrink: 0, lineHeight: 1.2 },
  rowBody: { flex: 1, minWidth: 0, display: 'flex',
              flexDirection: 'column', gap: '0.125rem' },
  rowMsg: { fontSize: '0.8125rem', fontWeight: 700, lineHeight: 1.3 },
  rowReason: { fontSize: '0.6875rem', color: '#9FB3C8', lineHeight: 1.4 },
  rowCta: {
    marginTop: '0.25rem', background: 'none', border: 'none',
    color: '#86EFAC', fontSize: '0.6875rem', fontWeight: 700,
    padding: 0, cursor: 'pointer', textAlign: 'left',
    WebkitTapHighlightColor: 'transparent',
  },
};
