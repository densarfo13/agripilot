/**
 * OfficerIssuesPage — field-officer view of their assigned issues.
 *
 *   • Scoped via getIssuesForRole('field_officer', { officerId })
 *   • Per-issue actions: add note, start (→ in_progress), resolve,
 *     escalate back to admin
 *   • Officer id is read from the existing auth store for logged-in
 *     staff, but the page also accepts `?officerId=` for preview /
 *     impersonation flows so QA can demo without full auth wiring
 *
 * Invalid status transitions are silently ignored (updateIssueStatus
 * returns null), so the button set below is gated to only what's
 * legal for the current state.
 */

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useTranslation } from '../../i18n/index.js';
import {
  getIssuesForRole,
  subscribeIssues,
  addIssueNote,
  updateIssueStatus,
  ISSUE_STATUS,
} from '../../lib/issues/issueStore.js';

const resolve = (t, key, fallback) => {
  if (typeof t !== 'function' || !key) return fallback;
  const v = t(key);
  return v && v !== key ? v : fallback;
};

function readOfficerIdFromAuthShim() {
  // Best-effort: some environments stash the session blob under this
  // key; older ones use authUser. Either way, we only need `id`.
  if (typeof window === 'undefined' || !window.localStorage) return null;
  for (const key of ['farroway.session', 'authUser', 'farroway.authUser']) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.id || parsed.userId)) {
        return String(parsed.id || parsed.userId);
      }
    } catch { /* keep trying */ }
  }
  return null;
}

