/**
 * ScanTracePage.jsx — admin-only /admin/scan-trace/:scanId.
 *
 * Permanent Detection Fix §10. Reads GET /api/admin/scan/trace/:scanId
 * (server masks every API key — only `keysMasked: true` attestation
 * comes back) and renders the end-to-end pipeline state for one scan:
 *
 *   Source results · Candidates · Disease candidates ·
 *   Pest / Soil / FieldHealth envelopes · Recommendations ·
 *   Follow-ups · Learning record · Escalation status
 *
 * Pure render. Role-gated INSIDE the page (admin / super_admin /
 * ngo / field_officer).
 */
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tSafe } from '../../i18n/tSafe.js';
import { useAuth } from '../../context/AuthContext.jsx';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
const ALLOWED_ROLES = new Set(['admin', 'super_admin', 'ngo', 'field_officer']);

async function _fetchJson(url) {
  return _safe(async () => {
    if (typeof fetch === 'undefined') return null;
    const res = await fetch(url, { credentials: 'include' });
    if (!res || !res.ok) return null;
    return await res.json();
  }, null);
}

function Section({ title, children, testid }) {
  return (
    <section style={S.section} data-testid={testid}>
      <h2 style={S.h2}>{title}</h2>
      {children}
    </section>
  );
}

function Json({ value, testid }) {
  if (value == null) {
    return <p style={S.empty} data-testid={testid + '-empty'}>—</p>;
  }
  return (
    <pre style={S.pre} data-testid={testid}>
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function ScanTraceInner() {
  const { scanId } = useParams();
  const navigate = useNavigate();
  const auth = useAuth() || {};
  const role = String((auth.user && auth.user.role) || '').toLowerCase();
  const allowed = ALLOWED_ROLES.has(role);

  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!allowed || !scanId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const env = await _fetchJson('/api/admin/scan/trace/'
        + encodeURIComponent(scanId));
      if (cancelled) return;
      setData(env); setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [allowed, scanId]);

  if (!allowed) {
    return (
      <main style={S.page} data-testid="scan-trace-not-allowed">
        <p style={S.title}>{tSafe('scanTrace.notAllowed.title', 'Not available')}</p>
        <button type="button" style={S.btnPrimary}
          onClick={() => _safe(() => navigate('/home'), null)}>
          {tSafe('common.goHome', 'Go to Home')}
        </button>
      </main>
    );
  }

  const t = data && data.trace;

  return (
    <main style={S.page}
      data-testid="scan-trace-page"
      data-consumes="scanTrace"
      data-surface="scan-trace"
      data-role-scoped="true">
      <header style={S.head}>
        <p style={S.eyebrow}>{tSafe('scanTrace.eyebrow', 'Admin · Scan Trace')}</p>
        <h1 style={S.h1}>{scanId}</h1>
        <p style={S.sub}>
          {tSafe('scanTrace.sub',
            'End-to-end pipeline trace for this scan. API keys are masked.')}
        </p>
      </header>

      {loading ? <p style={S.loading}>{tSafe('scanTrace.loading', 'Loading…')}</p> : null}

      {data && !data.ok ? (
        <p style={S.error} data-testid="scan-trace-error">
          {tSafe('scanTrace.notFound', 'Scan not found.')}
        </p>
      ) : null}

      {t ? (
        <>
          <Section title={tSafe('scanTrace.summary', 'Summary')}
            testid="scan-trace-summary">
            <p style={S.kv}><span style={S.k}>Created</span>
              <span style={S.v}>{t.createdAt}</span></p>
            <p style={S.kv}><span style={S.k}>Predicted plant</span>
              <span style={S.v}>{t.predictedPlant || '—'}</span></p>
            <p style={S.kv}><span style={S.k}>Predicted issue</span>
              <span style={S.v}>{t.predictedIssue || '—'}</span></p>
            <p style={S.kv}><span style={S.k}>Confidence (band)</span>
              <span style={S.v}>{t.confidence || '—'}</span></p>
            <p style={S.kv}><span style={S.k}>Confidence (pct)</span>
              <span style={S.v}>{t.confidencePct != null ? t.confidencePct + '%' : '—'}</span></p>
            <p style={S.kv}><span style={S.k}>Consensus mode</span>
              <span style={S.v}>{t.consensusMode || '—'}</span></p>
            <p style={S.kv}><span style={S.k}>Keys masked</span>
              <span style={S.v}>{t.keysMasked ? '✓' : '✗'}</span></p>
          </Section>

          <Section title={tSafe('scanTrace.sources', 'Source results (per-provider)')}
            testid="scan-trace-sources">
            <Json value={t.sourceResults} testid="scan-trace-sources-json" />
          </Section>

          <Section title={tSafe('scanTrace.candidates', 'Plant candidates')}
            testid="scan-trace-candidates">
            <Json value={t.candidates} testid="scan-trace-candidates-json" />
          </Section>

          <Section title={tSafe('scanTrace.diseases', 'Disease candidates')}
            testid="scan-trace-diseases">
            <Json value={t.diseaseCandidates} testid="scan-trace-diseases-json" />
          </Section>

          <Section title={tSafe('scanTrace.pest', 'Pest envelope')}
            testid="scan-trace-pest">
            <Json value={t.pest} testid="scan-trace-pest-json" />
          </Section>

          <Section title={tSafe('scanTrace.fieldHealth', 'Field health (NDVI)')}
            testid="scan-trace-fieldhealth">
            <Json value={t.fieldHealth} testid="scan-trace-fieldhealth-json" />
          </Section>

          <Section title={tSafe('scanTrace.soil', 'Soil')}
            testid="scan-trace-soil">
            <Json value={t.soil} testid="scan-trace-soil-json" />
          </Section>

          <Section title={tSafe('scanTrace.recs', 'Recommendations')}
            testid="scan-trace-recs">
            <Json value={t.recommendations} testid="scan-trace-recs-json" />
          </Section>

          <Section title={tSafe('scanTrace.followUps', 'Follow-ups')}
            testid="scan-trace-followups">
            <Json value={t.followUps} testid="scan-trace-followups-json" />
          </Section>

          <Section title={tSafe('scanTrace.learning', 'Learning record')}
            testid="scan-trace-learning">
            <Json value={t.learning} testid="scan-trace-learning-json" />
          </Section>
        </>
      ) : null}

      <p style={S.note}>
        {tSafe('scanTrace.note',
          'Trace reconstructed from the persisted outcome envelope. Raw Plant.id / PlantNet responses are not stored to keep row size bounded. Decision support, not a guarantee.')}
      </p>
    </main>
  );
}

export default class ScanTracePage extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow */ }
  render() {
    if (this.state.failed) return null;
    try { return <ScanTraceInner />; } catch { return null; }
  }
}

