/**
 * safePreviewRenderer.js — preview rules so the broken-image
 * placeholder NEVER appears during scan.
 *
 *   import { isPreviewValid, shouldKeepPreview, fallbackSrcFor,
 *            PREVIEW_STAGE }
 *     from 'src/core/scan/safePreviewRenderer.js';
 *
 * What it is — and is NOT
 * ───────────────────────
 *   Pure rules the existing scan surface adopts to keep the
 *   captured photo on screen through analyzing → result → retry.
 *   Composes with `safeScanImagePipeline` (validation rules) and
 *   `safeAssetResolver` (fallback chain).
 *
 *   It does NOT render anything itself. It does NOT replace
 *   SafeImage handling — it codifies WHEN the preview is "safe to
 *   show", "must stay", and what fallback is acceptable.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 */

import { LAST_RESORT_IMAGE } from '../assets/safeAssetResolver.js';

export const PREVIEW_STAGE = Object.freeze({
  EMPTY:     'empty',       // no photo yet — show capture surface, not a preview slot
  LOADING:   'loading',     // image bytes exist but `<img>` hasn't loaded
  STABLE:    'stable',      // loaded + dimensions valid → safe for analyze
  ANALYZING: 'analyzing',   // preview MUST persist
  RESULT:    'result',      // preview MUST persist behind the result card
  ERROR:     'error',       // analysis or load failed — show fallback, NOT broken icon
});

const _num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

/**
 * Is the preview safe to render right now? True iff there is a
 * source URL, the image has reported `onload`, and the dimensions
 * are non-zero. Anything else is "not stable yet" — the surface
 * should show a loading shimmer, not a broken-image icon.
 *
 * @param {object} state
 * @param {string} [state.src]
 * @param {boolean} [state.loaded]    set true on `<img onLoad>`
 * @param {number} [state.naturalWidth]
 * @param {number} [state.naturalHeight]
 * @returns {boolean}
 */
export function isPreviewValid(state) {
  try {
    if (!state || typeof state !== 'object') return false;
    const src = typeof state.src === 'string' ? state.src.trim() : '';
    if (!src) return false;
    if (state.loaded !== true) return false;
    const w = _num(state.naturalWidth), h = _num(state.naturalHeight);
    if (w <= 0 || h <= 0) return false;
    return true;
  } catch { return false; }
}

/**
 * Should the preview keep rendering at this stage? True for
 * STABLE / ANALYZING / RESULT — the broken-image fix is making
 * sure the surface NEVER unmounts the `<img>` mid-flight.
 *
 * @param {string} stage one of PREVIEW_STAGE
 * @returns {boolean}
 */
export function shouldKeepPreview(stage) {
  return stage === PREVIEW_STAGE.STABLE
      || stage === PREVIEW_STAGE.ANALYZING
      || stage === PREVIEW_STAGE.RESULT;
}

/**
 * The fallback `src` to render when the user's captured image
 * truly cannot be displayed (load error). Returns the calm
 * brand mark — never an empty string, never a "?" icon.
 *
 * @param {string} [stage]
 * @returns {string}
 */
export function fallbackSrcFor(stage) {
  // Only ERROR stage gets the fallback. Other stages still show
  // the user's photo or a loading shimmer, NEVER the mark.
  if (stage === PREVIEW_STAGE.ERROR) return LAST_RESORT_IMAGE;
  return '';
}

/**
 * Convenience descriptor for an `<img>` element. The caller wires
 * onLoad → setState({ loaded: true, naturalWidth, naturalHeight })
 * and onError → setState({ stage: PREVIEW_STAGE.ERROR }).
 *
 * @param {object} state    same shape as isPreviewValid
 * @param {string} stage    one of PREVIEW_STAGE
 */
export function describePreview(state, stage) {
  const valid = isPreviewValid(state);
  const keep  = shouldKeepPreview(stage);
  const shouldRender = valid || keep || stage === PREVIEW_STAGE.LOADING;
  return {
    shouldRender,
    src: shouldRender ? (state && state.src) || fallbackSrcFor(stage) : '',
    isFallback: stage === PREVIEW_STAGE.ERROR && !valid,
    stage,
  };
}

const _module = {
  PREVIEW_STAGE,
  isPreviewValid, shouldKeepPreview, fallbackSrcFor, describePreview,
};
export default _module;
