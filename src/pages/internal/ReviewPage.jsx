/**
 * src/pages/internal/ReviewPage.jsx — Internal Human Review queue.
 *
 *   Route: /internal/review
 *   Gate:  localStorage.farroway_internal === '1'
 *
 * What this is
 * ────────────
 *   Read-mostly inspector for the in-memory review queue. Admin
 *   users can advance items through in_review / resolved / rejected.
 *   Normal users see an "internal only" empty state.
 *
 *   Driven entirely off the runtime — no fetch, no network.
 *
 * Strict-rule audit
 *   • Pure render. SSR-safe.
 *   • Never crashes — every runtime call wrapped in try/catch.
 *   • All copy via tSafe.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import { INTERNAL_FLAG_KEY } from '../../runtime/release/releaseLockContracts';
import {
  REVIEW_TYPES,
  REVIEW_STATUSES,
  listReviews,
  updateReviewStatus,
  reviewQueueSnapshot,
} from '../../runtime/review';

const TYPE_LABELS = {
  low_confidence_scan:   'Low-confidence Scan',
  evidence_needs_review: 'Evidence Needs Review',
  artifact_rejected:     'Artifact Rejected',
  buyer_dispute:         'Buyer Dispute',
  report_exception:      'Report Exception',
};

const STATUS_STYLES = {
  pending:   { bg: 'rgba(245,158,11,0.15)', color: '#B45309' },
  in_review: { bg: 'rgba(59,130,246,0.15)', color: '#1D4ED8' },
  resolved:  { bg: 'rgba(22,163,74,0.15)',  color: '#15803D' },
  rejected:  { bg: 'rgba(185,28,28,0.15)',  color: '#B91C1C' },
};

const S = {
  page: {
    minHeight: '100vh',
    background: '#F6F1E7',
    color: '#1F2933',
    padding: '20px 16px 96px',
    maxWidth: 960,
    margin: '0 auto',
    boxSizing: 'border-box',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  header: { fontSize: 22, fontWeight: 800, margin: '0 0 4px' },
  sub:    { fontSize: 13, color: '#475569', margin: '0 0 14px' },
  empty:  { textAlign: 'center', padding: 60, color: '#64748B' },
  topRow: {
    display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12,
    alignItems: 'center',
  },
  refresh: {
    appearance: 'none', border: 'none',
    background: '#C8944D', color: '#FFFFFF',
    padding: '8px 14px', borderRadius: 8,
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit',
  },
  groupCard: {
    background: '#FFFFFF',
    border: '1px solid rgba(31,41,51,0.08)',
    borderRadius: 12,
    padding: '12px 14px',
    marginBottom: 12,
  },
  groupTitle: {
    fontSize: 14, fontWeight: 700, color: '#1F2933',
    marginBottom: 8,
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemRow: {
    background: 'rgba(31,41,51,0.04)',
    borderRadius: 8,
    padding: '10px 12px',
    marginBottom: 8,
  },
  itemHeader: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'flex-start', gap: 8,
    marginBottom: 6,
  },
  itemMeta: {
    fontSize: 11, color: '#475569',
    fontFamily: 'ui-monospace, SFMono-Regular, monospace',
    wordBreak: 'break-all',
  },
  itemReason: {
    fontSize: 12, color: '#1F2933', marginTop: 4,
  },
  statusPill: {
    fontSize: 10, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.05em',
    padding: '3px 8px', borderRadius: 999,
    whiteSpace: 'nowrap',
  },
  actionsRow: {
    display: 'flex', gap: 6, flexWrap: 'wrap',
    marginTop: 8,
  },
  actionBtn: {
    appearance: 'none',
    background: '#FFFFFF',
    border: '1px solid rgba(31,41,51,0.15)',
    borderRadius: 6,
    padding: '4px 10px',
    fontSize: 11, fontWeight: 600,
    color: '#1F2933',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  snapshotRow: {
    display: 'flex', gap: 10, flexWrap: 'wrap',
    marginBottom: 12,
  },
  snapshotPill: {
    background: '#FFFFFF',
    border: '1px solid rgba(31,41,51,0.08)',
    borderRadius: 8,
    padding: '6px 10px',
    fontSize: 12, color: '#1F2933',
  },
};

function _isInternal() {
  try {
    if (typeof window === 'undefined') return false;
    return window.localStorage
            && window.localStorage.getItem(INTERNAL_FLAG_KEY) === '1';
  } catch { return false; }
}

function StatusBadge({ status }) {
  const cfg = STATUS_STYLES[status] || STATUS_STYLES.pending;
  return (
    <span style={{ ...S.statusPill, background: cfg.bg, color: cfg.color }}>
      {status}
    </span>
  );
}

export default function ReviewPage() {
  const [internal, setInternal] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => { setInternal(_isInternal()); }, []);

  const items = useMemo(() => {
    try { return listReviews({ status: 'pending', limit: 500 }) || []; }
    catch { return []; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const snapshot = useMemo(() => {
    try { return reviewQueueSnapshot(); }
    catch { return null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const grouped = useMemo(() => {
    const out = {};
    for (const t of REVIEW_TYPES) out[t] = [];
    for (const it of items) {
      if (it && typeof it.type === 'string' && out[it.type]) {
        out[it.type].push(it);
      }
    }
    return out;
  }, [items]);

  const onRefresh = useCallback(() => setTick((t) => t + 1), []);

  const onAdvance = useCallback((id, status) => {
    try { updateReviewStatus({ id, status }); }
    catch { /* swallow */ }
    setTick((t) => t + 1);
  }, []);

  if (!internal) {
    return (
      <main style={S.page} data-testid="review-internal-only">
        <h1 style={S.header}>
          {tSafe('review.title', 'Human Review Queue')}
        </h1>
        <div style={S.empty}>
          {tSafe('review.notInternal',
            'This page is internal-only. '
            + 'Set localStorage.farroway_internal = "1" to view.')}
        </div>
      </main>
    );
  }

  const hasAny = items.length > 0;

  return (
    <main style={S.page} data-testid="review-page">
      <h1 style={S.header}>
        {tSafe('review.title', 'Human Review Queue')}
      </h1>
      <p style={S.sub}>
        {tSafe('review.subtitle',
          'Pending items grouped by type. Admin-only advancement.')}
      </p>

      <div style={S.topRow}>
        <button type="button" style={S.refresh} onClick={onRefresh}
          data-testid="review-refresh">
          {tSafe('review.refresh', 'Refresh')}
        </button>
        {snapshot && (
          <div style={{ fontSize: 12, color: '#475569' }}>
            {snapshot.total} total
          </div>
        )}
      </div>

      {snapshot && (
        <div style={S.snapshotRow}>
          {REVIEW_STATUSES.map((s) => (
            <div key={s} style={S.snapshotPill}
              data-testid={'review-snapshot-' + s}>
              <strong>{(snapshot.byStatus && snapshot.byStatus[s]) || 0}</strong>
              {' '}{s}
            </div>
          ))}
        </div>
      )}

      {!hasAny && (
        <div style={S.empty} data-testid="review-empty">
          {tSafe('review.empty', 'Not enough data yet')}
        </div>
      )}

      {hasAny && REVIEW_TYPES.map((type) => {
        const list = grouped[type] || [];
        if (list.length === 0) return null;
        return (
          <section key={type} style={S.groupCard}
            data-testid={'review-group-' + type}>
            <div style={S.groupTitle}>
              <span>{TYPE_LABELS[type] || type}</span>
              <span style={{ fontSize: 12, color: '#475569' }}>
                {list.length} pending
              </span>
            </div>

            {list.map((item) => (
              <div key={item.id} style={S.itemRow}
                data-testid={'review-item-' + item.id}>
                <div style={S.itemHeader}>
                  <div style={S.itemMeta}>
                    <div><strong>id:</strong> {item.id}</div>
                    <div><strong>user:</strong> {item.userId || '—'}</div>
                    {item.organizationId && (
                      <div><strong>org:</strong> {item.organizationId}</div>
                    )}
                    {item.plantId && (
                      <div><strong>plant:</strong> {item.plantId}</div>
                    )}
                    {item.scanId && (
                      <div><strong>scan:</strong> {item.scanId}</div>
                    )}
                    {item.artifactId && (
                      <div><strong>artifact:</strong> {item.artifactId}</div>
                    )}
                    <div><strong>created:</strong> {item.createdAt || '—'}</div>
                  </div>
                  <StatusBadge status={item.status} />
                </div>

                {item.reason && (
                  <div style={S.itemReason}>{item.reason}</div>
                )}

                <div style={S.actionsRow}>
                  <button type="button" style={S.actionBtn}
                    onClick={() => onAdvance(item.id, 'in_review')}
                    data-testid={'review-action-in_review-' + item.id}>
                    {tSafe('review.action.inReview', 'Mark in review')}
                  </button>
                  <button type="button" style={S.actionBtn}
                    onClick={() => onAdvance(item.id, 'resolved')}
                    data-testid={'review-action-resolved-' + item.id}>
                    {tSafe('review.action.resolved', 'Resolve')}
                  </button>
                  <button type="button" style={S.actionBtn}
                    onClick={() => onAdvance(item.id, 'rejected')}
                    data-testid={'review-action-rejected-' + item.id}>
                    {tSafe('review.action.rejected', 'Reject')}
                  </button>
                </div>
              </div>
            ))}
          </section>
        );
      })}
    </main>
  );
}
