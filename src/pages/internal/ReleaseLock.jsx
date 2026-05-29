/**
 * src/pages/internal/ReleaseLock.jsx — Internal-only Release
 * Lock dashboard.
 *
 *   Route: /internal/release-lock
 *   Gate:  localStorage.farroway_internal === '1'
 *
 * What this is
 * ────────────
 *   Renders the live release lock verdict + per-section
 *   checklist with PASS/FAIL/PENDING badges. Manual checks can
 *   be marked passed / failed / pending. JSON report export
 *   downloads the same envelope the CI script writes.
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
  computeReleaseLock, exportReleaseLockReport,
  setManualOverride, clearManualOverrides, loadManualOverrides,
  RELEASE_SECTIONS, INTERNAL_FLAG_KEY,
} from '../../runtime/release/index';

const SECTION_LABELS = {
  scanRuntime:        'Scan Runtime',
  plantRuntime:       'Plant Runtime',
  scanToManagedPlant: 'Scan → Managed Plant',
  myPlants:           'My Plants',
  plantProfile:       'Plant Profile',
  plantTimeline:      'Plant Timeline',
  knowledgeLayer:     'Knowledge Layer',
  dailyBriefing:      'Daily Briefing',
  realPlantMedia:     'Real Plant Media',
  founderDashboard:   'Founder Dashboard',
};

const STATUS_COLOR = {
  passed:        '#16A34A',
  failed:        '#B91C1C',
  warning:       '#B45309',
  pending:       '#64748B',
  pendingManual: '#64748B',
  unknown:       '#94A3B8',
  skipped:       '#94A3B8',
};

const VERDICT_BG = {
  GREEN:  '#DCFCE7',
  YELLOW: '#FEF3C7',
  RED:    '#FEE2E2',
};
const VERDICT_FG = {
  GREEN:  '#166534',
  YELLOW: '#92400E',
  RED:    '#B91C1C',
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
  verdictRow: { display: 'flex', alignItems: 'center', gap: 12,
                 flexWrap: 'wrap' },
  verdictBadge: {
    fontSize: 24, fontWeight: 800, letterSpacing: '0.04em',
  },
  scorePill: {
    fontSize: 13, fontWeight: 700,
    padding: '4px 10px', borderRadius: 999,
    background: 'rgba(31,41,51,0.06)',
  },
  metaRow: {
    fontSize: 12, color: '#475569',
    marginTop: 6,
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
    padding: '6px 0',
    borderBottom: '1px solid rgba(31,41,51,0.05)',
    fontSize: 13,
  },
  itemLabel: { flex: 1, color: '#1F2933' },
  itemDetail: { fontSize: 11, color: '#64748B', marginTop: 2 },
  statusPill: {
    fontSize: 10, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.05em',
    padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap',
  },
  actionBtn: {
    appearance: 'none', border: '1px solid rgba(31,41,51,0.16)',
    background: '#FFFFFF', color: '#1F2933',
    padding: '4px 8px', borderRadius: 6,
    fontSize: 11, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit',
  },
  manualRow: {
    display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap',
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

export default function ReleaseLockPage() {
  const [tick, setTick]   = useState(0);
  const [internal, setInternal] = useState(false);

  useEffect(() => { setInternal(_isInternal()); }, []);

  const lock = useMemo(() => {
    try { return computeReleaseLock(); }
    catch {
      return { verdict: 'RED', score: 0, blockers: [], warnings: [],
               sections: {}, summary: {}, lastChecked: '',
               diagnosticsAvailable: {}, build: null, appStore: null };
    }
  }, [tick]);

  const onRefresh = useCallback(() => setTick((t) => t + 1), []);

  const onMark = useCallback((id, status) => {
    try { setManualOverride(id, status); } catch { /* ignore */ }
    setTick((t) => t + 1);
  }, []);

  const onClearManual = useCallback(() => {
    try { clearManualOverrides(); } catch { /* ignore */ }
    setTick((t) => t + 1);
  }, []);

  const onExport = useCallback(() => {
    try {
      const report = exportReleaseLockReport();
      const blob = new Blob([JSON.stringify(report, null, 2)],
        { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'FARROWAY_RELEASE_LOCK_V1_'
                    + (report.timestamp || '').replace(/[:.]/g, '-')
                    + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  }, []);

  if (!internal) {
    return (
      <main style={S.page} data-testid="release-lock-internal-only">
        <h1 style={S.header}>
          {tSafe('releaseLock.title', 'Release Lock')}
        </h1>
        <div style={S.empty}>
          {tSafe('releaseLock.notInternal',
            'This page is internal-only. '
            + 'Set localStorage.farroway_internal = "1" to view.')}
        </div>
      </main>
    );
  }

  const verdict = (lock && lock.verdict) || 'RED';
  const sections = (lock && lock.sections) || {};

  return (
    <main style={S.page} data-testid="release-lock-page"
      data-verdict={verdict}>
      <h1 style={S.header}>
        {tSafe('releaseLock.title', 'Farroway Release Lock')}
      </h1>
      <p style={S.sub}>
        {tSafe('releaseLock.subtitle',
          'Read-only verdict gate for production-ready release.')}
      </p>

      <section style={{ ...S.verdictCard,
                         background: VERDICT_BG[verdict],
                         color: VERDICT_FG[verdict] }}
        data-testid="release-lock-verdict">
        <div style={S.verdictRow}>
          <div style={S.verdictBadge}>{verdict}</div>
          <div style={S.scorePill}>
            {tSafe('releaseLock.score', 'Score')}: {lock.score} / 100
          </div>
          <div style={S.scorePill}>
            {lock.blockers ? lock.blockers.length : 0}
            {' '}{tSafe('releaseLock.blockers', 'blockers')}
          </div>
          <div style={S.scorePill}>
            {lock.warnings ? lock.warnings.length : 0}
            {' '}{tSafe('releaseLock.warnings', 'warnings')}
          </div>
        </div>
        <div style={S.metaRow}>
          {tSafe('releaseLock.lastChecked', 'Last checked')}:
          {' ' + (lock.lastChecked || '—')}
          {' · '}
          {tSafe('releaseLock.build', 'Build')}:
          {' ' + ((lock.build && lock.build.sha) || (lock.build && lock.build.commit) || '—')}
          {' · '}
          {tSafe('releaseLock.appStore', 'App Store mode')}:
          {' ' + ((lock.appStore && lock.appStore.mode) || '—')}
        </div>
      </section>

      <div style={{ marginBottom: 14 }}>
        <button type="button" style={S.cta} onClick={onRefresh}
          data-testid="release-lock-refresh">
          {tSafe('releaseLock.refresh', 'Refresh checks')}
        </button>
        <button type="button" style={S.cta} onClick={onExport}
          data-testid="release-lock-export">
          {tSafe('releaseLock.export', 'Export JSON report')}
        </button>
        <button type="button" style={S.cta} onClick={onClearManual}
          data-testid="release-lock-clear-manual">
          {tSafe('releaseLock.clearManual', 'Clear manual overrides')}
        </button>
      </div>

      {(lock.blockers && lock.blockers.length > 0) ? (
        <section style={{ ...S.card,
                           borderColor: '#FCA5A5', background: '#FEF2F2' }}
          data-testid="release-lock-blockers">
          <div style={{ fontSize: 12, fontWeight: 700, color: '#B91C1C',
                         textTransform: 'uppercase', letterSpacing: '0.06em',
                         marginBottom: 4 }}>
            {tSafe('releaseLock.blockerList', 'Blockers')}
          </div>
          {lock.blockers.map((b) => (
            <div key={b.id} style={{ fontSize: 12, color: '#1F2933',
                                      padding: '2px 0' }}>
              ✗ <strong>{b.id}</strong>{b.detail ? ' — ' + b.detail : ''}
            </div>
          ))}
        </section>
      ) : null}

      {RELEASE_SECTIONS.map((key) => {
        const s = sections[key];
        if (!s) return null;
        return (
          <div key={key} data-testid={`release-lock-section-${key}`}>
            <div style={S.sectionTitle}>
              {SECTION_LABELS[key] || key}
              {' '}({s.passed}/{s.total} passed
              {s.failed > 0 ? ` · ${s.failed} failed` : ''}
              {s.warning > 0 ? ` · ${s.warning} warn` : ''}
              {s.pendingManual > 0 ? ` · ${s.pendingManual} pending` : ''})
            </div>
            <div style={S.card}>
              {s.items.map((r) => (
                <div key={r.id} style={S.itemRow}>
                  <div style={S.itemLabel}>
                    <div>{r.id}</div>
                    {r.detail ? (
                      <div style={S.itemDetail}>{r.detail}</div>
                    ) : null}
                    {r.status === 'pendingManual' ? (
                      <div style={S.manualRow}>
                        <button type="button" style={S.actionBtn}
                          onClick={() => onMark(r.id, 'passed')}
                          data-testid={`mark-passed-${r.id}`}>
                          Mark passed
                        </button>
                        <button type="button" style={S.actionBtn}
                          onClick={() => onMark(r.id, 'failed')}
                          data-testid={`mark-failed-${r.id}`}>
                          Mark failed
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <div style={{
                    ...S.statusPill,
                    background: STATUS_COLOR[r.status]
                                  ? STATUS_COLOR[r.status] + '22'
                                  : '#E2E8F0',
                    color: STATUS_COLOR[r.status] || '#475569',
                  }}>{r.status}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </main>
  );
}
