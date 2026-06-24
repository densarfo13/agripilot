/**
 * ScanObservabilityCard.jsx — SCAN_OBSERVABILITY_V1 admin dashboard.
 *
 * Total / successful / failed scans, average confidence, most-scanned
 * crops, most-common diseases + insects, and a CSV export. Reads
 * GET /api/admin/scan-observability (+ /export.csv). Honest empty state
 * ("No data yet"); pure render, never throws.
 */
import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
function _token() {
  return _safe(() => (typeof localStorage !== 'undefined'
    ? localStorage.getItem('farroway_token') : null), null);
}
function _authHeaders() {
  const tok = _token();
  return tok ? { Authorization: 'Bearer ' + tok } : {};
}

async function _fetchObs() {
  const res = await fetch('/api/admin/scan-observability', {
    method: 'GET', credentials: 'include', headers: _authHeaders(),
  });
  if (!res || !res.ok) throw new Error('http_' + (res ? res.status : 'none'));
  return res.json();
}

async function _downloadCsv() {
  await _safe(async () => {
    const res = await fetch('/api/admin/scan-observability/export.csv', {
      method: 'GET', credentials: 'include', headers: _authHeaders(),
    });
    if (!res || !res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'scan-observability.csv';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch { /* */ } }, 1000);
  }, undefined);
}

