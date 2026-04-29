/**
 * NgoDashboard — multi-program NGO operator view.
 *
 * Fetches four program-scoped aggregates in parallel:
 *   /program-summary, /program-farmers, /program-risk,
 *   /program-performance
 *
 * A program-picker query-param (`?program=Cassava Program`)
 * filters every tile at once. Export opens `/program-export`
 * with the same filter. All copy via t() + English fallback.
 *
 * Explicit loading / error / empty states — nothing blanks.
 */

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useTranslation } from '../i18n/index.js';
import { isDemoMode } from '../config/demoMode.js';
import {
  friendlyEmptyMessage, friendlyErrorMessage,
  getFallbackNgoSummary, getFallbackProgramRisk, getFallbackPerformance,
  shouldShowFallback,
} from '../lib/demo/demoFallbacks.js';
import {
  MetricCard, MetricGrid, SoftBanner, AdminEmptyState, SectionHeader,
} from '../components/admin/AdminPolish.jsx';
import NeedsAttentionPanel from '../components/admin/NeedsAttentionPanel.jsx';
import BrandLogo from '../components/BrandLogo.jsx';
import { FARROWAY_BRAND } from '../brand/farrowayBrand.js';
// NGO impact reporting — local-first event aggregation.
// computeNgoEngagementSummary reads `farroway_events` (the
// canonical event log written by AllTasksPage + App.jsx) and
// returns the 8-field summary the Farmer Engagement section
// renders. engagementToCsv produces the per-farmer roll-up
// for the "Download Engagement Report" button.
import { getEvents } from '../data/eventLogger.js';
import {
  computeNgoEngagementSummary, engagementToCsv,
} from '../metrics/impactMetrics.js';

/**
 * Brand header reused across NGO loading / error / success states
 * so the operator always sees the v3 mark + tagline at the top of
 * the surface, never a bare "NGO Dashboard" label.
 */
function BrandHeader() {
  return (
    <header
      style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'flex-start', gap: '0.35rem',
        marginBottom: '0.75rem',
      }}
      data-testid="ngo-brand-header"
    >
      <BrandLogo variant="light" size="md" />
      <p style={{
        margin: 0, color: 'rgba(255,255,255,0.65)',
        fontSize: '0.875rem',
      }}>
        {FARROWAY_BRAND.tagline}
      </p>
    </header>
  );
}

const resolve = (t, key, fallback) => {
  if (typeof t !== 'function' || !key) return fallback;
  const v = t(key);
  return v && v !== key ? v : fallback;
};

