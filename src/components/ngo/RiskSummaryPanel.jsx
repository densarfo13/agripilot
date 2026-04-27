/**
 * RiskSummaryPanel — NGO-side region-level risk roll-up.
 *
 *   <RiskSummaryPanel farms={farms} />
 *
 * Spec section 6: "Region X: HIGH pest risk: 12 farms, HIGH
 * drought risk: 20 farms".
 *
 * Pulls the active outbreak clusters once + computes per-farm
 * risks via computeFarmRisks(). Then bucketed by farm.region
 * for the table:
 *
 *   Region   | High pest farms | High drought farms
 *   --------- + --------------- + ---------------------
 *
 * Strict-rule audit
 *   * works offline (mirror + pure engine)
 *   * never crashes on missing inputs - empty state copy
 *     surfaces when no farms are passed
 *   * inline styles match the codebase
 *   * tSafe for every label
 */

import React, { useMemo } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tSafe } from '../../i18n/tSafe.js';
import { getOutbreakReports } from '../../outbreak/outbreakStore.js';
import { detectActiveClusters } from '../../outbreak/outbreakClusterEngine.js';
import { getAlertsForFarm } from '../../outbreak/farmerOutbreakAlerts.js';
import { computeFarmRisks } from '../../outbreak/riskEngine.js';
import { normaliseRegion, normaliseCountry } from '../../outbreak/regionNormaliser.js';

function titleCase(s) {
  if (typeof s !== 'string' || !s) return s;
  return s.split(' ').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
}

export default function RiskSummaryPanel({ farms = [] }) {
  const { lang } = useTranslation();

  const rows = useMemo(() => {
    if (!Array.isArray(farms) || farms.length === 0) return [];
    const clusters = detectActiveClusters(getOutbreakReports(), farms);
    const buckets = new Map();

    for (const farm of farms) {
      if (!farm || typeof farm !== 'object') continue;
      const country = normaliseCountry(farm.country);
      const region  = normaliseRegion(farm.region || farm.stateCode, country);
      if (!country || !region) continue;
      const matched = getAlertsForFarm(farm, clusters);
      const cluster = matched && matched.length ? matched[0] : null;
      const risks   = computeFarmRisks(farm, cluster);

      const key = `${country}|${region}`;
      if (!buckets.has(key)) {
        buckets.set(key, {
          country,
          region,
          highPest:    0,
          highDrought: 0,
          totalFarms:  0,
        });
      }
      const b = buckets.get(key);
      b.totalFarms += 1;
      if (risks.pest    === 'HIGH') b.highPest    += 1;
      if (risks.drought === 'HIGH') b.highDrought += 1;
    }

    return Array.from(buckets.values())
      // Show rows with at least one HIGH so the dashboard stays
      // signal-dense.
      .filter((r) => r.highPest > 0 || r.highDrought > 0)
      // Sort by combined HIGH count desc, then region asc.
      .sort((a, b) => (
        (b.highPest + b.highDrought) - (a.highPest + a.highDrought)
        || a.region.localeCompare(b.region)
      ));
  }, [farms]);

  const hasRows = rows.length > 0;

  return (
    <section style={S.card} data-testid="ngo-risk-summary-panel">
      <header style={S.header}>
        <span style={S.icon} aria-hidden="true">{'\uD83D\uDCCA'}</span>
        <div style={S.headerText}>
          <h2 style={S.h2}>{tSafe('risk.summary.title', 'Risk by region')}</h2>
          <p style={S.sub}>
            {tSafe('risk.summary.sub',
              'Farms at HIGH pest or drought risk in each region.')}
          </p>
        </div>
      </header>

      {!hasRows ? (
        <p style={S.empty} data-testid="ngo-risk-summary-empty">
          {tSafe('risk.summary.empty',
            'No farms at HIGH risk right now.')}
        </p>
      ) : (
        <ul style={S.list}>
          {rows.map((row) => (
            <li key={`${row.country}|${row.region}`} style={S.row}>
              <div style={S.rowMain}>
                <span style={S.rowRegion}>{titleCase(row.region)}</span>
                <span style={S.rowCountry}>{(row.country || '').toUpperCase()}</span>
              </div>
              <div style={S.metricsRow}>
                <span style={S.metricPest}>
                  <strong style={S.metricBig}>{row.highPest}</strong>{' '}
                  <span style={S.metricLabel}>
                    {tSafe('risk.summary.highPest', 'high pest')}
                  </span>
                </span>
                <span style={S.metricDrought}>
                  <strong style={S.metricBig}>{row.highDrought}</strong>{' '}
                  <span style={S.metricLabel}>
                    {tSafe('risk.summary.highDrought', 'high drought')}
                  </span>
                </span>
                <span style={S.metricTotal}>
                  <strong style={S.metricBig}>{row.totalFarms}</strong>{' '}
                  <span style={S.metricLabel}>
                    {tSafe('risk.summary.farms', 'farms')}
                  </span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {/* lang ref so React-i18n callers re-render on language
          switch even when memoised rows change less often */}
      <span hidden aria-hidden="true">{lang}</span>
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
  header: { display: 'flex', alignItems: 'flex-start', gap: '0.75rem' },
  icon: { fontSize: '1.5rem', lineHeight: 1, flexShrink: 0 },
  headerText: { flex: 1, minWidth: 0 },
  h2: { margin: 0, fontSize: '1rem', fontWeight: 800, color: '#EAF2FF' },
  sub: { margin: '0.125rem 0 0', fontSize: '0.8125rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.4 },

  list: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  row: {
    display: 'flex', alignItems: 'center', gap: '0.875rem',
    padding: '0.75rem 0.875rem',
    borderRadius: '14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    flexWrap: 'wrap',
  },
  rowMain: { flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' },
  rowRegion:  { fontSize: '0.9375rem', fontWeight: 800, color: '#EAF2FF' },
  rowCountry: { fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em',
                color: 'rgba(255,255,255,0.55)',
                padding: '0.125rem 0.5rem',
                borderRadius: '999px',
                background: 'rgba(255,255,255,0.06)' },

  metricsRow: { display: 'flex', alignItems: 'center', gap: '0.875rem', flexWrap: 'wrap' },
  metricPest:    { color: '#FCA5A5' },
  metricDrought: { color: '#FCD34D' },
  metricTotal:   { color: 'rgba(255,255,255,0.65)' },
  metricBig:   { fontSize: '1.0625rem', fontWeight: 800 },
  metricLabel: { fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600 },

  empty: {
    margin: 0,
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.55)',
    fontStyle: 'italic',
    padding: '0.5rem 0',
  },
};
