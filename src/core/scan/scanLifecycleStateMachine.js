/**
 * scanLifecycleStateMachine.js — fine-grained finite-state machine
 * for the scan acquisition + processing lifecycle.
 *
 *   import {
 *     LIFECYCLE_STATE, LIFECYCLE_EVENT,
 *     nextLifecycleState, canPublishResult, isTerminal,
 *   } from 'src/core/scan/scanLifecycleStateMachine.js';
 *
 *   let s = LIFECYCLE_STATE.IDLE;
 *   s = nextLifecycleState(s, LIFECYCLE_EVENT.CAPTURE_START);
 *   // → 'capturing'
 *
 * Relationship to scanStateMachine.js
 * ───────────────────────────────────
 *   `scanStateMachine.js` carries the COARSE 8-state flow:
 *
 *     idle → choosing → preview_ready → analyzing → result_ready → saved
 *
 *   This module carries the FINER 11-state lifecycle the V5
 *   stability spec asks for — covers normalization, upload, and the
 *   inference-vs-recoverable-error split. The two are NOT redundant:
 *   the coarse one drives UI routing decisions; the fine one drives
 *   the retry engine + the debug overlay rows + the auto-recovery
 *   ladder.
 *
 *   Surfaces SHOULD subscribe to the coarse state for routing and
 *   to the fine state for spinner copy + recovery prompts.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe. No imports of React, T, or window.
 */

export const LIFECYCLE_STATE = Object.freeze({
  IDLE:               'idle',
  CAPTURING:          'capturing',
  NORMALIZING:        'normalizing',
  PREVIEW_READY:      'preview_ready',
  UPLOADING:          'uploading',
  UPLOADED:           'uploaded',
  AI_PROCESSING:      'ai_processing',
  AI_COMPLETE:        'ai_complete',
  LOW_CONFIDENCE:     'low_confidence',
  RECOVERABLE_ERROR:  'recoverable_error',
  FAILED:             'failed',
});

/**
 * Spec-aligned aliases (Scan V5 production-rebuild spec §1).
 *
 *   IDLE              ← LIFECYCLE_STATE.IDLE
 *   OPENING_CAMERA    ← LIFECYCLE_STATE.CAPTURING (camera open
 *                       phase before a frame is grabbed)
 *   CAMERA_READY      ← LIFECYCLE_STATE.CAPTURING (still in
 *                       capturing; the live preview is rendering)
 *   CAPTURING         ← LIFECYCLE_STATE.CAPTURING (shutter tap)
 *   IMAGE_READY       ← LIFECYCLE_STATE.PREVIEW_READY (normalized
 *                       JPEG is ready for AI)
 *   PREPROCESSING     ← LIFECYCLE_STATE.NORMALIZING
 *   ANALYZING         ← LIFECYCLE_STATE.AI_PROCESSING
 *   SUCCESS           ← LIFECYCLE_STATE.AI_COMPLETE
 *   LOW_CONFIDENCE    ← LIFECYCLE_STATE.LOW_CONFIDENCE
 *   RECOVERABLE_ERROR ← LIFECYCLE_STATE.RECOVERABLE_ERROR
 *   FATAL_ERROR       ← LIFECYCLE_STATE.FAILED
 *
 * Provided so the production-rebuild spec's identifiers compile
 * 1:1 with the existing FSM. Surfaces can subscribe to whichever
 * vocabulary they prefer — both resolve to the same underlying
 * state via toSpecState() / fromSpecState().
 */
export const LIFECYCLE_STATE_SPEC = Object.freeze({
  IDLE:              LIFECYCLE_STATE.IDLE,
  OPENING_CAMERA:    LIFECYCLE_STATE.CAPTURING,
  CAMERA_READY:      LIFECYCLE_STATE.CAPTURING,
  CAPTURING:         LIFECYCLE_STATE.CAPTURING,
  IMAGE_READY:       LIFECYCLE_STATE.PREVIEW_READY,
  PREPROCESSING:     LIFECYCLE_STATE.NORMALIZING,
  ANALYZING:         LIFECYCLE_STATE.AI_PROCESSING,
  SUCCESS:           LIFECYCLE_STATE.AI_COMPLETE,
  LOW_CONFIDENCE:    LIFECYCLE_STATE.LOW_CONFIDENCE,
  RECOVERABLE_ERROR: LIFECYCLE_STATE.RECOVERABLE_ERROR,
  FATAL_ERROR:       LIFECYCLE_STATE.FAILED,
});

export const LIFECYCLE_EVENT = Object.freeze({
  CAPTURE_START:        'capture_start',
  CAPTURE_OK:           'capture_ok',
  CAPTURE_FAIL:         'capture_fail',
  NORMALIZE_OK:         'normalize_ok',
  NORMALIZE_FAIL:       'normalize_fail',
  UPLOAD_START:         'upload_start',
  UPLOAD_OK:             'upload_ok',
  UPLOAD_FAIL:           'upload_fail',
  AI_START:              'ai_start',
  AI_OK:                 'ai_ok',
  AI_LOW_CONFIDENCE:     'ai_low_confidence',
  AI_FAIL:               'ai_fail',
  RETRY:                 'retry',
  RESET:                 'reset',
  CANCEL:                'cancel',
});

