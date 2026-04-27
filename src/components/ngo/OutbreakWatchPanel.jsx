/**
 * OutbreakWatchPanel — NGO/admin "Outbreak Watch" surface.
 *
 *   <OutbreakWatchPanel farms={farms} />
 *
 * Reads outbreak reports from the local mirror, runs the pure
 * cluster engine against the farm roster, and renders the active
 * clusters with country / region / crop / issueType / report
 * count / severity / last-reported / affected-farms columns.
 *
 * Filters: country / region / crop / severity. High-severity
 * clusters render first.
 *
 * Strict-rule audit:
 *   * works offline (mirror + pure engine; no network)
 *   * never crashes when the mirror is empty - shows the
 *     informational empty state
 *   * cropLabel resolves via getCropLabelSafe
 *   * tSafe for every label
 *   * inline styles match the codebase
 */

import React, { useMemo, useState } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tSafe } from '../../i18n/tSafe.js';
import { getCropLabelSafe } from '../../utils/crops.js';
import { getOutbreakReports } from '../../outbreak/outbreakStore.js';
import { detectActiveClusters } from '../../outbreak/outbreakClusterEngine.js';

const SEV_COLOR = Object.freeze({
  high:   '#FCA5A5',
  medium: '#FCD34D',
  low:    '#93C5FD',
});

function fmtRelative(ts, now = Date.now()) {
  if (!Number.isFinite(ts)) return '';
  const diff = Math.max(0, now - ts);
  if (diff < 60_000)        return tSafe('time.just_now', 'Just now');
  if (diff < 3_600_000)     return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000)    return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
}

function titleCase(s) {
  if (typeof s !== 'string' || !s) return s;
  return s.split(' ').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
}

