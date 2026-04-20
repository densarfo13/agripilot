/**
 * AdminDashboard — NGO/admin overview page at /admin.
 *
 * Fetches four aggregates from the backend (/api/admin/*) and
 * renders them in a single responsive layout. All copy goes
 * through t() with English fallback so other locales work the
 * moment the overlay ships.
 *
 * Error / loading / empty states are explicit — no silent blank
 * page. Export button is a direct link to the CSV endpoint.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from '../i18n/index.js';

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

export default function AdminDashboard() {
  const { t } = useTranslation();

  const [summary, setSummary] = useState(null);
  const [farmers, setFarmers] = useState(null);
  const [risk, setRisk]       = useState(null);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [s, f, r] = await Promise.all([
          fetchJson('/api/admin/summary'),
          fetchJson('/api/admin/farmers'),
          fetchJson('/api/admin/risk'),
        ]);
        if (!alive) return;
        setSummary(s); setFarmers(f); setRisk(r);
      } catch (e) {
        if (alive) setError(e?.message || 'Failed to load');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const title  = resolve(t, 'admin.dashboard.title',   'NGO Admin Dashboard');
  const lblTot = resolve(t, 'admin.dashboard.total',   'Total Farmers');
  const lblAct = resolve(t, 'admin.dashboard.active',  'Active (7d)');
  const lblNew = resolve(t, 'admin.dashboard.new',     'New (30d)');
  const lblCmp = resolve(t, 'admin.dashboard.completionRate', 'Completion');
  const riskT  = resolve(t, 'admin.dashboard.riskByRegion',   'Risk by Region');
  const farT   = resolve(t, 'admin.dashboard.farmers',        'Farmers');
  const expT   = resolve(t, 'admin.dashboard.exportCsv',      'Export CSV');
  const loadT  = resolve(t, 'admin.dashboard.loading',        'Loading dashboard\u2026');
  const emptyT = resolve(t, 'admin.dashboard.noData',         'No data yet.');
  const errLbl = resolve(t, 'admin.dashboard.error',          'Could not load dashboard');

  if (loading) {
    return <main style={S.page} data-screen="admin-dashboard">{loadT}</main>;
  }

  if (error) {
    return (
      <main style={S.page} data-screen="admin-dashboard" data-state="error">
        <h2 style={S.title}>{title}</h2>
        <p style={S.errorLine} role="alert">{errLbl}: {error}</p>
      </main>
    );
  }

  return (
    <main style={S.page} data-screen="admin-dashboard">
      <h2 style={S.title}>{title}</h2>

      {/* ─── Summary cards ──────────────────────────────── */}
      <section style={S.cardsRow}>
        <Card label={lblTot} value={summary?.totalFarmers ?? 0} />
        <Card label={lblAct} value={summary?.activeFarmers ?? 0} />
        <Card label={lblNew} value={summary?.newThisMonth ?? 0} />
        <Card
          label={lblCmp}
          value={`${Math.round((summary?.completionRate ?? 0) * 100)}%`}
        />
      </section>

      {/* ─── Risk by region ─────────────────────────────── */}
      <section style={S.section}>
        <h3 style={S.h3}>{riskT}</h3>
        {Array.isArray(risk) && risk.length > 0 ? (
          <ul style={S.riskList}>
            {risk.map((r, i) => (
              <li key={`${r.region}-${i}`} style={S.riskRow}>
                <span style={S.riskRegion}>{r.region}</span>
                <span style={{ ...S.riskBadge, ...riskStyleFor(r.risk) }}>
                  {resolve(t, `admin.dashboard.risk.${r.risk}`, r.risk)}
                </span>
                <span style={S.riskCount}>{r.farmers}</span>
              </li>
            ))}
          </ul>
        ) : <p style={S.muted}>{emptyT}</p>}
      </section>

      {/* ─── Farmers ───────────────────────────────────── */}
      <section style={S.section}>
        <h3 style={S.h3}>{farT}</h3>
        {Array.isArray(farmers) && farmers.length > 0 ? (
          <div style={S.tableWrap}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>{resolve(t, 'admin.dashboard.col.id',       'ID')}</th>
                  <th style={S.th}>{resolve(t, 'admin.dashboard.col.location', 'Location')}</th>
                  <th style={S.th}>{resolve(t, 'admin.dashboard.col.crop',     'Crop')}</th>
                  <th style={S.th}>{resolve(t, 'admin.dashboard.col.stage',    'Stage')}</th>
                  <th style={S.th}>{resolve(t, 'admin.dashboard.col.status',   'Status')}</th>
                </tr>
              </thead>
              <tbody>
                {farmers.map((f) => (
                  <tr key={f.id}>
                    <td style={S.td}>{`${String(f.id || '').slice(0, 8)}\u2026`}</td>
                    <td style={S.td}>{f.location || '—'}</td>
                    <td style={S.td}>{f.crop || '—'}</td>
                    <td style={S.td}>{f.stage || '—'}</td>
                    <td style={S.td}>{f.status || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p style={S.muted}>{emptyT}</p>}
      </section>

      <a
        href="/api/admin/export"
        style={S.exportBtn}
        data-testid="admin-export-csv"
      >
        {expT}
      </a>
    </main>
  );
}

function Card({ label, value }) {
  return (
    <div style={S.card}>
      <div style={S.cardLabel}>{label}</div>
      <div style={S.cardValue}>{value}</div>
    </div>
  );
}

function riskStyleFor(level) {
  switch (level) {
    case 'high':   return { background: 'rgba(239,68,68,0.15)',  color: '#FCA5A5' };
    case 'medium': return { background: 'rgba(245,158,11,0.15)', color: '#FDE68A' };
    default:       return { background: 'rgba(34,197,94,0.15)',  color: '#86EFAC' };
  }
}

const S = {
  page: {
    minHeight: '100vh', background: '#0B1D34', color: '#fff',
    padding: '1.25rem 1rem 2rem', maxWidth: '64rem', margin: '0 auto',
    boxSizing: 'border-box',
  },
  title: { fontSize: '1.5rem', fontWeight: 700, margin: '0 0 1rem' },
  h3:    { fontSize: '1.1rem', fontWeight: 600, margin: '1.5rem 0 0.5rem' },
  muted: { color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' },
  errorLine: {
    padding: '0.75rem', borderRadius: 10,
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
    color: '#FCA5A5', fontSize: '0.9rem',
  },
  section: { marginTop: '1rem' },
  cardsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '0.75rem',
  },
  card: {
    padding: '0.875rem 1rem', borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
  },
  cardLabel: { fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600 },
  cardValue: { fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem' },

  riskList: { listStyle: 'none', padding: 0, margin: 0 },
  riskRow:  {
    display: 'flex', alignItems: 'center', gap: '0.75rem',
    padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  riskRegion: { flex: 1, fontWeight: 600 },
  riskBadge:  {
    padding: '0.15rem 0.625rem', borderRadius: 999,
    fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase',
  },
  riskCount: { width: '3.5rem', textAlign: 'right', color: 'rgba(255,255,255,0.7)' },

  tableWrap: { overflowX: 'auto', marginTop: '0.5rem' },
  table: {
    width: '100%', borderCollapse: 'collapse',
    fontSize: '0.875rem',
  },
  th: {
    textAlign: 'left', padding: '0.5rem 0.75rem',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    fontWeight: 600, color: 'rgba(255,255,255,0.8)',
  },
  td: {
    padding: '0.5rem 0.75rem',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    color: 'rgba(255,255,255,0.85)',
  },

  exportBtn: {
    display: 'inline-block', marginTop: '1.5rem',
    padding: '0.625rem 1rem', borderRadius: 10,
    background: '#22C55E', color: '#fff', fontWeight: 700,
    textDecoration: 'none', fontSize: '0.95rem',
  },
};
