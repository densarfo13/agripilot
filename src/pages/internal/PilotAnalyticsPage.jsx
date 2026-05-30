/**
 * src/pages/internal/PilotAnalyticsPage.jsx — wave-36 admin-only
 * pilot analytics view.
 *
 *   Route:  /internal/pilot-analytics
 *   Gate:   RoleRoute roles={ADMIN_ROLES}
 *
 * Renders the 7 real metrics + 3 success rates pulled from the
 * PilotAnalyticsRuntime. Empty rows show "—" (never fake numbers).
 *
 * Strict-rule audit
 *   • Pure render. Probe reads in try/catch.
 *   • Admin-only via App.jsx route wrapper.
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

function _fmt(value) {
  if (value == null) return '—';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toLocaleString();
  }
  return String(value);
}
function _fmtPct(value) {
  if (value == null) return '—';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${value}%`;
  }
  return String(value);
}

function Metric({ label, value, sublabel }) {
  return (
    <div style={S.metric}>
      <div style={S.metricLabel}>{label}</div>
      <div style={S.metricValue}>{value}</div>
      {sublabel && <div style={S.metricSub}>{sublabel}</div>}
    </div>
  );
}

export default function PilotAnalyticsPage() {
  const snap = useMemo(() => _probe('__pilotAnalytics') || {}, []);
  const window = snap.windowDays || 7;

  return (
    <div style={S.page} data-testid="pilot-analytics-page">
      <header style={S.header}>
        <p style={S.eyebrow}>Internal · Pilot Analytics</p>
        <h1 style={S.title}>Pilot Analytics</h1>
        <p style={S.subtitle}>
          Real metrics from the last {window} days. Rows showing
          "—" have not yet recorded data.
        </p>
      </header>

      <section style={S.section}>
        <h2 style={S.sectionTitle}>Counts (last {window}d)</h2>
        <div style={S.grid}>
          <Metric label="Weekly active growers" value={_fmt(snap.weeklyActiveGrowers)} />
          <Metric label="Scans"                value={_fmt(snap.scans)} />
          <Metric label="Plants added"         value={_fmt(snap.plantsAdded)} />
          <Metric label="Tasks generated"      value={_fmt(snap.tasksGenerated)}
                  sublabel="—  if not recorded" />
          <Metric label="Tasks completed"      value={_fmt(snap.tasksCompleted)} />
          <Metric label="Follow-up scans"      value={_fmt(snap.followUpScans)} />
          <Metric label="Outcomes recorded"    value={_fmt(snap.outcomesRecorded)} />
        </div>
      </section>

      <section style={S.section}>
        <h2 style={S.sectionTitle}>Success rates</h2>
        <div style={S.grid}>
          <Metric label="Task completion rate" value={_fmtPct(snap.taskCompletionRate)}
                  sublabel="completed ÷ generated" />
          <Metric label="Follow-up scan rate"  value={_fmtPct(snap.followUpScanRate)}
                  sublabel="follow-ups ÷ outcomes" />
          <Metric label="Improvement rate"     value={_fmtPct(snap.improvementRate)}
                  sublabel="improved ÷ outcomes" />
        </div>
      </section>

      <footer style={S.footer}>
        <span>realDataOnly: true</span>
        <span>{snap.emptyStateMessage || 'Not enough data yet'}</span>
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
};

const S = {
  page: { minHeight: '100vh', background: C.bg, color: C.ink,
          padding: '2rem 1.5rem 4rem',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  header: { maxWidth: '56rem', margin: '0 auto 1.5rem' },
  eyebrow: { margin: 0, fontSize: '0.6875rem', fontWeight: 700,
             letterSpacing: '0.12em', textTransform: 'uppercase', color: C.accent },
  title:   { margin: '0.5rem 0', fontSize: '1.75rem', fontWeight: 800 },
  subtitle:{ margin: 0, fontSize: '0.9375rem', color: C.inkDim, lineHeight: 1.5 },
  section: { maxWidth: '56rem', margin: '0 auto 1.25rem' },
  sectionTitle: { margin: '0 0 0.75rem', fontSize: '0.875rem', fontWeight: 700,
                  letterSpacing: '0.06em', textTransform: 'uppercase', color: C.accent },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '0.75rem' },
  metric: { background: C.panel, border: '1px solid '+C.border, borderRadius: 12,
            padding: '1rem 1.1rem' },
  metricLabel: { fontSize: '0.75rem', color: C.inkDim,
                 textTransform: 'uppercase', letterSpacing: '0.04em' },
  metricValue: { fontSize: '1.5rem', fontWeight: 800, marginTop: '0.35rem',
                 fontFamily: 'monospace' },
  metricSub: { fontSize: '0.75rem', color: C.inkFaint, marginTop: '0.25rem' },
  footer: { maxWidth: '56rem', margin: '2rem auto 0', padding: '0.6rem 0',
            borderTop: '1px dashed '+C.border, display: 'flex',
            justifyContent: 'space-between', flexWrap: 'wrap',
            fontSize: '0.6875rem', color: C.inkFaint,
            fontFamily: 'monospace', letterSpacing: '0.04em', gap: '0.5rem' },
};
