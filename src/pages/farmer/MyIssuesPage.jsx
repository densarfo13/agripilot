/**
 * MyIssuesPage — farmer-facing list of their own reported issues.
 *
 *   • Pulls from issueStore via getIssuesForRole('farmer', { farmerId })
 *   • Shows the farmer-friendly status line (Reported / Assigned to
 *     field officer / Under review / Resolved / Escalated) via
 *     FARMER_STATUS_KEYS
 *   • Marks each issue as "seen" so the notification dot clears
 *   • Subscribes to in-process updates so assignment / status changes
 *     appear immediately without a manual reload
 *
 * No new UI patterns — same dark cards as the rest of the app.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useTranslation } from '../../i18n/index.js';
import {
  getIssuesForRole,
  subscribeIssues,
  markIssueSeen,
  FARMER_STATUS_KEYS,
  FARMER_STATUS_FALLBACK,
} from '../../lib/issues/issueStore.js';
import { getActiveFarm, getActiveFarmId } from '../../store/farrowayLocal.js';

const resolve = (t, key, fallback) => {
  if (typeof t !== 'function' || !key) return fallback;
  const v = t(key);
  return v && v !== key ? v : fallback;
};

function useFarmerIssues() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const unsub = subscribeIssues(() => setTick((n) => n + 1));
    return unsub;
  }, []);
  return useMemo(() => {
    // eslint-disable-next-line no-unused-vars
    const _ = tick;
    const activeFarm = getActiveFarm();
    const farmerId = (activeFarm && activeFarm.farmerId) || getActiveFarmId();
    return getIssuesForRole('farmer', { farmerId });
  }, [tick]);
}

export default function MyIssuesPage() {
  const { t } = useTranslation();
  const issues = useFarmerIssues();

  // Clear the "unseen update" mark for every issue we render. This
  // keeps the notification hook honest — spec §8 "show farmer in-app
  // update on next load".
  useEffect(() => {
    for (const i of issues) markIssueSeen(i.id);
  }, [issues]);

  const titleLbl    = resolve(t, 'issues.my.title',   'My reported issues');
  const subLbl      = resolve(t, 'issues.my.subtitle','Status updates appear here.');
  const emptyLbl    = resolve(t, 'issues.my.empty',   'You haven\u2019t reported any issues yet.');
  const reportLbl   = resolve(t, 'issues.my.report',  'Report a new issue');

  return (
    <main style={S.page} data-screen="my-issues">
      <h1 style={S.title}>{titleLbl}</h1>
      <p style={S.sub}>{subLbl}</p>

      <Link to="/report-issue" style={S.cta} data-testid="my-issues-report-cta">
        {reportLbl}
      </Link>

      {issues.length === 0 ? (
        <p style={S.empty} data-testid="my-issues-empty">{emptyLbl}</p>
      ) : (
        <ul style={S.list}>
          {issues.map((issue) => (
            <li key={issue.id} style={S.card} data-testid={`my-issue-${issue.id}`}>
              <div style={S.cardHead}>
                <span style={S.issueType}>
                  {resolve(t, `issues.type.${issue.issueType}`,
                    humanize(issue.issueType))}
                </span>
                <span style={{ ...S.statusPill, ...statusStyle(issue.status) }}>
                  {resolve(
                    t,
                    FARMER_STATUS_KEYS[issue.status] || 'issues.farmer.status.reported',
                    FARMER_STATUS_FALLBACK[issue.status] || 'Reported',
                  )}
                </span>
              </div>
              {issue.description && (
                <p style={S.desc}>{issue.description}</p>
              )}
              <div style={S.metaRow}>
                <span>{resolve(t, 'issues.my.reported', 'Reported')}: {formatDate(issue.createdAt)}</span>
                {issue.updatedAt !== issue.createdAt && (
                  <span>{resolve(t, 'issues.my.updated', 'Updated')}: {formatDate(issue.updatedAt)}</span>
                )}
              </div>
              {latestVisibleNote(issue) && (
                <p style={S.note} data-testid="my-issue-note">
                  {latestVisibleNote(issue).text}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function humanize(s) {
  return String(s || '').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

function formatDate(ts) {
  try { return new Date(ts).toLocaleDateString(); } catch { return ''; }
}

function latestVisibleNote(issue) {
  if (!issue || !Array.isArray(issue.notes)) return null;
  for (let i = issue.notes.length - 1; i >= 0; i -= 1) {
    const n = issue.notes[i];
    if (n && !n.system && n.text) return n;
  }
  return null;
}

function statusStyle(status) {
  switch (status) {
    case 'resolved':    return { background: 'rgba(34,197,94,0.15)',  color: '#86EFAC' };
    case 'in_progress': return { background: 'rgba(245,158,11,0.15)', color: '#FDE68A' };
    case 'assigned':    return { background: 'rgba(59,130,246,0.15)', color: '#93C5FD' };
    case 'escalated':   return { background: 'rgba(239,68,68,0.15)',  color: '#FCA5A5' };
    default:            return { background: 'rgba(255,255,255,0.08)', color: '#CBD5E1' };
  }
}

const S = {
  page:    { minHeight: '100vh', background: '#0B1D34', color: '#fff',
             padding: '1.25rem 1rem 2rem', maxWidth: '32rem', margin: '0 auto',
             boxSizing: 'border-box' },
  title:   { fontSize: '1.375rem', fontWeight: 700, margin: '0 0 0.25rem' },
  sub:     { margin: '0 0 1rem', color: 'rgba(255,255,255,0.65)', fontSize: '0.9rem' },
  cta:     { display: 'inline-block', padding: '0.5rem 0.875rem', borderRadius: 10,
             background: '#22C55E', color: '#000', fontWeight: 700,
             textDecoration: 'none', fontSize: '0.875rem', marginBottom: '1rem' },
  empty:   { padding: '1rem', borderRadius: 12,
             background: 'rgba(255,255,255,0.04)',
             border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.9rem',
             color: 'rgba(255,255,255,0.65)', textAlign: 'center' },
  list:    { listStyle: 'none', padding: 0, margin: 0,
             display: 'flex', flexDirection: 'column', gap: '0.625rem' },
  card:    { padding: '0.875rem 1rem', borderRadius: 12,
             border: '1px solid rgba(255,255,255,0.08)',
             background: 'rgba(255,255,255,0.04)' },
  cardHead:{ display: 'flex', justifyContent: 'space-between',
             alignItems: 'center', gap: '0.5rem' },
  issueType: { fontWeight: 700, fontSize: '0.9375rem' },
  statusPill: { padding: '2px 10px', borderRadius: 999, fontSize: '0.75rem',
                fontWeight: 700, letterSpacing: 0.2 },
  desc:    { margin: '0.5rem 0 0', fontSize: '0.9rem', color: 'rgba(255,255,255,0.85)' },
  metaRow: { display: 'flex', gap: '0.75rem', fontSize: '0.75rem',
             color: 'rgba(255,255,255,0.55)', margin: '0.375rem 0 0', flexWrap: 'wrap' },
  note:    { margin: '0.5rem 0 0', fontSize: '0.85rem',
             color: '#A7F3D0', fontStyle: 'italic' },
};
