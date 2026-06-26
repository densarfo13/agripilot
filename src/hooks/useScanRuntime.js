/**
 * useScanRuntime.js — React subscription wire for the canonical
 * `ScanRuntime` (src/core/scan/ScanRuntime.js).
 *
 *   import { useScanRuntime } from 'src/hooks/useScanRuntime.js';
 *
 *   function ScanSurface() {
 *     const rt = useScanRuntime({ activeFarm, locale, classifier });
 *     // rt.snapshot   — frozen state envelope, updates on every transition
 *     // rt.state      — SCAN_STATE.*
 *     // rt.preview    — current preview URL (string | null)
 *     // rt.statusMessage — tSafe envelope to render
 *     // rt.result     — frozen result envelope or null
 *     // rt.runtime    — the underlying ScanRuntime handle
 *     return <PreviewView url={rt.preview} status={rt.statusMessage} />;
 *   }
 *
 * What this is
 * ────────────
 *   The single canonical subscription point every Scan UI
 *   component should use. Surfaces consume the snapshot + call
 *   the runtime's methods — they NEVER call getUserMedia, store
 *   preview in their own useState, run analysis directly, or
 *   write to the journal independently.
 *
 *   On mount: creates a runtime via `createScanRuntime`,
 *   subscribes to `onStateChange`, auto-registers the runtime
 *   with `window.__registerScanRuntime(rt)` so the diagnostic
 *   globals (`__scanSession()` / `__clearScanSession()`) reflect
 *   live state.
 *
 *   On unmount: calls `destroySession()` so the next mount starts
 *   from `IDLE` with no leaked stream / blob URLs.
 *
 * Strict-rule audit
 *   • Never throws. SSR-safe (no useMemo/state until React loads).
 *   • Cleanup is idempotent.
 *   • Re-renders ONLY on state transitions — the runtime debounces
 *     internal updates already.
 */

import { useEffect, useMemo, useState, useRef } from 'react';

import {
  createScanRuntime, SCAN_STATE,
} from '../core/scan/ScanRuntime.js';
import { beginScan, endScan } from '../lib/scanIdempotency.js';

const _isObj = (v) => v != null && typeof v === 'object';
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

/**
 * @param {object} cfg
 *   @prop {object}   [cfg.activeFarm]
 *   @prop {string}   [cfg.locale]
 *   @prop {Function} [cfg.classifier]
 *   @prop {Function} [cfg.onTelemetry]
 *   @prop {boolean}  [cfg.autoRegisterDiagnostic=true]  pin to window.__activeScanRuntime
 */
