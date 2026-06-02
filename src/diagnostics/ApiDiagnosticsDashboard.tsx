/**
 * ApiDiagnosticsDashboard.tsx — admin-only /admin/system-health page.
 *
 * Renders each of the 12 service checks with traffic-light color
 * (green / yellow / red) + latency + last error. Triggers
 * runAllChecks() on mount + on the operator's "Re-check" button.
 *
 * Role-gated INSIDE the page (admin only).
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { tSafe } from '../i18n/tSafe.js';
import { useAuth } from '../context/AuthContext.jsx';
import { runAllChecks } from './ApiHealthChecks';
import type { ApiCheckResult } from './ApiHealthChecks';
import { writeCheckCache, apiHealth } from './ApiHealthRuntime';
import { recordLatencySample } from './ApiLatencyMonitor';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

const ALLOWED_ROLES = new Set(['admin']);

type Light = 'green' | 'yellow' | 'red';

function _light(r: ApiCheckResult): Light {
  if (r.status === 'connected') return 'green';
  if (r.status === 'unconfigured' || r.status === 'unknown'
      || r.serverProbeRequired) return 'yellow';
  return 'red';
}

function _lightColor(light: Light): string {
  if (light === 'green') return '#2f7a3a';
  if (light === 'yellow') return '#9a6a00';
  return '#a13a3a';
}

function _lightLabel(light: Light): string {
  if (light === 'green') return tSafe('apiHealth.light.green', 'Connected');
  if (light === 'yellow') return tSafe('apiHealth.light.yellow', 'Needs check');
  return tSafe('apiHealth.light.red', 'Failed');
}

function _fmtLatency(ms: number | null): string {
  if (ms === null || ms === undefined) return '—';
  return ms + ' ms';
}

function _fmtTs(ts: number | null): string {
  if (ts === null) return tSafe('apiHealth.lastCheck.never', 'Never');
  return _safe(() => {
    const diff = Math.max(0, Date.now() - ts);
    if (diff < 60_000) return Math.round(diff / 1000) + 's ago';
    if (diff < 3_600_000) return Math.round(diff / 60_000) + 'm ago';
    return Math.round(diff / 3_600_000) + 'h ago';
  }, '—');
}

interface PageState {
  checking: boolean;
  results: ReadonlyArray<Readonly<ApiCheckResult>>;
  lastCheckTs: number | null;
  envelope: ReturnType<typeof apiHealth> | null;
}

function ApiDiagnosticsDashboardInner() {
  const navigate = useNavigate();
  const auth = useAuth() || {};
  const user = (auth as any).user;
  const role = String((user && user.role) || '').toLowerCase();
  const allowed = ALLOWED_ROLES.has(role);

  const [state, setState] = React.useState<PageState>({
    checking: false, results: [], lastCheckTs: null,
    envelope: _safe(() => apiHealth(), null),
  });

  const runChecks = React.useCallback(async () => {
    setState((s) => ({ ...s, checking: true }));
    try {
      const results = await runAllChecks();
      const nowMs = Date.now();
      _safe(() => writeCheckCache(results, nowMs), undefined);
      // Persist latency samples for the monitor.
      for (const r of results) {
        if (r.latencyMs !== null) {
          _safe(() => recordLatencySample(r.serviceKey, r.latencyMs as number, r.status, nowMs), undefined);
        }
      }
      const envelope = _safe(() => apiHealth(), null);
      setState({ checking: false, results, lastCheckTs: nowMs, envelope });
    } catch {
      setState((s) => ({ ...s, checking: false }));
    }
  }, []);

  React.useEffect(() => {
    if (!allowed) return;
    // Auto-run once on mount.
    runChecks();
  }, [allowed, runChecks]);

  if (!allowed) {
    return (
      <main style={S.page} data-testid="api-health-not-allowed">
        <p style={S.title}>{tSafe('apiHealth.notAllowed.title', 'Not available')}</p>
        <p style={S.sub}>
          {tSafe('apiHealth.notAllowed.body', 'System health is for admins only.')}
        </p>
        <button type="button" style={S.btnPrimary}
          onClick={() => _safe(() => navigate('/home'), null)}>
          {tSafe('common.goHome', 'Go to Home')}
        </button>
      </main>
    );
  }

  const env = state.envelope;
  const results = state.results;

  return (
    <main
      style={S.page}
      data-testid="api-health-page"
      data-consumes="apiHealth"
      data-surface="system-health"
      data-role-scoped="true">
      <header style={S.head}>
        <p style={S.eyebrow}>{tSafe('apiHealth.eyebrow', 'System Health')}</p>
        <h1 style={S.h1}>{tSafe('apiHealth.title', 'API Diagnostics')}</h1>
        <p style={S.sub}>
          {tSafe('apiHealth.sub',
            'Connectivity, latency, and configuration for each production service.')}
        </p>
        <div style={S.headRow}>
          <button type="button" style={S.btnPrimary}
            onClick={runChecks}
            disabled={state.checking}
            data-testid="api-health-recheck">
            {state.checking
              ? tSafe('apiHealth.button.checking', 'Checking…')
              : tSafe('apiHealth.button.recheck', 'Re-check all')}
          </button>
          <span style={S.lastCheck}>
            {tSafe('apiHealth.lastCheck.label', 'Last check')}
            {': '}{_fmtTs(state.lastCheckTs)}
          </span>
        </div>
      </header>

      {/* Scores band */}
      {env ? (
        <section style={S.scores} data-testid="api-health-scores">
          <div style={S.scoreCard}>
            <p style={S.scoreLabel}>{tSafe('apiHealth.overall', 'Overall Health')}</p>
            <p style={S.scoreValue}>
              {env.overallHealthScore === null
                ? tSafe('apiHealth.needsData', 'Not enough data yet')
                : env.overallHealthScore + ' / 100'}
            </p>
            <p style={S.scoreSub}>
              {env.connectedCount}/{env.totalServices}{' '}
              {tSafe('apiHealth.connected', 'connected')}
            </p>
          </div>
          <div style={S.scoreCard}>
            <p style={S.scoreLabel}>{tSafe('apiHealth.scanReadiness', 'Scan Readiness')}</p>
            <p style={S.scoreValue}>
              {env.scanReadinessScore === null
                ? tSafe('apiHealth.needsData', 'Not enough data yet')
                : env.scanReadinessScore + ' / 100'}
            </p>
            <p style={S.scoreSub}>{env.scanReadinessRecommendation}</p>
          </div>
        </section>
      ) : null}

      {/* Per-service table */}
      <section style={S.section} data-testid="api-health-services">
        <p style={S.sectionEyebrow}>{tSafe('apiHealth.section.services', 'Services')}</p>
        <div style={S.table}>
          {results.length === 0 ? (
            <p style={S.empty} data-testid="api-health-empty">
              {tSafe('apiHealth.empty',
                'No checks have run yet. Click "Re-check all" to verify each service.')}
            </p>
          ) : results.map((r) => {
            const light = _light(r);
            return (
              <div key={r.serviceKey} style={S.row}
                data-testid={'api-row-' + r.serviceKey}
                data-light={light}>
                <span style={{ ...S.lightDot, background: _lightColor(light) }}
                  aria-label={_lightLabel(light)} />
                <span style={S.serviceName}>{r.service}</span>
                <span style={S.statusLabel}>{_lightLabel(light)}</span>
                <span style={S.latency}>{_fmtLatency(r.latencyMs)}</span>
                <span style={S.error}>
                  {r.error ? r.error : (r.serverProbeRequired
                    ? tSafe('apiHealth.serverProbeRequired',
                        'Server /api/health/* needed to verify')
                    : '')}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Missing env vars */}
      {env && env.missingEnvVars.length > 0 ? (
        <section style={S.section} data-testid="api-health-missing-env">
          <p style={S.sectionEyebrow}>
            {tSafe('apiHealth.section.missingEnv', 'Missing environment variables')}
          </p>
          <ul style={S.envList}>
            {env.missingEnvVars.map((e) => (
              <li key={e} style={S.envItem}>{e}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <p style={S.note}>
        {tSafe('apiHealth.note.honest',
          'Green means the check returned connected. Yellow means the service is server-side or unconfigured. Red means the check failed. No fake greens.')}
      </p>
    </main>
  );
}

export default class ApiDiagnosticsDashboard extends React.Component {
  constructor(props: any) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow */ }
  render() {
    if ((this.state as any).failed) return null;
    try { return <ApiDiagnosticsDashboardInner />; } catch { return null; }
  }
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#FAF7F0', color: '#2C3A26',
    fontFamily: 'system-ui', padding: '20px 16px 96px', maxWidth: 920,
    margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 },
  head: { display: 'flex', flexDirection: 'column', gap: 6 },
  headRow: { display: 'flex', flexDirection: 'row', gap: 12, alignItems: 'center',
    marginTop: 6, flexWrap: 'wrap' },
  eyebrow: { margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'rgba(60,72,55,0.55)' },
  h1: { margin: 0, fontSize: 22, fontWeight: 800, lineHeight: 1.2 },
  title: { margin: 0, fontSize: 18, fontWeight: 700 },
  sub: { margin: 0, fontSize: 13, color: 'rgba(60,72,55,0.7)' },
  lastCheck: { fontSize: 12, color: 'rgba(60,72,55,0.6)' },
  scores: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 },
  scoreCard: { background: 'rgba(255,255,255,0.95)',
    border: '1px solid rgba(60,72,55,0.10)', borderRadius: 12,
    padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 },
  scoreLabel: { margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'rgba(60,72,55,0.55)' },
  scoreValue: { margin: 0, fontSize: 24, fontWeight: 800, lineHeight: 1.1 },
  scoreSub: { margin: 0, fontSize: 12, color: 'rgba(60,72,55,0.7)', lineHeight: 1.35 },
  section: { display: 'flex', flexDirection: 'column', gap: 8 },
  sectionEyebrow: { margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'rgba(60,72,55,0.62)' },
  table: { display: 'flex', flexDirection: 'column', gap: 4,
    border: '1px solid rgba(60,72,55,0.10)', borderRadius: 12,
    background: 'rgba(255,255,255,0.85)', overflow: 'hidden' },
  row: { display: 'grid',
    gridTemplateColumns: '14px 1.2fr 0.8fr 0.5fr 1.5fr',
    gap: 10, alignItems: 'center',
    padding: '10px 12px',
    borderBottom: '1px solid rgba(60,72,55,0.06)',
    fontSize: 13 },
  lightDot: { width: 10, height: 10, borderRadius: '50%',
    display: 'inline-block' },
  serviceName: { fontWeight: 700, color: 'rgba(40,52,40,0.95)' },
  statusLabel: { fontSize: 12, fontWeight: 600 },
  latency: { fontSize: 12, color: 'rgba(60,72,55,0.7)' },
  error: { fontSize: 12, color: 'rgba(60,72,55,0.65)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  empty: { margin: 0, padding: '20px', fontSize: 13,
    color: 'rgba(60,72,55,0.7)', textAlign: 'center' },
  envList: { margin: 0, padding: '8px 16px',
    background: 'rgba(255,255,255,0.85)',
    border: '1px solid rgba(60,72,55,0.10)', borderRadius: 12 },
  envItem: { fontSize: 13, fontFamily: 'monospace',
    color: 'rgba(40,52,40,0.9)', padding: '4px 0' },
  note: { margin: 0, fontSize: 11, color: 'rgba(60,72,55,0.55)' },
  btnPrimary: { minHeight: 40, padding: '0 18px', borderRadius: 10, border: 'none',
    background: '#2f7a3a', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
};
