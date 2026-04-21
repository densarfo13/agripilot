/**
 * PrintableReportPage — print-friendly NGO / program report.
 *
 * Built for the case where org admins need a one-page summary they
 * can hand to a funder or print from a tablet. No charts, just a
 * clean tabular layout that looks good when the browser's Print
 * dialog is triggered (`window.print()` CSS).
 *
 * Data path (offline-friendly):
 *   src/store/farrowayLocal.getFarms()
 *   src/lib/events/eventLogger.getEvents()
 *   src/store/farrowayLocal.getTaskCompletions()
 *   → src/lib/ngo/reportFilters.aggregateReport(...)
 *
 * Route: /reports/print  (wrapped in RoleRoute for STAFF_ROLES).
 */

import { useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAppSettings } from '../context/AppSettingsContext.jsx';

import { getFarms, getTaskCompletions } from '../store/farrowayLocal.js';
import { getEvents } from '../lib/events/eventLogger.js';
import {
  aggregateReport, filterFarms,
} from '../lib/ngo/reportFilters.js';
import { getFarmerVerificationSignals }
  from '../lib/ngo/verificationSignals.js';
import ReportExportButton from '../components/ReportExportButton.jsx';

export default function PrintableReportPage() {
  const { t } = useAppSettings();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  // Filters come from query string so a user can bookmark / share
  // a filtered report URL.
  const filterCrop   = params.get('crop')   || null;
  const filterRegion = params.get('region') || null;
  const filterStatus = params.get('status') || null;
  const filterFrom   = params.get('from')   || null;
  const filterTo     = params.get('to')     || null;
  const program      = params.get('program') || null;

  const [now] = useState(() => new Date());

  const { farms, events, completions } = useMemo(() => ({
    farms:       getFarms(),
    events:      getEvents(),
    completions: getTaskCompletions(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  const filteredFarms = useMemo(() => filterFarms(farms, {
    crop:   filterCrop,
    region: filterRegion,
    status: filterStatus,
    from:   filterFrom,
    to:     filterTo,
    events,
    now,
  }), [farms, events, filterCrop, filterRegion, filterStatus, filterFrom, filterTo, now]);

  const report = useMemo(() => aggregateReport({
    farms:       program
                   ? filteredFarms.filter((f) => f && f.program === program)
                   : filteredFarms,
    events,
    completions,
    now,
  }), [filteredFarms, events, completions, program, now]);

  const farmSignals = useMemo(() => filteredFarms.slice(0, 200).map((f) => ({
    farm: f,
    signals: getFarmerVerificationSignals({
      farm: f, events, completions, now,
    }),
  })), [filteredFarms, events, completions, now]);

  function handlePrint() {
    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
    }
  }

  const title     = t('reports.print.title')     || 'Farroway program report';
  const generated = t('reports.print.generated') || 'Generated';
  const totalLbl  = t('reports.print.total')     || 'Total farmers';
  const activeLbl = t('reports.print.active')    || 'Active (7d)';
  const inactLbl  = t('reports.print.inactive')  || 'Inactive';
  const signupsLbl= t('reports.print.recent_signups') || 'Signups (30d)';
  const tasksLbl  = t('reports.print.tasks_completed') || 'Tasks completed';
  const cropHd    = t('reports.print.crops')     || 'Crops';
  const regHd     = t('reports.print.regions')   || 'Regions';
  const stageHd   = t('reports.print.stages')    || 'Stages';
  const farmerHd  = t('reports.print.farmers')   || 'Farmers';
  const printLbl  = t('reports.print.print_cta') || 'Print';
  const backLbl   = t('common.back')             || 'Back';

  return (
    <main style={S.page} data-testid="printable-report-page">
      <style>{PRINT_CSS}</style>

      <div className="no-print" style={S.toolbar}>
        <button type="button" onClick={() => navigate(-1)} style={S.ghostBtn}>
          {'\u2190'} {backLbl}
        </button>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <ReportExportButton
            program={program}
            filename={`farroway-report-${new Date(report.generatedAt).toISOString().slice(0, 10)}.csv`}
          />
          <button type="button" onClick={handlePrint} style={S.primaryBtn}
                  data-testid="printable-report-print">
            {printLbl}
          </button>
        </div>
      </div>

      <header style={S.header}>
        <h1 style={S.h1}>{title}</h1>
        <p style={S.sub}>
          {generated}: {new Date(report.generatedAt).toLocaleString()}
          {program && ` · ${t('reports.print.program') || 'Program'}: ${program}`}
          {filterCrop   && ` · ${cropHd}: ${filterCrop}`}
          {filterRegion && ` · ${regHd}: ${filterRegion}`}
          {filterStatus && ` · ${filterStatus}`}
          {filterFrom   && ` · from ${filterFrom}`}
          {filterTo     && ` · to ${filterTo}`}
        </p>
      </header>

      <section style={S.kpis}>
        <Kpi label={totalLbl}  value={report.totals.total} />
        <Kpi label={activeLbl} value={report.totals.active}   tone="green" />
        <Kpi label={inactLbl}  value={report.totals.inactive} tone="amber" />
        <Kpi label={signupsLbl}value={report.recentSignups} />
        <Kpi label={tasksLbl}  value={report.tasksCompleted} />
      </section>

      <section style={S.grid}>
        <Table title={cropHd}  rows={report.crops}   labelKey="crop"   />
        <Table title={regHd}   rows={report.regions} labelKey="region" />
        <Table title={stageHd} rows={report.stages}  labelKey="stage"  />
      </section>

      <section style={S.farmerTableWrap}>
        <h2 style={S.h2}>{farmerHd}</h2>
        <table style={S.farmerTable} data-testid="printable-farmer-table">
          <thead>
            <tr>
              <th style={S.th}>ID</th>
              <th style={S.th}>Name</th>
              <th style={S.th}>Crop</th>
              <th style={S.th}>Region</th>
              <th style={S.th}>Onboarding</th>
              <th style={S.th}>Location</th>
              <th style={S.th}>Crop set</th>
              <th style={S.th}>Recent</th>
              <th style={S.th}>Tasks</th>
              <th style={S.th}>Score</th>
            </tr>
          </thead>
          <tbody>
            {farmSignals.length === 0 && (
              <tr><td colSpan={10} style={{ ...S.td, color: '#9FB3C8' }}>
                {t('reports.print.empty') || 'No farmers match these filters.'}
              </td></tr>
            )}
            {farmSignals.map(({ farm, signals }) => (
              <tr key={farm.id} data-testid={`printable-row-${farm.id}`}>
                <td style={S.td}>{farm.id}</td>
                <td style={S.td}>{farm.name || '—'}</td>
                <td style={S.td}>{farm.crop || farm.cropType || '—'}</td>
                <td style={S.td}>{farm.state || farm.stateCode || farm.country || '—'}</td>
                <td style={S.td}>{signals.onboardingComplete ? '\u2714' : '—'}</td>
                <td style={S.td}>{signals.locationCaptured ? '\u2714' : '—'}</td>
                <td style={S.td}>{signals.cropSelected ? '\u2714' : '—'}</td>
                <td style={S.td}>{signals.recentActivity ? '\u2714' : '—'}</td>
                <td style={S.td}>{signals.taskActivity ? '\u2714' : '—'}</td>
                <td style={S.td}><strong>{signals.score}/5</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

function Kpi({ label, value, tone }) {
  const toneStyle = tone === 'green' ? { color: '#1b5e20' }
                 : tone === 'amber' ? { color: '#b26a00' }
                 :                      {};
  return (
    <div style={S.kpi}>
      <span style={S.kpiLabel}>{label}</span>
      <span style={{ ...S.kpiValue, ...toneStyle }}>{value}</span>
    </div>
  );
}

function Table({ title, rows, labelKey }) {
  return (
    <div style={S.tableCard}>
      <h3 style={S.h3}>{title}</h3>
      <table style={S.table}>
        <thead><tr><th style={S.th}>{labelKey}</th><th style={S.th}>count</th></tr></thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={2} style={{ ...S.td, color: '#9FB3C8' }}>—</td></tr>
          )}
          {rows.map((r) => (
            <tr key={r[labelKey]}><td style={S.td}>{r[labelKey]}</td><td style={S.td}>{r.count}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const PRINT_CSS = `
@media print {
  .no-print { display: none !important; }
  body { background: #fff !important; color: #000 !important; }
}
`;

const S = {
  page: {
    minHeight: '100vh', background: '#0B1D34', color: '#EAF2FF',
    padding: '1.25rem', maxWidth: '1024px', margin: '0 auto',
    fontFamily: 'inherit',
  },
  toolbar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: '1rem',
  },
  ghostBtn: {
    padding: '0.5rem 0.75rem', borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.12)', background: 'transparent',
    color: '#9FB3C8', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  primaryBtn: {
    padding: '0.5rem 0.875rem', borderRadius: 10, border: 'none',
    background: '#22C55E', color: '#fff', fontSize: 13, fontWeight: 700,
    cursor: 'pointer',
  },
  header:  { marginBottom: '1rem' },
  h1:      { margin: 0, fontSize: '1.375rem', fontWeight: 800 },
  sub:     { margin: '0.25rem 0 0', color: '#9FB3C8', fontSize: '0.8125rem' },
  kpis:    {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '0.625rem', marginBottom: '1rem',
  },
  kpi:     {
    display: 'flex', flexDirection: 'column', gap: '0.125rem',
    padding: '0.625rem 0.75rem', borderRadius: 10,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  kpiLabel:{ fontSize: 11, color: '#9FB3C8', fontWeight: 700,
             textTransform: 'uppercase', letterSpacing: '0.05em' },
  kpiValue:{ fontSize: 22, fontWeight: 800, color: '#EAF2FF' },
  grid:    {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '0.625rem', marginBottom: '1rem',
  },
  tableCard: {
    padding: '0.75rem 0.875rem', borderRadius: 10,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  h2:      { margin: '0 0 0.625rem', fontSize: '1.0625rem', fontWeight: 700 },
  h3:      { margin: '0 0 0.5rem',    fontSize: '0.9375rem', fontWeight: 700 },
  table:   { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:      { textAlign: 'left', padding: '0.25rem 0.5rem',
             color: '#9FB3C8', fontWeight: 700, fontSize: 11,
             textTransform: 'uppercase', letterSpacing: '0.04em',
             borderBottom: '1px solid rgba(255,255,255,0.08)' },
  td:      { padding: '0.375rem 0.5rem', color: '#EAF2FF',
             borderBottom: '1px solid rgba(255,255,255,0.05)' },
  farmerTableWrap: {
    padding: '0.75rem 0.875rem', borderRadius: 10,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    overflowX: 'auto',
  },
  farmerTable: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
};

