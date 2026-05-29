/**
 * src/pages/organization/OnboardingBatchDetail.jsx — single
 * EnrollmentBatch inspector with row-level filters and actions.
 *
 *   Route: /organization/onboarding/batches/:batchId
 *   Gate:  RoleRoute wrapper at App.jsx level. Runtime probe
 *          window.__bulkOnboardingHealth() must return
 *          available:true; otherwise a Forbidden empty state
 *          renders (defence-in-depth).
 *
 *   Header        — batch summary (file, status, counts).
 *   Filter tabs   — All / Valid / Invalid / Duplicate /
 *                   Imported / Failed.
 *   Row table     — number, status, error message, duplicate
 *                   reason.
 *   Row actions   — Skip / Link to existing / Retry (admin only).
 *
 * Strict-rule audit
 *   • Pure render. SSR-safe.
 *   • All copy via tSafe.
 *   • Never crashes — every runtime read wrapped in try/catch.
 *   • No direct fetch calls — writes go through the API client.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { tSafe } from '../../i18n/tSafe.js';
import { useApiClient } from '../../hooks/useApiClient.js';

const STATUS_COLOR = {
  valid:        '#16A34A',
  invalid:      '#B91C1C',
  duplicate:    '#B45309',
  imported:     '#16A34A',
  failed:       '#B91C1C',
  needs_review: '#B45309',
};

const BATCH_STATUS_COLOR = {
  uploaded:     '#64748B',
  validating:   '#B45309',
  ready:        '#1D4ED8',
  importing:    '#B45309',
  completed:    '#16A34A',
  failed:       '#B91C1C',
  needs_review: '#B45309',
};

const FILTERS = [
  { key: 'all',       label: 'All'       },
  { key: 'valid',     label: 'Valid'     },
  { key: 'invalid',   label: 'Invalid'   },
  { key: 'duplicate', label: 'Duplicate' },
  { key: 'imported',  label: 'Imported'  },
  { key: 'failed',    label: 'Failed'    },
];

const S = {
  page: {
    minHeight: '100vh',
    background: '#F6F1E7',
    color: '#1F2933',
    padding: '20px 16px 96px',
    maxWidth: 1100,
    margin: '0 auto',
    boxSizing: 'border-box',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  header: { fontSize: 22, fontWeight: 800, margin: '0 0 4px' },
  sub:    { fontSize: 13, color: '#475569', margin: '0 0 18px' },
  empty:  { textAlign: 'center', padding: 60, color: '#64748B' },
  back: {
    fontSize: 12, color: '#475569', textDecoration: 'none',
    display: 'inline-block', marginBottom: 8,
  },
  summaryCard: {
    background: '#FFFFFF',
    border: '1px solid rgba(31,41,51,0.08)',
    borderRadius: 12,
    padding: '14px 16px',
    marginBottom: 14,
  },
  summaryTop: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', gap: 10, flexWrap: 'wrap',
    marginBottom: 8,
  },
  summaryTitle: { fontSize: 16, fontWeight: 800 },
  countsRow: {
    display: 'flex', gap: 8, flexWrap: 'wrap',
    marginTop: 6,
  },
  countPill: {
    fontSize: 12, fontWeight: 700,
    padding: '4px 10px', borderRadius: 999,
    background: 'rgba(31,41,51,0.06)',
    color: '#1F2933',
  },
  tabsRow: {
    display: 'flex', gap: 6, flexWrap: 'wrap',
    marginBottom: 10,
  },
  tab: {
    appearance: 'none',
    border: '1px solid rgba(31,41,51,0.12)',
    background: '#FFFFFF', color: '#1F2933',
    padding: '6px 12px', borderRadius: 999,
    fontSize: 12, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit',
  },
  tabActive: {
    background: '#C8944D', color: '#FFFFFF',
    borderColor: '#C8944D',
  },
  card: {
    background: '#FFFFFF',
    border: '1px solid rgba(31,41,51,0.08)',
    borderRadius: 12,
    padding: '12px 14px',
    marginBottom: 10,
    overflowX: 'auto',
  },
  table: {
    width: '100%', borderCollapse: 'collapse', fontSize: 12,
  },
  th: {
    textAlign: 'left', fontWeight: 700, color: '#475569',
    padding: '8px 10px',
    borderBottom: '1px solid rgba(31,41,51,0.1)',
    fontSize: 11, textTransform: 'uppercase',
    letterSpacing: '0.04em',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '8px 10px',
    borderBottom: '1px solid rgba(31,41,51,0.05)',
    verticalAlign: 'top',
  },
  statusPill: {
    fontSize: 10, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.05em',
    padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap',
  },
  actions: {
    display: 'flex', gap: 4, flexWrap: 'wrap',
  },
  miniBtn: {
    appearance: 'none', border: '1px solid rgba(31,41,51,0.16)',
    background: '#FFFFFF', color: '#1F2933',
    padding: '3px 8px', borderRadius: 6,
    fontSize: 10, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

function _safeProbe(name) {
  try {
    if (typeof window === 'undefined') return null;
    const fn = window[name];
    if (typeof fn !== 'function') return null;
    return fn();
  } catch { return null; }
}

function _readBatch(batchId) {
  try {
    if (typeof window === 'undefined') return null;
    const rt = window.bulkOnboardingRuntime;
    if (!rt) return null;
    if (typeof rt.getBatchSnapshot === 'function') {
      return rt.getBatchSnapshot(batchId);
    }
    if (typeof rt.getBatch === 'function') {
      return rt.getBatch(batchId);
    }
    return null;
  } catch { return null; }
}

function _isAdmin() {
  try {
    if (typeof window === 'undefined') return false;
    const rt = window.bulkOnboardingRuntime;
    if (rt && typeof rt.viewerIsAdmin === 'function') {
      return !!rt.viewerIsAdmin();
    }
    // Best-effort fallback — defer to the role probe.
    const r = _safeProbe('__bulkOnboardingHealth');
    return !!(r && r.viewerIsAdmin);
  } catch { return false; }
}

export default function OnboardingBatchDetailPage() {
  const { api: apiClient } = useApiClient();
  const { batchId } = useParams();
  const [filter, setFilter] = useState('all');
  const [tick, setTick] = useState(0);
  const [actionError, setActionError] = useState(null);

  const health = useMemo(() => _safeProbe('__bulkOnboardingHealth'), []);
  const available = health && health.available !== false;

  const batch = useMemo(
    () => _readBatch(batchId),
    [batchId, tick],
  );

  const admin = useMemo(() => _isAdmin(), [tick]);

  const rows = useMemo(() => {
    const list = (batch && Array.isArray(batch.rows)) ? batch.rows : [];
    if (filter === 'all') return list;
    return list.filter((r) => r && r.status === filter);
  }, [batch, filter]);

  const onRowAction = useCallback(async (rowId, action) => {
    setActionError(null);
    try {
      if (apiClient && typeof apiClient.post === 'function') {
        await apiClient.post(
          `/organization/onboarding/batches/${batchId}/rows/${rowId}/${action}`,
          {},
        );
      }
      setTick((t) => t + 1);
    } catch (e) {
      setActionError(String((e && e.message) || e));
    }
  }, [batchId, apiClient]);

  if (!available) {
    return (
      <main style={S.page}
        data-testid="organization-onboarding-batch-detail"
        data-forbidden="true">
        <h1 style={S.header}>
          {tSafe('orgOnboardingBatchDetail.title',
            'Onboarding batch')}
        </h1>
        <div style={S.empty}>
          {tSafe('orgOnboardingBatchDetail.forbidden',
            'This feature is not available for your account.')}
        </div>
      </main>
    );
  }

  if (!batch) {
    return (
      <main style={S.page}
        data-testid="organization-onboarding-batch-detail">
        <Link to="/organization/onboarding/batches" style={S.back}>
          {tSafe('orgOnboardingBatchDetail.back', '← Back to batches')}
        </Link>
        <h1 style={S.header}>
          {tSafe('orgOnboardingBatchDetail.title',
            'Onboarding batch')}
        </h1>
        <div style={S.empty}>
          {tSafe('orgOnboardingBatchDetail.notFound',
            'Batch not found.')}
        </div>
      </main>
    );
  }

  const status = (batch && batch.status) || 'unknown';
  const statusColor = BATCH_STATUS_COLOR[status] || '#475569';
  const counts = (batch && batch.counts) || {};

  return (
    <main style={S.page}
      data-testid="organization-onboarding-batch-detail">
      <Link to="/organization/onboarding/batches" style={S.back}
        data-testid="orgOnboardingBatchDetail-back">
        {tSafe('orgOnboardingBatchDetail.back', '← Back to batches')}
      </Link>

      <section style={S.summaryCard}
        data-testid="orgOnboardingBatchDetail-summary">
        <div style={S.summaryTop}>
          <div style={S.summaryTitle}>
            {(batch && (batch.fileName || batch.file_name)) || '—'}
          </div>
          <span style={{ ...S.statusPill,
                          background: statusColor + '22',
                          color: statusColor }}>
            {status}
          </span>
        </div>
        <div style={{ fontSize: 12, color: '#475569' }}>
          {tSafe('orgOnboardingBatchDetail.uploadedBy',
            'Uploaded by')}
          {': ' + ((batch.uploadedByName || batch.uploadedBy) || '—')}
        </div>
        <div style={S.countsRow}>
          {[
            ['total',      'Total',      counts.total],
            ['valid',      'Valid',      counts.valid],
            ['invalid',    'Invalid',    counts.invalid],
            ['duplicate',  'Duplicates',
              counts.duplicate != null ? counts.duplicate : counts.duplicates],
            ['imported',   'Imported',   counts.imported],
            ['failed',     'Failed',     counts.failed],
          ].map(([key, label, value]) => (
            <span key={key} style={S.countPill}
              data-testid={`orgOnboardingBatchDetail-count-${key}`}>
              {tSafe('orgOnboardingBatchDetail.count_' + key, label)}
              {': '}
              <strong>{Number(value || 0)}</strong>
            </span>
          ))}
        </div>
      </section>

      <div style={S.tabsRow}
        data-testid="orgOnboardingBatchDetail-tabs">
        {FILTERS.map(({ key, label }) => (
          <button key={key} type="button"
            style={filter === key
              ? { ...S.tab, ...S.tabActive }
              : S.tab}
            onClick={() => setFilter(key)}
            data-testid={`orgOnboardingBatchDetail-tab-${key}`}
            data-active={filter === key ? 'true' : 'false'}>
            {tSafe('orgOnboardingBatchDetail.tab_' + key, label)}
          </button>
        ))}
      </div>

      {actionError ? (
        <section style={{ ...S.card, borderColor: '#FCA5A5',
                           background: '#FEF2F2' }}
          data-testid="orgOnboardingBatchDetail-action-error">
          <div style={{ fontSize: 12, color: '#B91C1C' }}>
            {actionError}
          </div>
        </section>
      ) : null}

      {rows.length === 0 ? (
        <section style={S.card}
          data-testid="orgOnboardingBatchDetail-rows-empty">
          <div style={S.empty}>
            {tSafe('orgOnboardingBatchDetail.rowsEmpty',
              'No rows match this filter.')}
          </div>
        </section>
      ) : (
        <section style={S.card}
          data-testid="orgOnboardingBatchDetail-rows-card">
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>
                  {tSafe('orgOnboardingBatchDetail.colRow', 'Row')}
                </th>
                <th style={S.th}>
                  {tSafe('orgOnboardingBatchDetail.colStatus', 'Status')}
                </th>
                <th style={S.th}>
                  {tSafe('orgOnboardingBatchDetail.colError',
                    'Error message')}
                </th>
                <th style={S.th}>
                  {tSafe('orgOnboardingBatchDetail.colDupReason',
                    'Duplicate reason')}
                </th>
                <th style={S.th}>
                  {tSafe('orgOnboardingBatchDetail.colActions',
                    'Actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const rowId = (r && (r.id || ('row-' + r.rowIndex))) || '';
                const rstatus = (r && r.status) || 'unknown';
                const color = STATUS_COLOR[rstatus] || '#475569';
                return (
                  <tr key={rowId}
                    data-testid={`orgOnboardingBatchDetail-row-${rowId}`}>
                    <td style={S.td}>{r.rowIndex}</td>
                    <td style={S.td}>
                      <span style={{ ...S.statusPill,
                                     background: color + '22',
                                     color }}>
                        {rstatus}
                      </span>
                    </td>
                    <td style={S.td}>{r.errorMessage || '—'}</td>
                    <td style={S.td}>{r.duplicateReason || '—'}</td>
                    <td style={S.td}>
                      <div style={S.actions}>
                        <button type="button" style={S.miniBtn}
                          onClick={() => onRowAction(rowId, 'skip')}
                          data-testid={`orgOnboardingBatchDetail-action-skip-${rowId}`}>
                          {tSafe('orgOnboardingBatchDetail.actionSkip',
                            'Skip')}
                        </button>
                        <button type="button" style={S.miniBtn}
                          onClick={() => onRowAction(rowId, 'link')}
                          data-testid={`orgOnboardingBatchDetail-action-link-${rowId}`}>
                          {tSafe('orgOnboardingBatchDetail.actionLink',
                            'Link to existing')}
                        </button>
                        {admin ? (
                          <button type="button" style={S.miniBtn}
                            onClick={() => onRowAction(rowId, 'retry')}
                            data-testid={`orgOnboardingBatchDetail-action-retry-${rowId}`}>
                            {tSafe('orgOnboardingBatchDetail.actionRetry',
                              'Retry')}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
