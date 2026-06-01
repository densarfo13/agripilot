/**
 * CommunityModerationPage — internal, admin-only moderation queue.
 *
 *   <Route path="/internal/community-moderation" element={
 *     <RoleRoute roles={ADMIN_ROLES}><CommunityModerationPage /></RoleRoute>
 *   } />
 *
 * Shows reported posts + reported comments + hidden posts + a basic audit
 * trail. Read-only diagnostic surface — the actual moderation actions
 * (hide/un-hide/soft-delete) are POSTed to the server.
 *
 * NEVER bypasses moderation-ready state: the page reads from
 * /api/community/moderation/queue if available, falls back to the local
 * report log + the local artifact log so the surface stays useful offline.
 */

import React from 'react';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _readLocalReports() {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem('farroway_community_report_log');
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  }, []);
}

function _readLocalArtifacts() {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem('farroway_community_artifacts');
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  }, []);
}

export default function CommunityModerationPage() {
  const [serverQueue, setServerQueue] = React.useState(null);
  const [refreshTick, setRefreshTick] = React.useState(0);

  React.useEffect(() => {
    let alive = true;
    _safe(async () => {
      if (typeof fetch !== 'function') return;
      const res = await fetch('/api/community/moderation/queue', { credentials: 'same-origin' });
      if (!alive || !res || !res.ok) return;
      const body = await res.json().catch(() => null);
      if (alive && body) setServerQueue(body);
    }, null);
    return () => { alive = false; };
  }, [refreshTick]);

  const localReports = _readLocalReports();
  const localArtifacts = _readLocalArtifacts();
  const moderationArtifacts = localArtifacts.filter((a) =>
    a && (a.kind === 'GrowPostReported' || a.kind === 'GrowPostDeleted'));

  const action = async (postId, op) => {
    await _safe(async () => {
      if (typeof fetch !== 'function') return;
      await fetch(`/api/community/posts/${encodeURIComponent(postId)}/${op}`, {
        method: 'POST', credentials: 'same-origin',
      });
    }, null);
    setRefreshTick((n) => n + 1);
  };

  return (
    <main style={S.page} data-testid="internal-community-moderation">
      <div style={S.head}>
        <h1 style={S.title}>Community Moderation</h1>
        <button type="button" style={S.btn} onClick={() => setRefreshTick((n) => n + 1)}>Refresh</button>
      </div>
      <p style={S.sub}>
        Reported + hidden posts and a moderation audit trail. No public post bypasses moderation-ready state.
      </p>

      {/* Reported posts (server) */}
      <section style={S.card}>
        <h2 style={S.h2}>Reported posts (server)</h2>
        {!serverQueue || !Array.isArray(serverQueue.reported) || serverQueue.reported.length === 0 ? (
          <p style={S.empty}>No reported posts in the queue, or queue unavailable.</p>
        ) : (
          <ul style={S.list}>
            {serverQueue.reported.map((p) => (
              <li key={p.id} style={S.row}>
                <div>
                  <div style={S.rowTitle}>{p.title || '(untitled)'} <span style={S.dim}>· {p.reportedCount} reports</span></div>
                  <div style={S.rowMeta}>{p.visibility} · {p.cropKey || '—'} · author {p.authorId}</div>
                </div>
                <div style={S.actions}>
                  <button type="button" style={S.actBtn} onClick={() => action(p.id, 'hide')}>Hide</button>
                  <button type="button" style={S.actBtn} onClick={() => action(p.id, 'unhide')}>Un-hide</button>
                  <button type="button" style={S.actBtnDanger} onClick={() => action(p.id, 'soft-delete')}>Soft delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Hidden posts (server) */}
      <section style={S.card}>
        <h2 style={S.h2}>Hidden posts (server)</h2>
        {!serverQueue || !Array.isArray(serverQueue.hidden) || serverQueue.hidden.length === 0 ? (
          <p style={S.empty}>No hidden posts.</p>
        ) : (
          <ul style={S.list}>
            {serverQueue.hidden.map((p) => (
              <li key={p.id} style={S.row}>
                <div>
                  <div style={S.rowTitle}>{p.title || '(untitled)'}</div>
                  <div style={S.rowMeta}>{p.visibility} · author {p.authorId}</div>
                </div>
                <div style={S.actions}>
                  <button type="button" style={S.actBtn} onClick={() => action(p.id, 'unhide')}>Un-hide</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Local reports (offline / fallback) */}
      <section style={S.card}>
        <h2 style={S.h2}>Recent local reports ({localReports.length})</h2>
        {localReports.length === 0 ? <p style={S.empty}>No local reports.</p> : (
          <pre style={S.pre}>{_safe(() => JSON.stringify(localReports.slice(-20), null, 2), '—')}</pre>
        )}
      </section>

      {/* Audit trail — artifact log */}
      <section style={S.card}>
        <h2 style={S.h2}>Moderation audit trail ({moderationArtifacts.length})</h2>
        {moderationArtifacts.length === 0 ? <p style={S.empty}>No moderation artifacts recorded.</p> : (
          <pre style={S.pre}>{_safe(() => JSON.stringify(moderationArtifacts.slice(-30), null, 2), '—')}</pre>
        )}
      </section>
    </main>
  );
}

const S = {
  page: { minHeight: '100vh', background: '#0B1220', color: '#E5E7EB',
    padding: '24px 16px 80px', fontFamily: 'system-ui', maxWidth: 960, margin: '0 auto' },
  head: { display: 'flex', alignItems: 'center', gap: 12 },
  title: { fontSize: 20, fontWeight: 800, margin: 0, color: '#FFFFFF' },
  sub: { fontSize: 13, color: '#94A3B8', margin: '8px 0 16px' },
  btn: { border: '1px solid #334155', background: '#1E293B', color: '#E5E7EB',
    fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 10, cursor: 'pointer' },
  card: { background: '#111827', border: '1px solid #1F2937', borderRadius: 12,
    padding: '12px 14px', marginBottom: 12 },
  h2: { fontSize: 14, fontWeight: 700, margin: '0 0 8px', color: '#9CA3AF',
    textTransform: 'uppercase', letterSpacing: '0.06em' },
  empty: { fontSize: 12, color: '#94A3B8', margin: 0 },
  list: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 },
  row: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#0F172A',
    borderRadius: 8, border: '1px solid #1F2937' },
  rowTitle: { fontSize: 13, color: '#E5E7EB', fontWeight: 700 },
  rowMeta: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  dim: { color: '#94A3B8', fontWeight: 400 },
  actions: { marginLeft: 'auto', display: 'flex', gap: 6 },
  actBtn: { padding: '4px 10px', borderRadius: 999, border: '1px solid #334155',
    background: '#1E293B', color: '#E5E7EB', fontSize: 11, fontWeight: 700, cursor: 'pointer' },
  actBtnDanger: { padding: '4px 10px', borderRadius: 999, border: '1px solid #F87171',
    background: 'rgba(248,113,113,0.10)', color: '#FCA5A5', fontSize: 11, fontWeight: 700, cursor: 'pointer' },
  pre: { margin: 0, fontSize: 11, color: '#CBD5E1', whiteSpace: 'pre-wrap',
    wordBreak: 'break-all', maxHeight: 320, overflow: 'auto', fontFamily: 'ui-monospace, monospace' },
};
