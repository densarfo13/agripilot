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
    return <main style={S.page} data-screen="ngo-dashboard">{resolve(t, 'common.loading', 'Loading\u2026')}</main>;
  }

  // Demo-safe soft recovery: when the dashboard endpoint fails and
  // we're in demo mode, swap the red banner for friendly copy + a
  // non-zero fallback summary. Production flow (non-demo) keeps the
  // original red error banner so real operators still see problems.
  if (error) {
    if (isDemoMode()) {
      const soft = friendlyErrorMessage('analytics');
      const fb = getFallbackNgoSummary();
      return (
        <main style={S.page} data-screen="ngo-dashboard" data-state="demo-fallback">
          <h2 style={S.title}>{title}</h2>
          <p style={S.muted} role="status" data-testid="ngo-soft-recovery">
            {resolve(t, soft.key, soft.fallback)}
          </p>
          <section style={S.cardsRow} data-testid="ngo-summary-fallback">
            <Card label={lblTot} value={fb.totalFarmers} />
            <Card label={lblAct} value={fb.activeFarmers} />
            <Card label={lblCmp} value={`${Math.round(fb.completionRate * 100)}%`} />
            <Card label={lblHi}  value={fb.highRiskFarmers} tone="warning" />
          </section>
        </main>
      );
    }
    return (
      <main style={S.page} data-screen="ngo-dashboard" data-state="error">
        <h2 style={S.title}>{title}</h2>
        <p style={S.error} role="alert">{errLbl}: {error}</p>
      </main>
    );
  }

  const highRiskFarmers = (farmers || []).filter((f) => f && f.risk === 'high');

  return (
    <main style={S.page} data-screen="ngo-dashboard">
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

      {/* Summary cards */}
      {summary && (
        <section style={S.cardsRow} data-testid="ngo-summary">
          <Card label={lblTot} value={summary.totalFarmers ?? 0} />
          <Card label={lblAct} value={summary.activeFarmers ?? 0} />
          <Card label={lblCmp} value={`${Math.round((summary.completionRate ?? 0) * 100)}%`} />
          <Card label={lblHi}  value={summary.highRiskFarmers ?? 0} tone="warning" />
        </section>
      )}

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
        ) : <p style={S.muted}>{emptyLbl}</p>}
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
