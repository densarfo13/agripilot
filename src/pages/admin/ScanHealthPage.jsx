/**
 * ScanHealthPage.jsx — admin-only /admin/scan-health surface.
 *
 * Scan Recovery Sprint §8.
 *
 * Renders five service rows with traffic-light status:
 *   • Plant.id          — fetched from /api/health/scan-provider
 *                          + window.__apiHealth()
 *   • PlantNet          — same probe path
 *   • Disease Engine    — alias for Plant.id (carries disease module)
 *   • Consensus Engine  — true when BOTH Plant.id + PlantNet ready
 *   • UI                — window.__scanRecoveryHealth() + window.__scanResultHealth()
 *
 * Role-gated INSIDE the page (admin only). Reads window globals;
 * never throws; renders something sensible even when probes return
 * null. Honesty: green only when the probe reports connected; yellow
 * when not configured or server-probe-required; red when failed.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { tSafe } from '../../i18n/tSafe.js';
import { useAuth } from '../../context/AuthContext.jsx';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

const ALLOWED_ROLES = new Set(['admin']);

function _readApiHealth() {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const fn = window.__apiHealth;
    return typeof fn === 'function' ? fn() : null;
  }, null);
}

function _readScanRecoveryHealth() {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const fn = window.__scanRecoveryHealth;
    return typeof fn === 'function' ? fn() : null;
  }, null);
}

function _readScanResultHealth() {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const fn = window.__scanResultHealth;
    return typeof fn === 'function' ? fn() : null;
  }, null);
}

function _light(status) {
  if (status === 'green') return '#2f7a3a';
  if (status === 'yellow') return '#9a6a00';
  return '#a13a3a';
}

function _statusLabel(status) {
  if (status === 'green') return tSafe('scanHealth.status.green', 'Connected');
  if (status === 'yellow') return tSafe('scanHealth.status.yellow', 'Needs check');
  return tSafe('scanHealth.status.red', 'Failed');
}

function _computeRows(api, recovery, resultHealth) {
  const plantIdFlag  = !!(api && api.plantId);
  const plantNetFlag = !!(api && api.plantNet);
  const scanPipelineFlag = !!(api && api.scanPipeline);

  // Plant.id row — green when the probe reports connected; yellow
  // when the API health endpoint reports server-probe-required.
  const plantIdRow = {
    key: 'plantid',
    label: tSafe('scanHealth.row.plantId', 'Plant.id'),
    status: plantIdFlag ? 'green'
      : (api && api.checkedCount === 0) ? 'yellow' : 'red',
    detail: plantIdFlag
      ? tSafe('scanHealth.detail.plantIdGreen', 'PLANT_ID_API_KEY active; disease module wired.')
      : tSafe('scanHealth.detail.plantIdServer', 'Server-side check needed — run /admin/system-health re-check.'),
  };

  const plantNetRow = {
    key: 'plantnet',
    label: tSafe('scanHealth.row.plantNet', 'PlantNet'),
    status: plantNetFlag ? 'green' : 'yellow',
    detail: plantNetFlag
      ? tSafe('scanHealth.detail.plantNetGreen', 'PLANTNET_API_KEY active; species ID online.')
      : tSafe('scanHealth.detail.plantNetUnchecked', 'Probe has not run yet OR PLANTNET_API_KEY not set.'),
  };

  // Disease row — green when Plant.id is green (Plant.id carries
  // the disease module). Yellow when Plant.id alone is unconfirmed.
  const diseaseRow = {
    key: 'disease',
    label: tSafe('scanHealth.row.disease', 'Disease Engine'),
    status: plantIdFlag ? 'green' : 'yellow',
    detail: plantIdFlag
      ? tSafe('scanHealth.detail.diseaseGreen', 'Plant.id v3 disease module active.')
      : tSafe('scanHealth.detail.diseaseYellow', 'Falls back to PlantNet then regex rules.'),
  };

  // Consensus row — green ONLY when both Plant.id + PlantNet are
  // available so the multi-source path can actually run.
  const consensusRow = {
    key: 'consensus',
    label: tSafe('scanHealth.row.consensus', 'Consensus Engine'),
    status: (plantIdFlag && plantNetFlag) ? 'green'
      : (plantIdFlag || plantNetFlag) ? 'yellow' : 'red',
    detail: (plantIdFlag && plantNetFlag)
      ? tSafe('scanHealth.detail.consensusGreen', 'Multi-source consensus (Plant.id + PlantNet) active.')
      : (plantIdFlag || plantNetFlag)
        ? tSafe('scanHealth.detail.consensusSingle', 'Running in single-provider mode.')
        : tSafe('scanHealth.detail.consensusRed', 'No providers configured.'),
  };

  // UI row — green when the recovery runtime + result health both
  // report the IntelligentScanResult path is live.
  const recoveryOk   = !!(recovery && recovery.initialized
                          && recovery.executesPipelinePerScan);
  const intelligentPathOk = !!(resultHealth && resultHealth.intelligentPathActive);
  const uiRow = {
    key: 'ui',
    label: tSafe('scanHealth.row.ui', 'Scan UI'),
    status: (recoveryOk && intelligentPathOk && scanPipelineFlag) ? 'green'
      : (recoveryOk || intelligentPathOk) ? 'yellow' : 'red',
    detail: (recoveryOk && intelligentPathOk)
      ? tSafe('scanHealth.detail.uiGreen', 'IntelligentScanResult + runScanPipeline wired.')
      : tSafe('scanHealth.detail.uiYellow', 'Legacy result card may still mount.'),
  };

  return [plantIdRow, plantNetRow, diseaseRow, consensusRow, uiRow];
}

function ScanHealthInner() {
  const navigate = useNavigate();
  const auth = useAuth() || {};
  const user = (auth || {}).user;
  const role = String((user && user.role) || '').toLowerCase();
  const allowed = ALLOWED_ROLES.has(role);

  const [api, setApi] = React.useState(() => _readApiHealth());
  const [recovery, setRecovery] = React.useState(() => _readScanRecoveryHealth());
  const [resultHealth, setResultHealth] = React.useState(() => _readScanResultHealth());

  const refresh = React.useCallback(() => {
    setApi(_readApiHealth());
    setRecovery(_readScanRecoveryHealth());
    setResultHealth(_readScanResultHealth());
  }, []);

  React.useEffect(() => {
    if (!allowed) return undefined;
    refresh();
    const id = setInterval(refresh, 8000);
    return () => { try { clearInterval(id); } catch { /* */ } };
  }, [allowed, refresh]);

  if (!allowed) {
    return (
      <main style={S.page} data-testid="scan-health-not-allowed">
        <p style={S.title}>{tSafe('scanHealth.notAllowed.title', 'Not available')}</p>
        <p style={S.sub}>
          {tSafe('scanHealth.notAllowed.body', 'Scan health is for admins only.')}
        </p>
        <button type="button" style={S.btnPrimary}
          onClick={() => _safe(() => navigate('/home'), null)}>
          {tSafe('common.goHome', 'Go to Home')}
        </button>
      </main>
    );
  }

  const rows = _computeRows(api, recovery, resultHealth);
  const greens = rows.filter((r) => r.status === 'green').length;

  return (
    <main
      style={S.page}
      data-testid="scan-health-page"
      data-consumes="scanRecovery"
      data-surface="scan-health"
      data-role-scoped="true">
      <header style={S.head}>
        <p style={S.eyebrow}>{tSafe('scanHealth.eyebrow', 'Scan Health')}</p>
        <h1 style={S.h1}>{tSafe('scanHealth.title', 'Scan Diagnostics')}</h1>
        <p style={S.sub}>
          {tSafe('scanHealth.sub',
            'Live status for Plant.id, PlantNet, disease module, consensus, and the UI path.')}
        </p>
        <div style={S.headRow}>
          <button type="button" style={S.btnPrimary}
            onClick={refresh}
            data-testid="scan-health-refresh">
            {tSafe('scanHealth.button.refresh', 'Refresh')}
          </button>
          <span style={S.summary}>{greens}/5 {tSafe('scanHealth.green', 'green')}</span>
        </div>
      </header>

      <section style={S.section} data-testid="scan-health-rows">
        <div style={S.table}>
          {rows.map((r) => (
            <div key={r.key} style={S.row}
              data-testid={'scan-health-row-' + r.key}
              data-light={r.status}>
              <span style={{ ...S.lightDot, background: _light(r.status) }}
                aria-label={_statusLabel(r.status)} />
              <span style={S.serviceName}>{r.label}</span>
              <span style={S.statusLabel}>{_statusLabel(r.status)}</span>
              <span style={S.detail}>{r.detail}</span>
            </div>
          ))}
        </div>
      </section>

      <p style={S.note}>
        {tSafe('scanHealth.note',
          'Green means the underlying probe reported connected. Yellow means the service is unconfigured or the probe has not run yet. Red means the check failed. No fake greens.')}
      </p>
    </main>
  );
}

