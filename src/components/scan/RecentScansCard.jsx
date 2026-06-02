/**
 * RecentScansCard.jsx — server-backed Recent Scans surface.
 *
 * Scan Intelligence V2 §4 — closes audit gap "scan persistence is
 * localStorage-only; no cross-device history".
 *
 *   <RecentScansCard limit={6} />
 *
 * Reads /api/scan/history via ScanLearningRuntime.fetchScanHistory.
 * Self-hides when the endpoint returns an empty list (or the user
 * is signed out → endpoint returns 401 → fetchScanHistory returns []).
 *
 * Each row shows: photo · plant name · confidence percent · date.
 * Tapping a row navigates to /scan/result/:scanId for the detail
 * view (existing route).
 *
 * Pure render. Never throws.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { tSafe } from '../../i18n/tSafe.js';
import { fetchScanHistory } from '../../runtime/scanLearning/ScanLearningRuntime';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _formatDate(iso) {
  if (!iso) return '';
  return _safe(() => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString();
  }, '');
}

function _formatPct(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '';
  return Math.round(n) + '%';
}

function _confidenceColor(band) {
  if (band === 'high')   return '#2f7a3a';
  if (band === 'medium') return '#9a6a00';
  return '#a13a3a';
}

function RecentScansCardInner({ limit = 6 }) {
  const navigate = useNavigate();
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const data = await fetchScanHistory(limit);
      if (cancelled) return;
      setRows(Array.isArray(data) ? data : []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [limit]);

  if (!loading && rows.length === 0) return null;

  return (
    <section
      style={S.wrap}
      data-testid="recent-scans-card"
      data-consumes="scanHistory"
      data-surface="recent-scans">
      <h3 style={S.title}>
        {tSafe('recentScans.title', 'Recent Scans')}
      </h3>
      {loading && rows.length === 0 ? (
        <p style={S.empty}>
          {tSafe('recentScans.loading', 'Loading…')}
        </p>
      ) : null}
      <ul style={S.list}>
        {rows.map((r) => (
          <li key={r.scanId || r.createdAt}>
            <button
              type="button"
              style={S.row}
              onClick={() => _safe(() => navigate(
                '/scan/result/' + encodeURIComponent(r.scanId)
              ), null)}
              data-testid={'recent-scan-row-' + r.scanId}>
              {r.imageUrl ? (
                <img src={r.imageUrl} alt="" style={S.thumb} />
              ) : (
                <span style={S.thumbPlaceholder} aria-hidden="true">·</span>
              )}
              <span style={S.rowText}>
                <span style={S.rowTitle}>
                  {r.plantName || tSafe('recentScans.unknownPlant', 'Plant')}
                </span>
                <span style={S.rowMeta}>
                  {r.predictedIssue ? r.predictedIssue + ' · ' : ''}
                  <span style={{ color: _confidenceColor(r.confidence) }}>
                    {_formatPct(r.confidencePct)}
                  </span>
                  {' · '}
                  {_formatDate(r.createdAt)}
                </span>
              </span>
              {r.userConfirmed ? (
                <span style={S.confirmed} title="Confirmed">✓</span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default class RecentScansCard extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow */ }
  render() {
    if (this.state.failed) return null;
    try { return <RecentScansCardInner {...this.props} />; }
    catch { return null; }
  }
}

const S = {
  wrap: {
    background: 'rgba(255,255,255,0.95)',
    border: '1px solid rgba(60,72,55,0.10)',
    borderRadius: 14,
    padding: '14px 16px',
    display: 'flex', flexDirection: 'column', gap: 10,
    fontFamily: 'system-ui',
  },
  title: {
    margin: 0, fontSize: 13, fontWeight: 700,
    color: 'rgba(40,52,40,0.95)',
    letterSpacing: '0.04em', textTransform: 'uppercase',
  },
  list: {
    listStyle: 'none', margin: 0, padding: 0,
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  row: {
    appearance: 'none',
    border: '1px solid rgba(60,72,55,0.10)',
    background: 'rgba(255,255,255,0.85)',
    borderRadius: 10,
    padding: '10px 12px',
    display: 'flex', alignItems: 'center', gap: 10,
    cursor: 'pointer', textAlign: 'left',
    fontFamily: 'inherit', width: '100%',
  },
  thumb: {
    width: 44, height: 44, borderRadius: 8,
    objectFit: 'cover', flexShrink: 0,
  },
  thumbPlaceholder: {
    width: 44, height: 44, borderRadius: 8,
    background: 'rgba(60,72,55,0.06)', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18, color: 'rgba(60,72,55,0.4)',
  },
  rowText: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' },
  rowTitle: {
    fontSize: 13, fontWeight: 700, color: '#1F2933',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  rowMeta: { fontSize: 11, color: 'rgba(60,72,55,0.65)', marginTop: 2 },
  confirmed: { fontSize: 16, color: '#2f7a3a', fontWeight: 800 },
  empty: { fontSize: 12, color: 'rgba(60,72,55,0.55)', margin: 0 },
};
