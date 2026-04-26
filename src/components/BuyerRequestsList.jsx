import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../i18n/index.js';
import { getCropLabel, getCropImage } from '../config/crops/index.js';
import {
  listMyBuyerRequests,
  fetchBulkLotStatus,
  REQUEST_STATUS,
} from '../lib/marketplace.js';

/**
 * BuyerRequestsList — "My requests" view for buyers.
 *
 * Lists every request this buyer has placed, grouped by status.
 * Read-only surface — buyers can't accept/decline their own
 * requests (that's the farmer side). Status updates in real time
 * after a farmer action when the component is re-mounted or the
 * explicit refresh button is tapped.
 *
 * Props
 *   buyerId  — required. The authenticated buyer's userId.
 *   status   — optional filter; defaults to 'all'
 *   compact  — tighter spacing
 *   maxRows  — clip the list (default 10)
 */
export default function BuyerRequestsList({
  buyerId,
  status = 'all',
  compact = true,
  maxRows = 10,
}) {
  const { t, lang } = useTranslation();
  const styles = useMemo(() => buildStyles(compact), [compact]);

  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  // Per-request bulk-status rollup. Keyed by requestId. Each entry
  // is either null (non-bulk / unknown) or { totalContributors,
  // accepted, declined, pending, parentStatus }.
  const [bulkById, setBulkById] = useState({});

  const tr = (k, fallback) => {
    const v = t(k);
    return v && v !== k ? v : fallback;
  };

  const load = useCallback(async () => {
    if (!buyerId) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const data = await listMyBuyerRequests(buyerId, { status });
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.code || 'load_failed');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [buyerId, status]);

  useEffect(() => { load(); }, [load]);

  // After rows load, fetch bulk rollups in parallel. Requests with
  // no associated bulk notifications (totalContributors === 0) stay
  // unmarked — the UI falls back to the standard single-request row.
  useEffect(() => {
    if (!Array.isArray(rows) || rows.length === 0) return;
    let cancelled = false;
    Promise.all(rows.map((r) => fetchBulkLotStatus(r.id)
      .then((status) => ({ id: r.id, status }))
      .catch(() => ({ id: r.id, status: null }))
    )).then((results) => {
      if (cancelled) return;
      const next = {};
      for (const { id, status } of results) {
        if (status && status.totalContributors > 0) next[id] = status;
      }
      setBulkById(next);
    });
    return () => { cancelled = true; };
  }, [rows]);

  const visible = rows.slice(0, maxRows);
  const hiddenCount = Math.max(0, rows.length - visible.length);

  return (
    <section style={styles.root}
             data-testid="buyer-requests"
             aria-label={tr('marketplace.myRequests.title', 'My requests')}>
      <header style={styles.header}>
        <h3 style={styles.title}>
          {tr('marketplace.myRequests.title', 'My requests')}
          {rows.length > 0 && (
            <span style={styles.countPill}>{rows.length}</span>
          )}
        </h3>
        <button type="button" onClick={load} style={styles.refreshBtn}
                aria-label="Refresh">↻</button>
      </header>

      {loading && (
        <div style={styles.info}>{tr('marketplace.loading', 'Loading…')}</div>
      )}
      {!loading && error && (
        <div style={styles.error} role="alert">
          {tr(`marketplace.err.${error}`, tr('marketplace.err.generic', 'Something went wrong.'))}
        </div>
      )}
      {!loading && !error && rows.length === 0 && (
        <div style={styles.empty}>
          {tr('marketplace.myRequests.empty',
            'No requests yet. Browse available crops and tap Request to connect with a farmer.')}
        </div>
      )}

      <ul style={styles.list}>
        {visible.map((row) => {
          const bulk = bulkById[row.id];
          return (
          <li key={row.id} style={styles.row}
              data-testid={`my-request-${row.id}`}>
            <img src={getCropImage(row.crop)} alt="" style={styles.thumb} />
            <div style={styles.rowMain}>
              <div style={styles.rowTitle}>
                {getCropLabelSafe(row.crop, lang)} · {row.quantity} kg
                {bulk && (
                  <span style={styles.bulkPill}
                        data-testid={`my-request-bulk-${row.id}`}>
                    {tr('marketplace.inbox.bulkPill', 'Bulk lot')}
                  </span>
                )}
              </div>
              {bulk && (
                <div style={styles.rowMeta}>
                  {bulk.accepted}/{bulk.totalContributors}{' '}
                  {tr('bulk.myRequest.acceptedOf', 'farmers accepted')}
                  {bulk.declined > 0 && `, ${bulk.declined} ${tr('bulk.myRequest.declined', 'declined')}`}
                  {bulk.pending > 0 && `, ${bulk.pending} ${tr('bulk.myRequest.pending', 'pending')}`}
                </div>
              )}
              {row.location && (
                <div style={styles.rowMeta}>
                  {tr('marketplace.inbox.pickupAt', 'Pickup at')}:{' '}
                  <strong>{row.location}</strong>
                </div>
              )}
              <div style={styles.rowMeta}>
                {row.region && (<span>{row.region} · </span>)}
                <StatusBadge status={row.status} tr={tr} />
              </div>
            </div>
          </li>
        );})}
      </ul>

      {hiddenCount > 0 && (
        <div style={styles.more}>
          +{hiddenCount} {tr('marketplace.more', 'more')}
        </div>
      )}
    </section>
  );
}

