/**
 * src/pages/internal/FieldOfficerOutcomesPage.jsx — wave-36
 * admin-only field officer outcomes view.
 *
 *   Route:  /internal/pilot-analytics/field-officer
 *   Gate:   RoleRoute roles={ADMIN_ROLES}
 *
 * Renders the three field officer lists:
 *   • growers needing follow-up
 *   • worsening crops
 *   • unresolved diagnoses
 *
 * Composes against __fieldOfficerView, scoped to the current
 * user's organization via TenantIsolation. Each list shows real
 * rows or an empty-state — never fakes.
 *
 * Strict-rule audit
 *   • Pure render. Probe reads in try/catch.
 *   • Admin-only via App.jsx route wrapper. NGO scoping happens
 *     at the runtime layer.
 */

import React, { useMemo } from 'react';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
function _probe(name, ...args) {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window;
    return typeof w[name] === 'function' ? w[name](...args) : null;
  }, null);
}

function _readViewer() {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window;
    if (typeof w.__roleHealth === 'function') {
      const r = w.__roleHealth();
      if (r && r.user) return r.user;
    }
    return null;
  }, null);
}

function Row({ row }) {
  return (
    <li style={S.row}>
      <span style={S.rowPlant}>{row.plantId}</span>
      <span style={S.rowStatus}>{row.outcomeStatus}</span>
      <span style={S.rowAge}>{row.ageDays}d</span>
      <span style={S.rowScans}>{row.scanCount} scan{row.scanCount === 1 ? '' : 's'}</span>
    </li>
  );
}

function List({ title, rows, emptyHint }) {
  return (
    <section style={S.section}>
      <h2 style={S.sectionTitle}>{title}</h2>
      {Array.isArray(rows) && rows.length > 0 ? (
        <ul style={S.list}>
          {rows.map((r) => <Row key={r.outcomeId} row={r} />)}
        </ul>
      ) : (
        <div style={S.empty}>{emptyHint}</div>
      )}
    </section>
  );
}

export default function FieldOfficerOutcomesPage() {
  const viewer = useMemo(() => _readViewer(), []);
  const view = useMemo(() => _probe('__fieldOfficerView', viewer) || {}, [viewer]);
  const orgLabel = view.viewerOrg || 'no organization scope';

  return (
    <div style={S.page} data-testid="field-officer-outcomes-page">
      <header style={S.header}>
        <p style={S.eyebrow}>Internal · Field Officer · Outcomes</p>
        <h1 style={S.title}>Outcomes follow-up</h1>
        <p style={S.subtitle}>
          Org scope: <code style={S.code}>{orgLabel}</code> ·
          total outcomes in scope: <code style={S.code}>{view.totalOutcomesInScope || 0}</code>
        </p>
      </header>

      <List
        title="Growers needing follow-up"
        rows={view.growersNeedingFollowUp}
        emptyHint="Nothing waiting on a follow-up scan."
      />
      <List
        title="Worsening crops"
        rows={view.worseningCrops}
        emptyHint="No worsening outcomes recorded."
      />
      <List
        title="Unresolved diagnoses"
        rows={view.unresolvedDiagnoses}
        emptyHint="No unresolved diagnoses past the resolution window."
      />
    </div>
  );
}

const C = {
  bg: '#0B1D34', panel: 'rgba(255,255,255,0.04)',
  border: 'rgba(255,255,255,0.08)',
  ink: '#FFFFFF', inkDim: 'rgba(255,255,255,0.65)',
  inkFaint: 'rgba(255,255,255,0.45)', accent: '#C8944D',
};
const S = {
  page: { minHeight: '100vh', background: C.bg, color: C.ink,
          padding: '2rem 1.5rem 4rem',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  header: { maxWidth: '52rem', margin: '0 auto 1.5rem' },
  eyebrow: { margin: 0, fontSize: '0.6875rem', fontWeight: 700,
             letterSpacing: '0.12em', textTransform: 'uppercase', color: C.accent },
  title:   { margin: '0.5rem 0', fontSize: '1.75rem', fontWeight: 800 },
  subtitle:{ margin: 0, fontSize: '0.9375rem', color: C.inkDim, lineHeight: 1.5 },
  code:    { fontFamily: 'monospace', background: 'rgba(255,255,255,0.06)',
             padding: '0.1rem 0.4rem', borderRadius: 4 },
  section: { maxWidth: '52rem', margin: '0 auto 1.25rem' },
  sectionTitle: { margin: '0 0 0.75rem', fontSize: '0.875rem', fontWeight: 700,
                  letterSpacing: '0.06em', textTransform: 'uppercase', color: C.accent },
  list: { listStyle: 'none', margin: 0, padding: 0 },
  row: { display: 'grid',
         gridTemplateColumns: 'minmax(0, 1fr) auto auto auto',
         gap: '0.75rem', alignItems: 'center',
         background: C.panel, border: '1px solid '+C.border,
         borderRadius: 10, padding: '0.75rem 0.95rem', marginBottom: '0.5rem',
         fontSize: '0.9375rem' },
  rowPlant:  { fontWeight: 700, minWidth: 0, overflow: 'hidden',
               textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rowStatus: { fontSize: '0.75rem', textTransform: 'uppercase',
               letterSpacing: '0.06em', color: C.inkDim },
  rowAge:    { fontFamily: 'monospace', color: C.inkDim, fontSize: '0.8125rem' },
  rowScans:  { fontFamily: 'monospace', color: C.inkFaint, fontSize: '0.8125rem' },
  empty: { background: 'rgba(255,255,255,0.03)', border: '1px dashed '+C.border,
           borderRadius: 10, padding: '0.85rem 1rem',
           color: C.inkFaint, fontStyle: 'italic', fontSize: '0.875rem' },
};
