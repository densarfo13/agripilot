/**
 * pestDeprecationWarning.js — single, deduped console.warn for
 * the legacy v0 pest-report surface.
 *
 * The v0 stack (utils/pestReports.js, utils/pestCluster.js, the
 * three Pest* components) is superseded by the Outbreak
 * Intelligence System v1 under src/outbreak/. Anything still
 * importing the v0 modules calls warnDeprecatedV0Pest() once on
 * module load; the helper emits one console line in dev and
 * stays silent in production.
 *
 * Strict-rule audit:
 *   * never throws (try/catch wrapped)
 *   * never spams (deduped via a module-level `_warned` flag)
 *   * production-quiet (gated on import.meta.env.DEV)
 */

let _warned = false;

function _isDev() {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) return true;
  } catch { /* SSR */ }
  return false;
}

export function warnDeprecatedV0Pest(label = 'pest v0') {
  if (_warned) return;
  _warned = true;
  if (!_isDev()) return;
  try {
    console.warn(
      `[FARROWAY_DEPRECATED] ${label}: replace with src/outbreak/* (v1).`
      + ' See docs in src/outbreak/outbreakStore.js for migration.',
    );
  } catch { /* console missing */ }
}

export const _internal = Object.freeze({
  reset: () => { _warned = false; },
});
