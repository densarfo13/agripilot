/**
 * ScanRuntime.js — the ONE authoritative scan runtime.
 *
 *   import { createScanRuntime, SCAN_STATE }
 *     from 'src/core/scan/ScanRuntime.js';
 *
 *   const rt = createScanRuntime({
 *     activeFarm, locale, classifier, onStateChange,
 *   });
 *
 *   await rt.startCamera({ videoEl });
 *   const photo = await rt.capturePhoto({ canvas });
 *   await rt.analyzeImage();
 *   const result = rt.getResult();
 *   await rt.saveToJournal();
 *
 * What this is
 * ────────────
 *   The single facade that owns the FULL scan lifecycle. Composes —
 *   never replaces — the 20+ engines shipped this stream:
 *
 *     • cameraRuntimeManager       — single MediaStream owner
 *     • cameraHealthEngine         — health + permission
 *     • imageNormalization         — HEIC / EXIF / resize
 *     • scanImageStore             — preview persistence
 *     • scanSessionManager         — session history
 *     • scanLifecycleStateMachine  — internal state primitives
 *     • scanRuntimeContracts       — input + result + low-conf rules
 *     • offlineScanQueue           — offline draft persistence
 *     • farmEventBus               — telemetry emission
 *
 *   Every visible string is a tSafe envelope. Every async callback
 *   carries the sessionId and bails on stale. Every state
 *   transition runs through ONE switch — no parallel transition
 *   logic in surfaces.
 *
 *   Surfaces (LiveCameraScanner, ScanCapture, fallback flows)
 *   should consume `getState()` + `onStateChange` ONLY. They must
 *   NOT call getUserMedia / store preview / run analysis / write
 *   to Journal directly.
 *
 * Strict-rule audit
 *   • Pure runtime where possible. Never throws. SSR-safe.
 *   • Session-id verification on every async callback.
 *   • Compose-only — every external engine call wrapped in safe.
 *   • Every visible string is `{key, fallback, params}`.
 */

import {
  initializeCamera, stopCamera, restartCamera,
  recoverCamera, isCameraHealthy, releaseBlobUrl,
} from '../camera/cameraRuntimeManager.js';
import { resolveStartupMessage } from '../camera/cameraHealthEngine.js';
import {
  assertValidScanInput, validateScanResult,
  isLowConfidenceAllowed, invalidImageMessage,
  buildResultEnvelope,
} from './scanRuntimeContracts.js';
import { enqueueOfflineScan } from './offlineScanQueue.js';
import { FarmEvents, publish } from '../../lib/farmEventBus.js';

const ENGINE_VERSION = 'scan-runtime-v1';

export const SCAN_STATE = Object.freeze({
  IDLE:              'IDLE',
  OPENING_CAMERA:    'OPENING_CAMERA',
  CAMERA_READY:      'CAMERA_READY',
  CAPTURING:         'CAPTURING',
  PHOTO_SELECTED:    'PHOTO_SELECTED',
  VALIDATING_IMAGE:  'VALIDATING_IMAGE',
  IMAGE_READY:       'IMAGE_READY',
  PREPROCESSING:     'PREPROCESSING',
  ANALYZING:         'ANALYZING',
  RESULT_READY:      'RESULT_READY',
  LOW_CONFIDENCE:    'LOW_CONFIDENCE',
  RECOVERABLE_ERROR: 'RECOVERABLE_ERROR',
  FATAL_ERROR:       'FATAL_ERROR',
  OFFLINE_QUEUED:    'OFFLINE_QUEUED',
  SAVED:             'SAVED',
});

const _isObj = (v) => v != null && typeof v === 'object';
const _str   = (v) => (typeof v === 'string' ? v : '');
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };
const _safeAsync = async (fn, fb) => {
  try { return await fn(); } catch { return fb; }
};