export default class ScanHealthPage extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow */ }
  render() {
    if (this.state.failed) return null;
    try { return <ScanHealthInner />; } catch { return null; }
  }
}

const S = {
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
  summary: { fontSize: 12, color: 'rgba(60,72,55,0.6)' },
  section: { display: 'flex', flexDirection: 'column', gap: 8 },
  table: { display: 'flex', flexDirection: 'column', gap: 4,
    border: '1px solid rgba(60,72,55,0.10)', borderRadius: 12,
    background: 'rgba(255,255,255,0.85)', overflow: 'hidden' },
  row: { display: 'grid',
    gridTemplateColumns: '14px 1fr 0.8fr 2fr',
    gap: 10, alignItems: 'center',
    padding: '12px 14px',
    borderBottom: '1px solid rgba(60,72,55,0.06)',
    fontSize: 13 },
  lightDot: { width: 12, height: 12, borderRadius: '50%' },
  serviceName: { fontWeight: 700 },
  statusLabel: { fontSize: 12, fontWeight: 600 },
  detail: { fontSize: 12, color: 'rgba(60,72,55,0.7)', lineHeight: 1.4 },
  note: { margin: 0, fontSize: 11, color: 'rgba(60,72,55,0.55)' },
  btnPrimary: { minHeight: 40, padding: '0 18px', borderRadius: 10, border: 'none',
    background: '#2f7a3a', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
};
