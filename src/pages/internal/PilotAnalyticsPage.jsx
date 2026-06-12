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

// Sprint #195 — drop-off ranking derived from the existing
// __pilotMetrics() funnel. Each stage pair yields a loss count;
// stages are ranked by absolute loss. With zero events everything
// reads NEEDS_DATA — never a fabricated ranking.
const FUNNEL_STAGES = [
  ['signup',               'Signup'],
  ['farmOrGardenCreated',  'Farm / Garden created'],
  ['cropOrPlantAdded',     'Crop / Plant added'],
  ['todayActionStarted',   "Today's Action started"],
  ['todayActionCompleted', "Today's Action completed"],
  ['scanCompleted',        'Scan completed'],
  ['outcomeRecorded',      'Outcome recorded'],
  ['followupCompleted',    'Follow-up completed'],
];

function _dropOffs(funnel) {
  if (!funnel || typeof funnel !== 'object') return [];
  const out = [];
  for (let i = 1; i < FUNNEL_STAGES.length; i++) {
    const [prevKey, prevLabel] = FUNNEL_STAGES[i - 1];
    const [curKey, curLabel] = FUNNEL_STAGES[i];
    const prev = Number(funnel[prevKey]) || 0;
    const cur = Number(funnel[curKey]) || 0;
    if (prev <= 0) continue; // no data at this stage — honest skip
    const lost = Math.max(0, prev - cur);
    out.push({
      from: prevLabel, to: curLabel, lost,
      lossPct: Math.round((lost / prev) * 100),
    });
  }
  return out.sort((a, b) => b.lost - a.lost);
}

export default function PilotAnalyticsPage() {
  const snap = useMemo(() => _probe('__pilotAnalytics') || {}, []);
  // Sprint #195 — KPI envelope from the #188 aggregator. Rates are
  // null (render NEEDS_DATA) until events exist.
  const kpi = useMemo(() => _probe('__pilotMetrics') || {}, []);
  const drops = useMemo(() => _dropOffs(kpi.funnel), [kpi]);
  const window = snap.windowDays || 7;

  const _kpiPct = (v) => (v == null ? 'NEEDS_DATA' : v + '%');

  return (
    <div style={S.page} data-testid="pilot-analytics-page">
      <header style={S.header}>
        <p style={S.eyebrow}>Internal · Pilot Command Center</p>
        <h1 style={S.title}>Pilot Command Center</h1>
        <p style={S.subtitle}>
          Real metrics from the last {window} days. Rows showing
          "—" or NEEDS_DATA have not yet recorded data.
        </p>
      </header>

      {/* Sprint #195 — the 8 policy KPIs, straight from __pilotMetrics().
          North-star metrics only; vanity metrics intentionally absent. */}
      <section style={S.section} data-testid="pilot-kpi-cards">
        <h2 style={S.sectionTitle}>North-star KPIs (last {kpi.windowDays || 7}d)</h2>
        <div style={S.grid}>
          <Metric label="Today's Action started"
                  value={_fmt(kpi.funnel && kpi.funnel.todayActionStarted)} />
          <Metric label="Today's Action completed"
                  value={_fmt(kpi.funnel && kpi.funnel.todayActionCompleted)} />
          <Metric label="Scan success %"     value={_kpiPct(kpi.scanSuccessRate)}
                  sublabel="completed ÷ started" />
          <Metric label="Unknown scan %"     value={_kpiPct(kpi.unknownScanRate)}
                  sublabel="unknown ÷ completed" />
          <Metric label="Outcome capture %"  value={_kpiPct(kpi.outcomeCaptureRate)}
                  sublabel="outcomes ÷ scans" />
          <Metric label="Follow-up completion %" value={_kpiPct(kpi.followupCompletionRate)}
                  sublabel="completed ÷ created" />
          <Metric label="D1 retention %"     value={_kpiPct(kpi.d1Retention)}
                  sublabel="client-side proxy" />
          <Metric label="D7 retention %"     value={_kpiPct(kpi.d7Retention)}
                  sublabel="client-side proxy" />
        </div>
      </section>

      {/* Sprint #195 — Top user drop-offs from the funnel. */}
      <section style={S.section} data-testid="pilot-drop-offs">
        <h2 style={S.sectionTitle}>Top user drop-offs</h2>
        {drops.length === 0 ? (
          <p style={S.subtitle}>
            NEEDS_DATA — no funnel events recorded yet. Drop-offs
            appear once pilot users move through signup → action →
            scan → outcome.
          </p>
        ) : (
          <div style={S.grid}>
            {drops.slice(0, 5).map((d, i) => (
              <Metric key={i}
                label={d.from + ' → ' + d.to}
                value={d.lost + ' lost'}
                sublabel={d.lossPct + '% of stage'} />
            ))}
          </div>
        )}
      </section>

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
