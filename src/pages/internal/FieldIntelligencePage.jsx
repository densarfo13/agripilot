/**
 * src/pages/internal/FieldIntelligencePage.jsx — wave-37
 * admin-only executive field-intelligence dashboard.
 *
 *   Route:  /internal/intelligence
 *   Gate:   RoleRoute roles={ADMIN_ROLES}
 *
 * Renders 7 panels from the wave-37 globals. Each panel shows
 * real data or the canonical "Not enough field data yet" empty
 * state — never fakes.
 *
 * Strict-rule audit
 *   • Pure render. Probe reads in try/catch.
 *   • Admin-only via App.jsx route wrapper.
 *   • No fake metrics. No fabricated regions. No hardcoded scores.
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

const EMPTY = 'Not enough field data yet';

function Section({ title, sub, children }) {
  return (
    <section style={S.section}>
      <header style={S.sectionHeader}>
        <h2 style={S.sectionTitle}>{title}</h2>
        {sub && <p style={S.sectionSub}>{sub}</p>}
      </header>
      <div style={S.sectionBody}>{children}</div>
    </section>
  );
}

function Empty({ msg }) {
  return <div style={S.empty}>{msg || EMPTY}</div>;
}

function LeaderboardTable({ rows, columns, emptyMsg }) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return <Empty msg={emptyMsg} />;
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={S.table}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={S.th}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={S.tr}>
              {columns.map((c) => (
                <td key={c.key} style={S.td}>{c.fmt ? c.fmt(r[c.key], r) : (r[c.key] ?? '—')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Score({ score, band, label }) {
  if (score == null) return <Empty />;
  return (
    <div style={S.scoreBox}>
      <div style={S.scoreNumber}>{score}</div>
      <div style={S.scoreBand}>{band || ''}</div>
      <div style={S.scoreLabel}>{label}</div>
    </div>
  );
}

function Field({ label, value, fmt }) {
  let display;
  if (value == null) display = '—';
  else if (fmt) display = fmt(value);
  else if (typeof value === 'number') display = value.toLocaleString();
  else display = String(value);
  return (
    <div style={S.field}>
      <div style={S.fieldLabel}>{label}</div>
      <div style={S.fieldValue}>{display}</div>
    </div>
  );
}

export default function FieldIntelligencePage() {
  const intel = useMemo(() => ({
    fih:        _probe('__fieldIntelligenceHealth') || {},
    disease:    _probe('__diseaseLeaderboard')      || {},
    pest:       _probe('__pestLeaderboard')         || {},
    treatment:  _probe('__treatmentEffectiveness')  || {},
    regional:   _probe('__regionalRisk')            || {},
    farmHealth: _probe('__farmHealthScore')         || {},
    ngoImpact:  _probe('__ngoImpactHealth')         || {},
    buyer:      _probe('__buyerTrustHealth')        || {},
    yieldRdy:   _probe('__yieldReadiness')          || {},
  }), []);

  return (
    <div style={S.page} data-testid="field-intelligence-page">
      <header style={S.header}>
        <p style={S.eyebrow}>Internal · Field Intelligence</p>
        <h1 style={S.title}>Executive Intelligence</h1>
        <p style={S.subtitle}>
          Real-data composite over outcomes + retention events.
          Empty panels read "{EMPTY}" — never fakes.
        </p>
      </header>

      <Section title="Top diseases" sub="By total scan references">
        <LeaderboardTable
          rows={intel.disease.entries}
          emptyMsg={intel.disease.emptyState}
          columns={[
            { key: 'disease',        label: 'Plant / disease group' },
            { key: 'scans',          label: 'Scans' },
            { key: 'affectedPlants', label: 'Affected outcomes' },
            { key: 'regions',        label: 'Regions',
              fmt: (v) => Array.isArray(v) && v.length ? v.join(', ') : '—' },
          ]}
        />
      </Section>

      <Section title="Top pests" sub="With 7d trend window">
        <LeaderboardTable
          rows={intel.pest.entries}
          emptyMsg={intel.pest.emptyState}
          columns={[
            { key: 'pest',          label: 'Plant / pest group' },
            { key: 'detections',    label: 'Detections' },
            { key: 'farmsAffected', label: 'Farms' },
            { key: 'trend',         label: 'Trend' },
          ]}
        />
      </Section>

      <Section title="Treatment effectiveness" sub="Recommendation → outcome success">
        <LeaderboardTable
          rows={intel.treatment.entries}
          emptyMsg={intel.treatment.emptyState}
          columns={[
            { key: 'recommendation', label: 'Recommendation' },
            { key: 'totalUses',      label: 'Uses' },
            { key: 'improved',       label: 'Improved' },
            { key: 'unchanged',      label: 'Unchanged' },
            { key: 'worsened',       label: 'Worsened' },
            { key: 'successRate',    label: 'Success %',
              fmt: (v) => v == null ? '—' : `${v}%` },
          ]}
        />
      </Section>

      <Section title="Regional risk" sub="Composite over outcomes (real regions only)">
        <LeaderboardTable
          rows={intel.regional.entries}
          emptyMsg={intel.regional.emptyState}
          columns={[
            { key: 'region',       label: 'Region' },
            { key: 'diseaseRisk',  label: 'Disease',  fmt: (v) => v == null ? '—' : v },
            { key: 'pestRisk',     label: 'Pest',     fmt: (v) => v == null ? '—' : v },
            { key: 'nutrientRisk', label: 'Nutrient', fmt: (v) => v == null ? '—' : v },
            { key: 'weatherRisk',  label: 'Weather',  fmt: (v) => v == null ? '—' : v },
            { key: 'sampleSize',   label: 'n' },
          ]}
        />
      </Section>

      <Section title="Farm health score" sub="0–100 composite (rolling 30d)">
        <div style={S.scoreRow}>
          <Score score={intel.farmHealth.score}
                 band={intel.farmHealth.band}
                 label="Composite" />
          {intel.farmHealth.components && (
            <div style={S.components}>
              <Field label="Disease score"   value={intel.farmHealth.components.diseaseScore} />
              <Field label="Pest score"      value={intel.farmHealth.components.pestScore} />
              <Field label="Task completion" value={intel.farmHealth.components.taskCompletion} fmt={(v) => `${v}%`} />
              <Field label="Follow-up rate"  value={intel.farmHealth.components.followUpRate} fmt={(v) => `${v}%`} />
              <Field label="Plant trend"     value={intel.farmHealth.components.plantTrend}    fmt={(v) => `${v}%`} />
            </div>
          )}
        </div>
      </Section>

      <Section title="NGO impact" sub="Outcome-grounded metrics">
        <div style={S.grid}>
          <Field label="Farmers enrolled" value={intel.ngoImpact.farmersEnrolled} />
          <Field label="Scans completed"  value={intel.ngoImpact.scansCompleted} />
          <Field label="Tasks completed"  value={intel.ngoImpact.tasksCompleted} />
          <Field label="Follow-ups"       value={intel.ngoImpact.followUps} />
          <Field label="Improvement rate" value={intel.ngoImpact.improvementRate} fmt={(v) => `${v}%`} />
        </div>
        {intel.ngoImpact.emptyState && <Empty msg={intel.ngoImpact.emptyState} />}
      </Section>

      <Section title="Yield readiness" sub="LOW · MEDIUM · HIGH (never a yield prediction)">
        <div style={S.scoreRow}>
          <Score score={intel.yieldRdy.score}
                 band={intel.yieldRdy.value}
                 label="Composite" />
          {intel.yieldRdy.components && (
            <div style={S.components}>
              <Field label="Disease pressure" value={intel.yieldRdy.components.diseasePressure} />
              <Field label="Pest pressure"    value={intel.yieldRdy.components.pestPressure} />
              <Field label="Task completion"  value={intel.yieldRdy.components.taskCompletion} fmt={(v) => `${v}%`} />
              <Field label="Weather risk"     value={intel.yieldRdy.components.weatherRisk} />
            </div>
          )}
        </div>
      </Section>

      <Section title="Buyer trust" sub="Verified scans + follow-up history (no payments)">
        <div style={S.grid}>
          <Field label="Verified scans"     value={intel.buyer.verifiedScans} />
          <Field label="Follow-up history"  value={intel.buyer.followUpHistory} />
          <Field label="Health score"       value={intel.buyer.healthScore} />
          <Field label="Harvest readiness"  value={intel.buyer.harvestReadiness} />
        </div>
        {intel.buyer.emptyState && <Empty msg={intel.buyer.emptyState} />}
      </Section>

      <footer style={S.footer}>
        <span>intelligenceReady: {String(intel.fih.intelligenceReady)}</span>
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
  header: { maxWidth: '64rem', margin: '0 auto 1.5rem' },
  eyebrow: { margin: 0, fontSize: '0.6875rem', fontWeight: 700,
             letterSpacing: '0.12em', textTransform: 'uppercase', color: C.accent },
  title:    { margin: '0.5rem 0', fontSize: '1.75rem', fontWeight: 800 },
  subtitle: { margin: 0, fontSize: '0.9375rem', color: C.inkDim, lineHeight: 1.5 },
  section: { maxWidth: '64rem', margin: '0 auto 1.5rem' },
  sectionHeader: { marginBottom: '0.75rem' },
  sectionTitle: { margin: 0, fontSize: '1rem', fontWeight: 800 },
  sectionSub:   { margin: '0.2rem 0 0', fontSize: '0.8125rem', color: C.inkDim },
  sectionBody:  { background: C.panel, border: '1px solid '+C.border,
                  borderRadius: 12, padding: '1rem 1.1rem' },
  empty: { color: C.inkFaint, fontStyle: 'italic', fontSize: '0.875rem',
           padding: '0.6rem 0' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' },
  th: { textAlign: 'left', padding: '0.5rem 0.4rem',
        color: C.inkDim, fontSize: '0.7rem', textTransform: 'uppercase',
        letterSpacing: '0.06em', borderBottom: '1px solid '+C.border },
  tr: {},
  td: { padding: '0.55rem 0.4rem', borderBottom: '1px dashed '+C.border,
        fontFamily: 'monospace' },
  scoreRow: { display: 'flex', gap: '1rem', flexWrap: 'wrap',
              alignItems: 'flex-start' },
  scoreBox: { background: 'rgba(255,255,255,0.03)', border: '1px solid '+C.border,
              borderRadius: 12, padding: '1rem 1.25rem', minWidth: 140,
              display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  scoreNumber: { fontSize: '2.4rem', fontWeight: 800, fontFamily: 'monospace' },
  scoreBand:   { fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em',
                 textTransform: 'uppercase', color: C.accent },
  scoreLabel:  { fontSize: '0.75rem', color: C.inkDim },
  components:  { display: 'grid',
                 gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                 gap: '0.5rem', flex: 1 },
  grid: { display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.5rem' },
  field: { padding: '0.6rem 0.75rem',
           background: 'rgba(255,255,255,0.03)', border: '1px solid '+C.border,
           borderRadius: 8 },
  fieldLabel: { fontSize: '0.7rem', color: C.inkDim,
                textTransform: 'uppercase', letterSpacing: '0.04em' },
  fieldValue: { fontSize: '1.05rem', fontWeight: 700, fontFamily: 'monospace',
                marginTop: '0.2rem' },
  footer: { maxWidth: '64rem', margin: '2rem auto 0', padding: '0.6rem 0',
            borderTop: '1px dashed '+C.border, display: 'flex',
            justifyContent: 'space-between', fontSize: '0.6875rem',
            color: C.inkFaint, fontFamily: 'monospace', letterSpacing: '0.04em' },
};
