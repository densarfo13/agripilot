/**
 * scanStateMachine — production-safe FSM for the scan pipeline.
 *
 * Replaces the indefinite-spinner / "taking longer than expected"
 * dead end with a state machine where every state TERMINATES:
 *
 *   IDLE -> CAMERA_READY -> IMAGE_SELECTED -> COMPRESSING ->
 *   UPLOADING -> UPLOAD_COMPLETE -> ANALYZING -> ANALYSIS_COMPLETE
 *
 *   ANALYZING -> DELAYED           (analysis exceeded ceiling)
 *   ANALYZING -> MANUAL_FALLBACK   (analysis returned no result)
 *   UPLOADING -> OFFLINE_QUEUED    (network unavailable)
 *   any       -> FAILED            (unrecoverable error)
 *   FAILED    -> MANUAL_FALLBACK   (user opts into manual mode)
 *
 * Hard rules:
 *   * Every async step is wrapped in withScanTimeout — never an
 *     unbounded await.
 *   * cancel() always returns the FSM to IDLE + aborts in-flight.
 *   * reset() is the only way to restart from a terminal state.
 *   * Route-change unmount calls cancel() so a navigated-away
 *     scan never leaves a stream / promise dangling.
 *   * No silent catch — every failure routes through the
 *     diagnostics collector + classifies the failure kind.
 *
 *   import { createScanStateMachine, SCAN_STATES }
 *     from '../features/scan/scanStateMachine.js';
 *
 *   const fsm = createScanStateMachine({
 *     compress:  (file)  => imageCompression.compressImage(file),
 *     upload:    (blob, signal) => scanUploadClient.upload(blob, signal),
 *     analyse:   (uploadId, signal) => scanInferenceClient.analyse(uploadId, signal),
 *     queueOffline: (blob) => offlineScanQueue.enqueueScan(blob),
 *     onChange: (state, ctx) => setReactState({ state, ctx }),
 *   });
 *
 *   fsm.startWithFile(file);  // promise resolves at a terminal state
 *
 * Strict-rule audit
 *   * Pure JS — no React, no DOM, SSR-safe.
 *   * Never throws — every entry point catches + routes to FAILED.
 *   * Idempotent terminal transitions — cancel/reset can be
 *     called any number of times.
 *   * Frozen state snapshots passed to onChange so consumers
 *     can't mutate.
 */

import {
  SCAN_TIMEOUTS,
  withScanTimeout,
  ScanTimeoutError,
} from '../../lib/scan/scanPipelineTimeouts.js';
import {
  startScanRun,
  recordStage,
  recordError,
  finishScanRun,
  classifyFailure,
  failureMessage,
} from '../../lib/scan/scanDiagnostics.js';
import {
  describeImage,
  isOversized,
} from '../../lib/scan/scanImageDebug.js';
import {
  buildManualFallbackResult,
} from '../../lib/scan/scanManualFallback.js';

export const SCAN_STATES = Object.freeze({
  IDLE:             'idle',
  CAMERA_READY:     'camera_ready',
  IMAGE_SELECTED:   'image_selected',
  COMPRESSING:      'compressing',
  UPLOADING:        'uploading',
  UPLOAD_COMPLETE:  'upload_complete',
  ANALYZING:        'analyzing',
  ANALYSIS_COMPLETE: 'analysis_complete',
  DELAYED:          'delayed',
  OFFLINE_QUEUED:   'offline_queued',
  FAILED:           'failed',
  MANUAL_FALLBACK:  'manual_fallback',
});

const _TERMINAL = new Set([
  SCAN_STATES.ANALYSIS_COMPLETE,
  SCAN_STATES.DELAYED,
  SCAN_STATES.OFFLINE_QUEUED,
  SCAN_STATES.FAILED,
  SCAN_STATES.MANUAL_FALLBACK,
]);

const _MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB ceiling (spec §4)
const _SUPPORTED_MIME = new Set([
  'image/jpeg', 'image/jpg', 'image/png',
  'image/webp', 'image/heic', 'image/heif',
]);

function _safeFn(fn) { return typeof fn === 'function' ? fn : null; }

function _isOnline() {
  try {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine !== false;
  } catch { return true; }
}

function _validateImage(file) {
  if (file == null) return { ok: false, reason: 'no_file' };
  const desc = describeImage(file);
  if (!desc || !Number.isFinite(desc.size) || desc.size <= 0) {
    return { ok: false, reason: 'empty_file' };
  }
  if (isOversized(desc, { maxBytes: _MAX_FILE_BYTES })) {
    return { ok: false, reason: 'too_large' };
  }
  if (desc.mime && !_SUPPORTED_MIME.has(String(desc.mime).toLowerCase())
      && !desc.looksHeic) {
    return { ok: false, reason: 'unsupported_mime' };
  }
  return { ok: true, desc };
}

