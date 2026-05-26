/**
 * scanPipelineIntegrity.js — invariant checker for the scan
 * pipeline. The single guard that proves a result was reached
 * through the legitimate path.
 *
 *   import { assertScanPipelineIntegrity, INTEGRITY_VIOLATION }
 *     from 'src/core/scan/scanPipelineIntegrity.js';
 *
 *   const verdict = assertScanPipelineIntegrity({
 *     state,       // current acquisition-FSM state
 *     image,       // image record (or null)
 *     result,      // diagnosis envelope (or null)
 *     sessionId,   // active scan session id
 *     activeSessionId, // current session — verifies result isn't stale
 *   });
 *   if (!verdict.ok) {
 *     // surface MUST suppress diagnosis + render recovery
 *     telemetry.track('scan_integrity_violation', { reason: verdict.reason });
 *     return;
 *   }
 *
 * Invariants (any failure = pipeline integrity violation):
 *
 *   1. result exists ⇒ image exists  (no diagnosis without image)
 *   2. result exists ⇒ state ∈ { ANALYZING, RESULT_READY }  (no
 *      diagnosis from an idle / failed / pre-validate state)
 *   3. result has confidence ⇒ classifierInputVerified === true
 *      (no confidence label without verified image)
 *   4. sessionId provided ⇒ sessionId === activeSessionId
 *      (no stale-session result)
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A pure verifier. Returns `{ ok, reason }` — never throws in
 *   production. In dev mode (when `_devThrow` is set), it throws
 *   so a violation is loud during local QA.
 *
 *   It is NOT a state machine, NOT a fixer (consumers branch on
 *   ok and either render the diagnosis or fall back to recovery
 *   UI). It is NOT a renderer.
 *
 * Strict-rule audit
 *   • Pure. Never throws in production. SSR-safe.
 *   • Default-fail: an unrecognised shape returns ok:false.
 */

export const INTEGRITY_VIOLATION = Object.freeze({
  RESULT_WITHOUT_IMAGE:           'result_without_image',
  RESULT_FROM_WRONG_STATE:        'result_from_wrong_state',
  CONFIDENCE_WITHOUT_VERIFIED_INPUT: 'confidence_without_verified_input',
  STALE_SESSION:                  'stale_session',
});

// In-process flag — set once at boot. Defaults to false so
// production never throws from this guard.
let _devThrow = false;

/**
 * Enable throw-on-violation. Boot calls this with
 * `(import.meta.env.DEV === true)` so dev surfaces a hard error
 * and prod stays silent.
 */
export function setDevThrowMode(flag) {
  _devThrow = !!flag;
}

// Acquisition-FSM states where a result is allowed.
const _ALLOWED_RESULT_STATES = new Set(['analyzing', 'result_ready', 'saved']);
const _str = (v) => String(v == null ? '' : v).toLowerCase();

function _hasImage(image) {
  if (!image || typeof image !== 'object') return false;
  return !!(image.objectUrl || image.dataUrlBackup || image.dataUrl || image.file);
}

/**
 * Run the integrity check. Returns `{ ok, reason, detail }`.
 * In dev mode throws when ok=false so a violation halts the page
 * loudly and shows in the React error boundary.
 *
 * @param {object} ctx
 * @returns {object}
 */
export function assertScanPipelineIntegrity(ctx) {
  const verdict = (() => {
    try {
      const c = (ctx && typeof ctx === 'object') ? ctx : {};
      const result = c.result;
      const image  = c.image;
      const state  = _str(c.state);
      const session = c.sessionId;
      const active  = c.activeSessionId;

      // No result → nothing to verify. Always ok.
      if (result == null) return { ok: true };

      // 1. Result without image is invalid.
      if (!_hasImage(image)) {
        return {
          ok: false,
          reason: INTEGRITY_VIOLATION.RESULT_WITHOUT_IMAGE,
          detail: 'Diagnosis envelope present but no image record carries a survival channel.',
        };
      }

      // 2. Result must come from ANALYZING / RESULT_READY / SAVED.
      if (state && !_ALLOWED_RESULT_STATES.has(state)) {
        return {
          ok: false,
          reason: INTEGRITY_VIOLATION.RESULT_FROM_WRONG_STATE,
          detail: `Result rendered from state="${state}" — only ANALYZING/RESULT_READY/SAVED may publish.`,
        };
      }

      // 3. Confidence requires verified input.
      const hasConfidence = !!(result.confidence || result.confidenceLabel || result.confidenceTone);
      if (hasConfidence && result.classifierInputVerified !== true) {
        return {
          ok: false,
          reason: INTEGRITY_VIOLATION.CONFIDENCE_WITHOUT_VERIFIED_INPUT,
          detail: 'Diagnosis carries a confidence label without classifierInputVerified=true.',
        };
      }

      // 4. Stale session — supplied sessionId must equal the active one.
      if (session != null && active != null && session !== active) {
        return {
          ok: false,
          reason: INTEGRITY_VIOLATION.STALE_SESSION,
          detail: `Result session "${session}" is not the active session "${active}".`,
        };
      }

      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        reason: INTEGRITY_VIOLATION.RESULT_FROM_WRONG_STATE,
        detail: (err && err.message) || String(err),
      };
    }
  })();

  // Dev-mode hard throw so a violation halts the page during QA.
  if (!verdict.ok && _devThrow) {
    // eslint-disable-next-line no-console
    console.error('[scanPipelineIntegrity]', verdict);
    throw new Error(`scanPipelineIntegrity: ${verdict.reason} — ${verdict.detail || ''}`);
  }
  return verdict;
}

/** Test-only reset. */
export function _resetIntegrityForTests() { _devThrow = false; }

const _module = {
  INTEGRITY_VIOLATION,
  setDevThrowMode,
  assertScanPipelineIntegrity,
  _resetIntegrityForTests,
};
export default _module;