export default function OfficerIssuesPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const officerId = params.get('officerId') || readOfficerIdFromAuthShim() || 'ofc_demo';

  const [tick, setTick]         = useState(0);
  const [noteDraft, setNoteDraft] = useState({}); // { [issueId]: 'text' }

  useEffect(() => {
    const unsub = subscribeIssues(() => setTick((n) => n + 1));
    return unsub;
  }, []);

  const issues = useMemo(() => {
    // eslint-disable-next-line no-unused-vars
    const _ = tick;
    return getIssuesForRole('field_officer', { officerId });
  }, [tick, officerId]);

  function handleNote(issueId) {
    const text = (noteDraft[issueId] || '').trim();
    if (!text) return;
    addIssueNote(issueId, { authorRole: 'field_officer', authorId: officerId, text });
    setNoteDraft((d) => ({ ...d, [issueId]: '' }));
  }

  function handleStatus(issueId, next) {
    updateIssueStatus(issueId, next, {
      authorRole: 'field_officer', authorId: officerId,
    });
  }

  const titleLbl  = resolve(t, 'issues.officer.title',    'My assigned issues');
  const subLbl    = resolve(t, 'issues.officer.subtitle', 'Add notes, update status, or escalate.');
  const emptyLbl  = resolve(t, 'issues.officer.empty',
    'No issues assigned to you yet.');
  const noteLbl   = resolve(t, 'issues.officer.notePlaceholder', 'Add a note\u2026');
  const addNoteLbl    = resolve(t, 'issues.officer.addNote',    'Add note');
  const startLbl      = resolve(t, 'issues.officer.start',      'Start work');
  const resolveBtnLbl = resolve(t, 'issues.officer.resolve',    'Mark resolved');
  const escalateLbl   = resolve(t, 'issues.officer.escalate',   'Escalate to admin');
  const notesHeaderLbl = resolve(t, 'issues.officer.notesHeader','Notes');

  return (
    <main style={S.page} data-screen="officer-issues">
      <h1 style={S.title}>{titleLbl}</h1>
      <p style={S.sub}>{subLbl}</p>

      {issues.length === 0 ? (
        <p style={S.empty} data-testid="officer-issues-empty">{emptyLbl}</p>
      ) : (
        <ul style={S.list}>
          {issues.map((issue) => (
            <li key={issue.id} style={S.card} data-testid={`officer-issue-${issue.id}`}>
              <header style={S.cardHead}>
                <div style={S.headCol}>
                  <strong style={S.issueType}>
                    {resolve(t, `issues.type.${issue.issueType}`, humanize(issue.issueType))}
                  </strong>
                  <span style={S.muted}>
                    {issue.farmerName || issue.farmerId || '—'} · {issue.crop || '—'} · {issue.location || '—'}
                  </span>
                </div>
                <span style={{ ...S.pill, ...statusStyle(issue.status) }}>
                  {resolve(t, `issues.status.${issue.status}`, humanize(issue.status))}
                </span>
              </header>

              <p style={S.desc}>{issue.description}</p>

              {Array.isArray(issue.notes) && issue.notes.length > 0 && (
                <section style={S.notes}>
                  <div style={S.notesHeader}>{notesHeaderLbl}</div>
                  <ul style={S.notesList}>
                    {issue.notes.map((n) => (
                      <li
                        key={n.id}
                        style={{
                          ...S.noteItem,
                          ...(n.system    ? S.noteSystem    : null),
                          ...(n.suggested ? S.noteSuggested : null),
                        }}
                        data-suggested={n.suggested ? 'yes' : 'no'}
                      >
                        <span style={S.noteRole}>
                          {n.suggested
                            ? resolve(t, 'issues.officer.suggestedBadge',
                                'Suggested \u2014 confirm before sending')
                            : resolve(t, `issues.role.${n.authorRole}`,
                                n.authorRole || 'system')}
                        </span>
                        <span style={S.noteText}>{n.text}</span>
                        <span style={S.noteTime}>{formatDate(n.createdAt)}</span>
                        {n.suggested && (
                          <button
                            type="button"
                            onClick={() => setNoteDraft((d) => ({ ...d, [issue.id]: n.text }))}
                            style={S.useSuggestion}
                            data-testid={`officer-use-suggestion-${issue.id}`}
                          >
                            {resolve(t, 'issues.officer.useSuggestion', 'Use this')}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <div style={S.actionsRow}>
                <input
                  type="text"
                  value={noteDraft[issue.id] || ''}
                  onChange={(e) => setNoteDraft((d) => ({ ...d, [issue.id]: e.target.value }))}
                  placeholder={noteLbl}
                  style={S.noteInput}
                  data-testid={`officer-note-input-${issue.id}`}
                />
                <button
                  type="button"
                  onClick={() => handleNote(issue.id)}
                  style={S.smallPrimary}
                  data-testid={`officer-add-note-${issue.id}`}
                >
                  {addNoteLbl}
                </button>

                {issue.status === ISSUE_STATUS.ASSIGNED && (
                  <button
                    type="button"
                    onClick={() => handleStatus(issue.id, ISSUE_STATUS.IN_PROGRESS)}
                    style={S.smallGhost}
                    data-testid={`officer-start-${issue.id}`}
                  >
                    {startLbl}
                  </button>
                )}
                {(issue.status === ISSUE_STATUS.ASSIGNED
                  || issue.status === ISSUE_STATUS.IN_PROGRESS) && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleStatus(issue.id, ISSUE_STATUS.RESOLVED)}
                      style={S.smallGood}
                      data-testid={`officer-resolve-${issue.id}`}
                    >
                      {resolveBtnLbl}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatus(issue.id, ISSUE_STATUS.ESCALATED)}
                      style={S.smallDanger}
                      data-testid={`officer-escalate-${issue.id}`}
                    >
                      {escalateLbl}
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function humanize(s) { return String(s || '').replace(/_/g, ' '); }
function formatDate(ts) {
  try { return new Date(ts).toLocaleDateString(); } catch { return ''; }
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
  page:     { maxWidth: 720, margin: '0 auto', padding: '24px 20px 40px',
              minHeight: '100vh', background: '#0B1D34', color: '#fff',
              boxSizing: 'border-box' },
  title:    { margin: '0 0 6px', fontSize: 22, fontWeight: 700 },
  sub:      { margin: '0 0 18px', color: 'rgba(255,255,255,0.65)', fontSize: 14 },
  empty:    { padding: '1rem', borderRadius: 12,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.65)', textAlign: 'center' },
  list:     { listStyle: 'none', padding: 0, margin: 0,
              display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  card:     { padding: '1rem', borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.04)' },
  cardHead: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
              gap: 10, marginBottom: 6 },
  headCol:  { display: 'flex', flexDirection: 'column', gap: 2 },
  issueType:{ fontSize: 15, fontWeight: 700 },
  muted:    { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  desc:     { margin: '0.25rem 0 0.5rem', fontSize: 14,
              color: 'rgba(255,255,255,0.88)' },
  notes:    { marginTop: 8, padding: '8px 10px', borderRadius: 10,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)' },
  notesHeader: { fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)',
                 marginBottom: 4, letterSpacing: 0.3, textTransform: 'uppercase' },
  notesList: { listStyle: 'none', padding: 0, margin: 0,
               display: 'flex', flexDirection: 'column', gap: 4 },
  noteItem: { display: 'flex', gap: 8, fontSize: 12,
              color: 'rgba(255,255,255,0.85)' },
  noteSystem:{ color: 'rgba(255,255,255,0.55)', fontStyle: 'italic' },
  noteSuggested: {
    padding: '6px 8px', borderRadius: 8,
    border: '1px dashed rgba(59,130,246,0.45)',
    background: 'rgba(59,130,246,0.08)',
    color: '#93C5FD', fontStyle: 'normal',
  },
  useSuggestion: {
    padding: '2px 8px', borderRadius: 6,
    border: '1px solid rgba(147,197,253,0.4)',
    background: 'transparent', color: '#BFDBFE',
    fontSize: 11, fontWeight: 700, cursor: 'pointer',
  },
  noteRole: { minWidth: 100, fontWeight: 600 },
  noteText: { flex: 1 },
  noteTime: { color: 'rgba(255,255,255,0.45)', fontSize: 11 },
  actionsRow: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 },
  noteInput:{ flex: 1, minWidth: 180, padding: '6px 10px', borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.05)', color: '#fff',
              fontSize: 13 },
  smallPrimary: { padding: '6px 10px', borderRadius: 8, border: 'none',
                  background: '#22C55E', color: '#000',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  smallGhost:   { padding: '6px 10px', borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'transparent', color: 'rgba(255,255,255,0.85)',
                  fontSize: 12, cursor: 'pointer' },
  smallGood:    { padding: '6px 10px', borderRadius: 8,
                  border: '1px solid rgba(34,197,94,0.35)',
                  background: 'rgba(34,197,94,0.1)', color: '#86EFAC',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  smallDanger:  { padding: '6px 10px', borderRadius: 8,
                  border: '1px solid rgba(239,68,68,0.35)',
                  background: 'rgba(239,68,68,0.1)', color: '#FCA5A5',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  pill:     { display: 'inline-block', padding: '2px 8px', borderRadius: 999,
              fontSize: 11, fontWeight: 700, letterSpacing: 0.3 },
};
