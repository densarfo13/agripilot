/**
 * AdminBasicPage — Phase 6 restore: minimal admin dashboard.
 *
 *   Route: /admin  (role-gated: super_admin | institutional_admin)
 *
 * Sections:
 *   1. 4 overview cards — Total users, Active (24h), Total listings,
 *      Open buyer requests
 *   2. Recent activity list — last 20 EventLog entries
 *   3. Moderation panel — pause/unpause a listing, mark request reviewed
 *
 * Data sources (all via /api/v2/admin/* — role-enforced server-side):
 *   GET  /v2/admin/overview
 *   GET  /v2/admin/activity
 *   PATCH /v2/admin/listings/:id/status  (action: pause|unpause)
 *   PATCH /v2/admin/requests/:id/review
 *
 * Rules:
 *   • Never throws. Every fetch try/catched.
 *   • No hard-coded colours — uses CSS variables.
 *   • Mobile-first, no charts.
 *   • Pure functional — no Redux / context coupling.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../runtime/apiRuntime.js';

// ── Empty / loading shapes ─────────────────────────────────
const EMPTY_OVERVIEW = Object.freeze({
  totalUsers:    0,
  activeUsers24h: 0,
  totalListings: 0,
  openRequests:  0,
});

// ── Helpers ───────────────────────────────────────────────
function fmtTime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return String(iso);
  }
}

function fmtEventType(type) {
  return String(type || 'unknown').replace(/_/g, ' ');
}

// ── Component ─────────────────────────────────────────────
export default function AdminBasicPage() {
  const [overview, setOverview] = useState(EMPTY_OVERVIEW);
  const [events,   setEvents]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  // Moderation state
  const [listingId,   setListingId]   = useState('');
  const [listingAction, setListingAction] = useState('pause');
  const [listingMsg,  setListingMsg]  = useState(null); // { ok, text }
  const [listingBusy, setListingBusy] = useState(false);

  const [requestId,   setRequestId]   = useState('');
  const [requestMsg,  setRequestMsg]  = useState(null); // { ok, text }
  const [requestBusy, setRequestBusy] = useState(false);

  // Track cancellation.
  const cancelled = useRef(false);
  useEffect(() => {
    cancelled.current = false;
    return () => { cancelled.current = true; };
  }, []);

  // ── Data fetch ─────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [ovRes, actRes] = await Promise.all([
          api.get('/v2/admin/overview').catch(() => null),
          api.get('/v2/admin/activity').catch(() => null),
        ]);
        if (cancelled.current) return;

        if (ovRes && ovRes.data) {
          const d = ovRes.data;
          setOverview({
            totalUsers:     Number(d.totalUsers    ?? 0),
            activeUsers24h: Number(d.activeUsers24h ?? 0),
            totalListings:  Number(d.totalListings  ?? 0),
            openRequests:   Number(d.openRequests   ?? 0),
          });
        }
        if (actRes && actRes.data) {
          const list = Array.isArray(actRes.data.events)
            ? actRes.data.events
            : [];
          setEvents(list);
        }
      } catch (err) {
        if (!cancelled.current) {
          setError(err && err.message ? err.message : 'load_failed');
        }
      } finally {
        if (!cancelled.current) setLoading(false);
      }
    })();
  }, []);

  // ── Moderation handlers ─────────────────────────────────
  const handleListingSubmit = useCallback(async (e) => {
    e.preventDefault();
    const id = listingId.trim();
    if (!id) return;
    setListingBusy(true);
    setListingMsg(null);
    try {
      await api.patch(`/v2/admin/listings/${encodeURIComponent(id)}/status`, {
        action: listingAction,
      });
      setListingMsg({ ok: true, text: `Listing ${listingAction}d successfully.` });
      setListingId('');
    } catch (err) {
      const code = err?.response?.data?.error || err?.message || 'error';
      setListingMsg({ ok: false, text: `Failed: ${code}` });
    } finally {
      setListingBusy(false);
    }
  }, [listingId, listingAction]);

  const handleRequestSubmit = useCallback(async (e) => {
    e.preventDefault();
    const id = requestId.trim();
    if (!id) return;
    setRequestBusy(true);
    setRequestMsg(null);
    try {
      await api.patch(`/v2/admin/requests/${encodeURIComponent(id)}/review`);
      setRequestMsg({ ok: true, text: 'Request marked as reviewed.' });
      setRequestId('');
    } catch (err) {
      const code = err?.response?.data?.error || err?.message || 'error';
      setRequestMsg({ ok: false, text: `Failed: ${code}` });
    } finally {
      setRequestBusy(false);
    }
  }, [requestId]);

  // ── Render ─────────────────────────────────────────────
  return (
    <main style={S.page} data-testid="admin-basic-page">
      <header style={S.header}>
        <span style={S.headerStrip} aria-hidden="true" />
        <h1 style={S.title}>Admin Dashboard</h1>
        <p style={S.subtitle}>
          Platform overview, recent activity, and moderation tools.
        </p>
      </header>

      {/* 4 Overview cards */}
      <section style={S.grid} data-testid="admin-overview-cards">
        <Card label="Total users"       value={overview.totalUsers} />
        <Card label="Active (24 h)"     value={overview.activeUsers24h} />
        <Card label="Total listings"    value={overview.totalListings} />
        <Card label="Open requests"     value={overview.openRequests} tone="warn" />
      </section>

      {/* Recent activity */}
      <section style={S.section} data-testid="admin-activity">
        <h2 style={S.sectionTitle}>Recent activity</h2>
        {loading ? (
          <div style={S.emptyRow}>Loading activity…</div>
        ) : error ? (
          <div style={S.emptyRow}>
            Could not load activity — please refresh.
          </div>
        ) : events.length === 0 ? (
          <div style={S.emptyRow}>No activity recorded yet.</div>
        ) : (
          <div style={S.list}>
            {events.map((ev) => (
              <ActivityRow key={ev.id} event={ev} />
            ))}
          </div>
        )}
      </section>

      {/* Moderation panel */}
      <section style={S.section} data-testid="admin-moderation">
        <h2 style={S.sectionTitle}>Moderation</h2>
        <div style={S.moderationGrid}>

          {/* Pause / unpause listing */}
          <div style={S.card}>
            <div style={S.cardLabel}>Listing — pause / unpause</div>
            <form onSubmit={handleListingSubmit} style={S.form}>
              <input
                type="text"
                placeholder="Listing ID"
                value={listingId}
                onChange={(e) => setListingId(e.target.value)}
                style={S.input}
                data-testid="admin-listing-id-input"
                aria-label="Listing ID"
              />
              <div style={S.radioGroup}>
                <label style={S.radioLabel}>
                  <input
                    type="radio" name="listingAction" value="pause"
                    checked={listingAction === 'pause'}
                    onChange={() => setListingAction('pause')}
                  />
                  {' '}Pause
                </label>
                <label style={S.radioLabel}>
                  <input
                    type="radio" name="listingAction" value="unpause"
                    checked={listingAction === 'unpause'}
                    onChange={() => setListingAction('unpause')}
                  />
                  {' '}Unpause
                </label>
              </div>
              <button
                type="submit"
                disabled={listingBusy || !listingId.trim()}
                style={S.submitBtn}
                data-testid="admin-listing-submit"
              >
                {listingBusy ? 'Saving…' : 'Apply'}
              </button>
            </form>
            {listingMsg && (
              <div style={listingMsg.ok ? S.msgOk : S.msgErr}>
                {listingMsg.text}
              </div>
            )}
          </div>

          {/* Mark request reviewed */}
          <div style={S.card}>
            <div style={S.cardLabel}>Buyer request — mark reviewed</div>
            <form onSubmit={handleRequestSubmit} style={S.form}>
              <input
                type="text"
                placeholder="Request ID"
                value={requestId}
                onChange={(e) => setRequestId(e.target.value)}
                style={S.input}
                data-testid="admin-request-id-input"
                aria-label="Request ID"
              />
              <button
                type="submit"
                disabled={requestBusy || !requestId.trim()}
                style={S.submitBtn}
                data-testid="admin-request-submit"
              >
                {requestBusy ? 'Saving…' : 'Mark reviewed'}
              </button>
            </form>
            {requestMsg && (
              <div style={requestMsg.ok ? S.msgOk : S.msgErr}>
                {requestMsg.text}
              </div>
            )}
          </div>

        </div>
      </section>
    </main>
  );
}

