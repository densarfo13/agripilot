import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n/index.js';
import {
  getQueueStats, listAllEntries, listFailedEntries,
  retryOne, retryAllFailed, dismissEntry, drainAll,
} from '../lib/sync/queueInspector.js';
import { makeTransport } from '../lib/sync/transport.js';

/**
 * AdminSyncQueuePage — ops surface for the offline action queue.
 *
 * Shows pending / failed / synced counts + per-type breakdown, the
 * raw entries with their status, and controls to retry individual
 * rows, retry all failed, drain everything, or dismiss a stuck entry.
 *
 * Role-gated upstream to ADMIN_ROLES (super_admin +
 * institutional_admin) via the App.jsx route wiring. This page
 * doesn't re-check roles — it just reads/writes localStorage.
 */
export default function AdminSyncQueuePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [stats, setStats]     = useState(() => getQueueStats());
  const [entries, setEntries] = useState(() => listAllEntries());
  const [filter, setFilter]   = useState('all');   // all | pending | failed | synced
  const [busy, setBusy]       = useState(null);    // null | 'drain' | 'retryAll' | <entryId>
  const [lastReport, setLastReport] = useState(null);

  const tr = (k, fb) => {
    const v = t(k);
    return v && v !== k ? v : fb;
  };

  const refresh = useCallback(() => {
    setStats(getQueueStats());
    setEntries(listAllEntries());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    if (filter === 'pending') return entries.filter((e) => e && !e.synced);
    if (filter === 'failed')  return entries.filter((e) => e && !e.synced && (e.attempts || 0) > 0);
    if (filter === 'synced')  return entries.filter((e) => e && e.synced);
    return entries;
  }, [entries, filter]);

  const handleDrainAll = async () => {
    setBusy('drain'); setLastReport(null);
    try {
      const report = await drainAll({ transport: makeTransport() });
      setLastReport(report);
    } finally {
      refresh(); setBusy(null);
    }
  };

  const handleRetryAll = async () => {
    setBusy('retryAll'); setLastReport(null);
    try {
      const report = await retryAllFailed({ transport: makeTransport() });
      setLastReport(report);
    } finally {
      refresh(); setBusy(null);
    }
  };

  const handleRetryOne = async (id) => {
    setBusy(id); setLastReport(null);
    try {
      const out = await retryOne(id, { transport: makeTransport() });
      setLastReport({ singleId: id, ...out });
    } finally {
      refresh(); setBusy(null);
    }
  };

  const handleDismiss = (id) => {
    if (!window.confirm(tr('admin.syncQueue.confirmDismiss',
                         'Remove this entry from the queue? It will not be retried.'))) return;
    dismissEntry(id);
    refresh();
  };

  const styles = useMemo(() => buildStyles(), []);

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <button style={styles.backBtn} onClick={() => navigate(-1)}>
          ← {tr('common.back', 'Back')}
        </button>
        <h1 style={styles.title}>
          {tr('admin.syncQueue.title', 'Sync queue')}
        </h1>
        <div style={styles.headerActions}>
          <button style={styles.primaryBtn}
                  onClick={handleDrainAll}
                  disabled={busy === 'drain' || stats.pending === 0}
                  data-testid="sync-queue-drain">
            {busy === 'drain'
              ? tr('admin.syncQueue.draining', 'Draining…')
              : tr('admin.syncQueue.drainAll', 'Drain all pending')}
          </button>
          <button style={styles.ghostBtn}
                  onClick={handleRetryAll}
                  disabled={busy === 'retryAll' || stats.failed === 0}
                  data-testid="sync-queue-retry-all">
            {busy === 'retryAll'
              ? tr('admin.syncQueue.retrying', 'Retrying…')
              : tr('admin.syncQueue.retryFailed', 'Retry failed')}
          </button>
          <button style={styles.ghostBtn} onClick={refresh}>
            {tr('common.refresh', 'Refresh')}
          </button>
        </div>
      </header>

      {/* Summary tiles */}
      <section style={styles.tiles}>
        <Tile label={tr('admin.syncQueue.tile.total',   'Total entries')}
              value={stats.total} styles={styles} />
        <Tile label={tr('admin.syncQueue.tile.pending', 'Pending')}
              value={stats.pending} accent="#FCD34D" styles={styles} />
        <Tile label={tr('admin.syncQueue.tile.failed',  'Failed')}
              value={stats.failed} accent="#FCA5A5" styles={styles} />
        <Tile label={tr('admin.syncQueue.tile.synced',  'Synced')}
              value={stats.synced} accent="#86EFAC" styles={styles} />
        <Tile label={tr('admin.syncQueue.tile.oldest',  'Oldest pending')}
              value={stats.oldestPendingAt
                ? new Date(stats.oldestPendingAt).toLocaleString()
                : '—'}
              styles={styles} />
      </section>

      {/* By-type breakdown */}
      {stats.byType.length > 0 && (
        <section style={styles.card} data-testid="sync-queue-by-type">
          <h3 style={styles.cardTitle}>
            {tr('admin.syncQueue.byType', 'Pending by type')}
          </h3>
          <ul style={styles.byTypeList}>
            {stats.byType.map((row) => (
              <li key={row.type} style={styles.byTypeRow}>
                <code style={styles.typeCode}>{row.type}</code>
                <span>{row.pending} {tr('admin.syncQueue.pending', 'pending')}</span>
                {row.failed > 0 && (
                  <span style={styles.failedChip}>{row.failed} {tr('admin.syncQueue.failed', 'failed')}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Last report (shown after drain / retry) */}
      {lastReport && (
        <section style={{ ...styles.card, borderColor: 'rgba(34,197,94,0.3)' }}
                 data-testid="sync-queue-last-report">
          <h3 style={styles.cardTitle}>
            {tr('admin.syncQueue.lastReport', 'Last run result')}
          </h3>
          <pre style={styles.reportPre}>{JSON.stringify(lastReport, null, 2)}</pre>
        </section>
      )}

      {/* Filter + entry table */}
      <section style={styles.card}>
        <header style={styles.filterHeader}>
          <h3 style={styles.cardTitle}>
            {tr('admin.syncQueue.entries', 'Entries')}
          </h3>
          <div style={styles.filterGroup}>
            {['all', 'pending', 'failed', 'synced'].map((f) => (
              <button key={f}
                      onClick={() => setFilter(f)}
                      style={filter === f ? styles.filterBtnActive : styles.filterBtn}
                      data-testid={`sync-queue-filter-${f}`}>
                {tr(`admin.syncQueue.filter.${f}`, f)}
              </button>
            ))}
          </div>
        </header>
        {filtered.length === 0 ? (
          <div style={styles.empty} data-testid="sync-queue-empty">
            {tr('admin.syncQueue.empty', 'No entries match this filter.')}
          </div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>{tr('admin.syncQueue.col.type',      'Type')}</th>
                  <th style={styles.th}>{tr('admin.syncQueue.col.farm',      'Farm')}</th>
                  <th style={styles.th}>{tr('admin.syncQueue.col.createdAt', 'Queued at')}</th>
                  <th style={styles.th}>{tr('admin.syncQueue.col.attempts',  'Attempts')}</th>
                  <th style={styles.th}>{tr('admin.syncQueue.col.status',    'Status')}</th>
                  <th style={styles.th}>{tr('admin.syncQueue.col.actions',   'Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => {
                  const status = e.synced
                    ? { label: tr('admin.syncQueue.statuses.synced', 'synced'), color: '#86EFAC' }
                    : (e.attempts || 0) > 0
                      ? { label: tr('admin.syncQueue.statuses.failed',  'failed'),  color: '#FCA5A5' }
                      : { label: tr('admin.syncQueue.statuses.pending', 'pending'), color: '#FCD34D' };
                  return (
                    <tr key={e.id} style={styles.tr}
                        data-testid={`sync-queue-row-${e.id}`}>
                      <td style={styles.td}><code style={styles.typeCode}>{e.type}</code></td>
                      <td style={styles.td}>{e.farmId || '—'}</td>
                      <td style={styles.td}>
                        {e.createdAt ? new Date(e.createdAt).toLocaleString() : '—'}
                      </td>
                      <td style={styles.td}>
                        {e.attempts || 0}
                        {e.lastError && (
                          <div style={styles.lastError} title={e.lastError}>
                            {e.lastError}
                          </div>
                        )}
                      </td>
                      <td style={styles.td}>
                        <span style={{
                          ...styles.statusChip, color: status.color,
                          background: `${status.color}22`,
                        }}>{status.label}</span>
                      </td>
                      <td style={styles.td}>
                        {!e.synced && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button style={styles.smallBtn}
                                    disabled={busy === e.id}
                                    onClick={() => handleRetryOne(e.id)}
                                    data-testid={`sync-queue-retry-${e.id}`}>
                              {busy === e.id ? '…' : tr('admin.syncQueue.retry', 'Retry')}
                            </button>
                            <button style={styles.smallGhost}
                                    onClick={() => handleDismiss(e.id)}
                                    data-testid={`sync-queue-dismiss-${e.id}`}>
                              {tr('admin.syncQueue.dismiss', 'Dismiss')}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Tile({ label, value, accent, styles }) {
  return (
    <div style={{ ...styles.tile, ...(accent ? { borderColor: accent } : {}) }}>
      <div style={styles.tileLabel}>{label}</div>
      <div style={{ ...styles.tileValue, ...(accent ? { color: accent } : {}) }}>
        {value}
      </div>
    </div>
  );
}

function buildStyles() {
  return {
    page: {
      padding: 16, maxWidth: 1200, margin: '0 auto',
      display: 'flex', flexDirection: 'column', gap: 16,
      background: '#0B1D34', minHeight: '100vh', color: '#E6F4EA',
    },
    header: {
      display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
    },
    backBtn: {
      padding: '6px 12px', borderRadius: 8,
      border: '1px solid rgba(255,255,255,0.12)', background: 'transparent',
      color: '#E6F4EA', cursor: 'pointer', fontSize: 13,
    },
    title: { margin: 0, fontSize: 18, fontWeight: 700 },
    headerActions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
    primaryBtn: {
      padding: '8px 12px', borderRadius: 8, border: 'none',
      background: '#22C55E', color: '#0B1D34',
      fontWeight: 700, fontSize: 13, cursor: 'pointer',
    },
    ghostBtn: {
      padding: '8px 12px', borderRadius: 8,
      border: '1px solid rgba(255,255,255,0.16)',
      background: 'transparent', color: '#E6F4EA',
      fontSize: 13, cursor: 'pointer',
    },
    tiles: {
      display: 'grid', gap: 12,
      gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
    },
    tile: {
      padding: 14, borderRadius: 12,
      background: 'rgba(255,255,255,0.04)',
      border: '2px solid rgba(255,255,255,0.08)',
    },
    tileLabel: { fontSize: 11, color: 'rgba(230,244,234,0.65)',
                  textTransform: 'uppercase', letterSpacing: 0.3 },
    tileValue: { fontSize: 24, fontWeight: 800, marginTop: 4 },
    card: {
      padding: 16, borderRadius: 14,
      background: 'linear-gradient(180deg, #0F233E 0%, #0B1D34 100%)',
      border: '1px solid rgba(255,255,255,0.06)',
    },
    cardTitle: { margin: '0 0 8px 0', fontSize: 15, fontWeight: 700 },
    byTypeList: { listStyle: 'none', margin: 0, padding: 0,
                   display: 'flex', flexDirection: 'column', gap: 6 },
    byTypeRow:  { display: 'flex', alignItems: 'center', gap: 12,
                   padding: 8, borderRadius: 8,
                   background: 'rgba(255,255,255,0.04)' },
    typeCode:   { fontFamily: 'monospace', color: '#7DD3FC', fontSize: 12 },
    failedChip: {
      padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700,
      background: 'rgba(239,68,68,0.18)', color: '#FCA5A5',
    },
    filterHeader: { display: 'flex', alignItems: 'center',
                     justifyContent: 'space-between', marginBottom: 10 },
    filterGroup: { display: 'flex', gap: 4 },
    filterBtn: {
      padding: '4px 10px', borderRadius: 6,
      border: '1px solid rgba(255,255,255,0.12)', background: 'transparent',
      color: 'rgba(230,244,234,0.75)', fontSize: 12, cursor: 'pointer',
      textTransform: 'capitalize',
    },
    filterBtnActive: {
      padding: '4px 10px', borderRadius: 6,
      border: '1px solid #22C55E66', background: 'rgba(34,197,94,0.2)',
      color: '#86EFAC', fontSize: 12, cursor: 'pointer', fontWeight: 600,
      textTransform: 'capitalize',
    },
    empty: {
      padding: 16, borderRadius: 10, fontSize: 13,
      color: 'rgba(230,244,234,0.55)',
      background: 'rgba(255,255,255,0.03)',
      border: '1px dashed rgba(255,255,255,0.14)',
    },
    tableWrap: { overflowX: 'auto' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
    th: { padding: 8, textAlign: 'left', color: 'rgba(230,244,234,0.55)',
           borderBottom: '1px solid rgba(255,255,255,0.08)',
           textTransform: 'uppercase', letterSpacing: 0.3, fontSize: 10 },
    tr: {},
    td: { padding: 8, borderBottom: '1px solid rgba(255,255,255,0.06)' },
    statusChip: {
      padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: 0.3,
    },
    smallBtn: {
      padding: '4px 8px', borderRadius: 6, border: 'none',
      background: '#22C55E', color: '#0B1D34',
      fontSize: 11, fontWeight: 600, cursor: 'pointer',
    },
    smallGhost: {
      padding: '4px 8px', borderRadius: 6,
      border: '1px solid rgba(239,68,68,0.4)', background: 'transparent',
      color: '#FCA5A5', fontSize: 11, cursor: 'pointer',
    },
    lastError: {
      fontSize: 11, color: '#FCA5A5', marginTop: 4,
      maxWidth: 220, overflow: 'hidden',
      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    },
    reportPre: {
      margin: 0, padding: 10, borderRadius: 8,
      background: 'rgba(0,0,0,0.3)', color: '#E6F4EA',
      fontSize: 11, overflow: 'auto',
    },
  };
}
