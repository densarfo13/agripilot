/**
 * scanAcquisitionStateMachine.js — fine-grained 11-state FSM for
 * the scan ACQUISITION pipeline (camera → file → validate →
 * persist → analyze).
 *
 *   import {
 *     ACQ_STATE, ACQ_EVENT,
 *     nextAcquisitionState, canRunClassifier, canSaveJournal,
 *   } from 'src/core/scan/scanAcquisitionStateMachine.js';
 *
 *   let s = ACQ_STATE.IDLE;
 *   s = nextAcquisitionState(s, ACQ_EVENT.REQUEST_CAMERA);   // → REQUESTING_CAMERA
 *   s = nextAcquisitionState(s, ACQ_EVENT.CAMERA_OPEN);      // → CAPTURING
 *   s = nextAcquisitionState(s, ACQ_EVENT.PHOTO_CAPTURED);   // → VALIDATING_IMAGE
 *
 * What it is — and is NOT
 * ───────────────────────
 *   Companion to the existing `scanStateMachine.js` (coarse 8-state
 *   result-flow). THIS module models the FINE acquisition pipeline
 *   the spec asks for — every step from "request the camera" to
 *   "image is ready for the classifier" gets its own state so
 *   the UI can render the precise loading copy.
 *
 *   It is NOT a replacement for the coarse state machine — both
 *   coexist. The coarse FSM drives the result page; THIS FSM
 *   drives the capture screen.
 *
 *   States:
 *     IDLE                — nothing in flight
 *     REQUESTING_CAMERA   — getUserMedia() requested, awaiting permission
 *     CAPTURING           — camera open, user framing
 *     SELECTING_PHOTO     — gallery / file-input mode
 *     VALIDATING_IMAGE    — running validateScanImage()
 *     PERSISTING_IMAGE    — storing into the image store
 *     IMAGE_READY         — verified + persisted; classifier may run
 *     ANALYZING           — classifier in flight
 *     RESULT_READY        — diagnosis envelope produced
 *     FAILED              — terminal failure; recovery UI only
 *     OFFLINE_QUEUED      — no network; analysis queued for later
 *
 *   Hard rules:
 *     • classifier MUST NOT run unless state === IMAGE_READY (or
 *       transitioning IMAGE_READY → ANALYZING). `canRunClassifier`
 *       enforces this.
 *     • journal MUST NOT write unless state ∈ { RESULT_READY,
 *       OFFLINE_QUEUED }. `canSaveJournal` enforces this.
 *     • invalid transitions are no-ops (current state returned) —
 *       no throws.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 */

export const ACQ_STATE = Object.freeze({
  IDLE:               'idle',
  REQUESTING_CAMERA:  'requesting_camera',
  CAPTURING:          'capturing',
  SELECTING_PHOTO:    'selecting_photo',
  VALIDATING_IMAGE:   'validating_image',
  PERSISTING_IMAGE:   'persisting_image',
  IMAGE_READY:        'image_ready',
  ANALYZING:          'analyzing',
  RESULT_READY:       'result_ready',
  FAILED:             'failed',
  OFFLINE_QUEUED:     'offline_queued',
});

export const ACQ_EVENT = Object.freeze({
  REQUEST_CAMERA:     'request_camera',
  CAMERA_OPEN:        'camera_open',
  CAMERA_DENIED:      'camera_denied',
  CAMERA_TIMEOUT:     'camera_timeout',
  CHOOSE_GALLERY:     'choose_gallery',
  PHOTO_CAPTURED:     'photo_captured',
  PHOTO_SELECTED:     'photo_selected',
  VALIDATION_OK:      'validation_ok',
  VALIDATION_FAIL:    'validation_fail',
  PERSIST_OK:         'persist_ok',
  PERSIST_FAIL:       'persist_fail',
  ANALYZE_START:      'analyze_start',
  ANALYZE_OK:         'analyze_ok',
  ANALYZE_FAIL:       'analyze_fail',
  OFFLINE_DETECTED:   'offline_detected',
  RETAKE:             'retake',
  CANCEL:             'cancel',
});

const _VALID_STATES = new Set(Object.values(ACQ_STATE));
const _str = (v) => String(v == null ? '' : v).toLowerCase();