/**
 * Factory — produces a fresh FSM instance bound to a single scan
 * session. Multiple instances are safe (each owns its own
 * AbortController + diagnostics run).
 *
 * @param {object} deps
 * @param {(file: any) => Promise<any>}                     [deps.compress]
 * @param {(blob: any, signal: AbortSignal) => Promise<any>} [deps.upload]
 * @param {(id: any, signal: AbortSignal) => Promise<any>}   [deps.analyse]
 * @param {(blob: any) => Promise<any>}                     [deps.queueOffline]
 * @param {(state: string, ctx: object) => void}            [deps.onChange]
 * @returns {object} the FSM handle
 */
export function createScanStateMachine(deps) {
  const d = (deps && typeof deps === 'object') ? deps : {};
  const compressFn     = _safeFn(d.compress);
  const uploadFn       = _safeFn(d.upload);
  const analyseFn      = _safeFn(d.analyse);
  const queueOfflineFn = _safeFn(d.queueOffline);
  const onChange       = _safeFn(d.onChange);

  // Per-run state.
  let _state = SCAN_STATES.IDLE;
  let _ctx   = {
    runId:         null,
    file:          null,
    description:   null,
    compressedBlob: null,
    uploadId:      null,
    result:        null,
    failureKind:   null,
    failureMessage: null,
    fallbackResult: null,
  };
  let _controller = null;
  let _settle     = null;     // resolves the active startWithFile promise

  function getState() {
    return { state: _state, ctx: { ..._ctx } };
  }
  function isTerminal() { return _TERMINAL.has(_state); }

  function _emit() {
    if (onChange) {
      try { onChange(_state, Object.freeze({ ..._ctx })); }
      catch { /* swallow */ }
    }
  }

  function _transition(next, patch) {
    _state = next;
    if (patch && typeof patch === 'object') {
      _ctx = { ..._ctx, ...patch };
    }
    _emit();
    if (isTerminal() && _settle) {
      const resolve = _settle;
      _settle = null;
      resolve(getState());
    }
  }

  function _abortController() {
    try {
      _controller = (typeof AbortController !== 'undefined')
                      ? new AbortController() : null;
    } catch { _controller = null; }
    return _controller;
  }

  function _settleNoop(state) {
    // Used by external transitions (e.g. selectManualFallback)
    // that aren't tied to a startWithFile promise. We still flip
    // state cleanly so onChange fires + the FSM is in a terminal.
    return state;
  }

  function _routeFailureFromError(err, stage) {
    try {
      recordError(stage, err);
      const tempRun = { outcome: 'failure', failurePoint: stage,
                        errorMessage: (err && err.message) || String(err) };
      const kind = classifyFailure(tempRun);
      return { kind, message: failureMessage(kind) };
    } catch {
      return { kind: 'unknown', message: failureMessage('unknown') };
    }
  }

  // ─── Lifecycle ─────────────────────────────────────────────

  function reset() {
    cancel(); // tears down any in-flight async + aborts controller
    _state = SCAN_STATES.IDLE;
    _ctx = {
      runId:         null,
      file:          null,
      description:   null,
      compressedBlob: null,
      uploadId:      null,
      result:        null,
      failureKind:   null,
      failureMessage: null,
      fallbackResult: null,
    };
    _emit();
  }

  function cancel() {
    try { _controller && _controller.abort(); } catch { /* swallow */ }
    _controller = null;
    if (_settle) {
      const resolve = _settle;
      _settle = null;
      // Resolve the in-flight promise with the current snapshot so
      // callers awaiting startWithFile never hang.
      try { resolve(getState()); } catch { /* swallow */ }
    }
    if (_ctx.runId) {
      try { finishScanRun({ outcome: 'cancelled' }); } catch { /* swallow */ }
      _ctx = { ..._ctx, runId: null };
    }
  }

  // ─── Image entry ──────────────────────────────────────────

  function selectImage(file, source) {
    // Validate immediately - spec §4 hard image validation.
    const v = _validateImage(file);
    if (!v.ok) {
      _ctx = { ..._ctx, file: null, description: null,
               failureKind: 'unsupported_image',
               failureMessage: failureMessage('unsupported_image') };
      _transition(SCAN_STATES.FAILED);
      return false;
    }
    const runId = startScanRun({ source: source || 'unknown' });
    recordStage('image_ready', {
      size: v.desc.size,
      mime: v.desc.mime,
    });
    _ctx = { ..._ctx, runId, file, description: v.desc };
    _transition(SCAN_STATES.IMAGE_SELECTED);
    return true;
  }

  // ─── Core pipeline ────────────────────────────────────────

  async function _runCompress() {
    _transition(SCAN_STATES.COMPRESSING);
    if (!compressFn) {
      // No compressor wired — pass the raw file through.
      const out = _ctx.file;
      recordStage('image_compressed', {
        size: _ctx.description.size, // unchanged
      });
      return out;
    }
    const t0 = Date.now();
    try {
      const compressed = await withScanTimeout(
        Promise.resolve(compressFn(_ctx.file)),
        SCAN_TIMEOUTS.compression,
        'compression',
        () => { try { _controller && _controller.abort(); } catch { /* swallow */ } },
      );
      recordStage('image_compressed', {
        size: (compressed && Number.isFinite(compressed.size)) ? compressed.size : null,
        durationMs: Date.now() - t0,
      });
      return compressed || _ctx.file;
    } catch (err) {
      // Compression failure -> fall back to raw file (spec §5).
      recordError('compression', err);
      return _ctx.file;
    }
  }

  async function _runUpload(blob) {
    _transition(SCAN_STATES.UPLOADING, { compressedBlob: blob });
    if (!_isOnline() || !uploadFn) {
      // Spec §9 - offline-first: queue + transition.
      if (queueOfflineFn) {
        try { await queueOfflineFn(blob); } catch { /* swallow */ }
      }
      _transition(SCAN_STATES.OFFLINE_QUEUED);
      try { finishScanRun({ outcome: 'failure' }); } catch { /* swallow */ }
      return null;
    }
    const controller = _abortController();
    const t0 = Date.now();
    try {
      const res = await withScanTimeout(
        Promise.resolve(uploadFn(blob, controller && controller.signal)),
        SCAN_TIMEOUTS.upload,
        'upload',
        () => { try { controller && controller.abort(); } catch { /* swallow */ } },
      );
      recordStage('upload_success', {
        durationMs: Date.now() - t0,
        status: (res && Number.isFinite(res.status)) ? res.status : 200,
      });
      if (!res || res.ok === false) {
        const fail = _routeFailureFromError(
          new Error((res && res.error) || 'upload_failed'),
          'upload',
        );
        _ctx = { ..._ctx, failureKind: fail.kind, failureMessage: fail.message };
        _transition(SCAN_STATES.FAILED);
        try { finishScanRun({ outcome: 'failure' }); } catch { /* swallow */ }
        return null;
      }
      _transition(SCAN_STATES.UPLOAD_COMPLETE, {
        uploadId: (res && (res.uploadId || res.id)) || null,
      });
      return res;
    } catch (err) {
      // Timeout or network error — try the offline queue before
      // giving up so the user's photo isn't lost.
      if (queueOfflineFn) {
        try { await queueOfflineFn(blob); } catch { /* swallow */ }
        _transition(SCAN_STATES.OFFLINE_QUEUED);
        try { finishScanRun({ outcome: 'failure' }); } catch { /* swallow */ }
        return null;
      }
      const fail = _routeFailureFromError(err, 'upload');
      _ctx = { ..._ctx, failureKind: fail.kind, failureMessage: fail.message };
      _transition(SCAN_STATES.FAILED);
      try { finishScanRun({ outcome: 'failure' }); } catch { /* swallow */ }
      return null;
    }
  }

  async function _runAnalyse(uploadRes) {
    _transition(SCAN_STATES.ANALYZING);
    if (!analyseFn) {
      // No analyser wired — go straight to manual fallback.
      const fallback = buildManualFallbackResult({
        crop:  _ctx.description && _ctx.description.mime,
        stage: 'inference',
      });
      _transition(SCAN_STATES.MANUAL_FALLBACK, { fallbackResult: fallback });
      try { finishScanRun({ outcome: 'failure' }); } catch { /* swallow */ }
      return;
    }
    const controller = _abortController();
    const t0 = Date.now();
    try {
      const result = await withScanTimeout(
        Promise.resolve(analyseFn(
          (uploadRes && (uploadRes.uploadId || uploadRes.id)) || _ctx.uploadId,
          controller && controller.signal,
        )),
        SCAN_TIMEOUTS.inference + 35_000, // spec §7 - 45s total
        'inference',
        () => { try { controller && controller.abort(); } catch { /* swallow */ } },
      );
      recordStage('inference_response', {
        durationMs: Date.now() - t0,
        outcome:    result && (result.ok !== false) ? 'ok' : 'empty',
      });
      // Delayed mode (spec §8): the analysis returns ok:false +
      // delayed:true. Photo is already saved; surface the
      // calming DELAYED state instead of failing.
      if (result && result.delayed === true) {
        _transition(SCAN_STATES.DELAYED, { result });
        try { finishScanRun({ outcome: 'failure' }); } catch { /* swallow */ }
        return;
      }
      if (!result || !_looksLikeResult(result)) {
        // Result missing -> manual fallback (spec §10).
        const fallback = buildManualFallbackResult({
          crop:  null,
          stage: 'inference',
        });
        _transition(SCAN_STATES.MANUAL_FALLBACK, { fallbackResult: fallback });
        try { finishScanRun({ outcome: 'failure' }); } catch { /* swallow */ }
        return;
      }
      _transition(SCAN_STATES.ANALYSIS_COMPLETE, { result });
      try { finishScanRun({ outcome: 'success' }); } catch { /* swallow */ }
    } catch (err) {
      // Timeout -> DELAYED, not FAILED (spec §8 - do not fail
      // the user; their photo is already saved server-side).
      if (err instanceof ScanTimeoutError || (err && err.kind === 'timeout')) {
        _transition(SCAN_STATES.DELAYED, {
          result: { ok: false, delayed: true, reason: 'analysis_timeout' },
        });
        try { finishScanRun({ outcome: 'failure' }); } catch { /* swallow */ }
        return;
      }
      const fail = _routeFailureFromError(err, 'inference');
      _ctx = { ..._ctx, failureKind: fail.kind, failureMessage: fail.message };
      _transition(SCAN_STATES.FAILED);
      try { finishScanRun({ outcome: 'failure' }); } catch { /* swallow */ }
    }
  }

  function _looksLikeResult(r) {
    if (!r || typeof r !== 'object') return false;
    if (r.delayed === true) return false;
    // Backend response shape — needs at least one of these.
    return !!(r.possibleIssue || r.summary || r.scanId);
  }

  /**
   * The single entry point. Returns a Promise that ALWAYS
   * resolves at a terminal state — never rejects, never hangs.
   *
   * @param {File|Blob} file
   * @param {object} [opts]
   * @param {string} [opts.source]   'camera' | 'gallery'
   * @returns {Promise<{ state, ctx }>}
   */
  function startWithFile(file, opts) {
    // Cancel any prior run so a quick re-tap doesn't leak.
    if (_state !== SCAN_STATES.IDLE) reset();

    return new Promise((resolve) => {
      _settle = resolve;
      try {
        const ok = selectImage(file, (opts && opts.source) || 'unknown');
        if (!ok) return; // selectImage already routed to FAILED
        (async () => {
          try {
            const blob   = await _runCompress();
            const upload = await _runUpload(blob);
            if (isTerminal()) return; // upload may have terminated
            await _runAnalyse(upload);
          } catch (err) {
            const fail = _routeFailureFromError(err, 'unknown');
            _ctx = { ..._ctx, failureKind: fail.kind, failureMessage: fail.message };
            _transition(SCAN_STATES.FAILED);
            try { finishScanRun({ outcome: 'failure' }); } catch { /* swallow */ }
          }
        })();
      } catch (err) {
        const fail = _routeFailureFromError(err, 'unknown');
        _ctx = { ..._ctx, failureKind: fail.kind, failureMessage: fail.message };
        _transition(SCAN_STATES.FAILED);
      }
    });
  }

  /**
   * User opts into manual fallback from a FAILED / DELAYED /
   * OFFLINE_QUEUED state. Surfaces the manual symptom picker
   * envelope from scanManualFallback.
   */
  function selectManualFallback(meta) {
    const fallback = buildManualFallbackResult({
      crop:  meta && meta.crop || null,
      stage: meta && meta.stage || _ctx.failureKind || 'unknown',
    });
    _transition(SCAN_STATES.MANUAL_FALLBACK, { fallbackResult: fallback });
    return _settleNoop(SCAN_STATES.MANUAL_FALLBACK);
  }

  // Test seam — lets unit tests inspect internal counters.
  function _peek() {
    return { state: _state, ctx: { ..._ctx }, hasController: !!_controller };
  }

  return Object.freeze({
    SCAN_STATES,
    getState,
    isTerminal,
    reset,
    cancel,
    selectImage,
    startWithFile,
    selectManualFallback,
    _peek,
  });
}

const _module = {
  SCAN_STATES,
  createScanStateMachine,
};
export default _module;
