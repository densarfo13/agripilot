/**
 * src/pages/internal/NGOHealthPage.jsx — wave-38 NGO command
 * center.
 *
 *   Route: /internal/ngo-health
 *   Gate:  RoleRoute roles={ADMIN_ROLES}
 *
 * Renders organization / program / field officer / farmer /
 * invite counts pulled from real probes. Empty cells render
 * "Not enough data yet" — never fakes.
 *
 * Strict-rule audit
 *   • Pure render. Probe reads in try/catch.
 *   • Admin-only via App.jsx route wrapper.
 *   • No fake counts. No hardcoded values.
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
const EMPTY = 'Not enough data yet';

function Metric({ label, value }) {
  const display = (value == null)
    ? EMPTY
    : (typeof value === 'number' ? value.toLocaleString() : String(value));
  const muted = display === EMPTY;
  return (
    <div style={S.metric}>
      <div style={S.metricLabel}>{label}</div>
      <div style={muted ? S.metricEmpty : S.metricValue}>{display}</div>
    </div>
  );
}

export default function NGOHealthPage() {
  const ngo = useMemo(() => _probe('__ngoCommandHealth') || {}, []);
  const invite = useMemo(() => _probe('__inviteHealth') || {}, []);
  const alerts = useMemo(() => _probe('__pilotAlerts') || {}, []);

  const inviteRows = Array.isArray(alerts.alerts)
    ? alerts.alerts.filter((a) => /invite/i.test(a && a.id ? a.id : ''))
    : [];

  return (
    <div style={S.page} data-testid="ngo-health-page">
      <header style={S.header}>
        <p style={S.eyebrow}>Internal · NGO Command Center</p>
        <h1 style={S.title}>NGO Health</h1>
        <p style={S.subtitle}>
          Real counts from existing NGO + invite probes. Fields read
          "{EMPTY}" until the source surfaces real numbers — never
          fakes.
        </p>
      </header>

      <section style={S.section}>
        <h2 style={S.sectionTitle}>Organizations &amp; programs</h2>
        <div style={S.grid}>
          <Metric label="Organizations"   value={ngo.organizations} />
          <Metric label="Programs"        value={ngo.programs} />
          <Metric label="Field officers"  value={ngo.fieldOfficers} />
          <Metric label="Farmers"         value={ngo.farmers} />
        </div>
      </section>

      <section style={S.section}>
        <h2 style={S.sectionTitle}>Invites</h2>
        <div style={S.grid}>
          <Metric label="Invites sent"     value={ngo.invitesSent} />
          <Metric label="Invites accepted" value={ngo.invitesAccepted} />
          <Metric label="Email provider"
                  value={invite.emailProviderConfigured ? 'configured' : 'not configured'} />
          <Metric label="SMS provider"
                  value={invite.smsProviderConfigured ? 'configured' : 'not configured'} />
        </div>
        {inviteRows.length > 0 && (
          <ul style={S.alertList}>
            {inviteRows.map((a) => (
              <li key={a.id} style={S.alertRow}>
                <span style={S.alertSev}>{a.severity}</span>
                <span>{a.message}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer style={S.footer}>
        <span>onboardingReady: {String(ngo.onboardingReady)}</span>
        <span>pilotReady: {String(ngo.pilotReady)}</span>
        <span>Farroway · admin only</span>
      </footer>
    </div>
  );
}

const C = {
  bg: '#0B1D34', panel: 'rgba(255,255,255,0.04)',
  border: 'rgba(255,255,255,0.08)',
  ink: '#FFFFFF', inkDim: 'rgba(255,255,255,0.65)',
  inkFaint: 'rgba(255,255,255,0.45)', accent: '#C8944D',
  warn: '#F59E0B',
};
const S = {
  page: { minHeight: '100vh', background: C.bg, color: C.ink,
          padding: '2rem 1.5rem 4rem',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  header: { maxWidth: '56rem', margin: '0 auto 1.5rem' },
  eyebrow: { margin: 0, fontSize: '0.6875rem', fontWeight: 700,
             letterSpacing: '0.12em', textTransform: 'uppercase', color: C.accent },
  title:    { margin: '0.5rem 0', fontSize: '1.75rem', fontWeight: 800 },
  subtitle: { margin: 0, fontSize: '0.9375rem', color: C.inkDim, lineHeight: 1.5 },
  section: { maxWidth: '56rem', margin: '0 auto 1.25rem' },
  sectionTitle: { margin: '0 0 0.75rem', fontSize: '0.875rem', fontWeight: 700,
                  letterSpacing: '0.06em', textTransform: 'uppercase', color: C.accent },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' },
  metric: { background: C.panel, border: '1px solid '+C.border,
            borderRadius: 12, padding: '1rem 1.1rem' },
  metricLabel: { fontSize: '0.75rem', color: C.inkDim,
                 textTransform: 'uppercase', letterSpacing: '0.04em' },
  metricValue: { fontSize: '1.5rem', fontWeight: 800, marginTop: '0.35rem',
                 fontFamily: 'monospace' },
  metricEmpty: { fontSize: '0.9375rem', color: C.inkFaint, marginTop: '0.5rem', fontStyle: 'italic' },
  alertList: { listStyle: 'none', padding: 0, margin: '0.75rem 0 0' },
  alertRow: { display: 'flex', gap: '0.5rem', padding: '0.5rem 0.75rem',
              background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)',
              borderRadius: 8, marginBottom: '0.4rem', fontSize: '0.875rem' },
  alertSev: { fontWeight: 700, color: C.warn, fontSize: '0.6875rem',
              letterSpacing: '0.06em', textTransform: 'uppercase' },
  footer: { maxWidth: '56rem', margin: '2rem auto 0', padding: '0.6rem 0',
            borderTop: '1px dashed '+C.border, display: 'flex',
            justifyContent: 'space-between', fontSize: '0.6875rem',
            color: C.inkFaint, fontFamily: 'monospace', letterSpacing: '0.04em',
            flexWrap: 'wrap', gap: '0.5rem' },
};