export function useScanRuntime(cfg) {
  const _cfg = _isObj(cfg) ? cfg : {};
  const autoRegister = _cfg.autoRegisterDiagnostic !== false;

  // Snapshot state — drives re-renders.
  const [snapshot, setSnapshot] = useState(() => ({
    currentState: SCAN_STATE.IDLE,
    activeSessionId: null,
    previewUrl: null,
    previewExists: false,
    imageValidated: false,
    persisted: false,
    analyzing: false,
    resultValid: false,
    statusMessage: null,
    streamActive: false,
    recoveryAvailable: false,
    lastError: null,
    lastFailureStage: null,
    generatedAt: Date.now(),
  }));

  // Ref to the runtime so callers can read it stably without
  // re-rendering on every method call.
  const runtimeRef = useRef(null);

  // Create the runtime once per mount.
  if (runtimeRef.current == null) {
    runtimeRef.current = _safe(() => createScanRuntime({
      activeFarm: _cfg.activeFarm,
      locale:     _cfg.locale,
      classifier: _cfg.classifier,
      onTelemetry: _cfg.onTelemetry,
      onStateChange: (snap) => {
        // Setter is safe to call synchronously from the runtime
        // because the runtime fires onStateChange after committing
        // internal state.
        setSnapshot(snap || {});
      },
    }), null);
  }

  // Auto-register with the diagnostic globals so
  // window.__scanSession() / __clearScanSession() reflect the
  // active runtime for the current page.
  useEffect(() => {
    if (!autoRegister) return undefined;
    _safe(() => {
      if (typeof window !== 'undefined'
          && typeof window.__registerScanRuntime === 'function') {
        window.__registerScanRuntime(runtimeRef.current);
      }
    });
    return () => {
      _safe(() => {
        if (typeof window !== 'undefined'
            && typeof window.__registerScanRuntime === 'function') {
          window.__registerScanRuntime(null);
        }
      });
    };
    // Intentionally fire-once — autoRegister is captured at mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Destroy on unmount so the next mount starts from IDLE with
  // no leaked stream / blob URLs.
  useEffect(() => {
    return () => {
      _safe(() => {
        if (runtimeRef.current && typeof runtimeRef.current.destroySession === 'function') {
          runtimeRef.current.destroySession();
        }
      });
    };
  }, []);

  // Stable public surface — methods are passthroughs to the
  // runtime. Memoized to avoid re-creating bound functions on
  // every render.
  const api = useMemo(() => {
    const rt = runtimeRef.current;
    if (!rt) {
      return Object.freeze({
        state: SCAN_STATE.IDLE,
        preview: null,
        statusMessage: null,
        result: null,
        snapshot,
        runtime: null,
        startCamera:   () => Promise.resolve({ ok: false, reason: 'no_runtime' }),
        stopCamera:    () => Promise.resolve({ ok: false, reason: 'no_runtime' }),
        restartCamera: () => Promise.resolve({ ok: false, reason: 'no_runtime' }),
        choosePhoto:   () => Promise.resolve({ ok: false, reason: 'no_runtime' }),
        capturePhoto:  () => Promise.resolve({ ok: false, reason: 'no_runtime' }),
        analyzeImage:  () => Promise.resolve({ ok: false, reason: 'no_runtime' }),
        retryStage:    () => Promise.resolve({ ok: false, reason: 'no_runtime' }),
        saveToJournal: () => Promise.resolve({ ok: false, reason: 'no_runtime' }),
        createFollowUp:() => Promise.resolve({ ok: false, reason: 'no_runtime' }),
        recoverSession:() => Promise.resolve({ ok: false, reason: 'no_runtime' }),
        destroySession:() => {},
        SCAN_STATE,
      });
    }
    return Object.freeze({
      state:         snapshot.currentState,
      preview:       snapshot.previewUrl,
      statusMessage: snapshot.statusMessage,
      result:        _safe(() => rt.getResult(), null),
      snapshot,
      runtime:       rt,
      startCamera:   rt.startCamera,
      stopCamera:    rt.stopCamera,
      restartCamera: rt.restartCamera,
      choosePhoto:   rt.choosePhoto,
      capturePhoto:  rt.capturePhoto,
      // Duplicate-scan guard (protects provider credits). FAIL-OPEN: only an
      // immediate duplicate of the SAME session — a double-tap or re-fired submit
      // — is ignored; any legitimate scan (new session / different key) proceeds.
      analyzeImage:  (...args) => {
        const key = String(snapshot.activeSessionId || (rt.getSessionId && _safe(() => rt.getSessionId(), '')) || '').trim();
        if (key && beginScan(key) === false) {
          return Promise.resolve({ ok: false, reason: 'duplicate_ignored' });
        }
        let p;
        try { p = rt.analyzeImage(...args); }
        catch (e) { if (key) _safe(() => endScan(key)); throw e; }
        return Promise.resolve(p).finally(() => { if (key) _safe(() => endScan(key)); });
      },
      retryStage:    rt.retryStage,
      saveToJournal: rt.saveToJournal,
      createFollowUp:rt.createFollowUp,
      recoverSession:rt.recoverSession,
      destroySession:rt.destroySession,
      SCAN_STATE,
    });
  }, [snapshot]);

  return api;
}

export { SCAN_STATE };

const _module = { useScanRuntime, SCAN_STATE };
export default _module;
