/**
 * OptimizationDebugPanel — dev-only floating panel that surfaces
 * the auto-optimization loop's internal state. Visible to
 * engineers in dev builds or admin users who flip the flag.
 *
 * Shown sections:
 *   • Eligibility rollup (top of funnel)
 *   • Active adjustments by family
 *   • Top boosted / downgraded crops
 *   • Task skip patterns by mode
 *   • Listing conversion leaders
 *   • Audit trail (last 20 records)
 *   • Low-signal contexts (for tuning thresholds)
 *
 * Consumer passes a snapshot — the panel doesn't fetch.
 */

import { useMemo, useState } from 'react';

const STORAGE_KEY = 'farroway.debug';

function devEnabled() {
  const viteDev = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;
  let userFlag = false;
  try {
    userFlag = typeof window !== 'undefined'
      && window.localStorage
      && window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch { /* noop */ }
  return !!(viteDev || userFlag);
}

const shell = { position: 'fixed', top: 12, right: 12, zIndex: 99999,
                font: '12px/1.4 ui-monospace, Menlo, monospace', color: '#eaeaea' };
const btn   = { background: '#1a1a1a', border: '1px solid #444', color: '#eaeaea',
                padding: '6px 10px', borderRadius: 8, cursor: 'pointer' };
const panel = { marginTop: 8, width: 420, maxHeight: '70vh', overflow: 'auto',
                background: 'rgba(17,17,17,0.97)', border: '1px solid #333',
                borderRadius: 10, padding: 12 };
const h     = { margin: '10px 0 4px', color: '#ffb74d', fontWeight: 600, fontSize: 13 };
const pre   = { background: '#000', color: '#eaeaea', padding: 8, borderRadius: 6,
                overflow: 'auto', maxHeight: 200, margin: 0, fontSize: 11 };
const row   = { display: 'flex', justifyContent: 'space-between',
                padding: '2px 0', borderBottom: '1px dotted #333' };

function pct(n) { return `${(Number(n) * 100).toFixed(1)}%`; }
function signed(n, digits = 2) {
  const v = Number(n) || 0;
  return (v >= 0 ? '+' : '') + v.toFixed(digits);
}

export default function OptimizationDebugPanel({
  snapshot = null,
  auditEntries = [],
  eligibilitySummary = null,
  onRefresh = null,
  force = false,
}) {
  const [open, setOpen] = useState(false);
  if (!force && !devEnabled()) return null;

  const summary = useMemo(() => summarize(snapshot), [snapshot]);
  const topBoosted = useMemo(
    () => pickTopByDelta(snapshot, 'recommendation', 'desc', 8),
    [snapshot],
  );
  const topDowngraded = useMemo(
    () => pickTopByDelta(snapshot, 'recommendation', 'asc', 8),
    [snapshot],
  );
  const taskSkipTop = (snapshot?.taskSkipTop || []).slice(0, 6);
  const bestConverts = (snapshot?.bestConverts || []).slice(0, 6);
  const lowSignal = useMemo(() => countLowSignal(eligibilitySummary), [eligibilitySummary]);

  return (
    <div style={shell}>
      <button type="button" style={btn} onClick={() => setOpen((v) => !v)}>
        {open
          ? 'Optimization ▾'
          : `Optimization${summary.activeTotal ? ` (${summary.activeTotal})` : ''}`}
      </button>
      {open && (
        <div style={panel}>
          <div style={h}>Eligibility rollup</div>
          {eligibilitySummary ? (
            <>
              <div style={row}><span>contexts</span><span>{eligibilitySummary.total}</span></div>
              <div style={row}><span>low-signal</span><span>{eligibilitySummary.lowSignal}</span></div>
              <div style={row}><span>rec eligible</span><span>{eligibilitySummary.eligibleByFamily?.recommendation ?? 0}</span></div>
              <div style={row}><span>harvest eligible</span><span>{eligibilitySummary.eligibleByFamily?.harvest ?? 0}</span></div>
              <div style={row}><span>task eligible</span><span>{eligibilitySummary.eligibleByFamily?.task ?? 0}</span></div>
              <div style={row}><span>listing eligible</span><span>{eligibilitySummary.eligibleByFamily?.listing ?? 0}</span></div>
            </>
          ) : (
            <div style={{ color: '#aaa' }}>No eligibility summary supplied.</div>
          )}

          <div style={h}>Active adjustments by family</div>
          <div style={row}><span>recommendation</span><span>{summary.active.recommendation}</span></div>
          <div style={row}><span>confidence</span><span>{summary.active.confidence}</span></div>
          <div style={row}><span>urgency</span><span>{summary.active.urgency}</span></div>
          <div style={row}><span>listingQuality</span><span>{summary.active.listingQuality}</span></div>

          <div style={h}>Top boosted crops</div>
          {topBoosted.length === 0 && <div style={{ color: '#aaa' }}>—</div>}
          {topBoosted.map((r, i) => (
            <div key={`up-${i}`} style={row}>
              <span>{r.contextKey}</span>
              <span style={{ color: '#81c784' }}>{signed(r.delta, 3)}</span>
            </div>
          ))}

          <div style={h}>Top downgraded crops</div>
          {topDowngraded.length === 0 && <div style={{ color: '#aaa' }}>—</div>}
          {topDowngraded.map((r, i) => (
            <div key={`dn-${i}`} style={row}>
              <span>{r.contextKey}</span>
              <span style={{ color: '#ef9a9a' }}>{signed(r.delta, 3)}</span>
            </div>
          ))}

          <div style={h}>Task skip patterns</div>
          {taskSkipTop.length === 0 && <div style={{ color: '#aaa' }}>—</div>}
          {taskSkipTop.map((r, i) => (
            <div key={`ts-${i}`} style={row}>
              <span>{r.mode || 'unknown'}</span>
              <span>{r.skipped} skipped · {r.repeatSkipped} repeat</span>
            </div>
          ))}

          <div style={h}>Best-converting listings</div>
          {bestConverts.length === 0 && <div style={{ color: '#aaa' }}>—</div>}
          {bestConverts.map((r, i) => (
            <div key={`bc-${i}`} style={row}>
              <span>{r.country || '—'}:{r.state || '—'}</span>
              <span style={{ color: '#90caf9' }}>{pct(r.conversionRate)}</span>
            </div>
          ))}

          <div style={h}>Audit trail (last 20)</div>
          <pre style={pre}>
            {JSON.stringify(
              auditEntries.slice(0, 20).map((r) => ({
                ctx: r.contextKey,
                scope: r.scope,
                deltas: r.deltas,
                why: r.explanation,
              })),
              null, 2,
            )}
          </pre>

          {onRefresh && (
            <button type="button" style={{ ...btn, marginTop: 10 }} onClick={onRefresh}>
              Refresh
            </button>
          )}
          <div style={{ color: '#888', marginTop: 6 }}>
            low-signal contexts: {lowSignal}
          </div>
        </div>
      )}
    </div>
  );
}

function summarize(snapshot) {
  const a = snapshot?.activeAdjustments || { recommendation: 0, confidence: 0, urgency: 0, listingQuality: 0 };
  return {
    active: a,
    activeTotal: (a.recommendation || 0) + (a.confidence || 0) + (a.urgency || 0) + (a.listingQuality || 0),
  };
}

function pickTopByDelta(snapshot, field, order, n) {
  const rows = (snapshot?.activeByContext || [])
    .map((r) => ({
      contextKey: r.contextKey,
      delta: r.deltas?.[mapField(field)] ?? 0,
    }))
    .filter((r) => r.delta !== 0);
  rows.sort((a, b) => (order === 'asc' ? a.delta - b.delta : b.delta - a.delta));
  return rows.slice(0, n);
}

function mapField(field) {
  switch (field) {
    case 'recommendation':  return 'rec';
    case 'confidence':      return 'conf';
    case 'urgency':         return 'urg';
    case 'listingQuality':  return 'list';
    default:                return field;
  }
}

function countLowSignal(summary) {
  if (!summary) return 0;
  return summary.lowSignal || 0;
}