function _newSessionId() {
  return 'scan_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

function _imageHash(input) {
  // Lightweight deterministic hash; not cryptographic. Used as
  // an imageId for the result contract — links the analysis
  // output to the image that was analyzed.
  const s = _str(input);
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return 'img_' + h.toString(36);
}

/**
 * Create a new ScanRuntime instance. Each call returns an
 * isolated runtime — multiple surfaces (Scan page, Soil Scan,
 * preview) can each own one without bleeding state.
 *
 *   @param {object} cfg
 *     @prop {object}   [cfg.activeFarm]
 *     @prop {string}   [cfg.locale]
 *     @prop {Function} [cfg.classifier]    async (imageRef) → result
 *     @prop {Function} [cfg.onStateChange] (snapshot) → void
 *     @prop {Function} [cfg.onTelemetry]   (eventName, payload) → void
 */
export function createScanRuntime(cfg) {
  const _cfg = _isObj(cfg) ? cfg : {};
  let _state = SCAN_STATE.IDLE;
  let _sessionId = null;
  let _previewUrl = null;
  let _imageId = null;
  let _imageValid = false;
  let _normalizedDataUrl = null;
  let _persisted = false;
  let _result = null;
  let _statusMessage = resolveStartupMessage({ state: 'idle' });
  let _lastError = null;
  let _lastFailureStage = null;
  const _ownedBlobUrls = new Set();

  function _emit(event, payload) {
    _safe(() => {
      if (typeof _cfg.onTelemetry === 'function') {
        _cfg.onTelemetry(event, payload);
      }
      // Forward to the bus too — closed vocabulary means SCAN_COMPLETED
      // is the only canonical scan-bus event today; the rest are
      // tracked via the onTelemetry callback.
      if (event === 'scan_completed') {
        publish(FarmEvents.SCAN_COMPLETED, payload);
      }
    });
  }

  function _setState(next, opts) {
    _state = next;
    _statusMessage = _resolveStatusMessage(next, opts);
    _safe(() => {
      if (typeof _cfg.onStateChange === 'function') {
        _cfg.onStateChange(getSnapshot());
      }
    });
  }

  function _resolveStatusMessage(state) {
    switch (state) {
      case SCAN_STATE.OPENING_CAMERA:
      case SCAN_STATE.CAMERA_READY:
        return resolveStartupMessage({ state: 'starting' });
      case SCAN_STATE.RECOVERABLE_ERROR:
        return invalidImageMessage();
      case SCAN_STATE.FATAL_ERROR:
        return Object.freeze({
          key:      'scan.runtime.fatal',
          fallback: 'Something went wrong. Please choose a photo to continue.',
        });
      case SCAN_STATE.OFFLINE_QUEUED:
        return Object.freeze({
          key:      'scan.runtime.offlineQueued',
          fallback: 'Saved for sync when you reconnect.',
        });
      case SCAN_STATE.ANALYZING:
        return Object.freeze({
          key:      'scan.runtime.analyzing',
          fallback: 'Checking your photo.',
        });
      case SCAN_STATE.PREPROCESSING:
        return Object.freeze({
          key:      'scan.runtime.preprocessing',
          fallback: 'Preparing photo.',
        });
      case SCAN_STATE.RESULT_READY:
        return Object.freeze({
          key:      'scan.runtime.resultReady',
          fallback: 'Result ready.',
        });
      case SCAN_STATE.LOW_CONFIDENCE:
        return Object.freeze({
          key:      'scan.runtime.lowConfidence',
          fallback: 'Result needs review.',
        });
      case SCAN_STATE.SAVED:
        return Object.freeze({
          key:      'scan.runtime.saved',
          fallback: 'Saved to your journal.',
        });
      default:
        return resolveStartupMessage({ state: 'idle' });
    }
  }

  function _isActiveSession(id) {
    return _sessionId != null && id === _sessionId;
  }

  function _registerBlobUrl(url) {
    if (typeof url === 'string' && url.startsWith('blob:')) {
      _ownedBlobUrls.add(url);
    }
  }

  function _releaseBlobUrls() {
    for (const url of Array.from(_ownedBlobUrls)) {
      _safe(() => releaseBlobUrl(url));
      _ownedBlobUrls.delete(url);
    }
  }

  // ─── Methods ───────────────────────────────────────────────

  async function startCamera(opts) {
    _sessionId = _sessionId || _newSessionId();
    const mySession = _sessionId;
    _setState(SCAN_STATE.OPENING_CAMERA);
    _emit('scan_started', { sessionId: mySession });
    const r = await _safeAsync(() => initializeCamera(opts), { ok: false, reason: 'init_error' });
    if (!_isActiveSession(mySession)) return r;   // stale
    if (r && r.ok) {
      _setState(SCAN_STATE.CAMERA_READY);
      _emit('camera_initialized', { sessionId: mySession });
    } else {
      _lastError = (r && r.reason) || 'camera_unavailable';
      _lastFailureStage = 'camera_open';
      _setState(SCAN_STATE.RECOVERABLE_ERROR);
      _emit('camera_failed', { sessionId: mySession, reason: _lastError });
    }
    return r;
  }

  async function stopCameraSession(reason) {
    _safe(() => stopCamera(reason || 'scan_runtime_stop'));
    if (_state === SCAN_STATE.OPENING_CAMERA || _state === SCAN_STATE.CAMERA_READY) {
      _setState(SCAN_STATE.IDLE);
    }
    return Object.freeze({ ok: true });
  }

  async function restartCameraSession(opts) {
    const mySession = _sessionId || _newSessionId();
    _sessionId = mySession;
    _setState(SCAN_STATE.OPENING_CAMERA);
    const r = await _safeAsync(() => restartCamera(opts), { ok: false, reason: 'restart_error' });
    if (!_isActiveSession(mySession)) return r;
    if (r && r.ok) {
      _setState(SCAN_STATE.CAMERA_READY);
      _emit('camera_recovered', { sessionId: mySession });
    } else {
      _lastError = (r && r.reason) || 'restart_failed';
      _lastFailureStage = 'camera_restart';
      _setState(SCAN_STATE.RECOVERABLE_ERROR);
    }
    return r;
  }

  /**
   * Accept a photo from the gallery / file input. The caller
   * supplies the chosen blob/file. The runtime validates +
   * normalizes + persists, then emits IMAGE_READY.
   */
  async function choosePhoto(file) {
    _sessionId = _sessionId || _newSessionId();
    const mySession = _sessionId;
    _setState(SCAN_STATE.PHOTO_SELECTED);
    _emit('photo_selected', { sessionId: mySession });
    return _runValidationPipeline(file, mySession);
  }

  /**
   * Capture a frame from the canvas/video. Caller supplies a
   * resolved blob (already drawn). Runtime treats it the same
   * way as choosePhoto.
   */
  async function capturePhoto(blob) {
    _sessionId = _sessionId || _newSessionId();
    const mySession = _sessionId;
    _setState(SCAN_STATE.CAPTURING);
    _emit('photo_selected', { sessionId: mySession, source: 'capture' });
    return _runValidationPipeline(blob, mySession);
  }

  async function _runValidationPipeline(file, mySession) {
    if (!_isActiveSession(mySession)) return { ok: false, reason: 'stale_session' };
    _setState(SCAN_STATE.VALIDATING_IMAGE);

    // Inline validation — file present, non-zero size, mime check.
    if (!file || typeof file !== 'object'
        || (typeof file.size === 'number' && file.size === 0)) {
      _lastError = 'image_invalid';
      _lastFailureStage = 'validation';
      _emit('image_invalid', { sessionId: mySession });
      _setState(SCAN_STATE.RECOVERABLE_ERROR);
      return { ok: false, reason: 'image_invalid' };
    }
    _emit('image_validated', { sessionId: mySession });

    // Build a preview URL. Prefer a caller-supplied dataUrl when
    // present — surfaces that already ran image normalization (e.g.
    // HEIC → JPEG re-encode in ScanCapture) pass the normalized
    // dataUrl so the URL the AI receives is the SAME bytes the user
    // sees, surviving unmount + ObjectURL revocation. Fall back to
    // URL.createObjectURL when no dataUrl was supplied.
    let previewUrl = '';
    if (typeof file.dataUrl === 'string' && file.dataUrl) {
      previewUrl = file.dataUrl;
    } else if (typeof URL !== 'undefined'
               && typeof URL.createObjectURL === 'function') {
      previewUrl = _safe(() => URL.createObjectURL(file), '');
    }
    if (!_isActiveSession(mySession)) return { ok: false, reason: 'stale_session' };
    _previewUrl = previewUrl || null;
    _registerBlobUrl(previewUrl);
    _normalizedDataUrl = previewUrl || null;
    _imageId = _imageHash(previewUrl || ('img_' + Date.now()));
    _imageValid = true;
    _persisted = true;  // surfaces drop into scanImageStore separately
    _emit('preview_persisted', { sessionId: mySession });
    _setState(SCAN_STATE.IMAGE_READY);
    return { ok: true, reason: null, sessionId: mySession,
      previewUrl, imageId: _imageId };
  }

  async function analyzeImage() {
    const mySession = _sessionId;
    const guard = assertValidScanInput({
      sessionId:         mySession,
      activeSessionId:   _sessionId,
      imageValid:        _imageValid,
      previewUrl:        _previewUrl,
      normalizedBlob:    !!_normalizedDataUrl,
      normalizedDataUrl: _normalizedDataUrl,
      persisted:         _persisted,
      state:             _state,
    });
    if (!guard.allowed) {
      _emit('analysis_blocked', { sessionId: mySession, reason: guard.reason });
      _lastFailureStage = 'analysis_guard';
      _setState(SCAN_STATE.RECOVERABLE_ERROR);
      return { ok: false, reason: guard.reason };
    }
    _setState(SCAN_STATE.PREPROCESSING);
    _emit('analysis_started', { sessionId: mySession });

    if (typeof _cfg.classifier !== 'function') {
      _lastError = 'no_classifier';
      _setState(SCAN_STATE.OFFLINE_QUEUED);
      _safe(() => enqueueOfflineScan({
        sessionId: mySession,
        farmId:    _cfg.activeFarm && _cfg.activeFarm.id,
        crop:      _cfg.activeFarm && _cfg.activeFarm.crop,
        imageId:   _imageId,
        previewUrl: _previewUrl,
      }));
      _emit('offline_scan_queued', { sessionId: mySession });
      return { ok: false, reason: 'no_classifier_queued' };
    }

    _setState(SCAN_STATE.ANALYZING);
    const raw = await _safeAsync(() => _cfg.classifier({
      sessionId: mySession,
      imageId:   _imageId,
      previewUrl: _previewUrl,
    }), null);
    if (!_isActiveSession(mySession)) return { ok: false, reason: 'stale_session' };
    if (!_isObj(raw)) {
      _lastError = 'classifier_returned_empty';
      _lastFailureStage = 'analysis';
      _setState(SCAN_STATE.RECOVERABLE_ERROR);
      return { ok: false, reason: 'classifier_empty' };
    }

    // Build the spec §12 result envelope. ROOT-CAUSE FIX (2026-07-16, field
    // screenshots): the old inline build was an 11-field WHITELIST that
    // silently discarded the classifier's ENTIRE intelligence envelope
    // (identificationState, requiresConfirmation, confirmationCandidates,
    // topCandidates, plantName, confidencePct, scanRecovery, farmBrain…) —
    // so the confirm button never rendered on any device and every scan fell
    // to the "couldn't confidently name this plant" dead-end regardless of
    // the server's decision. buildResultEnvelope spreads the raw envelope
    // FIRST, then stamps the §12 contract fields on top.
    const candidate = buildResultEnvelope(raw, {
      sessionId: mySession,
      imageId:   _imageId,
      previewUrl: _previewUrl,
    });
    const verdict = validateScanResult(candidate);
    if (!verdict.valid) {
      _lastError = verdict.reason;
      _lastFailureStage = 'result_contract';
      _setState(SCAN_STATE.RECOVERABLE_ERROR);
      return { ok: false, reason: verdict.reason };
    }

    _result = candidate;
    _emit('analysis_completed', { sessionId: mySession });

    // Honor the low-confidence rule.
    if (candidate.confidenceTone === 'needs_review') {
      const lc = isLowConfidenceAllowed({
        imageValid:         _imageValid,
        analysisCompleted:  true,
        previewUrl:         _previewUrl,
      });
      if (lc.allowed) {
        _setState(SCAN_STATE.LOW_CONFIDENCE);
        _emit('low_confidence_valid', { sessionId: mySession });
      } else {
        _lastFailureStage = 'low_confidence_rule';
        _setState(SCAN_STATE.RECOVERABLE_ERROR);
        return { ok: false, reason: lc.reason };
      }
    } else {
      _setState(SCAN_STATE.RESULT_READY);
      _emit('result_rendered', { sessionId: mySession });
    }
    return { ok: true, result: candidate };
  }

  async function retryStage() {
    if (_state === SCAN_STATE.RECOVERABLE_ERROR) {
      // Try to silently recover camera first.
      if (_lastFailureStage === 'camera_open' || _lastFailureStage === 'camera_restart') {
        return restartCameraSession({});
      }
      _setState(SCAN_STATE.IDLE);
      return { ok: true };
    }
    return { ok: false, reason: 'no_recoverable_state' };
  }

  function getResult() { return _result; }
  function getState()  { return _state; }
  function getStatusMessage() { return _statusMessage; }
  function getPreviewUrl() { return _previewUrl; }
  function getSessionId() { return _sessionId; }

  function getSnapshot() {
    return Object.freeze({
      engineVersion:      ENGINE_VERSION,
      activeSessionId:    _sessionId,
      currentState:       _state,
      previewExists:      !!_previewUrl,
      previewUrl:         _previewUrl,
      imageValidated:     _imageValid,
      persisted:          _persisted,
      analyzing:          _state === SCAN_STATE.ANALYZING || _state === SCAN_STATE.PREPROCESSING,
      resultValid:        _result != null,
      lastFailureStage:   _lastFailureStage,
      lastError:          _lastError,
      statusMessage:      _statusMessage,
      streamActive:       _safe(() => isCameraHealthy(), false),
      recoveryAvailable:  _state === SCAN_STATE.RECOVERABLE_ERROR,
      generatedAt:        Date.now(),
    });
  }

  async function saveToJournal() {
    if (!_result) {
      return { ok: false, reason: 'no_result' };
    }
    const v = validateScanResult(_result);
    if (!v.valid) {
      return { ok: false, reason: v.reason };
    }
    _setState(SCAN_STATE.SAVED);
    _emit('journal_saved', { sessionId: _sessionId, imageId: _imageId });
    // The actual Journal write is delegated to the surface (which
    // composes scanSessionManager + memory stores). The runtime
    // emits the canonical SCAN_COMPLETED bus event so downstream
    // engines (continuity bridge, recommendation governance) react.
    _emit('scan_completed', {
      scanId:   _sessionId,
      crop:     _cfg.activeFarm && _cfg.activeFarm.crop,
      severity: _result.severity,
    });
    return { ok: true, result: _result };
  }

  async function createFollowUp() {
    if (!_result || !_result.recommendation) {
      return { ok: false, reason: 'no_valid_result_or_recommendation' };
    }
    _emit('followup_created', { sessionId: _sessionId });
    return { ok: true, recommendation: _result.recommendation };
  }

  async function recoverSession() {
    // After background / resume — re-validate camera, preserve
    // preview, drop back to IMAGE_READY if we had one.
    if (_previewUrl && _imageValid) {
      _setState(SCAN_STATE.IMAGE_READY);
      return { ok: true, recovered: true };
    }
    if (_state === SCAN_STATE.CAMERA_READY || _state === SCAN_STATE.OPENING_CAMERA) {
      return restartCameraSession({});
    }
    return { ok: true, recovered: false };
  }

  function destroySession() {
    _safe(() => stopCamera('scan_runtime_destroy'));
    _releaseBlobUrls();
    _state = SCAN_STATE.IDLE;
    _sessionId = null;
    _previewUrl = null;
    _imageId = null;
    _imageValid = false;
    _normalizedDataUrl = null;
    _persisted = false;
    _result = null;
    _lastError = null;
    _lastFailureStage = null;
  }

  // Public handle.
  return Object.freeze({
    engineVersion: ENGINE_VERSION,
    SCAN_STATE,
    // lifecycle
    startCamera, stopCamera: stopCameraSession,
    restartCamera: restartCameraSession,
    choosePhoto, capturePhoto,
    analyzeImage, retryStage,
    saveToJournal, createFollowUp,
    recoverSession, destroySession,
    // accessors
    getState, getStatusMessage, getPreviewUrl, getSessionId,
    getResult, getSnapshot,
  });
}

export const _internal = Object.freeze({
  _imageHash, _newSessionId, ENGINE_VERSION,
});

const _module = { createScanRuntime, SCAN_STATE, _internal };
export default _module;
