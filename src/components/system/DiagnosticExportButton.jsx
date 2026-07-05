/**
 * DiagnosticExportButton — the "Export Diagnostic Report" control shown on the scan
 * fallback screen. Lets a farmer on the failing device hand over a complete diagnostic
 * bundle (persisted exceptions + last 200 lifecycle events + render/upload/analyze/
 * result-render lifecycles + browser/device info) with no engineer access required.
 *
 * iPhone Safari support is the priority — a programmatic anchor-download is unreliable on
 * iOS, so the primary paths are (1) a selectable textarea + Copy (navigator.clipboard with
 * an execCommand fallback) and (2) the Web Share sheet. A Blob download is offered too for
 * desktop. Dependency-light on purpose: it is rendered INSIDE the error fallback, so it
 * imports nothing from the scan runtime.
 */
import React from 'react';
import { getReportJSON } from '../../lib/clientDiagnostics.js';
import { tSafe } from '../../i18n/tSafe.js';

const C = {
  primary: '#C8944D', ink: '#08111A', panel: '#0E1A24', text: '#EAF2FF',
  subtle: 'rgba(234,242,255,0.72)', line: 'rgba(234,242,255,0.16)',
};

export default function DiagnosticExportButton({ label }) {
  const [open, setOpen] = React.useState(false);
  const [json, setJson] = React.useState('');
  const [status, setStatus] = React.useState('');
  const taRef = React.useRef(null);

  const buttonText = label || tSafe('scan.diag.export', 'Export Diagnostic Report');

  const onOpen = React.useCallback(() => {
    let out = '';
    try { out = getReportJSON(); } catch { out = '{"error":"report_failed"}'; }
    setJson(out); setStatus(''); setOpen(true);
  }, []);

  const onClose = React.useCallback(() => setOpen(false), []);

  const onCopy = React.useCallback(async () => {
    // iOS Safari: clipboard API needs a gesture + HTTPS; fall back to select + execCommand.
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(json);
        setStatus(tSafe('scan.diag.copied', 'Copied to clipboard'));
        return;
      }
    } catch { /* fall through to legacy copy */ }
    try {
      const ta = taRef.current;
      if (ta) {
        ta.focus(); ta.select();
        try { ta.setSelectionRange(0, json.length); } catch { /* older iOS */ }
        const ok = typeof document !== 'undefined' && document.execCommand && document.execCommand('copy');
        setStatus(ok
          ? tSafe('scan.diag.copied', 'Copied to clipboard')
          : tSafe('scan.diag.copyManual', 'Select the text above, then copy'));
        return;
      }
    } catch { /* ignore */ }
    setStatus(tSafe('scan.diag.copyManual', 'Select the text above, then copy'));
  }, [json]);

  const onShare = React.useCallback(async () => {
    // Web Share works on iOS Safari — lets the user send the report via Mail / Files / AirDrop.
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: 'Farroway diagnostics', text: json });
        setStatus(tSafe('scan.diag.shared', 'Shared'));
        return;
      }
    } catch { /* user cancelled or unsupported */ }
    setStatus(tSafe('scan.diag.shareUnsupported', 'Sharing is not available — use Copy instead'));
  }, [json]);

  const onDownload = React.useCallback(() => {
    // Desktop path. On iOS this opens the JSON in a new tab (still savable) — Copy/Share
    // remain the reliable iOS paths.
    try {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'farroway-diagnostics.json';
      document.body.appendChild(a); a.click();
      setTimeout(() => { try { document.body.removeChild(a); URL.revokeObjectURL(url); } catch { /* ignore */ } }, 0);
      setStatus(tSafe('scan.diag.downloaded', 'Download started'));
    } catch {
      setStatus(tSafe('scan.diag.copyManual', 'Select the text above, then copy'));
    }
  }, [json]);

  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        data-testid="diagnostic-export-open"
        style={{
          appearance: 'none', border: '1px solid rgba(120,120,120,0.4)', background: 'transparent',
          color: 'inherit', opacity: 0.85, padding: '10px 14px', borderRadius: 999, fontSize: 13,
          fontWeight: 600, cursor: 'pointer', marginTop: 12, width: '100%',
        }}
      >
        {buttonText}
      </button>

      {open ? (
        <div
          data-testid="diagnostic-export-sheet"
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed', inset: 0, zIndex: 2147483000,
            background: 'rgba(4,10,16,0.72)', display: 'flex', alignItems: 'flex-end',
            justifyContent: 'center', padding: 12,
          }}
          onClick={onClose}
        >
          <div
            onClick={(e) => { try { e.stopPropagation(); } catch { /* ignore */ } }}
            style={{
              width: '100%', maxWidth: 560, maxHeight: '86vh', overflow: 'auto',
              background: C.panel, border: '1px solid ' + C.line, borderRadius: 18,
              padding: 16, boxSizing: 'border-box',
              paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
            }}
          >
            <h2 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800, color: C.text }}>
              {tSafe('scan.diag.title', 'Diagnostic report')}
            </h2>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: C.subtle, lineHeight: 1.45 }}>
              {tSafe('scan.diag.body', 'Copy or share this with the Farroway team so they can see exactly what happened on your phone.')}
            </p>

            <textarea
              ref={taRef}
              readOnly
              value={json}
              data-testid="diagnostic-export-json"
              onFocus={(e) => { try { e.target.select(); } catch { /* ignore */ } }}
              style={{
                width: '100%', height: 220, boxSizing: 'border-box', resize: 'vertical',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11,
                lineHeight: 1.4, color: C.text, background: 'rgba(0,0,0,0.35)',
                border: '1px solid ' + C.line, borderRadius: 12, padding: 10,
                WebkitUserSelect: 'text', userSelect: 'text',
              }}
            />
            {status ? (
              <div data-testid="diagnostic-export-status" style={{ marginTop: 8, fontSize: 12, color: '#86EFAC' }}>
                {status}
              </div>
            ) : null}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              <button type="button" onClick={onCopy} data-testid="diagnostic-export-copy"
                style={{ flex: '1 1 120px', minHeight: 46, border: 'none', borderRadius: 999,
                  background: C.primary, color: C.ink, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                {tSafe('scan.diag.copy', 'Copy')}
              </button>
              <button type="button" onClick={onShare} data-testid="diagnostic-export-share"
                style={{ flex: '1 1 120px', minHeight: 46, border: '1px solid ' + C.line, borderRadius: 999,
                  background: 'transparent', color: C.text, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {tSafe('scan.diag.share', 'Share')}
              </button>
              <button type="button" onClick={onDownload} data-testid="diagnostic-export-download"
                style={{ flex: '1 1 120px', minHeight: 46, border: '1px solid ' + C.line, borderRadius: 999,
                  background: 'transparent', color: C.text, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {tSafe('scan.diag.download', 'Download')}
              </button>
            </div>
            <button type="button" onClick={onClose} data-testid="diagnostic-export-close"
              style={{ marginTop: 10, width: '100%', minHeight: 42, border: 'none', borderRadius: 999,
                background: 'transparent', color: C.subtle, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {tSafe('common.close', 'Close')}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