function StatusBadge({ status, tr }) {
  const tone =
    status === REQUEST_STATUS.ACCEPTED ? { bg: 'rgba(34,197,94,0.18)',   fg: '#86EFAC' }
  : status === REQUEST_STATUS.DECLINED ? { bg: 'rgba(239,68,68,0.16)',   fg: '#FCA5A5' }
                                        : { bg: 'rgba(252,211,77,0.18)', fg: '#FCD34D' };
  const label =
    status === REQUEST_STATUS.ACCEPTED ? tr('marketplace.status.accepted', 'Accepted')
  : status === REQUEST_STATUS.DECLINED ? tr('marketplace.status.declined', 'Declined')
                                        : tr('marketplace.status.pending',  'Pending');
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 999, fontSize: 11,
      background: tone.bg, color: tone.fg,
    }}>{label}</span>
  );
}

function buildStyles(compact) {
  const pad = compact ? 12 : 16;
  return {
    root: {
      display: 'flex', flexDirection: 'column', gap: 10, padding: pad,
      borderRadius: 16,
      background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)',
      border: '1px solid rgba(255,255,255,0.06)', color: '#E6F4EA',
    },
    header: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    },
    title:     { margin: 0, fontSize: 16, fontWeight: 700,
                 display: 'flex', alignItems: 'center', gap: 8 },
    countPill: {
      padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
      background: 'rgba(56,189,248,0.18)', color: '#7DD3FC',
    },
    refreshBtn: {
      padding: '4px 10px', borderRadius: 8,
      border: '1px solid rgba(255,255,255,0.12)',
      background: 'transparent', color: '#E6F4EA', cursor: 'pointer', fontSize: 14,
    },
    info:  { padding: 10, fontSize: 13, color: 'rgba(230,244,234,0.7)' },
    error: {
      padding: 10, borderRadius: 8, fontSize: 13, color: '#FEE2E2',
      background: 'rgba(239,68,68,0.16)', border: '1px solid rgba(239,68,68,0.32)',
    },
    empty: {
      padding: 12, borderRadius: 8, fontSize: 13,
      color: 'rgba(230,244,234,0.6)',
      background: 'rgba(255,255,255,0.03)',
      border: '1px dashed rgba(255,255,255,0.14)',
    },
    list: { listStyle: 'none', margin: 0, padding: 0,
            display: 'flex', flexDirection: 'column', gap: 8 },
    row: {
      display: 'flex', gap: 10, alignItems: 'center',
      padding: 10, borderRadius: 10,
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
    },
    thumb:   { width: 48, height: 48, borderRadius: 10, objectFit: 'cover' },
    rowMain: { flex: 1, minWidth: 0 },
    rowTitle:{ fontSize: 14, fontWeight: 600 },
    rowMeta: { fontSize: 12, color: 'rgba(230,244,234,0.7)', marginTop: 2 },
    more:    { fontSize: 12, color: 'rgba(230,244,234,0.55)',
               textAlign: 'center', padding: 4 },
    bulkPill: {
      padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700,
      background: 'rgba(56,189,248,0.22)', color: '#7DD3FC',
      textTransform: 'uppercase', letterSpacing: 0.3, marginLeft: 6,
    },
  };
}