const _T = Object.freeze({
  [ACQ_STATE.IDLE]: {
    [ACQ_EVENT.REQUEST_CAMERA]: ACQ_STATE.REQUESTING_CAMERA,
    [ACQ_EVENT.CHOOSE_GALLERY]: ACQ_STATE.SELECTING_PHOTO,
  },
  [ACQ_STATE.REQUESTING_CAMERA]: {
    [ACQ_EVENT.CAMERA_OPEN]:     ACQ_STATE.CAPTURING,
    [ACQ_EVENT.CAMERA_DENIED]:   ACQ_STATE.SELECTING_PHOTO,   // fall to gallery
    [ACQ_EVENT.CAMERA_TIMEOUT]:  ACQ_STATE.SELECTING_PHOTO,   // fall to gallery
    [ACQ_EVENT.OFFLINE_DETECTED]: ACQ_STATE.OFFLINE_QUEUED,
    [ACQ_EVENT.CANCEL]:          ACQ_STATE.IDLE,
  },
  [ACQ_STATE.CAPTURING]: {
    [ACQ_EVENT.PHOTO_CAPTURED]: ACQ_STATE.VALIDATING_IMAGE,
    [ACQ_EVENT.CANCEL]:         ACQ_STATE.IDLE,
    [ACQ_EVENT.RETAKE]:         ACQ_STATE.IDLE,
  },
  [ACQ_STATE.SELECTING_PHOTO]: {
    [ACQ_EVENT.PHOTO_SELECTED]: ACQ_STATE.VALIDATING_IMAGE,
    [ACQ_EVENT.CANCEL]:         ACQ_STATE.IDLE,
  },
  [ACQ_STATE.VALIDATING_IMAGE]: {
    [ACQ_EVENT.VALIDATION_OK]:  ACQ_STATE.PERSISTING_IMAGE,
    [ACQ_EVENT.VALIDATION_FAIL]:ACQ_STATE.FAILED,
    [ACQ_EVENT.CANCEL]:         ACQ_STATE.IDLE,
  },
  [ACQ_STATE.PERSISTING_IMAGE]: {
    [ACQ_EVENT.PERSIST_OK]:     ACQ_STATE.IMAGE_READY,
    [ACQ_EVENT.PERSIST_FAIL]:   ACQ_STATE.FAILED,
    [ACQ_EVENT.CANCEL]:         ACQ_STATE.IDLE,
  },
  [ACQ_STATE.IMAGE_READY]: {
    [ACQ_EVENT.ANALYZE_START]:    ACQ_STATE.ANALYZING,
    [ACQ_EVENT.OFFLINE_DETECTED]: ACQ_STATE.OFFLINE_QUEUED,
    [ACQ_EVENT.RETAKE]:           ACQ_STATE.IDLE,
    [ACQ_EVENT.CANCEL]:           ACQ_STATE.IDLE,
  },
  [ACQ_STATE.ANALYZING]: {
    [ACQ_EVENT.ANALYZE_OK]:       ACQ_STATE.RESULT_READY,
    [ACQ_EVENT.ANALYZE_FAIL]:     ACQ_STATE.FAILED,
    [ACQ_EVENT.OFFLINE_DETECTED]: ACQ_STATE.OFFLINE_QUEUED,
    [ACQ_EVENT.CANCEL]:           ACQ_STATE.IDLE,
  },
  [ACQ_STATE.RESULT_READY]: {
    [ACQ_EVENT.RETAKE]: ACQ_STATE.IDLE,
    [ACQ_EVENT.CANCEL]: ACQ_STATE.IDLE,
  },
  [ACQ_STATE.OFFLINE_QUEUED]: {
    [ACQ_EVENT.ANALYZE_START]: ACQ_STATE.ANALYZING,  // retry when online
    [ACQ_EVENT.RETAKE]:        ACQ_STATE.IDLE,
    [ACQ_EVENT.CANCEL]:        ACQ_STATE.IDLE,
  },
  [ACQ_STATE.FAILED]: {
    [ACQ_EVENT.RETAKE]: ACQ_STATE.IDLE,
    [ACQ_EVENT.CANCEL]: ACQ_STATE.IDLE,
  },
});

/**
 * @param {string} current
 * @param {string} event
 * @returns {string} new state (or current if event is invalid here)
 */
export function nextAcquisitionState(current, event) {
  try {
    const c = _VALID_STATES.has(current) ? current : ACQ_STATE.IDLE;
    const e = _str(event);
    const row = _T[c];
    if (row && Object.prototype.hasOwnProperty.call(row, e)) return row[e];
    return c;
  } catch { return ACQ_STATE.IDLE; }
}

/**
 * Classifier MUST NOT run from any state except IMAGE_READY /
 * ANALYZING (the transition state). Surfaces should ASSERT this
 * before calling the classifier.
 */
export function canRunClassifier(state) {
  return state === ACQ_STATE.IMAGE_READY || state === ACQ_STATE.ANALYZING;
}

/**
 * Journal write is allowed ONLY from RESULT_READY (analysis
 * completed) or OFFLINE_QUEUED (image valid + persisted, analysis
 * pending). FAILED state never writes.
 */
export function canSaveJournal(state) {
  return state === ACQ_STATE.RESULT_READY || state === ACQ_STATE.OFFLINE_QUEUED;
}

/**
 * Coarse → fine mapping for callers that already hold a value from
 * the original `scanStateMachine.js` 8-state vocabulary. Used by
 * incremental migration code that calls both machines side-by-side.
 */
export function fromCoarseState(coarse) {
  switch (_str(coarse)) {
    case 'idle':            return ACQ_STATE.IDLE;
    case 'choosing':        return ACQ_STATE.SELECTING_PHOTO;
    case 'preview_ready':   return ACQ_STATE.IMAGE_READY;
    case 'analyzing':       return ACQ_STATE.ANALYZING;
    case 'result_ready':    return ACQ_STATE.RESULT_READY;
    case 'saved':           return ACQ_STATE.RESULT_READY;   // saved-after-result
    case 'failed_image':    return ACQ_STATE.FAILED;
    case 'failed_analysis': return ACQ_STATE.FAILED;
    default:                return ACQ_STATE.IDLE;
  }
}

const _module = {
  ACQ_STATE, ACQ_EVENT,
  nextAcquisitionState, canRunClassifier, canSaveJournal,
  fromCoarseState,
};
export default _module;
