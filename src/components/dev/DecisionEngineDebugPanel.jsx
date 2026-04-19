/**
 * DecisionEngineDebugPanel — dev-only floating panel that mirrors
 * DebugSignalPanel but surfaces the decision engine state:
 * pipeline order, top active signals, confidence scores,
 * arbitration results, friction/trust/hesitation, actionability
 * plans, weighted top reasons.
 *
 * Data is supplied by the caller — this component is a renderer,
 * not a fetcher. Typically the app root computes a snapshot
 * (buildDecisionEngineSnapshot on the server or locally) and
 * passes it in.
 *
 * Visibility: follows the same rules as DebugSignalPanel —
 * `import.meta.env.DEV` OR `localStorage.farroway.debug === '1'`.
 */

import { useState, useMemo } from 'react';

const STORAGE_KEY = 'farroway.debug';

function isDevEnabled() {
  const viteDev = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;
  let userFlag = false;
  try {
    userFlag = typeof window !== 'undefined'
      && window.localStorage
      && window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch { /* noop */ }
  return !!(viteDev || userFlag);
}

// Visual constants
const shell = { position: 'fixed', bottom: 12, left: 12, zIndex: 99999,
                font: '12px/1.4 ui-monospace, Menlo, monospace', color: '#eaeaea' };
const btn   = { background: '#1a1a1a', border: '1px solid #444', color: '#eaeaea',
                padding: '6px 10px', borderRadius: 8, cursor: 'pointer' };
const panel = { marginTop: 8, width: 400, maxHeight: '70vh', overflow: 'auto',
                background: 'rgba(17,17,17,0.96)', border: '1px solid #333',
                borderRadius: 10, padding: 12 };
const h     = { margin: '8px 0 4px', color: '#8ab4f8', fontWeight: 600 };
const sub   = { margin: '4px 0', color: '#bbb', fontStyle: 'italic' };
const pre   = { background: '#000', color: '#eaeaea', padding: 8, borderRadius: 6,
                overflow: 'auto', maxHeight: 200, margin: 0 };

function Row({ label, value, bar = null, tone = '#8ab4f8' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '2px 0' }}>
      <span style={{ minWidth: 140, color: '#ccc' }}>{label}</span>
      <span style={{ color: tone, fontWeight: 600 }}>{value}</span>
      {bar != null && (
        <div style={{ flex: 1, height: 6, background: '#333', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${Math.max(0, Math.min(100, bar * 100))}%`, height: '100%', background: tone }} />
        </div>
      )}
    </div>
  );
}

export default function DecisionEngineDebugPanel({ snapshot = null }) {
  const [open, setOpen] = useState(false);
  if (!isDevEnabled()) return null;

  const summary = useMemo(() => summarize(snapshot), [snapshot]);

  return (
    <div style={shell}>
      <button type="button" style={btn} onClick={() => setOpen((v) => !v)}>
        {open ? 'Decision engine ▾' : `Decision engine${summary.actions ? ` (${summary.actions})` : ''}`}
      </button>
      {open && (
        <div style={panel}>
          <div style={h}>Pipeline order</div>
          <pre style={pre}>
            {JSON.stringify(snapshot?.pipeline?.stageOrder || [], null, 2)}
          </pre>

          <div style={h}>Journey health</div>
          <Row label="friction"
               value={(summary.friction ?? 0).toFixed(2)}
               bar={summary.friction}
               tone={summary.friction >= 0.6 ? '#ef5350' : summary.friction >= 0.35 ? '#ffca28' : '#8ab4f8'} />
          <Row label="trust"
               value={(summary.trust ?? 0).toFixed(2)}
               bar={summary.trust}
               tone={summary.trust <= 0.4 ? '#ef5350' : summary.trust <= 0.7 ? '#ffca28' : '#66bb6a'} />
          <Row label="hesitation"
               value={(summary.hesitation ?? 0).toFixed(2)}
               bar={summary.hesitation}
               tone={summary.hesitation >= 0.5 ? '#ffca28' : '#8ab4f8'} />
          <Row label="risk"  value={summary.riskLevel || '—'} />
          <Row label="focus" value={summary.suggestedFocus || '—'} />

          <div style={h}>Top active signals</div>
          <pre style={pre}>
            {JSON.stringify(
              (snapshot?.confidenceSummary?.rows || []).slice(0, 8),
              null, 2,
            )}
          </pre>

          <div style={h}>Arbitration</div>
          <pre style={pre}>
            {JSON.stringify(
              (snapshot?.arbitration || []).slice(0, 6).map((a) => ({
                context: a.contextKey,
                winner: a.winningSignal,
                overridden: a.overriddenSignals,
                weight: a.finalDecisionWeight,
                reason: a.decisionReason,
              })),
              null, 2,
            )}
          </pre>

          <div style={h}>Actionability plan</div>
          <pre style={pre}>
            {JSON.stringify(
              Object.fromEntries(
                Object.entries(snapshot?.actionability?.surfaces || {}).map(([k, v]) => [k, v ? {
                  key: v.actionKey, type: v.actionType, priority: v.priority, reason: v.reason,
                } : null]),
              ),
              null, 2,
            )}
          </pre>

          <div style={h}>Top weighted reasons</div>
          <pre style={pre}>
            {JSON.stringify(
              (snapshot?.reasons || []).slice(0, 8).map((r) => ({
                reason: r.reason,
                score: r.combinedScore,
                count: r.count,
                dir: r.dominantDirection,
                sources: r.sources,
              })),
              null, 2,
            )}
          </pre>

          <div style={h}>Recent pipeline runs</div>
          <pre style={pre}>
            {JSON.stringify(snapshot?.pipeline?.recent || [], null, 2)}
          </pre>

          <div style={sub}>
            Snapshot generated: {snapshot?.generatedAt
              ? new Date(snapshot.generatedAt).toISOString()
              : '—'}
          </div>
        </div>
      )}
    </div>
  );
}

function summarize(snapshot) {
  const j = snapshot?.journey || {};
  const actions = Object.values(snapshot?.actionability?.surfaces || {}).filter(Boolean).length;
  return {
    friction: j.frictionScore,
    trust: j.trustScore,
    hesitation: j.hesitationScore,
    riskLevel: j.riskLevel,
    suggestedFocus: j.suggestedFocus,
    actions,
  };
}