const S = {
  page: { minHeight: '100vh', background: '#FAF7F0', color: '#2C3A26',
    fontFamily: 'system-ui', padding: '20px 16px 96px', maxWidth: 920,
    margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 },
  head: { display: 'flex', flexDirection: 'column', gap: 4 },
  eyebrow: { margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'rgba(60,72,55,0.55)' },
  h1: { margin: 0, fontSize: 18, fontWeight: 800, fontFamily: 'monospace',
    wordBreak: 'break-all' },
  h2: { margin: '0 0 8px', fontSize: 13, fontWeight: 700,
    color: 'rgba(60,72,55,0.75)', textTransform: 'uppercase',
    letterSpacing: '0.04em' },
  title: { margin: 0, fontSize: 18, fontWeight: 700 },
  sub: { margin: 0, fontSize: 12, color: 'rgba(60,72,55,0.7)' },
  section: {
    background: 'rgba(255,255,255,0.95)',
    border: '1px solid rgba(60,72,55,0.10)',
    borderRadius: 12, padding: '12px 14px',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  kv: { display: 'flex', flexDirection: 'row', gap: 12,
    fontSize: 12, margin: '2px 0' },
  k: { fontWeight: 700, color: 'rgba(60,72,55,0.7)', minWidth: 140 },
  v: { color: '#1F2933', fontFamily: 'monospace' },
  pre: { background: 'rgba(60,72,55,0.04)', padding: 10, borderRadius: 8,
    fontSize: 11, overflowX: 'auto', margin: 0,
    fontFamily: 'monospace', lineHeight: 1.4 },
  empty: { margin: 0, fontSize: 12, color: 'rgba(60,72,55,0.5)' },
  loading: { fontSize: 13, color: 'rgba(60,72,55,0.6)' },
  error: { fontSize: 13, color: '#a13a3a' },
  note: { margin: 0, fontSize: 10, color: 'rgba(60,72,55,0.55)' },
  btnPrimary: { minHeight: 40, padding: '0 18px', borderRadius: 10, border: 'none',
    background: '#2f7a3a', color: '#fff', fontSize: 14, fontWeight: 700,
    cursor: 'pointer', alignSelf: 'flex-start' },
};