// ── Sub-components ────────────────────────────────────────

function Card({ label, value, tone }) {
  const toneStyle = tone === 'warn'
    ? { borderColor: 'var(--warning, #f4c430)', color: 'var(--warning, #f4c430)' }
    : {};
  return (
    <div style={{ ...S.card, ...toneStyle }}>
      <div style={S.cardLabel}>{label}</div>
      <div style={S.cardValue}>{String(value)}</div>
    </div>
  );
}

function ActivityRow({ event }) {
  let metaStr = '';
  try {
    if (event.metadata && typeof event.metadata === 'object') {
      metaStr = Object.entries(event.metadata)
        .map(([k, v]) => `${k}: ${v}`)
        .join(' · ');
    }
  } catch { /* swallow */ }

  return (
    <div style={S.row} data-testid={`admin-activity-row-${event.id}`}>
      <div style={S.rowMain}>
        <div style={S.rowName}>{fmtEventType(event.eventType)}</div>
        {metaStr ? <div style={S.rowSub}>{metaStr}</div> : null}
      </div>
      <div style={S.rowTime}>{fmtTime(event.occurredAt)}</div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────
const S = {
  page: {
    minHeight: '100vh',
    padding: '20px 16px 96px',
    maxWidth: 920,
    margin: '0 auto',
    color: 'var(--text-primary, #EAF2FF)',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  header: { position: 'relative', paddingBottom: 6 },
  headerStrip: {
    position: 'absolute',
    top: 0, left: 0, right: 0, height: 4,
    background: 'linear-gradient(90deg, var(--role-accent, #6c63ff), transparent)',
    opacity: 0.85, borderRadius: 2,
  },
  title: { margin: '14px 0 0', fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em' },
  subtitle: {
    margin: '4px 0 0', fontSize: 13,
    color: 'var(--text-secondary, rgba(255,255,255,0.7))', lineHeight: 1.5,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 10,
  },
  section: { display: 'flex', flexDirection: 'column', gap: 10 },
  sectionTitle: {
    margin: 0, fontSize: 15, fontWeight: 800,
    color: 'var(--text-muted, rgba(255,255,255,0.55))',
    letterSpacing: '0.03em', textTransform: 'uppercase',
  },
  card: {
    padding: '14px',
    borderRadius: 14,
    background: 'var(--card-bg, rgba(255,255,255,0.06))',
    border: '1px solid var(--card-border, rgba(255,255,255,0.12))',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  cardLabel: {
    fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'var(--text-muted, rgba(255,255,255,0.55))',
  },
  cardValue: { fontSize: 22, fontWeight: 800, color: 'inherit' },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    background: 'var(--card-bg, rgba(255,255,255,0.06))',
    border: '1px solid var(--card-border, rgba(255,255,255,0.12))',
    borderRadius: 10,
  },
  rowMain: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 14, fontWeight: 700, textTransform: 'capitalize', lineHeight: 1.3 },
  rowSub:  { marginTop: 2, fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.55))' },
  rowTime: { fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.55))', flexShrink: 0 },
  emptyRow: {
    padding: '16px 14px',
    color: 'var(--text-muted, rgba(255,255,255,0.55))',
    textAlign: 'center',
    background: 'var(--card-bg, rgba(255,255,255,0.04))',
    border: '1px dashed var(--card-border, rgba(255,255,255,0.18))',
    borderRadius: 12,
    fontSize: 13,
  },
  moderationGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 12,
  },
  form: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 },
  input: {
    padding: '8px 12px',
    background: 'var(--card-bg-strong, rgba(255,255,255,0.10))',
    color: 'var(--text-primary, #EAF2FF)',
    border: '1px solid var(--card-border, rgba(255,255,255,0.18))',
    borderRadius: 8,
    fontSize: 13,
    outline: 'none',
  },
  radioGroup: { display: 'flex', gap: 16, fontSize: 13 },
  radioLabel: {
    display: 'flex', alignItems: 'center', gap: 4,
    color: 'var(--text-primary, #EAF2FF)', cursor: 'pointer',
  },
  submitBtn: {
    padding: '8px 16px',
    background: 'var(--role-accent, #6c63ff)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 13, fontWeight: 700,
    cursor: 'pointer',
    alignSelf: 'flex-start',
    opacity: 1,
  },
  msgOk: {
    marginTop: 4, fontSize: 12, fontWeight: 700,
    color: 'var(--accent-green, #2ecc71)',
  },
  msgErr: {
    marginTop: 4, fontSize: 12, fontWeight: 700,
    color: 'var(--danger, #ff6b6b)',
  },
};