function _Stat({ label, value }) {
  return (
    <div style={S.stat}>
      <span style={S.statVal}>{value == null ? '—' : value}</span>
      <span style={S.statLbl}>{label}</span>
    </div>
  );
}
function _TopList({ title, rows, empty }) {
  const list = Array.isArray(rows) ? rows : [];
  return (
    <div style={S.topBox}>
      <p style={S.topTitle}>{title}</p>
      {list.length === 0 ? <p style={S.muted}>{empty}</p> : (
        <ol style={S.topOl}>
          {list.map((r, i) => (
            <li key={(r.value || i) + ''} style={S.topLi}>
              <span style={S.topVal}>{r.value}</span>
              <span style={S.topCount}>{r.count}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ScanObservabilityCardInner() {
  const [data, setData]   = React.useState(null);
  const [error, setError] = React.useState(null);
  const [busy, setBusy]   = React.useState(false);

  const load = React.useCallback(() => {
    setBusy(true);
    _fetchObs()
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e && e.message ? e.message : 'load_failed'))
      .finally(() => setBusy(false));
  }, []);
  React.useEffect(() => { load(); }, [load]);

  const t = _safe(() => (data && data.totals) || {}, {});
  const noData = !!data && (t.total === 0);

  return (
    <section style={S.card} data-testid="scan-observability-card">
      <header style={S.head}>
        <div>
          <p style={S.eyebrow}>{tSafe('scanObs.eyebrow', 'Scan Observability')}</p>
          <h3 style={S.title}>{tSafe('scanObs.title', 'Scan Analytics')}</h3>
        </div>
        <div style={S.actions}>
          <button type="button" style={S.btnGhost} disabled={busy} onClick={load}>
            {busy ? tSafe('scanObs.loading', 'Loading…') : tSafe('scanObs.refresh', 'Refresh')}
          </button>
          <button type="button" style={S.btn} onClick={_downloadCsv}
            data-testid="scan-observability-csv">
            {tSafe('scanObs.downloadCsv', 'Download CSV')}
          </button>
        </div>
      </header>

      {error ? <p style={S.error}>{tSafe('scanObs.error', 'Could not load analytics.')} ({error})</p> : null}
      {!data && !error ? <p style={S.muted}>{tSafe('scanObs.loading', 'Loading…')}</p> : null}
      {noData ? <p style={S.muted} data-testid="scan-observability-empty">{tSafe('scanObs.none', 'No data yet')}</p> : null}

      {data && !noData ? (
        <>
          <div style={S.statRow}>
            <_Stat label={tSafe('scanObs.total', 'Total scans')} value={t.total} />
            <_Stat label={tSafe('scanObs.successful', 'Successful')} value={t.successful} />
            <_Stat label={tSafe('scanObs.failed', 'Failed')} value={t.failed} />
            <_Stat label={tSafe('scanObs.successRate', 'Success rate')}
              value={t.successRate == null ? null : t.successRate + '%'} />
            <_Stat label={tSafe('scanObs.avgConfidence', 'Avg confidence')}
              value={t.avgConfidence == null ? null : t.avgConfidence + '%'} />
          </div>
          <div style={S.statRow}>
            <_Stat label={tSafe('scanObs.tasksCreated', 'Tasks created')} value={t.tasksCreated} />
            <_Stat label={tSafe('scanObs.plantsSaved', 'Plants saved')} value={t.plantsSaved} />
            <_Stat label={tSafe('scanObs.healthDetected', 'Disease detected')} value={t.healthDetected} />
            <_Stat label={tSafe('scanObs.insectDetected', 'Insect detected')} value={t.insectDetected} />
          </div>
          <div style={S.topRow}>
            <_TopList title={tSafe('scanObs.topCrops', 'Most scanned crops')}
              rows={data.mostScannedCrops} empty={tSafe('scanObs.none', 'No data yet')} />
            <_TopList title={tSafe('scanObs.topDiseases', 'Most common diseases')}
              rows={data.mostCommonDiseases} empty={tSafe('scanObs.none', 'No data yet')} />
            <_TopList title={tSafe('scanObs.topInsects', 'Most common insects')}
              rows={data.mostCommonInsects} empty={tSafe('scanObs.none', 'No data yet')} />
          </div>
        </>
      ) : null}
    </section>
  );
}

export default class ScanObservabilityCard extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow */ }
  render() {
    if (this.state.failed) return null;
    try { return <ScanObservabilityCardInner {...this.props} />; } catch { return null; }
  }
}

const S = {
  card: { border: '1px solid rgba(60,72,55,0.12)', borderRadius: 12,
    background: 'rgba(255,255,255,0.9)', padding: '14px 16px',
    display: 'flex', flexDirection: 'column', gap: 12, fontFamily: 'system-ui' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' },
  eyebrow: { margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'rgba(60,72,55,0.55)' },
  title: { margin: '2px 0 0', fontSize: 16, fontWeight: 800, color: '#1F2933' },
  actions: { display: 'flex', gap: 8 },
  btn: { minHeight: 34, padding: '0 14px', borderRadius: 8, border: 'none',
    background: '#2f7a3a', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  btnGhost: { minHeight: 34, padding: '0 12px', borderRadius: 8, border: '1px solid rgba(60,72,55,0.2)',
    background: 'transparent', color: '#2C3A26', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  error: { margin: 0, fontSize: 12, color: '#a13a3a' },
  muted: { margin: 0, fontSize: 13, color: 'rgba(60,72,55,0.6)' },
  statRow: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  stat: { flex: '1 1 84px', minWidth: 84, display: 'flex', flexDirection: 'column', gap: 2,
    padding: '10px 12px', borderRadius: 10, background: 'rgba(47,122,58,0.06)' },
  statVal: { fontSize: 20, fontWeight: 800, color: '#1F2933' },
  statLbl: { fontSize: 11, color: 'rgba(60,72,55,0.65)' },
  topRow: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  topBox: { flex: '1 1 160px', minWidth: 150, border: '1px solid rgba(60,72,55,0.08)',
    borderRadius: 10, padding: '10px 12px' },
  topTitle: { margin: '0 0 6px', fontSize: 12, fontWeight: 800, color: 'rgba(60,72,55,0.8)' },
  topOl: { margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: 3 },
  topLi: { display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12 },
  topVal: { color: '#1F2933' },
  topCount: { fontWeight: 700, color: '#2f7a3a' },
};
