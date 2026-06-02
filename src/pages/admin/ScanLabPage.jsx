/**
 * ScanLabPage.jsx — admin-only /admin/scan-lab.
 *
 * Pilot Validation framework. NOT a grower feature — admins use
 * this to upload labelled images, run them through /api/scan/analyze,
 * record the model's predictions alongside the operator's ground
 * truth, and watch the accuracy dashboard.
 *
 * Sections:
 *   1. Upload + Analyze   — file input + crop-name hint + Analyze
 *                           button → POSTs /api/scan/analyze →
 *                           POSTs /api/admin/scan-validation
 *   2. Label / Feedback   — for the row just created, capture
 *                           actualPlant / actualDisease / actualPest
 *                           AND a ✓/✗ feedback button (recorded as
 *                           a ScanFeedback row).
 *   3. Accuracy Dashboard — plant / disease / pest / unknown rate /
 *                           false positive / avg confidence with a
 *                           7-day window selector.
 *   4. Top Failures       — most misidentified plants / diseases /
 *                           pests over 30 days.
 *   5. Confidence Calibration — 5-band table showing actual
 *                           accuracy vs predicted confidence midpoint;
 *                           positive inflation = model overclaims.
 *
 * Role-gated INSIDE the page (admin only). Never throws.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { tSafe } from '../../i18n/tSafe.js';
import { useAuth } from '../../context/AuthContext.jsx';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
const ALLOWED_ROLES = new Set(['admin', 'super_admin']);

async function _fetchJson(url, init) {
  return _safe(async () => {
    if (typeof fetch === 'undefined') return null;
    const res = await fetch(url, { ...init, credentials: 'include' });
    if (!res || !res.ok) return null;
    return await res.json();
  }, null);
}

function _fileToBase64(file) {
  return new Promise((resolve) => {
    try {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    } catch { resolve(''); }
  });
}

function _fmtPct(n) {
  if (n == null) return '—';
  return Math.round(Number(n) * 10) / 10 + '%';
}

function _statusColor(value, target, higherIsBetter = true) {
  if (value == null || target == null) return '#9a6a00';
  const meets = higherIsBetter ? value > target : value < target;
  return meets ? '#2f7a3a' : '#a13a3a';
}

function ScanLabInner() {
  const navigate = useNavigate();
  const auth = useAuth() || {};
  const role = String((auth.user && auth.user.role) || '').toLowerCase();
  const allowed = ALLOWED_ROLES.has(role);

  const [metrics, setMetrics] = React.useState(null);
  const [failures, setFailures] = React.useState(null);
  const [calibration, setCalibration] = React.useState(null);
  const [recentRows, setRecentRows] = React.useState([]);
  const [windowDays, setWindowDays] = React.useState(7);

  const [file, setFile] = React.useState(null);
  const [cropHint, setCropHint] = React.useState('');
  const [analyzing, setAnalyzing] = React.useState(false);
  const [lastResult, setLastResult] = React.useState(null);
  const [lastValidationId, setLastValidationId] = React.useState('');
  const [actualPlant, setActualPlant] = React.useState('');
  const [actualDisease, setActualDisease] = React.useState('');
  const [actualPest, setActualPest] = React.useState('');
  const [labelSaving, setLabelSaving] = React.useState(false);
  const [labelStatus, setLabelStatus] = React.useState('');

  const refreshAll = React.useCallback(async () => {
    if (!allowed) return;
    const [m, f, c, list] = await Promise.all([
      _fetchJson('/api/admin/scan-validation/metrics?days=' + String(windowDays)),
      _fetchJson('/api/admin/scan-validation/top-failures?days=30&limit=10'),
      _fetchJson('/api/admin/scan-validation/calibration?days=30'),
      _fetchJson('/api/admin/scan-validation?limit=20'),
    ]);
    setMetrics(m); setFailures(f); setCalibration(c);
    setRecentRows((list && Array.isArray(list.rows)) ? list.rows : []);
  }, [allowed, windowDays]);

  React.useEffect(() => { refreshAll(); }, [refreshAll]);

  const runAnalyze = React.useCallback(async () => {
    if (!file || analyzing) return;
    setAnalyzing(true);
    setLastResult(null); setLastValidationId('');
    setLabelStatus(''); setActualPlant(''); setActualDisease(''); setActualPest('');
    try {
      const base64 = await _fileToBase64(file);
      if (!base64) { setAnalyzing(false); return; }
      const t0 = Date.now();
      const analyzeRes = await _fetchJson('/api/scan/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          cropName: cropHint || null,
        }),
      });
      const latencyMs = Date.now() - t0;
      if (!analyzeRes || !analyzeRes.ok) {
        setAnalyzing(false);
        setLastResult({ error: 'analyze_failed' });
        return;
      }
      // Record the validation row.
      const scanId = analyzeRes.scanId || ('scan_lab_' + Date.now().toString(36));
      const recordRes = await _fetchJson('/api/admin/scan-validation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scanId,
          predictedPlant:   analyzeRes.plantName || null,
          predictedDisease: (analyzeRes.diseaseCandidates && analyzeRes.diseaseCandidates[0]
                              && analyzeRes.diseaseCandidates[0].name) || null,
          predictedPest:    (analyzeRes.pest && analyzeRes.pest.pest) || null,
          confidencePct:    analyzeRes.confidence || null,
          consensusMode:    analyzeRes.consensusMode || null,
          latencyMs,
        }),
      });
      setLastResult({ analyzeRes, scanId, latencyMs });
      setLastValidationId((recordRes && recordRes.id) || '');
      refreshAll();
    } finally {
      setAnalyzing(false);
    }
  }, [file, analyzing, cropHint, refreshAll]);

  const saveLabel = React.useCallback(async (feedback) => {
    if (!lastValidationId || !lastResult || !lastResult.scanId) return;
    setLabelSaving(true); setLabelStatus('');
    try {
      await _fetchJson('/api/admin/scan-validation/' + lastValidationId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actualPlant:   actualPlant || null,
          actualDisease: actualDisease || null,
          actualPest:    actualPest || null,
        }),
      });
      if (feedback) {
        await _fetchJson('/api/admin/scan-validation/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scanId: lastResult.scanId,
            feedback,
            correctedPlant:   actualPlant || null,
            correctedDisease: actualDisease || null,
            correctedPest:    actualPest || null,
          }),
        });
      }
      setLabelStatus('Saved');
      refreshAll();
    } finally {
      setLabelSaving(false);
    }
  }, [lastValidationId, lastResult, actualPlant, actualDisease, actualPest, refreshAll]);

  if (!allowed) {
    return (
      <main style={S.page} data-testid="scan-lab-not-allowed">
        <p style={S.title}>{tSafe('scanLab.notAllowed.title', 'Not available')}</p>
        <p style={S.sub}>
          {tSafe('scanLab.notAllowed.body', 'Scan Lab is for admins only.')}
        </p>
        <button type="button" style={S.btnPrimary}
          onClick={() => _safe(() => navigate('/home'), null)}>
          {tSafe('common.goHome', 'Go to Home')}
        </button>
      </main>
    );
  }

  return (
    <main
      style={S.page}
      data-testid="scan-lab-page"
      data-consumes="scanValidation"
      data-surface="scan-lab"
      data-role-scoped="true">
      <header style={S.head}>
        <p style={S.eyebrow}>{tSafe('scanLab.eyebrow', 'Pilot Validation')}</p>
        <h1 style={S.h1}>{tSafe('scanLab.title', 'Scan Lab')}</h1>
        <p style={S.sub}>
          {tSafe('scanLab.sub',
            'Upload a labelled image, run it through the live pipeline, capture ground truth, and watch the accuracy metrics roll up.')}
        </p>
      </header>

      {/* 1. Upload + Analyze */}
      <section style={S.section} data-testid="scan-lab-upload">
        <h2 style={S.h2}>{tSafe('scanLab.section.upload', 'Upload + Analyze')}</h2>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile((e.target.files && e.target.files[0]) || null)}
          data-testid="scan-lab-file"
          style={S.input}
        />
        <input
          type="text"
          placeholder={tSafe('scanLab.cropHint', 'Crop hint (optional)')}
          value={cropHint}
          onChange={(e) => setCropHint(e.target.value)}
          style={S.input}
          data-testid="scan-lab-crop-hint"
        />
        <button
          type="button"
          style={S.btnPrimary}
          disabled={!file || analyzing}
          onClick={runAnalyze}
          data-testid="scan-lab-analyze">
          {analyzing
            ? tSafe('scanLab.button.analyzing', 'Analyzing…')
            : tSafe('scanLab.button.analyze', 'Analyze + Record')}
        </button>
      </section>

      {/* Last result + label */}
      {lastResult && lastResult.analyzeRes ? (
        <section style={S.section} data-testid="scan-lab-label">
          <h2 style={S.h2}>{tSafe('scanLab.section.label', 'Last Result + Label')}</h2>
          <div style={S.kv}><span style={S.k}>Plant</span>
            <span style={S.v}>{lastResult.analyzeRes.plantName || '—'} ({_fmtPct(lastResult.analyzeRes.confidence)})</span></div>
          <div style={S.kv}><span style={S.k}>Disease</span>
            <span style={S.v}>{
              (lastResult.analyzeRes.diseaseCandidates
                && lastResult.analyzeRes.diseaseCandidates[0]
                && lastResult.analyzeRes.diseaseCandidates[0].name) || '—'
            }</span></div>
          <div style={S.kv}><span style={S.k}>Pest</span>
            <span style={S.v}>{
              (lastResult.analyzeRes.pest && lastResult.analyzeRes.pest.pest) || '—'
            }</span></div>
          <div style={S.kv}><span style={S.k}>Latency</span>
            <span style={S.v}>{lastResult.latencyMs} ms</span></div>

          <div style={S.labelGrid}>
            <input type="text" placeholder="actual plant" value={actualPlant}
              onChange={(e) => setActualPlant(e.target.value)} style={S.input}
              data-testid="scan-lab-actual-plant" />
            <input type="text" placeholder="actual disease" value={actualDisease}
              onChange={(e) => setActualDisease(e.target.value)} style={S.input}
              data-testid="scan-lab-actual-disease" />
            <input type="text" placeholder="actual pest" value={actualPest}
              onChange={(e) => setActualPest(e.target.value)} style={S.input}
              data-testid="scan-lab-actual-pest" />
          </div>
          <div style={S.btnRow}>
            <button type="button" style={S.btnCorrect}
              disabled={labelSaving} onClick={() => saveLabel('correct')}
              data-testid="scan-lab-correct">
              {tSafe('scanLab.button.correct', '✓ Correct')}
            </button>
            <button type="button" style={S.btnIncorrect}
              disabled={labelSaving} onClick={() => saveLabel('incorrect')}
              data-testid="scan-lab-incorrect">
              {tSafe('scanLab.button.incorrect', '✗ Incorrect')}
            </button>
            {labelStatus ? <span style={S.statusOk}>{labelStatus}</span> : null}
          </div>
        </section>
      ) : null}

      {/* 3. Accuracy Dashboard */}
      <section style={S.section} data-testid="scan-lab-metrics">
        <h2 style={S.h2}>{tSafe('scanLab.section.metrics', 'Accuracy Dashboard')}</h2>
        <div style={S.btnRow}>
          {[7, 14, 30].map((d) => (
            <button key={d} type="button"
              style={d === windowDays ? S.btnPill : S.btnPillIdle}
              onClick={() => setWindowDays(d)}>
              {d}d
            </button>
          ))}
        </div>
        {metrics && metrics.ok ? (
          <div style={S.metricGrid}>
            <Metric label="Plant Accuracy"   value={metrics.plantAccuracyPct}
              target={85} higherIsBetter />
            <Metric label="Disease Accuracy" value={metrics.diseaseAccuracyPct}
              target={75} higherIsBetter />
            <Metric label="Pest Accuracy"    value={metrics.pestAccuracyPct}
              target={70} higherIsBetter />
            <Metric label="Unknown Rate"     value={metrics.unknownRatePct}
              target={10} higherIsBetter={false} />
            <Metric label="False Positive %" value={metrics.falsePositivePct}
              target={15} higherIsBetter={false} />
            <Metric label="Avg Confidence"   value={metrics.averageConfidencePct}
              target={70} higherIsBetter />
            <Metric label="Confidence Inflation"
              value={metrics.confidenceInflationPct}
              target={0} higherIsBetter={false} />
            <Metric label="Total / Labeled"
              valueRaw={(metrics.totalValidations || 0) + ' / ' + (metrics.labeledCount || 0)} />
          </div>
        ) : (
          <p style={S.empty}>
            {tSafe('scanLab.metrics.empty', 'Not enough data yet — analyze + label a few images to populate the dashboard.')}
          </p>
        )}
      </section>

      {/* 4. Top Failures */}
      <section style={S.section} data-testid="scan-lab-top-failures">
        <h2 style={S.h2}>{tSafe('scanLab.section.failures', 'Top Failures (30d)')}</h2>
        {failures && failures.ok
            && (failures.plants.length || failures.diseases.length || failures.pests.length) ? (
          <div style={S.failGrid}>
            <FailureList title="Plants"   rows={failures.plants} />
            <FailureList title="Diseases" rows={failures.diseases} />
            <FailureList title="Pests"    rows={failures.pests} />
          </div>
        ) : (
          <p style={S.empty}>
            {tSafe('scanLab.failures.empty', 'No labelled failures yet.')}
          </p>
        )}
      </section>

      {/* 5. Confidence Calibration */}
      <section style={S.section} data-testid="scan-lab-calibration">
        <h2 style={S.h2}>{tSafe('scanLab.section.calibration', 'Confidence Calibration')}</h2>
        {calibration && calibration.ok && calibration.buckets.some((b) => b.n > 0) ? (
          <div style={S.calTable}>
            <div style={S.calHead}>
              <span>Band</span><span>n</span>
              <span>Accuracy</span><span>Inflation</span>
            </div>
            {calibration.buckets.map((b) => (
              <div key={b.band} style={S.calRow}>
                <span>{b.band}</span>
                <span>{b.n}</span>
                <span style={{ color: _statusColor(b.accuracyPct, (b.min + b.max) / 2, true) }}>
                  {_fmtPct(b.accuracyPct)}
                </span>
                <span style={{ color: b.inflation != null && b.inflation > 0 ? '#a13a3a' : '#2f7a3a' }}>
                  {b.inflation == null ? '—' : (b.inflation > 0 ? '+' : '') + b.inflation}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p style={S.empty}>
            {tSafe('scanLab.calibration.empty',
              'Not enough labelled samples in each band to compute calibration.')}
          </p>
        )}
      </section>

      <p style={S.note}>
        {tSafe('scanLab.note',
          'Pilot validation rows are append-only. Accuracy targets: plant > 85%, disease > 75%, unknown rate < 10%, avg confidence > 70%.')}
      </p>
    </main>
  );
}

function Metric({ label, value, valueRaw, target, higherIsBetter = true }) {
  const display = valueRaw != null ? valueRaw : _fmtPct(value);
  const color = valueRaw != null ? '#1F2933' : _statusColor(value, target, higherIsBetter);
  return (
    <div style={S.metricCard}>
      <p style={S.metricLabel}>{label}</p>
      <p style={{ ...S.metricValue, color }}>{display}</p>
      {target != null && valueRaw == null
        ? <p style={S.metricTarget}>target {higherIsBetter ? '>' : '<'} {target}%</p>
        : null}
    </div>
  );
}

function FailureList({ title, rows }) {
  return (
    <div style={S.failCol}>
      <p style={S.failTitle}>{title}</p>
      {rows.length === 0 ? <p style={S.empty}>—</p> : (
        <ul style={S.failList}>
          {rows.map((r, i) => (
            <li key={i} style={S.failRow}>
              <span style={S.failPredicted}>{r.predicted || '∅'}</span>
              <span style={S.failArrow}>→</span>
              <span style={S.failActual}>{r.actual || '∅'}</span>
              <span style={S.failCount}>×{r.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default class ScanLabPage extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow */ }
  render() {
    if (this.state.failed) return null;
    try { return <ScanLabInner />; } catch { return null; }
  }
}

const S = {
  page: { minHeight: '100vh', background: '#FAF7F0', color: '#2C3A26',
    fontFamily: 'system-ui', padding: '20px 16px 96px', maxWidth: 1000,
    margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 },
  head: { display: 'flex', flexDirection: 'column', gap: 6 },
  eyebrow: { margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'rgba(60,72,55,0.55)' },
  h1: { margin: 0, fontSize: 22, fontWeight: 800 },
  h2: { margin: '0 0 6px', fontSize: 16, fontWeight: 700 },
  title: { margin: 0, fontSize: 18, fontWeight: 700 },
  sub: { margin: 0, fontSize: 13, color: 'rgba(60,72,55,0.7)' },
  section: {
    background: 'rgba(255,255,255,0.95)',
    border: '1px solid rgba(60,72,55,0.10)',
    borderRadius: 12, padding: '14px 16px',
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  input: { padding: '8px 10px', borderRadius: 8,
    border: '1px solid rgba(60,72,55,0.20)', fontSize: 13, width: '100%',
    boxSizing: 'border-box', background: '#fff' },
  btnPrimary: { minHeight: 40, padding: '0 18px', borderRadius: 10, border: 'none',
    background: '#2f7a3a', color: '#fff', fontSize: 14, fontWeight: 700,
    cursor: 'pointer', alignSelf: 'flex-start' },
  btnCorrect: { minHeight: 36, padding: '0 16px', borderRadius: 8, border: 'none',
    background: '#2f7a3a', color: '#fff', fontSize: 13, fontWeight: 700,
    cursor: 'pointer' },
  btnIncorrect: { minHeight: 36, padding: '0 16px', borderRadius: 8, border: 'none',
    background: '#a13a3a', color: '#fff', fontSize: 13, fontWeight: 700,
    cursor: 'pointer' },
  btnPill: { minHeight: 30, padding: '0 12px', borderRadius: 14, border: 'none',
    background: '#1F2933', color: '#fff', fontSize: 12, fontWeight: 700,
    cursor: 'pointer' },
  btnPillIdle: { minHeight: 30, padding: '0 12px', borderRadius: 14,
    border: '1px solid rgba(60,72,55,0.20)', background: '#fff',
    color: '#1F2933', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  btnRow: { display: 'flex', flexDirection: 'row', gap: 8, alignItems: 'center',
    flexWrap: 'wrap' },
  kv: { display: 'flex', flexDirection: 'row', gap: 12, fontSize: 13 },
  k: { fontWeight: 700, color: 'rgba(60,72,55,0.7)', minWidth: 80 },
  v: { color: '#1F2933' },
  labelGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
    marginTop: 8 },
  metricGrid: { display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 },
  metricCard: {
    background: 'rgba(255,255,255,0.85)',
    border: '1px solid rgba(60,72,55,0.10)',
    borderRadius: 10, padding: '12px 14px',
    display: 'flex', flexDirection: 'column', gap: 2,
  },
  metricLabel: { margin: 0, fontSize: 10, fontWeight: 800,
    letterSpacing: '0.08em', textTransform: 'uppercase',
    color: 'rgba(60,72,55,0.55)' },
  metricValue: { margin: 0, fontSize: 22, fontWeight: 800, lineHeight: 1.1 },
  metricTarget: { margin: 0, fontSize: 10, color: 'rgba(60,72,55,0.5)' },
  failGrid: { display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 },
  failCol: { display: 'flex', flexDirection: 'column', gap: 4 },
  failTitle: { margin: 0, fontSize: 11, fontWeight: 800,
    letterSpacing: '0.08em', textTransform: 'uppercase',
    color: 'rgba(60,72,55,0.7)' },
  failList: { listStyle: 'none', margin: 0, padding: 0,
    display: 'flex', flexDirection: 'column', gap: 4 },
  failRow: { display: 'grid',
    gridTemplateColumns: '1fr 16px 1fr 36px', gap: 6,
    alignItems: 'center', fontSize: 12 },
  failPredicted: { overflow: 'hidden', textOverflow: 'ellipsis',
    whiteSpace: 'nowrap', color: '#a13a3a' },
  failArrow: { color: 'rgba(60,72,55,0.4)', textAlign: 'center' },
  failActual: { overflow: 'hidden', textOverflow: 'ellipsis',
    whiteSpace: 'nowrap', color: '#2f7a3a' },
  failCount: { fontSize: 11, color: 'rgba(60,72,55,0.6)', textAlign: 'right' },
  calTable: { display: 'flex', flexDirection: 'column', gap: 2 },
  calHead: { display: 'grid', gridTemplateColumns: '1fr 60px 100px 100px',
    gap: 8, padding: '6px 10px', fontSize: 11, fontWeight: 800,
    color: 'rgba(60,72,55,0.7)', textTransform: 'uppercase' },
  calRow: { display: 'grid', gridTemplateColumns: '1fr 60px 100px 100px',
    gap: 8, padding: '6px 10px', fontSize: 13,
    borderTop: '1px solid rgba(60,72,55,0.06)' },
  empty: { margin: 0, fontSize: 12, color: 'rgba(60,72,55,0.55)' },
  statusOk: { fontSize: 12, color: '#2f7a3a', fontWeight: 700 },
  note: { margin: 0, fontSize: 11, color: 'rgba(60,72,55,0.55)' },
};
