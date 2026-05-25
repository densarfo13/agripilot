/**
 * scanStateMachine.js — canonical scan-flow state machine.
 *
 *   import {
 *     SCAN_STATE, SCAN_EVENT,
 *     nextScanState, canRunClassifier, classifierGate,
 *   } from 'src/core/scan/scanStateMachine.js';
 *
 *   let s = SCAN_STATE.IDLE;
 *   s = nextScanState(s, SCAN_EVENT.CHOOSE_GALLERY);    // → 'choosing'
 *   s = nextScanState(s, SCAN_EVENT.PREVIEW_READY);     // → 'preview_ready'
 *   s = nextScanState(s, SCAN_EVENT.ANALYZE_START);     // → 'analyzing'
 *   if (classifierGate(s, imageRecord).ok) { ...runClassifier... }
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A small, pure reducer over the 8 scan-flow states the spec
 *   ("Permanent Scan + Language Fix" §1.7) requires. It does NOT
 *   own the image record (that's `stableScanImageStore.js`), does
 *   NOT make UI decisions (surfaces decide from `currentState`),
 *   and does NOT throw on garbage input — invalid transitions
 *   return `{ ok: false, state, reason }` so the surface stays in
 *   control.
 *
 *   `classifierGate()` is the SINGLE truth-source that prevents
 *   running the classifier on a failed image. Surfaces MUST call
 *   it before kicking off the analyze step — the rule that closes
 *   the "low confidence result on a failed photo" production bug
 *   permanently.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 */

export const SCAN_STATE = Object.freeze({
  IDLE:            'idle',
  CHOOSING:        'choosing',
  PREVIEW_READY:   'preview_ready',
  ANALYZING:       'analyzing',
  RESULT_READY:    'result_ready',
  SAVED:           'saved',
  FAILED_IMAGE:    'failed_image',
  FAILED_ANALYSIS: 'failed_analysis',
});

export const SCAN_EVENT = Object.freeze({
  CHOOSE_CAMERA:    'choose_camera',
  CHOOSE_GALLERY:   'choose_gallery',
  PREVIEW_READY:    'preview_ready',
  IMAGE_LOAD_FAIL:  'image_load_fail',
  ANALYZE_START:    'analyze_start',
  ANALYZE_OK:       'analyze_ok',
  ANALYZE_FAIL:     'analyze_fail',
  SAVE_OK:          'save_ok',
  RETAKE:           'retake',
  CANCEL:           'cancel',
});

const _str = (v) => String(v == null ? '' : v).toLowerCase();

// Transition table — `{ [state]: { [event]: nextState } }`.
const _T = Object.freeze({
  [SCAN_STATE.IDLE]: {
    [SCAN_EVENT.CHOOSE_CAMERA]:  SCAN_STATE.CHOOSING,
    [SCAN_EVENT.CHOOSE_GALLERY]: SCAN_STATE.CHOOSING,
  },
  [SCAN_STATE.CHOOSING]: {
    [SCAN_EVENT.PREVIEW_READY]:   SCAN_STATE.PREVIEW_READY,
    [SCAN_EVENT.IMAGE_LOAD_FAIL]: SCAN_STATE.FAILED_IMAGE,
    [SCAN_EVENT.CANCEL]:          SCAN_STATE.IDLE,
  },
  [SCAN_STATE.PREVIEW_READY]: {
    [SCAN_EVENT.ANALYZE_START]:  SCAN_STATE.ANALYZING,
    [SCAN_EVENT.RETAKE]:         SCAN_STATE.IDLE,
    [SCAN_EVENT.IMAGE_LOAD_FAIL]:SCAN_STATE.FAILED_IMAGE,
    [SCAN_EVENT.CANCEL]:         SCAN_STATE.IDLE,
  },
  [SCAN_STATE.ANALYZING]: {
    [SCAN_EVENT.ANALYZE_OK]:   SCAN_STATE.RESULT_READY,
    [SCAN_EVENT.ANALYZE_FAIL]: SCAN_STATE.FAILED_ANALYSIS,
    // If the image fails to load mid-analysis (rare), downgrade
    // to FAILED_IMAGE so we never publish a result from a broken
    // photo — the rule the spec asks for.
    [SCAN_EVENT.IMAGE_LOAD_FAIL]: SCAN_STATE.FAILED_IMAGE,
    [SCAN_EVENT.CANCEL]:       SCAN_STATE.IDLE,
  },
  [SCAN_STATE.RESULT_READY]: {
    [SCAN_EVENT.SAVE_OK]: SCAN_STATE.SAVED,
    [SCAN_EVENT.RETAKE]:  SCAN_STATE.IDLE,
    [SCAN_EVENT.CANCEL]:  SCAN_STATE.IDLE,
  },
  [SCAN_STATE.SAVED]: {
    [SCAN_EVENT.RETAKE]: SCAN_STATE.IDLE,
    [SCAN_EVENT.CANCEL]: SCAN_STATE.IDLE,
  },
  [SCAN_STATE.FAILED_IMAGE]: {
    [SCAN_EVENT.RETAKE]: SCAN_STATE.IDLE,
    [SCAN_EVENT.CANCEL]: SCAN_STATE.IDLE,
  },
  [SCAN_STATE.FAILED_ANALYSIS]: {
    [SCAN_EVENT.RETAKE]:        SCAN_STATE.IDLE,
    [SCAN_EVENT.ANALYZE_START]: SCAN_STATE.ANALYZING,  // user can retry
    [SCAN_EVENT.CANCEL]:        SCAN_STATE.IDLE,
  },
});

