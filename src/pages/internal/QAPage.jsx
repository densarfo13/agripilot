/**
 * src/pages/internal/QAPage.jsx — Internal-only QA Readiness
 * cross-device checklist dashboard.
 *
 *   Route: /internal/qa
 *   Gate:  localStorage.farroway_internal === '1'
 *
 * What this is
 * ────────────
 *   Renders the live QA Readiness verdict plus the 27-item
 *   manual checklist grouped by device (iPhone Safari, Android
 *   Chrome, installed PWA). Each item has PASS / FAIL / PENDING
 *   radio buttons that persist to localStorage via the runtime.
 *
 *   Normal users never see this — the page renders an
 *   "Internal only" empty state when the flag is absent.
 *
 * Strict-rule audit
 *   • Pure render. Reads + writes localStorage only via the
 *     runtime's gated helpers.
 *   • All copy via tSafe.
 *   • Never crashes — every read wrapped in try/catch.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import {
  qaReadiness,
  loadManualChecks,
  setManualCheck,
  DEVICE_QA_CHECKLIST,
  DEVICE_KINDS,
  DEVICE_LABELS,
  CHECK_STATUSES,
} from '../../runtime/qa/index';
import { INTERNAL_FLAG_KEY } from '../../runtime/release/releaseLockContracts';

const VERDICT_BG = {
  READY:   '#DCFCE7',
  PENDING: '#FEF3C7',
  FAILED:  '#FEE2E2',
};
const VERDICT_FG = {
  READY:   '#166534',
  PENDING: '#92400E',
  FAILED:  '#B91C1C',
};

const STATUS_COLOR = {
  passed:  '#16A34A',
  failed:  '#B91C1C',
  pending: '#64748B',
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
  verdictCard: {
    borderRadius: 14,
    padding: '14px 16px',
    marginBottom: 14,
  },
  verdictRow: {
    display: 'flex', alignItems: 'center', gap: 12,
    flexWrap: 'wrap',
  },
  verdictBadge: {
    fontSize: 24, fontWeight: 800, letterSpacing: '0.04em',
  },
  scorePill: {
    fontSize: 13, fontWeight: 700,
    padding: '4px 10px', borderRadius: 999,
    background: 'rgba(31,41,51,0.06)',
  },
  flagRow: {
    fontSize: 12, color: '#475569', marginTop: 6,
    display: 'flex', flexWrap: 'wrap', gap: 8,
  },
  flagPill: {
    fontSize: 11, fontWeight: 700,
    padding: '3px 8px', borderRadius: 999,
    background: 'rgba(31,41,51,0.06)',
  },
  card: {
    background: '#FFFFFF',
    border: '1px solid rgba(31,41,51,0.08)',
    borderRadius: 12,
    padding: '12px 14px',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12, fontWeight: 700, color: '#475569',
    textTransform: 'uppercase', letterSpacing: '0.06em',
    marginTop: 14, marginBottom: 6,
  },
  itemRow: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    padding: '8px 0',
    borderBottom: '1px solid rgba(31,41,51,0.05)',
    fontSize: 13,
  },
  itemLabel: { flex: 1, color: '#1F2933' },
  itemId: { fontSize: 10, color: '#94A3B8',
              fontFamily: 'ui-monospace, monospace' },
  statusPill: {
    fontSize: 10, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.05em',
    padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap',
  },
  radioRow: {
    display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap',
  },
  radioLabel: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    fontSize: 12, color: '#1F2933',
    padding: '2px 8px', borderRadius: 999,
    background: 'rgba(31,41,51,0.04)',
    cursor: 'pointer',
  },
  cta: {
    appearance: 'none', border: 'none',
    background: '#C8944D', color: '#FFFFFF',
    padding: '8px 14px', borderRadius: 8,
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit', marginRight: 8,
  },
  empty: {
    textAlign: 'center', padding: 60, color: '#64748B',
  },
};

function _isInternal() {
  try {
    if (typeof window === 'undefined') return false;
    return window.localStorage
            && window.localStorage.getItem(INTERNAL_FLAG_KEY) === '1';
  } catch { return false; }
}

function _statusLabel(status) {
  if (status === 'passed') return 'PASS';
  if (status === 'failed') return 'FAIL';
  return 'PENDING';
}

export default function QAPage() {
  const [tick, setTick] = useState(0);
  const [internal, setInternal] = useState(false);

  useEffect(() => { setInternal(_isInternal()); }, []);

  const readiness = useMemo(() => {
    try { return qaReadiness(); }
    catch {
      return {
        verdict: 'PENDING',
        scanFlowPassed: false,
        offlineFlowPassed: false,
        reconnectPassed: false,
        duplicatePreventionPassed: false,
        perDeviceSummary: {},
        totals: { total: 0, passed: 0, failed: 0, pending: 0 },
      };
    }
  }, [tick]);

  const checks = useMemo(() => {
    try { return loadManualChecks(); }
    catch { return {}; }
  }, [tick]);

  const onMark = useCallback((id, status) => {
    try { setManualCheck(id, status); } catch { /* ignore */ }
    setTick((t) => t + 1);
  }, []);

  const onRefresh = useCallback(() => setTick((t) => t + 1), []);

  if (!internal) {
    return (
      <main style={S.page} data-testid="qa-internal-only">
        <h1 style={S.header}>
          {tSafe('qa.title', 'QA Readiness')}
        </h1>
        <div style={S.empty}>
          {tSafe('qa.notInternal',
            'Internal only. '
            + 'Set localStorage.farroway_internal = "1" to view.')}
        </div>
      </main>
    );
  }

  const verdict = (readiness && readiness.verdict) || 'PENDING';
  const totals  = (readiness && readiness.totals)  || {
    total: 0, passed: 0, failed: 0, pending: 0 };

  return (
    <main style={S.page} data-testid="qa-page"
      data-verdict={verdict}>
      <h1 style={S.header}>
        {tSafe('qa.title', 'Farroway QA Readiness')}
      </h1>
      <p style={S.sub}>
        {tSafe('qa.subtitle',
          'Cross-device manual QA sweep — iPhone Safari, '
          + 'Android Chrome, installed PWA.')}
      </p>

      <section style={{ ...S.verdictCard,
                         background: VERDICT_BG[verdict],
                         color: VERDICT_FG[verdict] }}
        data-testid="qa-verdict">
        <div style={S.verdictRow}>
          <div style={S.verdictBadge}>{verdict}</div>
          <div style={S.scorePill}>
            {tSafe('qa.passed', 'Passed')}: {totals.passed} / {totals.total}
          </div>
          <div style={S.scorePill}>
            {tSafe('qa.failed', 'Failed')}: {totals.failed}
          </div>
          <div style={S.scorePill}>
            {tSafe('qa.pending', 'Pending')}: {totals.pending}
          </div>
        </div>
        <div style={S.flagRow}>
          <div style={S.flagPill}>
            {tSafe('qa.scanFlow', 'Scan flow')}:
            {' '}{readiness.scanFlowPassed ? '✓' : '—'}
          </div>
          <div style={S.flagPill}>
            {tSafe('qa.offlineFlow', 'Offline flow')}:
            {' '}{readiness.offlineFlowPassed ? '✓' : '—'}
          </div>
          <div style={S.flagPill}>
            {tSafe('qa.reconnect', 'Reconnect sync')}:
            {' '}{readiness.reconnectPassed ? '✓' : '—'}
          </div>
          <div style={S.flagPill}>
            {tSafe('qa.dedupe', 'No duplicates')}:
            {' '}{readiness.duplicatePreventionPassed ? '✓' : '—'}
          </div>
        </div>
      </section>

      <div style={{ marginBottom: 14 }}>
        <button type="button" style={S.cta} onClick={onRefresh}
          data-testid="qa-refresh">
          {tSafe('qa.refresh', 'Refresh')}
        </button>
      </div>

      {DEVICE_KINDS.map((device) => {
        const deviceItems = DEVICE_QA_CHECKLIST.filter(
          (it) => it.device === device);
        const summary = readiness.perDeviceSummary
                          && readiness.perDeviceSummary[device];
        const summaryVerdict = (summary && summary.verdict) || 'PENDING';
        return (
          <div key={device} data-testid={`qa-device-${device}`}>
            <div style={S.sectionTitle}>
              {DEVICE_LABELS[device] || device}
              {summary ? (
                <>
                  {' '}({summary.passed}/{summary.total} passed
                  {summary.failed > 0 ? ` · ${summary.failed} failed` : ''}
                  {summary.pending > 0 ? ` · ${summary.pending} pending` : ''})
                  {' · '}<span style={{
                    color: STATUS_COLOR[
                      summaryVerdict === 'READY' ? 'passed'
                        : summaryVerdict === 'FAILED' ? 'failed'
                        : 'pending'],
                    fontWeight: 800,
                  }}>{summaryVerdict}</span>
                </>
              ) : null}
            </div>
            <div style={S.card}>
              {deviceItems.map((item) => {
                const status = checks[item.id] || 'pending';
                return (
                  <div key={item.id} style={S.itemRow}>
                    <div style={S.itemLabel}>
                      <div>{item.label}</div>
                      <div style={S.itemId}>{item.id}</div>
                      <div style={S.radioRow}
                        role="radiogroup"
                        aria-label={item.label}>
                        {CHECK_STATUSES.map((opt) => (
                          <label key={opt} style={S.radioLabel}>
                            <input
                              type="radio"
                              name={item.id}
                              value={opt}
                              checked={status === opt}
                              onChange={() => onMark(item.id, opt)}
                              data-testid={`qa-${opt}-${item.id}`}
                            />
                            {_statusLabel(opt)}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div style={{
                      ...S.statusPill,
                      background: STATUS_COLOR[status]
                                    ? STATUS_COLOR[status] + '22'
                                    : '#E2E8F0',
                      color: STATUS_COLOR[status] || '#475569',
                    }}>{_statusLabel(status)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </main>
  );
}
