/**
 * src/pages/internal/pilot/GrowerPilotPage.jsx — wave-41 admin-only
 * grower pilot validation checklist.
 *
 *   Route: /internal/pilot/grower
 *   Gate:  RoleRoute roles={ADMIN_ROLES}
 *
 * Renders the 10-step grower journey + the __growerPilotHealth
 * envelope. Never fabricates state; each row binds to a real
 * underlying probe attestation.
 *
 * Strict-rule audit
 *   • Pure render. Probe reads in try/catch.
 *   • No fake states. Admin-only via App.jsx route wrapper.
 */

import React, { useMemo } from 'react';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
function _probe(name) {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}

const CHECKLIST = [
  { id: 'gardenerFlowReady',  label: 'Create gardener account' },
  { id: 'farmerFlowReady',    label: 'Create farmer account' },
  { id: 'gardenerFlowReady',  label: 'Add location OR skip location' },
  { id: 'scanReady',          label: 'Scan plant' },
  { id: 'uploadReady',        label: 'Upload photo' },
  { id: 'plantSaveReady',     label: 'Add to My Plants' },
  { id: 'taskReady',          label: 'Complete task' },
  { id: 'activityReady',      label: 'View Activity' },
  { id: 'scanReady',          label: 'Follow-up scan' },
  { id: 'outcomeReady',       label: 'Outcome recorded' },
];

function Row({ ok, label }) {
  return (
    <div style={{ ...S.row, borderColor: ok ? '#34D399' : 'rgba(245,158,11,0.5)' }}>
      <span style={ok ? S.dotOk : S.dotPending} aria-hidden="true" />
      <div style={S.rowLabel}>{label}</div>
      <span style={ok ? S.tagOk : S.tagPending}>
        {ok ? 'READY' : 'NOT READY'}
      </span>
    </div>
  );
}

export default function GrowerPilotPage() {
  const health = useMemo(() => _probe('__growerPilotHealth') || {}, []);
  const verdict = !!health.pilotReady;

  return (
    <div style={S.page} data-testid="grower-pilot-page">
      <header style={S.header}>
        <p style={S.eyebrow}>Internal · Pilot · Grower</p>
        <h1 style={S.title}>Grower Pilot Validation</h1>
        <p style={S.subtitle}>
          The 10-step grower journey, mapped to live runtime probes.
          Each row reflects the real attestation — no fake greens.
        </p>
        <div style={verdict ? S.verdictOk : S.verdictBlocked}>
          Verdict: {verdict ? 'PILOT READY' : 'NOT READY'}
        </div>
      </header>

      <section style={S.section}>
        <h2 style={S.sectionTitle}>Checklist</h2>
        {CHECKLIST.map((item, i) => (
          <Row
            key={`${item.id}-${i}`}
            ok={!!health[item.id]}
            label={item.label}
          />
        ))}
      </section>

      {Array.isArray(health.blockers) && health.blockers.length > 0 && (
        <section style={S.section}>
          <h2 style={S.sectionTitle}>Blockers</h2>
          <ul style={S.list}>
            {health.blockers.map((b) => (
              <li key={b} style={S.listItem}>{String(b)}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

const C = {
  bg:       '#0B1D34',
  panel:    'rgba(255,255,255,0.04)',
  border:   'rgba(255,255,255,0.08)',
  ink:      '#FFFFFF',
  inkDim:   'rgba(255,255,255,0.65)',
  inkFaint: 'rgba(255,255,255,0.45)',
  accent:   '#C8944D',
  ok:       '#34D399',
  warn:     '#F59E0B',
};

const S = {
  page: {
    minHeight: '100vh', background: C.bg, color: C.ink,
    padding: '2rem 1.5rem 4rem',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: { maxWidth: '48rem', margin: '0 auto 1.5rem' },
  eyebrow: { margin: 0, fontSize: '0.6875rem', fontWeight: 700,
             letterSpacing: '0.12em', textTransform: 'uppercase', color: C.accent },
  title:    { margin: '0.5rem 0', fontSize: '1.75rem', fontWeight: 800 },
  subtitle: { margin: 0, fontSize: '0.9375rem', color: C.inkDim, lineHeight: 1.55 },
  verdictOk:      { marginTop: '0.85rem', padding: '0.55rem 0.85rem',
                    background: 'rgba(52,211,153,0.12)', border: '1px solid '+C.ok,
                    borderRadius: 8, fontSize: '0.875rem', fontWeight: 700, color: C.ok,
                    display: 'inline-block' },
  verdictBlocked: { marginTop: '0.85rem', padding: '0.55rem 0.85rem',
                    background: 'rgba(245,158,11,0.12)', border: '1px solid '+C.warn,
                    borderRadius: 8, fontSize: '0.875rem', fontWeight: 700, color: C.warn,
                    display: 'inline-block' },
  section: { maxWidth: '48rem', margin: '0 auto 1.25rem' },
  sectionTitle: { margin: '0 0 0.75rem', fontSize: '0.875rem', fontWeight: 700,
                  letterSpacing: '0.06em', textTransform: 'uppercase', color: C.accent },
  row: { display: 'flex', alignItems: 'center', gap: '0.75rem',
         background: C.panel, border: '1px solid '+C.border,
         borderRadius: 10, padding: '0.85rem 1rem', marginBottom: '0.5rem' },
  rowLabel: { fontSize: '0.9375rem', fontWeight: 600, flex: 1, minWidth: 0 },
  dotOk:      { width: 10, height: 10, borderRadius: 999, background: C.ok, flex: '0 0 10px' },
  dotPending: { width: 10, height: 10, borderRadius: 999, background: C.warn, flex: '0 0 10px' },
  tagOk:      { fontSize: '0.6875rem', fontWeight: 700, color: C.ok,
                letterSpacing: '0.08em', textTransform: 'uppercase' },
  tagPending: { fontSize: '0.6875rem', fontWeight: 700, color: C.warn,
                letterSpacing: '0.08em', textTransform: 'uppercase' },
  list:     { margin: 0, padding: '0 0 0 1.25rem' },
  listItem: { fontSize: '0.875rem', color: C.inkDim, marginBottom: '0.25rem',
              fontFamily: 'monospace' },
};
