/**
 * NgoInsightsPanel — programme-friendly region insights surface.
 *
 *   <NgoInsightsPanel farms={farms} />
 *
 * Section 1 of the spec (region aggregation) + section 3
 * (action generator) + section 5 (trend view) + section 6
 * (confidence indicator) + section 7 (red/orange/green dot
 * proxy for the future map heat) + section 8 (Download Report).
 *
 * Strict-rule audit
 *   * never exposes raw weights or probabilities - each row
 *     shows farm counts + risk counts + a confidence pill +
 *     a coloured dot. No prob, no model coefficients, no
 *     "humidity_high = 1.10" debug text.
 *   * works offline (composes the local stores)
 *   * never crashes on missing inputs - empty state copy
 *     surfaces when no farms / no risks
 *   * tSafe + getCropLabelSafe for every visible label
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tSafe } from '../../i18n/tSafe.js';
import { computeAllRegionInsights } from '../../ngo/insightsEngine.js';
import { generateActions } from '../../ngo/actionEngine.js';
import { recordSnapshot, getTrendDelta } from '../../ngo/trendStore.js';
import { downloadReport, downloadReportCsv } from '../../ngo/reportExport.js';

const SEV_COLOR = Object.freeze({
  red:    '#FCA5A5',
  orange: '#FCD34D',
  green:  '#86EFAC',
});

const CONF_COLOR = Object.freeze({
  HIGH:   '#86EFAC',
  MEDIUM: '#FCD34D',
  LOW:    'rgba(255,255,255,0.55)',
});

function titleCase(s) {
  if (typeof s !== 'string' || !s) return s;
  return s.split(' ').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
}

export default function NgoInsightsPanel({ farms = [] }) {
  const { t } = useTranslation();

  const insights = useMemo(() => computeAllRegionInsights(farms), [farms]);

  // Stamp today's snapshot on mount so trend deltas have data
  // to compare against tomorrow. Idempotent inside a UTC day -
  // re-mounting won't double-count.
  useEffect(() => {
    if (insights && insights.length > 0) {
      try { recordSnapshot(insights); }
      catch { /* swallow */ }
    }
  }, [insights]);

  const trendByKey = useMemo(() => {
    const m = new Map();
    try {
      for (const trend of getTrendDelta(insights)) {
        m.set(`${trend.country}|${trend.region}`, trend);
      }
    } catch { /* swallow */ }
    return m;
  }, [insights]);

  const [downloading, setDownloading] = useState(false);
  function handleDownload(kind = 'json') {
    setDownloading(true);
    try {
      // The wrapped translator from useTranslation already
      // resolves messageKey -> active language string for the
      // action lines.
      if (kind === 'csv') {
        downloadReportCsv(farms, { t });
      } else {
        downloadReport(farms, { t });
      }
    } finally {
      // Reset quickly; downloads are synchronous in modern browsers.
      setTimeout(() => setDownloading(false), 600);
    }
  }

  const empty = insights.length === 0;

  return (
    <section style={S.card} data-testid="ngo-insights-panel">
      <header style={S.header}>
        <span style={S.icon} aria-hidden="true">{'\uD83D\uDCDD'}</span>
        <div style={S.headerText}>
          <h2 style={S.h2}>{tSafe('ngo.insights.title', 'Insights & actions')}</h2>
          <p style={S.sub}>
            {tSafe('ngo.insights.sub',
              'Region-level summary with recommended next steps.')}
          </p>
        </div>
        <div style={S.headerActions}>
          <button type="button"
            onClick={() => handleDownload('json')}
            disabled={downloading || empty}
            style={S.downloadBtn}
            data-testid="ngo-insights-download-json"
          >
            {tSafe('ngo.insights.downloadJson', 'Download report')}
          </button>
          <button type="button"
            onClick={() => handleDownload('csv')}
            disabled={downloading || empty}
            style={S.downloadBtnSecondary}
            data-testid="ngo-insights-download-csv"
          >
            {'CSV'}
          </button>
        </div>
      </header>

      {empty ? (
        <p style={S.empty} data-testid="ngo-insights-empty">
          {tSafe('ngo.insights.empty',
            'No farm data yet. Insights will appear as farmers report.')}
        </p>
      ) : (
        <ul style={S.list}>
          {insights.map((row) => {
            const key       = `${row.country}|${row.region}`;
            const trend     = trendByKey.get(key);
            const sevColor  = SEV_COLOR[row.severity]   || SEV_COLOR.green;
            const confColor = CONF_COLOR[row.confidence] || CONF_COLOR.LOW;
            const actions   = generateActions(row);

            return (
              <li key={key} style={S.row}>
                <div style={S.rowHead}>
                  <span style={{ ...S.dot, background: sevColor, borderColor: sevColor }} aria-hidden="true" />
                  <span style={S.rowRegion}>{titleCase(row.region)}</span>
                  <span style={S.rowCountry}>{(row.country || '').toUpperCase()}</span>
                  <span style={{ ...S.confPill, color: confColor, borderColor: confColor }}>
                    {tSafe(`ngo.insights.conf.${row.confidence.toLowerCase()}`,
                           row.confidence.toLowerCase())}
                  </span>
                </div>

                <div style={S.metricsRow}>
                  <span style={S.metric}>
                    <strong style={S.metricBig}>{row.farms}</strong>{' '}
                    {tSafe('ngo.insights.farms', 'farms')}
                  </span>
                  <span style={{ ...S.metric, color: '#FCA5A5' }}>
                    <strong style={S.metricBig}>{row.pestHigh}</strong>{' '}
                    {tSafe('ngo.insights.highPest', 'high pest')}
                  </span>
                  <span style={{ ...S.metric, color: '#FCD34D' }}>
                    <strong style={S.metricBig}>{row.droughtHigh}</strong>{' '}
                    {tSafe('ngo.insights.highDrought', 'high drought')}
                  </span>
                  {trend && (
                    <span style={S.trend}>
                      {trend.direction === 'up'   ? '\u2191' :
                       trend.direction === 'down' ? '\u2193' : '\u2192'}
                      {' '}
                      {trend.pestDelta + trend.droughtDelta >= 0 ? '+' : ''}
                      {trend.pestDelta + trend.droughtDelta}
                      {' '}
                      {tSafe('ngo.insights.vsYesterday', 'vs yesterday')}
                    </span>
                  )}
                </div>

                {actions.length > 0 && (
                  <ul style={S.actionList}>
                    {actions.map((a, i) => (
                      <li key={`${key}-a-${i}`} style={S.actionItem}>
                        <span style={S.actionIcon} aria-hidden="true">{'\u27A4'}</span>
                        <span>{tSafe(a.messageKey, a.fallback)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const S = {
  card: {
    background: 'rgba(15, 32, 52, 0.9)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '20px',
    padding: '1rem 1.125rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.875rem',
  },
  header: { display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' },
  icon: { fontSize: '1.5rem', lineHeight: 1, flexShrink: 0 },
  headerText: { flex: 1, minWidth: 0 },
  h2: { margin: 0, fontSize: '1rem', fontWeight: 800, color: '#EAF2FF' },
  sub: { margin: '0.125rem 0 0', fontSize: '0.8125rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.4 },

  headerActions: { display: 'flex', gap: '0.375rem', flexShrink: 0 },
  downloadBtn: {
    padding: '0.5rem 0.875rem',
    minHeight: '40px',
    borderRadius: '10px',
    border: '1px solid rgba(34,197,94,0.55)',
    background: 'rgba(34,197,94,0.16)',
    color: '#DCFCE7',
    fontSize: '0.8125rem',
    fontWeight: 700,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  downloadBtnSecondary: {
    padding: '0.5rem 0.625rem',
    minHeight: '40px',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.75)',
    fontSize: '0.8125rem',
    fontWeight: 700,
    cursor: 'pointer',
  },

  list: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.625rem' },
  row: {
    display: 'flex', flexDirection: 'column', gap: '0.5rem',
    padding: '0.875rem 0.875rem',
    borderRadius: '14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  rowHead: { display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' },
  dot: {
    width: '12px', height: '12px',
    borderRadius: '50%',
    border: '2px solid',
    flexShrink: 0,
  },
  rowRegion: { fontSize: '0.9375rem', fontWeight: 800, color: '#EAF2FF' },
  rowCountry: { fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em',
                color: 'rgba(255,255,255,0.55)',
                padding: '0.125rem 0.5rem',
                borderRadius: '999px',
                background: 'rgba(255,255,255,0.06)' },
  confPill: {
    fontSize: '0.6875rem', fontWeight: 800, letterSpacing: '0.05em',
    textTransform: 'uppercase',
    padding: '0.125rem 0.5rem',
    borderRadius: '999px',
    border: '1px solid',
    background: 'transparent',
    marginLeft: 'auto',
  },

  metricsRow: { display: 'flex', alignItems: 'center', gap: '0.875rem', flexWrap: 'wrap' },
  metric: { fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' },
  metricBig: { color: '#EAF2FF', fontWeight: 800, fontSize: '1rem' },
  trend: {
    marginLeft: 'auto',
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.7)',
    background: 'rgba(255,255,255,0.04)',
    padding: '0.125rem 0.5rem',
    borderRadius: '999px',
    border: '1px solid rgba(255,255,255,0.08)',
  },

  actionList: { listStyle: 'none', margin: '0.25rem 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  actionItem: {
    display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.85)',
    background: 'rgba(34,197,94,0.08)',
    padding: '0.5rem 0.625rem',
    borderRadius: '10px',
    border: '1px solid rgba(34,197,94,0.25)',
  },
  actionIcon: { color: '#86EFAC', flexShrink: 0 },

  empty: {
    margin: 0, fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.55)',
    fontStyle: 'italic',
    padding: '0.5rem 0',
  },
};