export default function OutbreakWatchPanel({ farms = [] }) {
  const { lang } = useTranslation();

  const [country,  setCountry]  = useState('');
  const [region,   setRegion]   = useState('');
  const [crop,     setCrop]     = useState('');
  const [severity, setSeverity] = useState('');

  const clusters = useMemo(() => {
    const reports = getOutbreakReports();
    return detectActiveClusters(reports, farms);
  }, [farms]);

  // Build filter option lists from the live cluster set so the
  // dropdowns never offer stale options.
  const optionSets = useMemo(() => {
    const c = new Set(), r = new Set(), k = new Set(), s = new Set();
    for (const x of clusters) {
      if (x.country)   c.add(x.country);
      if (x.region)    r.add(x.region);
      if (x.crop)      k.add(x.crop);
      if (x.severity)  s.add(x.severity);
    }
    return { country: [...c].sort(), region: [...r].sort(), crop: [...k].sort(), severity: [...s] };
  }, [clusters]);

  const filtered = useMemo(() => {
    return clusters.filter((c) => {
      if (country  && c.country  !== country)  return false;
      if (region   && c.region   !== region)   return false;
      if (crop     && c.crop     !== crop)     return false;
      if (severity && c.severity !== severity) return false;
      return true;
    });
  }, [clusters, country, region, crop, severity]);

  const hasResults = filtered.length > 0;

  return (
    <section style={S.card} data-testid="ngo-outbreak-watch-panel">
      <header style={S.header}>
        <span style={S.icon} aria-hidden="true">{'\uD83D\uDC1B'}</span>
        <div style={S.headerText}>
          <h2 style={S.h2}>{tSafe('outbreak.watchTitle', 'Outbreak Watch')}</h2>
          <p style={S.sub}>
            {tSafe('outbreak.watchSubtitle',
              'Active clusters reported by farmers in the last 7 days.')}
          </p>
        </div>
      </header>

      {/* Filters */}
      <div style={S.filterRow}>
        <Filter value={country}  setValue={setCountry}  options={optionSets.country}
                placeholder={tSafe('common.country', 'Country')} testId="ngo-outbreak-filter-country" />
        <Filter value={region}   setValue={setRegion}   options={optionSets.region}
                placeholder={tSafe('common.region', 'Region')} testId="ngo-outbreak-filter-region" />
        <Filter value={crop}     setValue={setCrop}     options={optionSets.crop}
                placeholder={tSafe('common.crop', 'Crop')}
                renderOption={(c) => getCropLabelSafe(c, lang) || c}
                testId="ngo-outbreak-filter-crop" />
        <Filter value={severity} setValue={setSeverity} options={optionSets.severity}
                placeholder={tSafe('common.severity', 'Severity')}
                renderOption={(s) => tSafe(`outbreak.severity${s[0].toUpperCase()}${s.slice(1)}`, s)}
                testId="ngo-outbreak-filter-severity" />
      </div>

      {!hasResults ? (
        <p style={S.empty} data-testid="ngo-outbreak-empty">
          {tSafe('outbreak.noClusters',
            'No active outbreaks. Reports from farmers will appear here.')}
        </p>
      ) : (
        <ul style={S.list}>
          {filtered.map((c) => {
            const sevColor = SEV_COLOR[c.severity] || SEV_COLOR.low;
            return (
              <li key={c.id} style={S.row}>
                <div style={S.rowMain}>
                  <div style={S.rowLine1}>
                    <span style={S.rowRegion}>{titleCase(c.region)}</span>
                    <span style={S.rowDot} aria-hidden="true">{'\u2022'}</span>
                    <span style={S.rowCountry}>{(c.country || '').toUpperCase()}</span>
                  </div>
                  <div style={S.rowLine2}>
                    <span style={S.rowCrop}>{getCropLabelSafe(c.crop, lang) || c.crop}</span>
                    <span style={S.rowDot} aria-hidden="true">{'\u2022'}</span>
                    <span style={S.rowIssue}>
                      {tSafe(`outbreak.issue${c.issueType[0].toUpperCase()}${c.issueType.slice(1)}`, c.issueType)}
                    </span>
                  </div>
                </div>
                <div style={S.rowMetrics}>
                  <span style={{ ...S.sevBadge, color: sevColor, borderColor: sevColor }}>
                    {tSafe(`outbreak.severity${c.severity[0].toUpperCase()}${c.severity.slice(1)}`, c.severity)}
                  </span>
                  <span style={S.metricLine}>
                    <strong style={S.metricBig}>{c.reportCount}</strong>{' '}
                    {tSafe('outbreak.reportCount', 'reports')}
                  </span>
                  <span style={S.metricLine}>
                    <strong style={S.metricBig}>{c.affectedFarmIds.length}</strong>{' '}
                    {tSafe('outbreak.affectedFarms', 'farms affected')}
                  </span>
                  <span style={S.metricLine}>
                    {tSafe('outbreak.lastReported', 'last reported')}
                    {' '}{fmtRelative(c.lastReportedAt)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Filter({ value, setValue, options, placeholder, renderOption, testId }) {
  return (
    <select
      value={value}
      onChange={(e) => setValue(e.target.value)}
      style={S.filter}
      data-testid={testId}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {renderOption ? renderOption(o) : o}
        </option>
      ))}
    </select>
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
  filterRow: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '0.5rem',
  },
  filter: {
    minHeight: '40px',
    padding: '0.5rem 0.625rem',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.05)',
    color: '#EAF2FF',
    fontSize: '0.875rem',
    outline: 'none',
  },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  row: {
    display: 'flex', alignItems: 'center', gap: '0.875rem',
    padding: '0.75rem 0.875rem',
    borderRadius: '14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    flexWrap: 'wrap',
  },
  rowMain: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.125rem' },
  rowLine1: { display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' },
  rowLine2: { display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', color: 'rgba(255,255,255,0.65)', fontSize: '0.8125rem' },
  rowRegion: { fontSize: '0.9375rem', fontWeight: 800, color: '#EAF2FF' },
  rowCountry: { fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.55)' },
  rowDot: { color: 'rgba(255,255,255,0.4)' },
  rowCrop: { fontWeight: 700, color: '#86EFAC' },
  rowIssue: { fontWeight: 600, color: '#FCD34D' },
  rowMetrics: {
    display: 'flex', alignItems: 'center', gap: '0.625rem',
    flexWrap: 'wrap',
  },
  sevBadge: {
    fontSize: '0.6875rem', fontWeight: 800, letterSpacing: '0.05em',
    textTransform: 'uppercase',
    padding: '0.125rem 0.5rem',
    borderRadius: '999px',
    border: '1px solid',
    background: 'transparent',
  },
  metricLine: { fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' },
  metricBig: { color: '#EAF2FF', fontWeight: 800 },
  empty: {
    margin: 0, fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.55)',
    fontStyle: 'italic',
    padding: '0.5rem 0',
  },
};
