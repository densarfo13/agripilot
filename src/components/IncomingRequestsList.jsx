import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../i18n/index.js';
import { getCropLabel, getCropImage } from '../config/crops/index.js';
import {
  listIncomingRequestsForFarmer,
  acceptMarketplaceRequest,
  declineMarketplaceRequest,
  REQUEST_STATUS,
} from '../lib/marketplace.js';

/**
 * IncomingRequestsList — farmer-side inbox for buyer requests.
 *
 * Calls GET /api/marketplace/requests/incoming → each row is a
 * { request, listingId, buyerName, crop, quantity, notificationId,
 *   createdAt } object. Accept/decline buttons call the existing
 * PATCH /requests/:id/status endpoint; on success we reload the
 * inbox so the row either disappears (status filter) or updates
 * its badge in place (if the parent passed status='all').
 *
 * Props
 *   status    — 'pending' (default) | 'accepted' | 'declined' | 'all'
 *   compact   — tighter spacing for dashboard embed
 *   onChange  — optional () => void callback after accept/decline
 *               (parent can refresh sibling views like a counter)
 *   maxRows   — clip the rendered list (default 5); the API pulls
 *               100 so "View all" on a dedicated page shows more.
 */
const REFRESH_COOLDOWN_MS = 500;

export default function IncomingRequestsList({
  status = 'pending',
  compact = true,
  onChange = null,
  maxRows = 5,
}) {
  const { t, lang } = useTranslation();
  const styles = useMemo(() => buildStyles(compact), [compact]);

  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [busy, setBusy]       = useState(null);   // requestId being transitioned

  const tr = (k, fallback) => {
    const v = t(k);
    return v && v !== k ? v : fallback;
  };

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await listIncomingRequestsForFarmer({ status });
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.code || 'load_failed');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const handle = async (row, action) => {
    if (busy) return;
    setBusy(row.request.id); setError('');
    try {
      if (action === 'accept') {
        await acceptMarketplaceRequest(row.request.id, row.listingId);
      } else {
        await declineMarketplaceRequest(row.request.id);
      }
      // Give the DB a tick so the re-fetch reflects the update on
      // eventually-consistent read replicas.
      setTimeout(() => { load(); onChange && onChange(); }, REFRESH_COOLDOWN_MS);
    } catch (err) {
      setError(err.code || 'action_failed');
    } finally {
      setBusy(null);
    }
  };

  const visible = rows.slice(0, maxRows);
  const hiddenCount = Math.max(0, rows.length - visible.length);

  return (
    <section style={styles.root}
             data-testid="incoming-requests"
             aria-label={tr('marketplace.inbox.title', 'Buyer requests')}>
      <header style={styles.header}>
        <h3 style={styles.title}>
          {tr('marketplace.inbox.title', 'Buyer requests')}
          {rows.length > 0 && (
            <span style={styles.countPill}
                  data-testid="incoming-requests-count">{rows.length}</span>
          )}
        </h3>
        <button type="button" onClick={load} style={styles.refreshBtn}
                aria-label="Refresh">↻</button>
      </header>

      {loading && (
        <div style={styles.info}>{tr('marketplace.loading', 'Loading…')}</div>
      )}
      {!loading && error && (
        <div style={styles.error} role="alert" data-testid="incoming-error">
          {tr(`marketplace.err.${error}`, tr('marketplace.err.generic', 'Something went wrong.'))}
        </div>
      )}
      {!loading && !error && rows.length === 0 && (
        <div style={styles.empty} data-testid="incoming-empty">
          {tr('marketplace.inbox.empty',
            'No buyer requests yet. Your active listings are visible to buyers.')}
        </div>
      )}

      <ul style={styles.list}>
        {visible.map((row) => (
          <li key={row.request.id} style={styles.row}
              data-testid={`incoming-${row.request.id}`}>
            <img src={getCropImage(row.crop)} alt="" style={styles.thumb} />
            <div style={styles.rowMain}>
              <div style={styles.rowTitle}>
                {getCropLabel(row.crop, lang)} · {row.quantity} kg
                {row.isBulk && (
                  <span style={styles.bulkPill}
                        data-testid={`bulk-pill-${row.request.id}`}>
                    {tr('marketplace.inbox.bulkPill', 'Bulk lot')}
                  </span>
                )}
              </div>
              {row.isBulk && row.lotTotal && (
                <div style={styles.rowMeta}>
                  {tr('marketplace.inbox.bulkShare', 'Your share')}:{' '}
                  <strong>{row.quantity} kg</strong>{' '}
                  / {row.lotTotal} kg {tr('marketplace.inbox.bulkOf', 'across')}
                  {' '}{row.contributors || 1}{' '}
                  {tr('marketplace.inbox.bulkFarmers', 'farmers')}
                </div>
              )}
              <div style={styles.rowMeta}>
                {row.buyerName
                  ? (tr('marketplace.inbox.from', 'From') + ` ${row.buyerName}`)
                  : tr('marketplace.inbox.fromAnonymous', 'From a buyer')}
                {' · '}
                <StatusBadge status={row.request.status} tr={tr} />
              </div>
            </div>
            {row.request.status === REQUEST_STATUS.PENDING ? (
              <div style={styles.actions}>
                <button type="button" style={styles.acceptBtn}
                        disabled={busy === row.request.id}
                        onClick={() => handle(row, 'accept')}
                        data-testid={`accept-${row.request.id}`}>
                  {busy === row.request.id
                    ? tr('marketplace.working', '…')
                    : tr('marketplace.accept', 'Accept')}
                </button>
                <button type="button" style={styles.declineBtn}
                        disabled={busy === row.request.id}
                        onClick={() => handle(row, 'decline')}
                        data-testid={`decline-${row.request.id}`}>
                  {tr('marketplace.decline', 'Decline')}
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {hiddenCount > 0 && (
        <div style={styles.more} data-testid="incoming-more">
          {tr('marketplace.inbox.moreCount',
              `+${hiddenCount} more — open full list to see all`)
            .replace('{{n}}', String(hiddenCount))}
        </div>
      )}
    </section>
  );
}

function StatusBadge({ status, tr }) {
  const tone =
    status === REQUEST_STATUS.ACCEPTED ? { bg: 'rgba(34,197,94,0.18)',  fg: '#86EFAC' }
  : status === REQUEST_STATUS.DECLINED ? { bg: 'rgba(148,163,184,0.18)', fg: '#CBD5E1' }
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
      background: 'rgba(34,197,94,0.18)', color: '#86EFAC',
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
    actions: { display: 'flex', gap: 6 },
    acceptBtn: {
      padding: '6px 12px', borderRadius: 8, border: 'none',
      background: '#22C55E', color: '#0B1D34', fontWeight: 600,
      fontSize: 12, cursor: 'pointer',
    },
    declineBtn: {
      padding: '6px 12px', borderRadius: 8,
      border: '1px solid rgba(255,255,255,0.16)',
      background: 'transparent', color: '#E6F4EA',
      fontSize: 12, cursor: 'pointer',
    },
    more: {
      fontSize: 12, color: 'rgba(230,244,234,0.55)', textAlign: 'center',
      padding: 4,
    },
    bulkPill: {
      padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700,
      background: 'rgba(56,189,248,0.22)', color: '#7DD3FC',
      textTransform: 'uppercase', letterSpacing: 0.3, marginLeft: 6,
    },
  };
}