const _str = (v) => String(v == null ? '' : v).toLowerCase();

// Each row maps the events handled FROM that state. Events not
// listed are silently ignored (state unchanged) — the spec rules
// out throwing on invalid transitions because the surface may
// dispatch from stale closures during fast user navigation.
const _T = Object.freeze({
  [LIFECYCLE_STATE.IDLE]: {
    [LIFECYCLE_EVENT.CAPTURE_START]: LIFECYCLE_STATE.CAPTURING,
  },
  [LIFECYCLE_STATE.CAPTURING]: {
    [LIFECYCLE_EVENT.CAPTURE_OK]:   LIFECYCLE_STATE.NORMALIZING,
    [LIFECYCLE_EVENT.CAPTURE_FAIL]: LIFECYCLE_STATE.RECOVERABLE_ERROR,
    [LIFECYCLE_EVENT.CANCEL]:       LIFECYCLE_STATE.IDLE,
  },
  [LIFECYCLE_STATE.NORMALIZING]: {
    [LIFECYCLE_EVENT.NORMALIZE_OK]:   LIFECYCLE_STATE.PREVIEW_READY,
    [LIFECYCLE_EVENT.NORMALIZE_FAIL]: LIFECYCLE_STATE.RECOVERABLE_ERROR,
    [LIFECYCLE_EVENT.CANCEL]:         LIFECYCLE_STATE.IDLE,
  },
  [LIFECYCLE_STATE.PREVIEW_READY]: {
    [LIFECYCLE_EVENT.UPLOAD_START]: LIFECYCLE_STATE.UPLOADING,
    [LIFECYCLE_EVENT.AI_START]:     LIFECYCLE_STATE.AI_PROCESSING,
    [LIFECYCLE_EVENT.RETRY]:        LIFECYCLE_STATE.CAPTURING,
    [LIFECYCLE_EVENT.CANCEL]:       LIFECYCLE_STATE.IDLE,
  },
  [LIFECYCLE_STATE.UPLOADING]: {
    [LIFECYCLE_EVENT.UPLOAD_OK]:   LIFECYCLE_STATE.UPLOADED,
    [LIFECYCLE_EVENT.UPLOAD_FAIL]: LIFECYCLE_STATE.RECOVERABLE_ERROR,
    [LIFECYCLE_EVENT.CANCEL]:      LIFECYCLE_STATE.IDLE,
  },
  [LIFECYCLE_STATE.UPLOADED]: {
    [LIFECYCLE_EVENT.AI_START]: LIFECYCLE_STATE.AI_PROCESSING,
    [LIFECYCLE_EVENT.CANCEL]:   LIFECYCLE_STATE.IDLE,
  },
  [LIFECYCLE_STATE.AI_PROCESSING]: {
    [LIFECYCLE_EVENT.AI_OK]:             LIFECYCLE_STATE.AI_COMPLETE,
    [LIFECYCLE_EVENT.AI_LOW_CONFIDENCE]: LIFECYCLE_STATE.LOW_CONFIDENCE,
    [LIFECYCLE_EVENT.AI_FAIL]:           LIFECYCLE_STATE.RECOVERABLE_ERROR,
    [LIFECYCLE_EVENT.CANCEL]:            LIFECYCLE_STATE.IDLE,
  },
  [LIFECYCLE_STATE.AI_COMPLETE]: {
    [LIFECYCLE_EVENT.RESET]:  LIFECYCLE_STATE.IDLE,
    [LIFECYCLE_EVENT.RETRY]:  LIFECYCLE_STATE.CAPTURING,
    [LIFECYCLE_EVENT.CANCEL]: LIFECYCLE_STATE.IDLE,
  },
  [LIFECYCLE_STATE.LOW_CONFIDENCE]: {
    [LIFECYCLE_EVENT.RESET]:  LIFECYCLE_STATE.IDLE,
    [LIFECYCLE_EVENT.RETRY]:  LIFECYCLE_STATE.CAPTURING,
    [LIFECYCLE_EVENT.CANCEL]: LIFECYCLE_STATE.IDLE,
  },
  [LIFECYCLE_STATE.RECOVERABLE_ERROR]: {
    // Auto-recovery ladder — caller decides where to resume.
    [LIFECYCLE_EVENT.RETRY]:        LIFECYCLE_STATE.CAPTURING,
    [LIFECYCLE_EVENT.UPLOAD_START]: LIFECYCLE_STATE.UPLOADING,
    [LIFECYCLE_EVENT.AI_START]:     LIFECYCLE_STATE.AI_PROCESSING,
    [LIFECYCLE_EVENT.AI_FAIL]:      LIFECYCLE_STATE.FAILED,
    [LIFECYCLE_EVENT.UPLOAD_FAIL]:  LIFECYCLE_STATE.FAILED,
    [LIFECYCLE_EVENT.CANCEL]:       LIFECYCLE_STATE.IDLE,
    [LIFECYCLE_EVENT.RESET]:        LIFECYCLE_STATE.IDLE,
  },
  [LIFECYCLE_STATE.FAILED]: {
    [LIFECYCLE_EVENT.RETRY]:  LIFECYCLE_STATE.CAPTURING,
    [LIFECYCLE_EVENT.RESET]:  LIFECYCLE_STATE.IDLE,
    [LIFECYCLE_EVENT.CANCEL]: LIFECYCLE_STATE.IDLE,
  },
});

