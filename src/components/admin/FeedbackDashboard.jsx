/**
 * FeedbackDashboard — admin-facing rollup of user feedback
 * (final feedback-loop spec §4).
 *
 *   <FeedbackDashboard />  // mount inside an admin route
 *
 * Renders a single page with:
 *   • Total feedback count
 *   • Top issue bucket + recommended fix
 *   • Counts per screen
 *   • Counts per role
 *   • Last 10 raw comments (free-form "Other" submissions)
 *
 * Reads localStorage via the canonical store helpers — works
 * offline, no backend dependency, no charts library. Designed
 * to ship as a small surface that engineers / PMs can read at a
 * glance after launch to decide what to fix next.
 *
 * Strict-rule audit
 *   * Inline styles only.
 *   * Never throws — every store call is try/catch wrapped.
 *   * Refresh button reloads the page-local state without
 *     touching the store.
 *   * Fires `feedback_top_issue_viewed` once per mount when
 *     there IS a top issue, so we can measure how often the
 *     dashboard is consulted.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getFeedback, getFeedbackByScreen, getFeedbackByRole,
} from '../../analytics/userFeedbackStore.js';
import { computeFeedbackPriority } from '../../analytics/feedbackPriority.js';
import { trackEvent } from '../../analytics/analyticsStore.js';

const C = {
  ink: '#EAF2FF',
  inkSoft: 'rgba(255,255,255,0.65)',
  border: 'rgba(255,255,255,0.10)',
  panel: 'rgba(255,255,255,0.04)',
  green: '#22C55E',
  amber: '#F59E0B',
  red:   '#EF4444',
};

const SEVERITY_COLOR = {
  critical: C.red,
  high:     C.amber,
  medium:   C.green,
};

const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)',
    color: C.ink,
    padding: '20px 16px 80px',
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  title: { margin: 0, fontSize: 22, fontWeight: 800 },
  subtitle: { margin: '4px 0 0', color: C.inkSoft, fontSize: 13 },
  refreshBtn: {
    appearance: 'none',
    fontFamily: 'inherit',
    cursor: 'pointer',
    background: 'transparent',
    border: `1px solid ${C.border}`,
    color: C.ink,
    padding: '6px 12px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    minHeight: 32,
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 12,
    marginBottom: 18,
  },
  card: {
    background: C.panel,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    padding: 14,
  },
  cardLabel: {
    fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: C.inkSoft,
  },
  cardValue: { fontSize: 28, fontWeight: 800, color: C.ink, marginTop: 4 },
  cardCopy:  { fontSize: 13, color: C.inkSoft, marginTop: 6, lineHeight: 1.4 },
  topFix: {
    background: 'rgba(34,197,94,0.10)',
    border: '1px solid rgba(34,197,94,0.32)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
  },
  fixHeader: { fontSize: 11, fontWeight: 800, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: '#86EFAC' },
  fixCopy: { margin: '4px 0 0', fontSize: 14, fontWeight: 700, color: C.ink, lineHeight: 1.5 },
  fixSub:  { margin: '6px 0 0', fontSize: 12, color: C.inkSoft },

  section: { marginTop: 18 },
  sectionTitle: { fontSize: 12, fontWeight: 800, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: C.inkSoft, margin: '0 0 8px' },
  table: {
    background: C.panel,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    borderBottom: `1px solid ${C.border}`,
    fontSize: 13,
  },
  rowLast: { borderBottom: 'none' },
  badge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    background: 'rgba(255,255,255,0.06)',
    color: C.inkSoft,
    marginLeft: 8,
  },
  comment: {
    padding: '12px 14px',
    borderBottom: `1px solid ${C.border}`,
    fontSize: 13,
    lineHeight: 1.5,
    color: C.ink,
  },
  commentMeta: {
    display: 'block',
    fontSize: 11,
    color: C.inkSoft,
    marginTop: 4,
  },
  empty: {
    padding: 18,
    textAlign: 'center',
    color: C.inkSoft,
    fontSize: 13,
  },
};

function _ts(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch { return ''; }
}

export default function FeedbackDashboard() {
  const [refreshKey, setRefreshKey] = useState(0);

  const rows = useMemo(() => {
    try { return getFeedback() || []; }
    catch { return []; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const byScreen = useMemo(() => {
    try { return getFeedbackByScreen() || {}; }
    catch { return {}; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const byRole = useMemo(() => {
    try { return getFeedbackByRole() || {}; }
    catch { return {}; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const priority = useMemo(() => {
    try { return computeFeedbackPriority({ rows }); }
    catch {
      return {
        topIssue: null, ranking: [], totalRows: 0,
        recommendedNextFix: '', reason: '',
      };
    }
  }, [rows]);

  // Once-per-mount analytics ping when a top issue exists.
  const seenTopRef = useRef(false);
  useEffect(() => {
    if (seenTopRef.current) return;
    if (!priority.topIssue) return;
    seenTopRef.current = true;
    try { trackEvent('feedback_top_issue_viewed', { topIssue: priority.topIssue }); }
    catch { /* swallow */ }
  }, [priority.topIssue]);

  const screenRows = Object.entries(byScreen)
    .map(([screen, list]) => ({ screen, count: Array.isArray(list) ? list.length : 0 }))
    .sort((a, b) => b.count - a.count);

  const roleRows = Object.entries(byRole)
    .map(([role, list]) => ({ role, count: Array.isArray(list) ? list.length : 0 }))
    .sort((a, b) => b.count - a.count);

  const recentComments = rows
    .filter((r) => r && r.feedbackText)
    .slice(0, 10);

  const totalRows = rows.length;
  const topBucket = priority.ranking[0] || null;

  return (
    <main style={S.page} data-screen="feedback-dashboard">
      <div style={S.header}>
        <div>
          <h1 style={S.title}>Feedback dashboard</h1>
          <p style={S.subtitle}>
            Local-first rollup of user feedback. Refresh to re-read storage.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRefreshKey((k) => k + 1)}
          style={S.refreshBtn}
          data-testid="feedback-dashboard-refresh"
        >
          Refresh
        </button>
      </div>

      <div style={S.cardGrid}>
        <div style={S.card}>
          <span style={S.cardLabel}>Total reports</span>
          <div style={S.cardValue} data-testid="feedback-total">{totalRows}</div>
          <div style={S.cardCopy}>
            Across {Object.keys(byScreen).length} screen(s) and{' '}
            {Object.keys(byRole).length} role(s).
          </div>
        </div>
        <div style={S.card}>
          <span style={S.cardLabel}>Top issue bucket</span>
          <div style={S.cardValue} data-testid="feedback-top-bucket">
            {priority.topIssue || '—'}
          </div>
          <div style={S.cardCopy}>
            {topBucket
              ? `${topBucket.count} report(s), severity ${topBucket.severity}.`
              : 'No feedback yet.'}
          </div>
        </div>
        <div style={S.card}>
          <span style={S.cardLabel}>Reports today</span>
          <div style={S.cardValue} data-testid="feedback-today">
            {rows.filter((r) => {
              if (!r?.timestamp) return false;
              try {
                const t = new Date(r.timestamp);
                const now = new Date();
                return t.toDateString() === now.toDateString();
              } catch { return false; }
            }).length}
          </div>
          <div style={S.cardCopy}>Resets at midnight local time.</div>
        </div>
      </div>

      {priority.topIssue ? (
        <section style={S.topFix} data-testid="feedback-top-fix">
          <span style={S.fixHeader}>Recommended next fix</span>
          <p style={S.fixCopy}>{priority.recommendedNextFix}</p>
          <p style={S.fixSub}>{priority.reason}</p>
        </section>
      ) : null}

      <section style={S.section}>
        <h3 style={S.sectionTitle}>By screen</h3>
        <div style={S.table} data-testid="feedback-by-screen">
          {screenRows.length === 0 ? (
            <div style={S.empty}>No reports yet.</div>
          ) : screenRows.map((r, i) => (
            <div key={r.screen}
              style={i === screenRows.length - 1 ? { ...S.row, ...S.rowLast } : S.row}>
              <span>{r.screen}</span>
              <span style={S.badge}>{r.count}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={S.section}>
        <h3 style={S.sectionTitle}>By role</h3>
        <div style={S.table} data-testid="feedback-by-role">
          {roleRows.length === 0 ? (
            <div style={S.empty}>No reports yet.</div>
          ) : roleRows.map((r, i) => (
            <div key={r.role}
              style={i === roleRows.length - 1 ? { ...S.row, ...S.rowLast } : S.row}>
              <span>{r.role}</span>
              <span style={S.badge}>{r.count}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={S.section}>
        <h3 style={S.sectionTitle}>Recent free-form comments</h3>
        <div style={S.table} data-testid="feedback-recent">
          {recentComments.length === 0 ? (
            <div style={S.empty}>No free-form comments yet.</div>
          ) : recentComments.map((row, i) => (
            <div key={row.id || i}
              style={i === recentComments.length - 1
                ? { ...S.comment, borderBottom: 'none' }
                : S.comment}>
              <span>{row.feedbackText}</span>
              <span style={S.commentMeta}>
                {row.screen || 'unknown'}
                {' · '}
                {row.role || 'unknown'}
                {row.timestamp ? ` · ${_ts(row.timestamp)}` : ''}
                <span style={{ ...S.badge,
                  color: SEVERITY_COLOR[row.severity || 'medium'] }}>
                  {row.feedbackType}
                </span>
              </span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