const _VALID_STATES = new Set(Object.values(SCAN_STATE));

/**
 * Reducer. Returns the next state for `(current, event)`. Unknown
 * inputs return the current state unchanged — the caller never
 * has to handle a thrown error.
 *
 * @param {string} current
 * @param {string} event
 * @returns {string} new state (or `current` if the event is invalid here)
 */
export function nextScanState(current, event) {
  try {
    const c = _VALID_STATES.has(current) ? current : SCAN_STATE.IDLE;
    const e = _str(event);
    const row = _T[c];
    if (row && Object.prototype.hasOwnProperty.call(row, e)) return row[e];
    return c;
  } catch { return SCAN_STATE.IDLE; }
}

/**
 * SAFE-TO-RUN check. The classifier MUST NOT run on:
 *   • IDLE / CHOOSING — no image yet
 *   • FAILED_IMAGE   — image couldn't be loaded
 *   • SAVED / RESULT_READY — analysis already done
 *
 * Returns true ONLY when the state is PREVIEW_READY / ANALYZING
 * AND the image record (if supplied) is valid for analysis.
 *
 * @param {string} state
 * @param {object} [imageRecord]  optional record from stableScanImageStore
 */
export function canRunClassifier(state, imageRecord) {
  try {
    if (state !== SCAN_STATE.PREVIEW_READY && state !== SCAN_STATE.ANALYZING) return false;
    if (imageRecord == null) return true; // caller didn't supply — gate at the surface
    return !!(imageRecord
      && (imageRecord.objectUrl || imageRecord.dataUrlBackup || imageRecord.previewUrl)
      && (imageRecord.size > 0 || imageRecord.file));
  } catch { return false; }
}

/**
 * Convenience wrapper that returns a result envelope. Surfaces
 * branch on `ok` and render the matching message envelope.
 *
 * @param {string} state
 * @param {object} [imageRecord]
 * @returns {{ ok: boolean, reason?: string, message?: object }}
 */
export function classifierGate(state, imageRecord) {
  try {
    if (canRunClassifier(state, imageRecord)) return { ok: true };
    if (state === SCAN_STATE.FAILED_IMAGE) {
      return {
        ok: false, reason: 'failed_image',
        message: {
          key:      'scan.gate.imageFailed',
          fallback: 'Photo could not be loaded. Please choose the photo again.',
        },
      };
    }
    if (state === SCAN_STATE.IDLE || state === SCAN_STATE.CHOOSING) {
      return {
        ok: false, reason: 'no_image',
        message: {
          key:      'scan.gate.noImage',
          fallback: 'Choose a photo to begin.',
        },
      };
    }
    return {
      ok: false, reason: 'not_ready',
      message: {
        key:      'scan.gate.notReady',
        fallback: 'Photo is not ready for analysis yet.',
      },
    };
  } catch {
    return { ok: false, reason: 'exception',
             message: { key: 'scan.gate.notReady',
                        fallback: 'Photo is not ready for analysis yet.' } };
  }
}

const _module = {
  SCAN_STATE, SCAN_EVENT,
  nextScanState, canRunClassifier, classifierGate,
};
export default _module;
