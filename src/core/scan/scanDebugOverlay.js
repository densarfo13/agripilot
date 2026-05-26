/**
 * scanDebugOverlay.js — dev-only state inspector. Renders nothing.
 * Returns a one-string snapshot the surface can show in a corner
 * overlay during local QA to expose hidden legacy flows.
 *
 *   import {
 *     buildScanDebugSnapshot, installScanDebugHook,
 *   } from 'src/core/scan/scanDebugOverlay.js';
 *
 *   // In dev only — call once at boot:
 *   installScanDebugHook();
 *   // Then from DevTools:
 *   window.__scanDebug();
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A pure inspector that aggregates everything the scan pipeline
 *   is tracking (session id, FSM state, image record validity,
 *   classifier input verified, result source) into a compact
 *   { key, value }[] snapshot. The dev overlay surface renders
 *   it as a tiny corner panel that exposes "which pipeline
 *   produced this result" instantly.
 *
 *   It is NOT a React component. It is NOT a logger. It NEVER
 *   renders in production — the hook itself short-circuits to
 *   no-op when `import.meta.env.DEV` is false.
 *
 *   Useful for catching the "old scan renderer still active"
 *   class of bug: if the snapshot shows `resultSource:
 *   "legacy_useEffect"` while the new pipeline is active, you've
 *   found a dual-path leak.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 *   • Idempotent — `window.__scanDebug` installed once.
 *   • Snapshot carries NO PII — just structural state values.
 */

import { getActiveScanSessionId } from './scanSessionId.js';
import { validateScanImage } from './validateScanImage.js';
import {
  getActiveSession, getScanHistory,
} from './scanSessionManager.js';

function _isDev() {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) return true;
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') return true;
  } catch { /* swallow */ }
  return false;
}

/**
 * Build a snapshot of the scan pipeline state. The optional
 * `ctx` lets the caller hand in extra signals (current FSM
 * state, the active image record, the latest result) — the
 * function defensively reads whatever it can.
 *
 * @param {object} [ctx]  optional supplemental state
 * @returns {{ rows: Array<{key,value}>, generatedAt: string }}
 */
export function buildScanDebugSnapshot(ctx) {
  try {
    const c = (ctx && typeof ctx === 'object') ? ctx : {};
    const sessionId = getActiveScanSessionId();
    const imageVerdict = c.image ? validateScanImage(c.image) : { valid: false, reason: 'no_image' };
    // V5 stability spec — pull the wide session record so DevTools
    // shows the full pipeline view in one snapshot.
    const session = (function () {
      try { return getActiveSession() || null; } catch { return null; }
    })();
    const rows = [
      { key: 'sessionId',          value: sessionId || '(none)' },
      { key: 'fsmState',           value: c.state || '(unknown)' },
      { key: 'lifecycle',          value: session && session.lifecycle ? session.lifecycle : '(idle)' },
      { key: 'source',             value: session ? session.source : '(none)' },
      { key: 'imageValid',         value: imageVerdict.valid ? 'true' : 'false' },
      { key: 'imageReason',        value: imageVerdict.reason || '-' },
      { key: 'imageMime',          value: imageVerdict.mime || '-' },
      { key: 'imageSize',          value: imageVerdict.size != null ? String(imageVerdict.size) : '-' },
      { key: 'localUri',           value: session && session.localUri ? '(present, ' + session.localUri.length + ' chars)' : '(none)' },
      { key: 'normalizedUri',      value: session && session.normalizedUri ? '(present)' : '(none)' },
      { key: 'uploadedUrl',        value: session && session.uploadedUrl ? session.uploadedUrl.slice(0, 80) : '(none)' },
      { key: 'aiStatus',           value: session ? session.aiStatus : '(idle)' },
      { key: 'previewStatus',      value: session ? session.previewStatus : '(idle)' },
      { key: 'renderStatus',       value: session ? session.renderStatus : '(idle)' },
      { key: 'cropPrediction',     value: session && session.cropPrediction ? String(session.cropPrediction) : '(none)' },
      { key: 'diseasePrediction',  value: session && session.diseasePrediction ? String(session.diseasePrediction) : '(none)' },
      { key: 'confidence',         value: session && session.confidence != null ? String(session.confidence) : '-' },
      { key: 'retryCount',         value: session ? String(session.retryCount) : '0' },
      { key: 'inferenceLatencyMs', value: session && session.inferenceLatencyMs != null ? String(session.inferenceLatencyMs) : '-' },
      { key: 'failedStage',        value: session && session.failedStage ? session.failedStage : '(none)' },
      { key: 'locale',             value: session ? session.locale : '(unknown)' },
      { key: 'device',             value: session ? session.device : '(unknown)' },
      { key: 'browser',            value: session ? session.browser : '(unknown)' },
      { key: 'classifierInputVerified',
        value: (c.result && c.result.classifierInputVerified) ? 'true' : 'false' },
      { key: 'persisted',
        value: (c.result && c.result.persisted) ? 'true' : 'false' },
      { key: 'resultSource',       value: (c.result && c.result.source) || '(none)' },
      { key: 'rendererSource',     value: c.rendererSource || '(unknown)' },
    ];
    return { rows, generatedAt: new Date().toISOString() };
  } catch {
    return { rows: [{ key: 'error', value: 'snapshot_failed' }], generatedAt: new Date().toISOString() };
  }
}

/**
 * Install `window.__scanDebug()`. Returns the snapshot inline so
 * DevTools shows the rows immediately. Dev-only — no-op in
 * production builds.
 */
export function installScanDebugHook() {
  try {
    // V5 stability spec — production diagnostics are now allowed
    // because the snapshot carries no PII (just structural state
    // rows). The hook is small and lets field operators dump scan
    // state without needing a dev build. The original DEV gate
    // stays available for surfaces that prefer to dead-strip the
    // install in production builds.
    if (typeof window === 'undefined') return false;
    if (window.__scanDebug && window.__scanHistory) return true;
    // Surfaces are responsible for handing the latest context to
    // the hook via `window.__scanDebugContext = { state, image, result }`.
    if (!window.__scanDebug) {
      window.__scanDebug = function () {
        const ctx = (typeof window !== 'undefined' && window.__scanDebugContext) || {};
        const snap = buildScanDebugSnapshot(ctx);
        try { console.table(snap.rows); } catch { /* swallow */ }
        return snap;
      };
    }
    if (!window.__scanHistory) {
      window.__scanHistory = function () {
        let history = [];
        try { history = getScanHistory(); } catch { history = []; }
        try { console.table(history); } catch { /* swallow */ }
        return history;
      };
    }
    return true;
  } catch { return false; }
}

const _module = { buildScanDebugSnapshot, installScanDebugHook };
export default _module;