const _VALID = new Set(Object.values(LIFECYCLE_STATE));
const _TERMINAL = new Set([
  LIFECYCLE_STATE.AI_COMPLETE,
  LIFECYCLE_STATE.LOW_CONFIDENCE,
  LIFECYCLE_STATE.FAILED,
]);

const _PUBLISHABLE = new Set([
  LIFECYCLE_STATE.AI_COMPLETE,
  LIFECYCLE_STATE.LOW_CONFIDENCE,
]);

/**
 * Reducer. Unknown current states reset to IDLE; unknown events
 * leave the state unchanged so a stale closure can't push the FSM
 * into an invalid corner.
 */
export function nextLifecycleState(current, event) {
  try {
    const c = _VALID.has(current) ? current : LIFECYCLE_STATE.IDLE;
    const e = _str(event);
    const row = _T[c];
    if (row && Object.prototype.hasOwnProperty.call(row, e)) return row[e];
    return c;
  } catch { return LIFECYCLE_STATE.IDLE; }
}

/**
 * `true` when the FSM is in a state where the surface MAY render
 * an AI result. Use this at the publish boundary so a stale async
 * write can never push a result into FAILED / IDLE / CAPTURING.
 */
export function canPublishResult(state) {
  return _PUBLISHABLE.has(state);
}

/** True for AI_COMPLETE / LOW_CONFIDENCE / FAILED. */
export function isTerminal(state) {
  return _TERMINAL.has(state);
}

/** True when the FSM is mid-flight (capture → ai_processing). */
export function isInFlight(state) {
  return state === LIFECYCLE_STATE.CAPTURING
      || state === LIFECYCLE_STATE.NORMALIZING
      || state === LIFECYCLE_STATE.UPLOADING
      || state === LIFECYCLE_STATE.AI_PROCESSING;
}

/**
 * True if the surface should KEEP rendering the captured preview.
 * Rule: preview stays visible from PREVIEW_READY all the way
 * through to AI_COMPLETE / LOW_CONFIDENCE / FAILED. It is ONLY
 * cleared on IDLE or a fresh CAPTURING.
 */
export function shouldKeepPreview(state) {
  switch (state) {
    case LIFECYCLE_STATE.IDLE:
    case LIFECYCLE_STATE.CAPTURING:
      return false;
    default:
      return true;
  }
}

/**
 * toSpecState(state) — translate the canonical underlying state
 * into the spec's display vocabulary. Use this when reporting
 * state to the production-rebuild dashboard or to surfaces that
 * want the "OPENING_CAMERA" / "ANALYZING" / "SUCCESS" labels.
 */
export function toSpecState(state) {
  switch (state) {
    case LIFECYCLE_STATE.IDLE:              return 'IDLE';
    case LIFECYCLE_STATE.CAPTURING:         return 'CAPTURING';
    case LIFECYCLE_STATE.NORMALIZING:       return 'PREPROCESSING';
    case LIFECYCLE_STATE.PREVIEW_READY:     return 'IMAGE_READY';
    case LIFECYCLE_STATE.UPLOADING:         return 'PREPROCESSING';
    case LIFECYCLE_STATE.UPLOADED:          return 'IMAGE_READY';
    case LIFECYCLE_STATE.AI_PROCESSING:     return 'ANALYZING';
    case LIFECYCLE_STATE.AI_COMPLETE:       return 'SUCCESS';
    case LIFECYCLE_STATE.LOW_CONFIDENCE:    return 'LOW_CONFIDENCE';
    case LIFECYCLE_STATE.RECOVERABLE_ERROR: return 'RECOVERABLE_ERROR';
    case LIFECYCLE_STATE.FAILED:            return 'FATAL_ERROR';
    default:                                return 'IDLE';
  }
}

/** Inverse — accept a spec label, return the underlying state. */
export function fromSpecState(label) {
  if (typeof label !== 'string') return LIFECYCLE_STATE.IDLE;
  return LIFECYCLE_STATE_SPEC[label.toUpperCase()] || LIFECYCLE_STATE.IDLE;
}

const _module = {
  LIFECYCLE_STATE, LIFECYCLE_EVENT, LIFECYCLE_STATE_SPEC,
  nextLifecycleState, canPublishResult, isTerminal, isInFlight,
  shouldKeepPreview, toSpecState, fromSpecState,
};
export default _module;
