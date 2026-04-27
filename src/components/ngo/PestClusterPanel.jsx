/**
 * PestClusterPanel — NGO-side pest activity summary.
 *
 * Reads the local pest-report mirror and renders the top regional
 * clusters above the alert threshold. Drops into the
 * NgoValueDashboard or any admin grid that already uses the
 * 16-20px rounded card visual language.
 *
 * Strict rules respected:
 *   * additive, presentational only
 *   * never crashes on empty / missing reports - empty state
 *     copy is informational
 *   * inline styles match the codebase
 */

import React from 'react';
import { getPestReports } from '../../utils/pestReports.js';
import { topClusters, CLUSTER_TUNING } from '../../utils/pestCluster.js';
import { tSafe } from '../../i18n/tSafe.js';

function fmtRelative(latestMs, now = Date.now()) {
  if (!Number.isFinite(latestMs)) return '';
  const diff = Math.max(0, now - latestMs);
  if (diff < 60_000)        return tSafe('time.just_now', 'Just now');
  if (diff < 3_600_000)     return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000)    return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
}

function titleCase(s) {
  if (typeof s !== 'string' || !s) return s;
  return s.split(' ').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
}

export default function PestClusterPanel({
  threshold  = CLUSTER_TUNING.MIN_REPORTS_ALERT,
  windowDays = CLUSTER_TUNING.WINDOW_DAYS,
  limit      = 6,
}) {
  const reports = getPestReports();
  const clusters = topClusters(reports, { threshold, windowDays, limit });

  return (
    <section style={S.card} data-testid="ngo-pest-cluster-panel">
      <header style={S.header}>
        <span style={S.icon} aria-hidden="true">{'\uD83D\uDC1B'}</span>
        <div style={S.headerText}>
          <h2 style={S.h2}>{tSafe('ngo.pest.title', 'Pest activity')}</h2>
          <p style={S.sub}>
            {tSafe(
              'ngo.pest.sub',
              'Regions where farmers reported pests in the last {n} days.',
            ).replace('{n}', String(windowDays))}
          </p>
        </div>
      </header>

      {clusters.length === 0 ? (
        <p style={S.empty} data-testid="ngo-pest-empty">
          {tSafe(
            'ngo.pest.empty',
            'No pest clusters above the alert threshold yet.',
          )}
        </p>
      ) : (
        <ul style={S.list}>
          {clusters.map((c) => (
            <li key={c.region} style={S.row}>
              <span style={S.region} title={c.region}>{titleCase(c.region)}</span>
              <span style={S.count}>
                {`${c.count} ${tSafe('ngo.pest.reports', 'pest reports')}`}
              </span>
              <span style={S.latest}>{fmtRelative(c.latest)}</span>
            </li>
          ))}
        </ul>
      )}

      <footer style={S.footer}>
        <span style={S.threshold}>
          {tSafe('ngo.pest.threshold', 'Alerts trigger at')}{' '}
          <strong>{threshold}+</strong>{' '}
          {tSafe('ngo.pest.thresholdSuffix', 'reports per region')}
        </span>
      </footer>
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
  h2: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 800,
    color: '#EAF2FF',
  },
  sub: {
    margin: '0.125rem 0 0',
    fontSize: '0.8125rem',
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 1.4,
  },
  empty: {
    margin: 0,
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.55)',
    fontStyle: 'italic',
    padding: '0.5rem 0',
  },
  list: {
    margin: 0,
    padding: 0,
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr auto auto',
    alignItems: 'center',
    gap: '0.625rem',
    padding: '0.5rem 0.75rem',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  region: {
    fontSize: '0.9375rem',
    fontWeight: 700,
    color: '#EAF2FF',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  count: {
    fontSize: '0.8125rem',
    fontWeight: 800,
    color: '#FCA5A5',
  },
  latest: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.5)',
    minWidth: '2.5rem',
    textAlign: 'right',
  },
  footer: {
    paddingTop: '0.5rem',
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },
  threshold: { fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)' },
};
