/**
 * DebugSignalPanel — developer-only floating panel that exposes
 * the decision-intelligence signals at a glance. Never rendered
 * in production builds.
 *
 * Show/hide:
 *   • Auto-on in dev builds (import.meta.env.DEV)
 *   • Or user toggles a flag in localStorage:
 *       localStorage.setItem('farroway.debug', '1')
 *
 * Shows:
 *   • Latest N events from the analytics buffer
 *   • Inferred drop-off stage
 *   • Top-level journey snapshot
 *   • Supplied confidence objects (location / recommendation / task)
 *
 * The panel is read-only; it never mutates state. Mount once at
 * the app root (e.g. in AppShell) and pass live confidence props.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  peekAnalyticsBuffer,
  bufferedAnalyticsCount,
  clearAnalyticsBuffer,
} from '../../utils/analyticsBuffer.js';
import { buildUserJourneySnapshot } from '../../utils/buildUserJourneySnapshot.js';
import { getLikelyDropOffStage } from '../../utils/getLikelyDropOffStage.js';

const STORAGE_KEY = 'farroway.debug';

function isDevEnabled() {
  // Vite exposes import.meta.env.DEV at build time.
  const viteDev = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;
  let userFlag = false;
  try {
    userFlag = typeof window !== 'undefined'
      && window.localStorage
      && window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch { /* noop */ }
  return !!(viteDev || userFlag);
}

export default function DebugSignalPanel({
  locationConfidence = null,
  recommendationConfidence = null,
  taskConfidence = null,
  journeyOverrides = {},
} = {}) {
  const [open, setOpen] = useState(false);
  const [bufferCount, setBufferCount] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!isDevEnabled()) return;
    const id = setInterval(() => {
      setBufferCount(bufferedAnalyticsCount());
      setTick((t) => t + 1);
    }, 1500);
    return () => clearInterval(id);
  }, []);

  const events = useMemo(
    () => (isDevEnabled() ? peekAnalyticsBuffer() : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tick, bufferCount],
  );

  const snapshot = useMemo(
    () => buildUserJourneySnapshot(events, journeyOverrides),
    [events, journeyOverrides],
  );

  const dropOff = useMemo(() => getLikelyDropOffStage(events), [events]);

  if (!isDevEnabled()) return null;

  const shellStyle = {
    position: 'fixed', bottom: 12, right: 12, zIndex: 99999,
    font: '12px/1.4 ui-monospace, Menlo, monospace',
    color: '#eaeaea',
  };
  const buttonStyle = {
    background: '#1a1a1a', border: '1px solid #444', color: '#eaeaea',
    padding: '6px 10px', borderRadius: 8, cursor: 'pointer',
  };
  const panelStyle = {
    marginTop: 8, width: 360, maxHeight: '60vh', overflow: 'auto',
    background: 'rgba(17,17,17,0.96)', border: '1px solid #333',
    borderRadius: 10, padding: 12,
  };
  const h = { margin: '8px 0 4px', color: '#8ab4f8', fontWeight: 600 };
  const pre = { background: '#000', color: '#eaeaea', padding: 8,
                borderRadius: 6, overflow: 'auto', maxHeight: 160, margin: 0 };

  return (
    <div style={shellStyle}>
      <button
        style={buttonStyle}
        onClick={() => setOpen((v) => !v)}
        type="button"
        aria-label="Toggle debug signal panel"
      >
        {open ? 'Debug ▾' : `Debug (${bufferCount})`}
      </button>
      {open && (
        <div style={panelStyle}>
          <div style={h}>Buffer ({bufferCount})</div>
          <button
            type="button"
            style={{ ...buttonStyle, marginBottom: 8 }}
            onClick={() => { clearAnalyticsBuffer(); setBufferCount(0); }}
          >
            Clear buffer
          </button>

          <div style={h}>Drop-off inference</div>
          <pre style={pre}>{JSON.stringify(dropOff, null, 2)}</pre>

          <div style={h}>Journey snapshot</div>
          <pre style={pre}>{JSON.stringify(snapshot, null, 2)}</pre>

          <div style={h}>Location confidence</div>
          <pre style={pre}>{JSON.stringify(locationConfidence, null, 2)}</pre>

          <div style={h}>Recommendation confidence</div>
          <pre style={pre}>{JSON.stringify(recommendationConfidence, null, 2)}</pre>

          <div style={h}>Task confidence</div>
          <pre style={pre}>{JSON.stringify(taskConfidence, null, 2)}</pre>

          <div style={h}>Last 10 events</div>
          <pre style={pre}>
            {JSON.stringify(events.slice(-10).map((e) => ({
              type: e.type,
              step: e.meta?.step,
              at: e.timestamp,
            })), null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
