/**
 * SimpleModeScanCard.jsx — Simple Mode scan result (§3).
 *
 * Replaces the technical scan result with the action-first layout:
 *
 *   Plant:    Tomato
 *   Problem:  Possible leaf disease
 *   Do this:  Remove bad leaves.
 *   Next:     Scan again in 3 days.
 *
 *   [Save Plant] [Create Task] [Scan Again]
 *
 * Hidden in Simple Mode: confidence %, provider name, raw taxonomy, long
 * explanations. Uses hedging language: "possible" / "likely" / "needs review".
 * NEVER renders "confirmed" / "guaranteed" / "100%".
 *
 * Self-contained — never blocks the scan flow.
 */

import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

// Forbidden visible-copy patterns (mirrors the contracts file). The
// component pre-scrubs any incoming label that would carry a banned word.
const FORBIDDEN_RE = /\b(confirmed|guaranteed|100%|protocol|taxonomy|integrated disease management)\b/i;

function _safeHedge(label, fallback) {
  if (typeof label !== 'string' || !label) return fallback;
  if (FORBIDDEN_RE.test(label)) return fallback;
  return label;
}

function _recordArtifact(kind, scanId) {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const KEY = 'farroway_simple_mode_artifacts';
    const raw = window.localStorage.getItem(KEY);
    const list = _safe(() => { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; }, []);
    const idempotencyKey = `${kind}:${scanId || 'noid'}:${Date.now()}`;
    list.push({ kind, idempotencyKey, scanId: scanId || null, ts: Date.now() });
    const bounded = list.length > 500 ? list.slice(list.length - 500) : list;
    window.localStorage.setItem(KEY, JSON.stringify(bounded));
    return true;
  }, false);
}

export default function SimpleModeScanCard({
  scanId,
  plantName,
  problemLabel,          // raw label from the scan result; pre-scrubbed for forbidden phrases
  doThis,                // short action sentence ≤ 12 words
  nextStep,              // short next sentence ≤ 10 words
  onSavePlant,
  onCreateTask,
  onScanAgain,
}) {
  React.useEffect(() => {
    if (scanId) _recordArtifact('SimpleActionShown', `scan:${scanId}`);
  }, [scanId]);

  const hedgedProblem = _safeHedge(problemLabel, tSafe('simple.scan.problemFallback', 'Possible plant issue'));
  const hedgedDoThis = _safeHedge(doThis, tSafe('simple.scan.doThisFallback', 'Check your plant today.'));
  const hedgedNext = _safeHedge(nextStep, tSafe('simple.scan.nextFallback', 'Scan again in 3 days.'));

  const handleSave = () => {
    _recordArtifact('SimpleActionCompleted', `scan:${scanId}:save`);
    _safe(() => typeof onSavePlant === 'function' && onSavePlant(), null);
  };
  const handleCreateTask = () => {
    _recordArtifact('SimpleActionCompleted', `scan:${scanId}:task`);
    _safe(() => typeof onCreateTask === 'function' && onCreateTask(), null);
  };
  const handleScanAgain = () => {
    _safe(() => typeof onScanAgain === 'function' && onScanAgain(), null);
  };

  return (
    <article style={S.card} data-testid="simple-mode-scan-card">
      <p style={S.eyebrow}>{tSafe('simple.scan.eyebrow', 'Scan result')}</p>

      <div style={S.row}>
        <span style={S.label}>{tSafe('simple.scan.plant', 'Plant')}:</span>
        <span style={S.value} data-testid="simple-scan-plant">
          {plantName || tSafe('simple.scan.plantFallback', 'Your plant')}
        </span>
      </div>

      <div style={S.row}>
        <span style={S.label}>{tSafe('simple.scan.problem', 'Problem')}:</span>
        <span style={S.value} data-testid="simple-scan-problem">{hedgedProblem}</span>
      </div>

      <p style={S.metaLabel}>{tSafe('simple.scan.doThis', 'Do this')}</p>
      <p style={S.action} data-testid="simple-scan-doThis">{hedgedDoThis}</p>

      <p style={S.metaLabel}>{tSafe('simple.scan.next', 'Next')}</p>
      <p style={S.next} data-testid="simple-scan-next">{hedgedNext}</p>

      <div style={S.btnRow}>
        {onSavePlant ? (
          <button type="button" style={S.btnPrimary} onClick={handleSave}
            data-testid="simple-scan-save">
            {tSafe('simple.scan.savePlant', 'Save Plant')}
          </button>
        ) : null}
        {onCreateTask ? (
          <button type="button" style={S.btnGhost} onClick={handleCreateTask}
            data-testid="simple-scan-task">
            {tSafe('simple.scan.createTask', 'Create Task')}
          </button>
        ) : null}
        {onScanAgain ? (
          <button type="button" style={S.btnGhost} onClick={handleScanAgain}
            data-testid="simple-scan-again">
            {tSafe('simple.scan.scanAgain', 'Scan Again')}
          </button>
        ) : null}
      </div>
    </article>
  );
}

const S = {
  card: { background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 18,
    padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 8,
    boxShadow: '0 14px 28px -14px rgba(0,0,0,0.10)' },
  eyebrow: { margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: '#6B7280' },
  row: { display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  label: { fontSize: 14, fontWeight: 700, color: '#6B7280' },
  value: { fontSize: 18, fontWeight: 800, color: '#1F2937' },
  metaLabel: { margin: '6px 0 0', fontSize: 10, fontWeight: 800,
    letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7280' },
  action: { margin: 0, fontSize: 20, fontWeight: 800, color: '#1F2937', lineHeight: 1.3 },
  next: { margin: 0, fontSize: 16, fontWeight: 700, color: '#1F2937', lineHeight: 1.4 },
  btnRow: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  btnPrimary: { flex: '1 1 auto', minWidth: 110, padding: '0.85rem 1.2rem',
    border: 'none', borderRadius: 999, background: '#6E8B61', color: '#FFFFFF',
    fontSize: 16, fontWeight: 800, cursor: 'pointer', minHeight: 48 },
  btnGhost: { flex: '0 1 auto', padding: '0.85rem 1rem',
    border: '1px solid #D1D5DB', borderRadius: 999, background: '#FFFFFF',
    color: '#1F2937', fontSize: 14, fontWeight: 700, cursor: 'pointer', minHeight: 48 },
};
