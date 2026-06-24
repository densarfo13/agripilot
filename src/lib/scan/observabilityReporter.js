/**
 * observabilityReporter.js — SCAN_OBSERVABILITY_V1 client hook.
 *
 * Fire-and-forget report of a downstream scan outcome (task created /
 * plant saved) so the admin dashboard can measure the full funnel.
 * NEVER throws, NEVER blocks the farmer action, swallows every error —
 * analytics must not be able to break a scan, a task, or a plant save.
 */

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _token() {
  return _safe(() => (typeof localStorage !== 'undefined'
    ? localStorage.getItem('farroway_token') : null), null);
}

/**
 * reportScanOutcome(scanId, { taskCreated?, plantSaved? })
 * Returns immediately; the POST resolves in the background.
 */
export function reportScanOutcome(scanId, outcome) {
  _safe(() => {
    if (!scanId || typeof fetch !== 'function') return;
    const body = {};
    if (outcome && typeof outcome.taskCreated === 'boolean') body.taskCreated = outcome.taskCreated;
    if (outcome && typeof outcome.plantSaved === 'boolean') body.plantSaved = outcome.plantSaved;
    if (Object.keys(body).length === 0) return;
    const tok = _token();
    fetch('/api/scan/observability/outcome', {
      method: 'POST',
      credentials: 'include',
      headers: Object.assign({ 'Content-Type': 'application/json' },
        tok ? { Authorization: 'Bearer ' + tok } : {}),
      body: JSON.stringify(Object.assign({ scanId: String(scanId) }, body)),
      keepalive: true,
    }).catch(() => {});
  }, undefined);
}

export default reportScanOutcome;
