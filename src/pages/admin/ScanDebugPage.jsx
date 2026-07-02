/**
 * ScanDebugPage — hidden admin route /admin/scan-debug.
 *
 * Reads the live Scan Debug Harness (window.__scanTrace / __scanResultCrash /
 * __lastScanCorrelationId), shows the 15 pipeline steps with pass/fail/pending, the
 * captured crash + device/browser, and an "Export Debug JSON" button that bundles the
 * client trace + a fetch of /api/admin/scan/last-trace so the exact on-device failing
 * step can be shared. Read-only; does not touch the scan engine.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { STEPS, buildScanDebugBundle, installScanTrace, deriveTraceSummary } from '../../lib/scanTraceRecorder.js';
import { COLORS } from '../../design/tokens/colors.js';

function _bundle() {
  try {
    if (typeof window !== 'undefined' && typeof window.exportScanDebug === 'function') return window.exportScanDebug();
  } catch { /* fall through */ }
  const w = typeof window !== 'undefined' ? window : {};
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  return buildScanDebugBundle({
    trace: w.__scanTrace || [], crash: w.__scanResultCrash || null,
    correlationId: w.__lastScanCorrelationId || null, nav,
    screen: { width: w.innerWidth, height: w.innerHeight, devicePixelRatio: w.devicePixelRatio, touch: 'ontouchstart' in w },
    timestamp: (function () { try { return new Date().toISOString(); } catch { return null; } })(),
  });
}

export default function ScanDebugPage() {
  const [bundle, setBundle] = useState(() => _bundle());
  const [serverTrace, setServerTrace] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { try { installScanTrace(); } catch { /* ignore */ } }, []);
  useEffect(() => {
    const t = setInterval(() => setBundle(_bundle()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    let alive = true;
    const cid = (typeof window !== 'undefined' && window.__lastScanCorrelationId) || '';
    fetch('/api/admin/scan/last-trace' + (cid ? '?cid=' + encodeURIComponent(cid) : ''), { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null)).then((j) => { if (alive) setServerTrace(j); })
      .catch(() => { if (alive) setServerTrace({ error: 'unreachable' }); });
    return () => { alive = false; };
  }, []);

  const summary = deriveTraceSummary(bundle.trace);
  const stepStatus = (step) => {
    const recs = (bundle.trace || []).filter((r) => r && r.step === step);
    if (recs.some((r) => r.status === 'fail')) return 'fail';
    if (recs.length > 0) return 'ok';
    if (summary.failingStep === step) return 'fail';
    return 'pending';
  };

  const exportJson = useCallback(() => {
    const full = { ...bundle, serverTrace };
    const text = JSON.stringify(full, null, 2);
    try {
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'scan-debug-' + (bundle.correlationId || 'trace') + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { /* clipboard fallback below */ }
    try { navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); }
    catch { /* ignore */ }
  }, [bundle, serverTrace]);

  const dot = { fail: COLORS.error, ok: COLORS.green, pending: 'rgba(234,242,255,0.35)' };
  const wrap = { maxWidth: 680, margin: '0 auto', padding: 16, color: COLORS.ink, fontFamily: 'system-ui, sans-serif' };
  return (
    <div style={wrap} data-testid="scan-debug-page">
      <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>Scan Debug Harness</h1>
      <p style={{ fontSize: 13, color: 'rgba(234,242,255,0.7)', margin: '0 0 16px' }}>
        Correlation: <code>{bundle.correlationId || '—'}</code> · Failing step:{' '}
        <strong style={{ color: summary.failingStep ? dot.fail : dot.ok }}>{summary.failingStep || 'none'}</strong>
      </p>

      <button type="button" onClick={exportJson} data-primary-action="true" data-testid="scan-debug-export"
        style={{ minHeight: 48, width: '100%', borderRadius: 999, border: 'none', background: COLORS.ochre,
          color: COLORS.structureDark, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 18 }}>
        {copied ? 'Copied ✓' : 'Export Debug JSON'}
      </button>

      <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {STEPS.map((step, i) => {
          const st = stepStatus(step);
          return (
            <li key={step} data-testid={'scan-debug-step-' + step}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0',
                borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: dot[st], flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'rgba(234,242,255,0.5)', width: 22 }}>{i + 1}</span>
              <span style={{ fontSize: 14, flex: 1 }}>{step}</span>
              <span style={{ fontSize: 12, color: dot[st], fontWeight: 700 }}>{st}</span>
            </li>
          );
        })}
      </ol>

      {bundle.crash ? (
        <div style={{ marginTop: 18, padding: 12, borderRadius: 12, background: 'rgba(198,90,75,0.12)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Render crash captured</div>
          <code style={{ fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{bundle.crash.message}</code>
        </div>
      ) : null}

      <div style={{ marginTop: 18, fontSize: 12, color: 'rgba(234,242,255,0.55)' }}>
        {bundle.browser.userAgent} · {bundle.device.width}×{bundle.device.height} @{bundle.device.dpr}x
      </div>
    </div>
  );
}
