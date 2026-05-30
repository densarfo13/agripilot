/**
 * src/pages/internal/pilot/PilotCommandPage.jsx — wave-41
 * admin-only pilot command center.
 *
 *   Route:  /internal/pilot
 *   Gate:   RoleRoute roles={ADMIN_ROLES} (wired in App.jsx)
 *
 * Renders ONLY real metrics pulled from the existing globals.
 * If a source is empty, shows "Not enough data yet" — never
 * fabricates numbers. Wave-41 §6 governance enforces this.
 *
 * Strict-rule audit
 *   • Pure render. Every read wrapped in try/catch.
 *   • No fake numbers. No external API calls.
 *   • Admin-only via the route wrapper in App.jsx.
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
  const display = (value == null || value === '')
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

function Section({ title, children }) {
  return (
    <section style={S.section}>
      <h2 style={S.sectionTitle}>{title}</h2>
      <div style={S.grid}>{children}</div>
    </section>
  );
}

export default function PilotCommandPage() {
  const probes = useMemo(() => ({
    retention:    _probe('__retentionHealth'),
    enterprise:   _probe('__enterpriseHealth'),
    evidence:     _probe('__programEvidenceHealth'),
    buyer:        _probe('__buyerDashboardHealth') || _probe('__buyerHealth'),
    pilotCommand: _probe('__pilotCommandHealth'),
    ngoPilot:     _probe('__ngoPilotHealth'),
    growerPilot:  _probe('__growerPilotHealth'),
    outcome:      _probe('__outcomeCaptureHealth'),
    knowledge:    _probe('__knowledgeCoverageHealth'),
    plantCatalog: _probe('__plantCatalogReadiness'),
  }), []);

  const r = probes.retention;
  const storedEvents       = r && typeof r.storedEvents === 'number' ? r.storedEvents : null;
  const weeklyActiveGrowers = r && r.metrics && typeof r.metrics.weeklyActiveGrowers === 'number'
    ? r.metrics.weeklyActiveGrowers : null;

  const ent = probes.enterprise;
  const enterpriseInit = !!(ent && ent.initialized);

  const evidence = probes.evidence;
  const evidenceChain = evidence && typeof evidence.chainStepsCovered === 'number'
    ? `${evidence.chainStepsCovered} / ${evidence.totalChainSteps}` : null;

  return (
    <div style={S.page} data-testid="pilot-command-page">
      <header style={S.header}>
        <p style={S.eyebrow}>Internal · Pilot Command</p>
        <h1 style={S.title}>Pilot Command Center</h1>
        <p style={S.subtitle}>
          Real metrics only. Empty fields show "{EMPTY}" — no fake numbers.
        </p>
      </header>

      <Section title="Grower">
        <Metric label="Stored retention events" value={storedEvents} />
        <Metric label="Weekly active growers (rolling 7d)" value={weeklyActiveGrowers} />
        <Metric label="Outcome dataset ready"
                value={probes.outcome && probes.outcome.outcomeDatasetReady ? 'yes' : null} />
      </Section>

      <Section title="NGO">
        <Metric label="Enterprise runtime initialised"
                value={enterpriseInit ? 'yes' : null} />
        <Metric label="Program evidence chain"
                value={evidenceChain} />
        <Metric label="NGO pilot ready"
                value={probes.ngoPilot && probes.ngoPilot.pilotReady ? 'yes' : null} />
      </Section>

      <Section title="Buyer">
        <Metric label="Buyer runtime initialised"
                value={probes.buyer && probes.buyer.initialized ? 'yes' : null} />
      </Section>

      <Section title="Catalog readiness">
        <Metric label="Plant catalog current"
                value={probes.plantCatalog && probes.plantCatalog.currentPlants} />
        <Metric label="Plant catalog gap (to 200)"
                value={probes.plantCatalog && probes.plantCatalog.gap} />
        <Metric label="Africa priority coverage"
                value={probes.plantCatalog && (probes.plantCatalog.africaPriorityCoverage + '%')} />
        <Metric label="USA garden coverage"
                value={probes.plantCatalog && (probes.plantCatalog.usaGardenCoverage + '%')} />
        <Metric label="Launch warning"
                value={probes.knowledge && probes.knowledge.launchWarning ? 'YES — content below target' : null} />
      </Section>

      <footer style={S.footer}>
        <span>{probes.pilotCommand && probes.pilotCommand.noFakeMetrics ? 'noFakeMetrics: true' : ''}</span>
        <span>Farroway · admin only</span>
      </footer>
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
};

const S = {
  page: {
    minHeight: '100vh', background: C.bg, color: C.ink,
    padding: '2rem 1.5rem 4rem',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: { maxWidth: '56rem', margin: '0 auto 1.5rem' },
  eyebrow: { margin: 0, fontSize: '0.6875rem', fontWeight: 700,
             letterSpacing: '0.12em', textTransform: 'uppercase', color: C.accent },
  title:   { margin: '0.5rem 0 0.5rem', fontSize: '1.75rem', fontWeight: 800 },
  subtitle: { margin: 0, fontSize: '0.9375rem', color: C.inkDim, lineHeight: 1.5 },
  section: { maxWidth: '56rem', margin: '0 auto 1.25rem' },
  sectionTitle: { margin: '0 0 0.75rem', fontSize: '0.875rem', fontWeight: 700,
                  letterSpacing: '0.06em', textTransform: 'uppercase', color: C.accent },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' },
  metric: { background: C.panel, border: '1px solid ' + C.border, borderRadius: 12,
            padding: '1rem 1.1rem' },
  metricLabel: { fontSize: '0.75rem', color: C.inkDim,
                 textTransform: 'uppercase', letterSpacing: '0.04em' },
  metricValue: { fontSize: '1.5rem', fontWeight: 800, marginTop: '0.35rem' },
  metricEmpty: { fontSize: '0.9375rem', color: C.inkFaint, marginTop: '0.5rem', fontStyle: 'italic' },
  footer: { maxWidth: '56rem', margin: '2rem auto 0', padding: '0.6rem 0',
            borderTop: '1px dashed ' + C.border, display: 'flex',
            justifyContent: 'space-between', fontSize: '0.6875rem',
            color: C.inkFaint, fontFamily: 'monospace', letterSpacing: '0.04em' },
};