async function fetchJson(url) {
  const r = await fetch(url, { credentials: 'include' });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

function buildQuery(program) {
  if (!program) return '';
  return `?program=${encodeURIComponent(program)}`;
}

export default function NgoDashboard() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const program = params.get('program') || '';

  const [summary,    setSummary]    = useState(null);
  const [farmers,    setFarmers]    = useState(null);
  const [risk,       setRisk]       = useState(null);
  const [performance, setPerformance] = useState(null);
  const [error,      setError]      = useState('');
  const [loading,    setLoading]    = useState(true);
  // NGO impact: engagement summary derived from the local event
  // log. Recomputed whenever the program filter changes or the
  // farmers list updates so totals stay aligned with the filtered
  // cohort. Pure read of localStorage — no extra fetch.
  const [engagement, setEngagement] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError('');
      const q = buildQuery(program);
      try {
        const [s, f, r, p] = await Promise.all([
          fetchJson(`/api/admin/program-summary${q}`),
          fetchJson(`/api/admin/program-farmers${q}`),
          fetchJson(`/api/admin/program-risk${q}`),
          fetchJson(`/api/admin/program-performance${q}`),
        ]);
        if (!alive) return;
        setSummary(s); setFarmers(f); setRisk(r); setPerformance(p);
      } catch (e) {
        if (alive) setError(e?.message || 'Failed to load');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [program]);

  // NGO impact: compute the Farmer Engagement summary whenever
  // the filtered farmers list updates. Reading the event log is
  // synchronous + local; the summary helper handles missing data
  // gracefully (returns all-zeros + hasActivity:false).
  useEffect(() => {
    let evs = [];
    try { evs = getEvents() || []; } catch { evs = []; }
    const farmList = Array.isArray(farmers) ? farmers : [];
    try {
      setEngagement(computeNgoEngagementSummary({
        events: evs, farms: farmList,
      }));
    } catch {
      setEngagement(null);
    }
  }, [farmers, program]);

  // Derive the list of known programs from the farmers payload
  // so the picker can offer concrete choices without a separate
  // endpoint.
  const knownPrograms = useMemo(() => {
    const set = new Set();
    if (Array.isArray(farmers)) {
      for (const f of farmers) {
        if (f && f.location) set.add(f.location);   // fallback signal
      }
    }
    if (Array.isArray(farmers)) {
      for (const f of farmers) if (f && f.program) set.add(f.program);
    }
    if (summary && summary.program) set.add(summary.program);
    return Array.from(set).sort();
  }, [farmers, summary]);

  function onProgramChange(next) {
    const q = next ? { program: next } : {};
    setParams(q, { replace: true });
  }

  // Download the per-farmer engagement CSV. Reuses the standard
  // Blob → object-URL → click pattern used elsewhere in the app
  // (FundingImpact, reportExport). Fully client-side; no API hop.
  function handleEngagementExport() {
    let evs = [];
    try { evs = getEvents() || []; } catch { evs = []; }
    const farmList = Array.isArray(farmers) ? farmers : [];
    let csv = '';
    try { csv = engagementToCsv({ events: evs, farms: farmList }); }
    catch { csv = 'farmerId,crop,region,tasksCompleted,lastActive,streak,verifiedActions\n'; }
    try {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `farroway-engagement-${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch { /* never propagate from a click handler */ }
  }

  const title   = resolve(t, 'ngo.dashboard.title',   'NGO Dashboard');
  const allPrgs = resolve(t, 'ngo.dashboard.allPrograms', 'All programs');
  const lblTot  = resolve(t, 'ngo.dashboard.totalFarmers',  'Total Farmers');
  const lblAct  = resolve(t, 'ngo.dashboard.activeFarmers', 'Active (7d)');
  const lblCmp  = resolve(t, 'ngo.dashboard.completionRate','Completion');
  const lblHi   = resolve(t, 'ngo.dashboard.highRisk',      'High Risk');
  const riskHdr = resolve(t, 'ngo.dashboard.riskDistribution', 'Risk Distribution');
  const perfHdr = resolve(t, 'ngo.dashboard.performance',   'Performance');
  const avgY    = resolve(t, 'ngo.dashboard.avgYield',      'Avg Yield');
  const avgS    = resolve(t, 'ngo.dashboard.avgScore',      'Avg Score');
  const taskC   = resolve(t, 'ngo.dashboard.taskCompletion','Task Completion');
  const farmHdr = resolve(t, 'ngo.dashboard.farmers',       'Farmers');
  const attnHdr = resolve(t, 'ngo.dashboard.needAttention',
    'Farmers needing attention');
  const expLbl  = resolve(t, 'ngo.dashboard.exportReport',  'Export Report');
  const errLbl  = resolve(t, 'ngo.dashboard.error',         'Could not load dashboard');
  const emptyLbl = resolve(t, 'ngo.dashboard.empty',        'No farmers in this program yet.');

  if (loading) {
    return (
      <main style={S.page} data-screen="ngo-dashboard">
        <BrandHeader />
        {resolve(t, 'common.loading', 'Loading\u2026')}
      </main>
    );
  }

  // Demo-safe soft recovery: when the dashboard endpoint fails and
  // we're in demo mode, swap the red banner for friendly copy + a
  // non-zero fallback summary. Production flow (non-demo) keeps the
  // original red error banner so real operators still see problems.
  if (error) {
    // Demo-safe soft recovery: calmer banner + non-zero KPIs so the
    // demo never dead-ends. Production paths still show a blocking
    // banner — real operators need to see real failures.
    if (isDemoMode()) {
      const soft = friendlyErrorMessage('analytics');
      const fb = getFallbackNgoSummary();
      return (
        <main style={S.page} data-screen="ngo-dashboard" data-state="demo-fallback">
          <BrandHeader />
          <h2 style={S.title}>{title}</h2>
          <SoftBanner tone="info" testId="ngo-soft-recovery">
            {resolve(t, soft.key, soft.fallback)}
          </SoftBanner>
          <SectionHeader title={resolve(t, 'ngo.dashboard.kpis', 'Program overview')} />
          <MetricGrid testId="ngo-summary-fallback">
            <MetricCard label={lblTot} value={fb.totalFarmers}  tone="neutral" />
            <MetricCard label={lblAct} value={fb.activeFarmers} tone="info" />
            <MetricCard label={lblCmp} value={`${Math.round(fb.completionRate * 100)}%`} tone="good" />
            <MetricCard label={lblHi}  value={fb.highRiskFarmers} tone="warn" />
          </MetricGrid>
        </main>
      );
    }
    return (
      <main style={S.page} data-screen="ngo-dashboard" data-state="error">
        <BrandHeader />
        <h2 style={S.title}>{title}</h2>
        <SoftBanner tone="critical" role="alert" testId="ngo-error-banner">
          {errLbl}: {error}
        </SoftBanner>
      </main>
    );
  }

  const highRiskFarmers = (farmers || []).filter((f) => f && f.risk === 'high');

  return (
    <main style={S.page} data-screen="ngo-dashboard">
      <BrandHeader />
      <h2 style={S.title}>{title}</h2>

      {/* Program picker — optional */}
      {knownPrograms.length > 0 && (
        <div style={S.pickerRow} data-testid="ngo-program-picker">
          <label style={S.pickerLbl}>
            {resolve(t, 'ngo.dashboard.program', 'Program')}:
          </label>
          <select
            value={program}
            onChange={(e) => onProgramChange(e.target.value)}
            style={S.pickerSelect}
          >
            <option value="">{allPrgs}</option>
            {knownPrograms.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      )}

      {/* Needs attention — actionable top-of-dashboard band. Numbers
          come straight from the already-fetched summary + farmers
          payload so there's zero extra API cost. Hidden when we
          have nothing to surface. */}
      {summary && (
        <NeedsAttentionPanel
          inactiveFarmers={Math.max(0, (summary.totalFarmers ?? 0) - (summary.activeFarmers ?? 0))}
          incompleteProfiles={Array.isArray(farmers)
            ? farmers.filter((f) => f && (!f.crop || !f.location)).length
            : 0}
          missedTasks={summary.missedTasks ?? summary.overdueTasks ?? 0}
          highRisk={summary.highRiskFarmers ?? 0}
          titleLabel={resolve(t, 'ngo.dashboard.needsAttention', 'Needs attention')}
          allClearLabel={resolve(t, 'ngo.dashboard.allClear',
            'Everything looks clear \u2014 no urgent follow-ups.')}
          labels={{
            inactive:   resolve(t, 'ngo.dashboard.attention.inactive',   'Inactive farmers'),
            incomplete: resolve(t, 'ngo.dashboard.attention.incomplete', 'Profiles incomplete'),
            missed:     resolve(t, 'ngo.dashboard.attention.missed',     'Missed tasks'),
            highRisk:   resolve(t, 'ngo.dashboard.attention.highRisk',   'High risk'),
          }}
        />
      )}

      {/* Summary cards — polished metric grid (spec §§1, 4) */}
      {summary && (
        <>
          <SectionHeader title={resolve(t, 'ngo.dashboard.kpis', 'Program overview')} />
          <MetricGrid testId="ngo-summary">
            <MetricCard label={lblTot} value={summary.totalFarmers ?? 0}  tone="neutral" />
            <MetricCard label={lblAct} value={summary.activeFarmers ?? 0} tone="info" />
            <MetricCard label={lblCmp} value={`${Math.round((summary.completionRate ?? 0) * 100)}%`} tone="good" />
            <MetricCard label={lblHi}  value={summary.highRiskFarmers ?? 0} tone="warn" />
          </MetricGrid>
        </>
      )}

      {/* ═══ FARMER ENGAGEMENT (NGO impact reporting) ═══
          Built from the local event log (TASK_COMPLETED,
          STREAK_UPDATED, APP_OPENED, TASK_VIEWED) so an NGO
          operator can see, at a glance, whether their cohort
          is actually using Farroway. Empty-state copy renders
          when no events exist yet — never a row of zero-cards. */}
      <section style={S.section} data-testid="ngo-engagement">
        <SectionHeader title={resolve(t, 'ngo.dashboard.engagement.title', 'Farmer Engagement')} />
        {engagement && engagement.hasActivity ? (
          <>
            <MetricGrid testId="ngo-engagement-grid">
              <MetricCard
                label={resolve(t, 'ngo.dashboard.engagement.active',    'Active Farmers')}
                value={engagement.activeFarmers7d}
                tone="info"
              />
              <MetricCard
                label={resolve(t, 'ngo.dashboard.engagement.completed', 'Tasks Completed')}
                value={engagement.tasksCompleted7d}
                tone="good"
              />
              <MetricCard
                label={resolve(t, 'ngo.dashboard.engagement.rate',      'Completion Rate')}
                value={`${Math.round((engagement.taskCompletionRate ?? 0) * 100)}%`}
                tone="good"
              />
              <MetricCard
                label={resolve(t, 'ngo.dashboard.engagement.verified',  'Verified Actions')}
                value={engagement.verifiedCompletions7d}
                tone="neutral"
              />
              <MetricCard
                label={resolve(t, 'ngo.dashboard.engagement.inactive',  'Inactive Farmers')}
                value={engagement.inactiveFarmers7d}
                tone="warn"
              />
            </MetricGrid>
            <button
              type="button"
              onClick={handleEngagementExport}
              style={S.exportBtn}
              data-testid="ngo-engagement-export"
            >
              {resolve(t, 'ngo.dashboard.engagement.export', 'Download Engagement Report')}
            </button>
          </>
        ) : (
          <AdminEmptyState
            tone="neutral"
            icon={'\u2139'}
            title={resolve(t, 'ngo.dashboard.engagement.empty.title', 'No activity yet')}
            body={resolve(t, 'ngo.dashboard.engagement.empty.body',
              'Data will appear here after farmers complete tasks.')}
            testId="ngo-engagement-empty"
          />
        )}
      </section>

      {/* Risk distribution */}
      {risk && (
        <section style={S.section} data-testid="ngo-risk">
          <h3 style={S.h3}>{riskHdr}</h3>
          <div style={S.riskRow}>
            <span style={{ ...S.riskPill, ...toneStyle('high')   }}>High: {risk.high ?? 0}</span>
            <span style={{ ...S.riskPill, ...toneStyle('medium') }}>Medium: {risk.medium ?? 0}</span>
            <span style={{ ...S.riskPill, ...toneStyle('low')    }}>Low: {risk.low ?? 0}</span>
          </div>
        </section>
      )}

      {/* Performance */}
      {performance && (
        <section style={S.section} data-testid="ngo-performance">
          <h3 style={S.h3}>{perfHdr}</h3>
          <div style={S.cardsRow}>
            <Card label={avgY}  value={performance.avgYield ?? 0} />
            <Card label={avgS}  value={performance.avgScore ?? 0} />
            <Card label={taskC} value={`${Math.round((performance.taskCompletion ?? 0) * 100)}%`} />
          </div>
        </section>
      )}

      {/* High-risk farmers filter — spec §9 */}
      {highRiskFarmers.length > 0 && (
        <section style={S.section} data-testid="ngo-need-attention">
          <h3 style={S.h3}>{attnHdr}</h3>
          <ul style={S.attnList}>
            {highRiskFarmers.slice(0, 10).map((f) => (
              <li key={f.farmId} style={S.attnRow}>
                <strong>{f.farmerName || `${String(f.farmId).slice(0,8)}\u2026`}</strong>
                <span>{f.crop || '—'}</span>
                <span>{f.location || '—'}</span>
                <span style={{ ...S.tag, ...toneStyle('high') }}>high</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Farmers table */}
      <section style={S.section} data-testid="ngo-farmers">
        <h3 style={S.h3}>{farmHdr}</h3>
        {Array.isArray(farmers) && farmers.length > 0 ? (
          <div style={S.tableWrap}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>{resolve(t, 'ngo.dashboard.col.name',    'Name')}</th>
                  <th style={S.th}>{resolve(t, 'ngo.dashboard.col.location','Location')}</th>
                  <th style={S.th}>{resolve(t, 'ngo.dashboard.col.crop',    'Crop')}</th>
                  <th style={S.th}>{resolve(t, 'ngo.dashboard.col.risk',    'Risk')}</th>
                  <th style={S.th}>{resolve(t, 'ngo.dashboard.col.score',   'Score')}</th>
                  <th style={S.th}>{resolve(t, 'ngo.dashboard.col.status',  'Status')}</th>
                </tr>
              </thead>
              <tbody>
                {farmers.map((f) => (
                  <tr key={f.farmId}>
                    <td style={S.td}>{f.farmerName || `${String(f.farmId||'').slice(0,8)}\u2026`}</td>
                    <td style={S.td}>{f.location || '—'}</td>
                    <td style={S.td}>{f.crop || '—'}</td>
                    <td style={{ ...S.td, ...toneStyle(f.risk) }}>{f.risk}</td>
                    <td style={S.td}>{f.score}</td>
                    <td style={S.td}>{f.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <AdminEmptyState
            tone="positive"
            icon={'\u2713'}
            title={resolve(t, 'ngo.dashboard.empty.title', 'Nothing to review yet')}
            body={emptyLbl}
            testId="ngo-farmers-empty"
          />
        )}
      </section>

      <a
        href={`/api/admin/program-export${buildQuery(program)}`}
        style={S.exportBtn}
        data-testid="ngo-export-csv"
      >
        {expLbl}
      </a>
    </main>
  );
}

function Card({ label, value, tone }) {
  const toneExtra = tone === 'warning'
    ? { borderColor: 'rgba(245,158,11,0.5)', background: 'rgba(245,158,11,0.08)' }
    : null;
  return (
    <div style={{ ...S.card, ...toneExtra }}>
      <div style={S.cardLabel}>{label}</div>
      <div style={S.cardValue}>{value}</div>
    </div>
  );
}

function toneStyle(level) {
  switch (level) {
    case 'high':   return { background: 'rgba(239,68,68,0.15)',  color: '#FCA5A5' };
    case 'medium': return { background: 'rgba(245,158,11,0.15)', color: '#FDE68A' };
    default:       return { background: 'rgba(34,197,94,0.15)',  color: '#86EFAC' };
  }
}

const S = {
  page: {
    maxWidth: 72 * 10, margin: '0 auto', padding: '24px 20px 40px',
    minHeight: '100vh', background: '#0B1D34', color: '#fff',
    boxSizing: 'border-box',
  },
  title:  { margin: '0 0 8px', fontSize: 22, fontWeight: 700 },
  pickerRow: { display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 14px' },
  pickerLbl: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 600 },
  pickerSelect: {
    padding: '6px 10px', borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 14,
  },
  cardsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 10, marginTop: 6,
  },
  card: {
    padding: '0.875rem 1rem', borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
  },
  cardLabel: { fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 600 },
  cardValue: { fontSize: 22, fontWeight: 700, marginTop: 4 },
  section:   { marginTop: 18 },
  h3:        { fontSize: 15, fontWeight: 700, margin: '10px 0 8px' },
  muted:     { color: 'rgba(255,255,255,0.55)', fontSize: 14 },
  error: {
    padding: '10px 12px', borderRadius: 10,
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
    color: '#FCA5A5', fontSize: 14,
  },
  riskRow:  { display: 'flex', gap: 8, flexWrap: 'wrap' },
  riskPill: {
    padding: '6px 12px', borderRadius: 999, fontSize: 13, fontWeight: 700,
  },
  attnList: { listStyle: 'none', padding: 0, margin: 0 },
  attnRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr auto',
    gap: 8, padding: '6px 0',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    fontSize: 13,
  },
  tag: { padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700 },
  tableWrap: { overflowX: 'auto', marginTop: 6 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: {
    textAlign: 'left', padding: '6px 10px',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    fontWeight: 600, color: 'rgba(255,255,255,0.8)',
  },
  td: {
    padding: '6px 10px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    color: 'rgba(255,255,255,0.85)',
  },
  exportBtn: {
    display: 'inline-block', marginTop: 16,
    padding: '8px 14px', borderRadius: 10,
    background: '#22C55E', color: '#fff', fontWeight: 700,
    textDecoration: 'none', fontSize: 14,
  },
};
