/**
 * ProviderReliabilityCard.jsx — admin Production Health card.
 *
 * The P0+ Production Health Dashboard core: per-provider reliability over the last
 * 24h, composed from GET /api/admin/scan/reliability (the scorecard built on the
 * scan_provider_metrics table). Shows latency p50/p95/p99, success/error rate,
 * uptime, avg confidence, and the health status per provider.
 *
 * Honesty: a provider with no recorded calls shows "No data yet" (NO_DATA) — never
 * a fabricated 100% or 0ms. Pure render, never throws.
 */
import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
function _token() {
  return _safe(() => (typeof localStorage !== 'undefined' ? localStorage.getItem('farroway_token') : null), null);
}

async function _fetchReliability(hours) {
  const tok = _token();
  const res = await fetch('/api/admin/scan/reliability' + (hours ? ('?hours=' + hours) : ''), {
    method: 'GET', credentials: 'include',
    headers: tok ? { Authorization: 'Bearer ' + tok } : {},
  });
  if (!res || !res.ok) throw new Error('http_' + (res ? res.status : 'none'));
  return res.json();
}

const STATUS = {
  HEALTHY:               { color: '#2f7a3a', bg: 'rgba(47,122,58,0.10)' },
  HEALTHY_WITH_WARNINGS: { color: '#9a6a00', bg: 'rgba(154,106,0,0.12)' },
  DEGRADED:              { color: '#c0590f', bg: 'rgba(192,89,15,0.12)' },
  CRITICAL:              { color: '#a13a3a', bg: 'rgba(161,58,58,0.14)' },
  NO_DATA:               { color: '#5a6472', bg: 'rgba(90,100,114,0.08)' },
};
function _statusStyle(s) { return STATUS[s] || STATUS.NO_DATA; }

// Honest cell: a missing/null metric renders "—", never a fake number.
function _n(v, suffix) {
  if (v == null || (typeof v === 'number' && !Number.isFinite(v))) return '—';
  return String(v) + (suffix || '');
}

function ProviderReliabilityCardInner() {
  const [data, setData] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(() => {
    setBusy(true);
    _fetchReliability(24)
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e && e.message ? e.message : 'load_failed'))
      .finally(() => setBusy(false));
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const providers = _safe(() => (data && Array.isArray(data.providers)) ? data.providers : [], []);

  return (
    <div style={S.card} data-testid="provider-reliability-card">
      <div style={S.head}>
        <h2 style={S.title}>{tSafe('reliability.title', 'Provider reliability (24h)')}</h2>
        <button type="button" onClick={load} disabled={busy} style={S.refresh}>
          {busy ? tSafe('common.loading', 'Loading…') : tSafe('common.refresh', 'Refresh')}
        </button>
      </div>

      {error && (
        <p style={S.error}>{tSafe('reliability.error', 'Could not load reliability data.')} ({error})</p>
      )}

      {!error && providers.length === 0 && (
        <p style={S.empty}>
          {tSafe('reliability.noData', 'No scan calls recorded yet. Reliability appears here once farmers run real scans.')}
        </p>
      )}

      {providers.length > 0 && (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                {['Provider', 'Status', 'Calls', 'Success', 'Errors', 'p50', 'p95', 'p99', 'Uptime', 'Conf'].map((h) => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {providers.map((p) => {
                const st = _statusStyle(p.healthStatus || p.status);
                return (
                  <tr key={p.provider}>
                    <td style={S.td}>{p.provider}</td>
                    <td style={S.td}>
                      <span style={{ ...S.badge, color: st.color, background: st.bg }}>
                        {p.healthStatus || p.status || 'NO_DATA'}
                      </span>
                    </td>
                    <td style={S.td}>{_n(p.requestCount != null ? p.requestCount : p.calls)}</td>
                    <td style={S.td}>{_n(p.successRate, '%')}</td>
                    <td style={S.td}>{_n(p.errorCount != null ? p.errorCount : p.errors)}</td>
                    <td style={S.td}>{_n(p.latencyP50, 'ms')}</td>
                    <td style={S.td}>{_n(p.latencyP95, 'ms')}</td>
                    <td style={S.td}>{_n(p.latencyP99, 'ms')}</td>
                    <td style={S.td}>{_n(p.uptime, '%')}</td>
                    <td style={S.td}>{_n(p.avgConfidence, '%')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p style={S.foot}>
        {tSafe('reliability.foot', 'Health score is null with no data (never a fake 100). Source: scan_provider_metrics, last 24h.')}
      </p>
    </div>
  );
}

class _Boundary extends React.Component {
  constructor(p) { super(p); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div style={S.card}><p style={S.error}>{tSafe('reliability.unavailable', 'Reliability card unavailable.')}</p></div>;
    return this.props.children;
  }
}

export default function ProviderReliabilityCard() {
  return (<_Boundary><ProviderReliabilityCardInner /></_Boundary>);
}

const S = {
  card: { border: '1px solid rgba(20,40,30,0.12)', borderRadius: 14, padding: '16px 18px', background: '#fff' },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 },
  title: { margin: 0, fontSize: 16, fontWeight: 700, color: '#16261c' },
  refresh: { minHeight: 36, padding: '6px 12px', borderRadius: 9, border: '1px solid rgba(20,40,30,0.18)', background: '#f4f7f4', fontSize: 13, cursor: 'pointer' },
  error: { color: '#a13a3a', fontSize: 13, margin: '4px 0' },
  empty: { color: '#5a6472', fontSize: 13, margin: '6px 0', lineHeight: 1.5 },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '6px 8px', color: '#5a6472', fontWeight: 600, borderBottom: '1px solid rgba(20,40,30,0.10)', whiteSpace: 'nowrap' },
  td: { padding: '7px 8px', borderBottom: '1px solid rgba(20,40,30,0.06)', whiteSpace: 'nowrap', color: '#16261c' },
  badge: { padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700 },
  foot: { color: '#7a8470', fontSize: 11, marginTop: 10, lineHeight: 1.5 },
};
