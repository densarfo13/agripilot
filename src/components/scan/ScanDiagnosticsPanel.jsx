/**
 * ScanDiagnosticsPanel — dev-only panel that renders the most
 * recent scan-run records collected by scanDiagnostics.
 *
 *   ScanDiagnosticsPanel takes no props; mount it anywhere.
 *
 * The component self-suppresses in production builds
 * (import.meta.env.DEV === false) so it can be safely mounted
 * on Home or Tasks during stabilization without leaking into
 * the released bundle's pixel output.
 *
 * Shows for each run:
 *   - source           camera / gallery
 *   - outcome          success / failure / cancelled
 *   - total ms
 *   - upload ms, inference ms (when available)
 *   - response status (when available)
 *   - failure point + classified failure kind
 *
 * Strict-rule audit
 *   * Pure presentational. Reads diagnostics from the in-memory
 *     ring; does not subscribe / does not auto-refresh — the
 *     host taps the refresh button.
 *   * No PII. No image bytes. No auth tokens.
 *   * Returns null in production builds.
 */

import React, { useCallback, useState } from 'react';
import {
  getCurrentRun,
  getRecentRuns,
  classifyFailure,
  failureMessage,
} from '../../lib/scan/scanDiagnostics.js';

function _isDev() {
  try {
    return !!(typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV);
  } catch { return false; }
}

const S = {
  shell: {
    position: 'fixed',
    bottom: '88px',     // sit above the bottom nav
    right:  12,
    width:  320,
    maxWidth: 'calc(100vw - 24px)',
    maxHeight: '60vh',
    overflowY: 'auto',
    background: 'rgba(8,18,28,0.94)',
    color:      'rgba(255,255,255,0.92)',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.15)',
    padding: 10,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 11,
    lineHeight: 1.45,
    zIndex: 9999,
    boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
    paddingBottom: 6,
    borderBottom: '1px solid rgba(255,255,255,0.12)',
  },
  title:  { fontWeight: 700, color: '#FCD34D' },
  small:  { color: 'rgba(255,255,255,0.55)' },
  btn: {
    appearance: 'none',
    border: '1px solid rgba(255,255,255,0.25)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.92)',
    padding: '3px 8px',
    borderRadius: 6,
    fontSize: 11,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  row:   { display: 'flex', gap: 8, padding: '4px 0' },
  key:   { color: 'rgba(255,255,255,0.55)', minWidth: 90 },
  val:   { color: '#86EFAC', wordBreak: 'break-all' },
  fail:  { color: '#FCA5A5' },
  runHead: {
    fontWeight: 700,
    padding: '6px 0',
    borderTop: '1px dashed rgba(255,255,255,0.10)',
    marginTop: 8,
  },
  stages: {
    marginTop: 4,
    paddingLeft: 8,
    borderLeft: '1px solid rgba(255,255,255,0.10)',
  },
  empty: { color: 'rgba(255,255,255,0.55)', fontStyle: 'italic', padding: '4px 0' },
};

function _outcomeStyle(outcome) {
  if (outcome === 'success')   return { color: '#86EFAC' };
  if (outcome === 'failure')   return S.fail;
  if (outcome === 'cancelled') return { color: '#FCD34D' };
  return S.val;
}

function _renderStage(stage, i) {
  return (
    <div key={`${stage.stage}-${i}-${stage.at}`} style={S.row}>
      <span style={S.key}>{stage.stage}</span>
      <span style={S.val}>
        +{stage.sinceStart}ms
        {Number.isFinite(stage.sincePrev) && stage.sincePrev !== stage.sinceStart
          ? ` (Δ${stage.sincePrev}ms)`
          : ''}
        {stage.payload && stage.payload.status != null
          ? ` · ${stage.payload.status}`
          : ''}
        {stage.payload && stage.payload.size != null
          ? ` · ${stage.payload.size}b`
          : ''}
      </span>
    </div>
  );
}

function _renderRun(run, i) {
  if (!run) return null;
  const kind = run.outcome === 'failure' ? classifyFailure(run) : null;
  return (
    <div key={run.runId || `run-${i}`}>
      <div style={S.runHead}>
        <span style={_outcomeStyle(run.outcome)}>
          {(run.outcome || 'pending').toUpperCase()}
        </span>
        <span style={S.small}> · {run.source || 'unknown'} · {run.totalMs}ms</span>
      </div>
      {kind ? (
        <div style={S.row}>
          <span style={S.key}>failure</span>
          <span style={S.fail}>
            {kind} — {failureMessage(kind)}
          </span>
        </div>
      ) : null}
      {run.failurePoint ? (
        <div style={S.row}>
          <span style={S.key}>failed at</span>
          <span style={S.fail}>{run.failurePoint}</span>
        </div>
      ) : null}
      {run.errorMessage ? (
        <div style={S.row}>
          <span style={S.key}>error</span>
          <span style={S.fail}>{run.errorMessage}</span>
        </div>
      ) : null}
      <div style={S.stages}>
        {run.stages.length === 0
          ? <div style={S.empty}>no stages recorded</div>
          : run.stages.map(_renderStage)}
      </div>
    </div>
  );
}

export default function ScanDiagnosticsPanel() {
  // Hooks unconditional so dev/prod render paths share order.
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((n) => n + 1), []);

  if (!_isDev()) return null;

  // void the tick state so the closure sees an updated reference
  // on each refresh tap; the function call is the side-effect.
  void tick;
  const current = getCurrentRun();
  const recent  = getRecentRuns(5);
  const empty   = !current && recent.length === 0;

  return (
    <div style={S.shell} data-testid="scan-diagnostics-panel">
      <div style={S.header}>
        <span style={S.title}>Scan Diagnostics</span>
        <button type="button" style={S.btn} onClick={refresh}>Refresh</button>
      </div>
      {empty
        ? <div style={S.empty}>no scan runs yet</div>
        : null}
      {current
        ? (
          <div>
            <div style={S.runHead}>
              <span style={{ color: '#FCD34D' }}>IN-FLIGHT</span>
              <span style={S.small}> · {current.source} · {current.totalMs}ms</span>
            </div>
            <div style={S.stages}>
              {current.stages.length === 0
                ? <div style={S.empty}>no stages yet</div>
                : current.stages.map(_renderStage)}
            </div>
          </div>
        )
        : null}
      {recent.map((r, i) => _renderRun(r, i))}
    </div>
  );
}
