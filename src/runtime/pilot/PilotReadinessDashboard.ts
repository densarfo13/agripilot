/**
 * PilotReadinessDashboard.ts — sprint #215 §11.
 *
 * Read-only "north star" composite. Pins window.__pilotReadinessDashboard()
 * reading the probes prior sprints already pin — it never re-measures
 * and never fabricates. Also installs the spec's __taskHealth /
 * __notificationHealth aliases over the existing dedup probes.
 *
 * Pure. SSR-safe. Never throws. Frozen returns.
 */

export const PILOT_READINESS_DASHBOARD_VERSION = 'pilot-readiness-dashboard-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _hasWindow = (): boolean => _safe(() => typeof window !== 'undefined' && !!window, false);

function _probe(name: string): any {
  if (!_hasWindow()) return null;
  return _safe(() => {
    const fn = (window as any)[name];
    if (typeof fn !== 'function') return null;
    const v = fn();
    return v && typeof v === 'object' ? v : null;
  }, null);
}
function _ok(v: any): boolean { return !!(v && v.ok); }

export function buildPilotReadinessDashboard(): Readonly<{
  ok: boolean;
  runtimeVersion: string;
  scanSuccess: boolean;
  farmBrainConfidence: boolean;
  taskCompletion: boolean;
  reviewQueueSize: number | null;
  localizationHealth: boolean;
  trustGateHealth: boolean;
}> {
  return _safe(() => {
    const trust = _probe('__scanTrustGateHealth');
    const review = _probe('__scanReviewQueueHealth');
    const fbExpl = _probe('__farmBrainExplanationHealth');
    const taskD = _probe('__taskDedupHealth');
    const lang = _probe('__languageConsistencyHealth');
    const scanMythos = _probe('__scanMythosHealth');

    const reviewQueueSize = (review && typeof review.pendingCount === 'number')
      ? review.pendingCount : null;

    return Object.freeze({
      ok: _ok(trust) && _ok(review),
      runtimeVersion: PILOT_READINESS_DASHBOARD_VERSION,
      scanSuccess: _ok(scanMythos) || (scanMythos && scanMythos.runtimeVersion != null) || false,
      farmBrainConfidence: _ok(fbExpl) || (fbExpl && fbExpl.farmBrainExplanationReady) || false,
      taskCompletion: _ok(taskD) || (taskD && taskD.taskDedupReady) || false,
      reviewQueueSize,
      localizationHealth: _ok(lang) || (lang && lang.ok) || false,
      trustGateHealth: _ok(trust) || (trust && trust.trustGateReady) || false,
    });
  }, Object.freeze({
    ok: false, runtimeVersion: PILOT_READINESS_DASHBOARD_VERSION,
    scanSuccess: false, farmBrainConfidence: false, taskCompletion: false,
    reviewQueueSize: null, localizationHealth: false, trustGateHealth: false,
  }));
}

let _installed = false;
export function installPilotReadinessDashboardGlobal(): void {
  if (_installed) return;
  if (!_hasWindow()) return;
  _safe(() => {
    const def = (name: string, fn: () => any) =>
      Object.defineProperty(window as any, name, {
        configurable: true, enumerable: false, writable: false, value: fn,
      });
    def('__pilotReadinessDashboard', () => buildPilotReadinessDashboard());
    // §13 spec aliases over existing dedup probes.
    def('__taskHealth', () => _probe('__taskDedupHealth') || { ok: false });
    def('__notificationHealth', () => _probe('__notificationDedupHealth') || { ok: false });
    _installed = true;
  }, undefined);
}

export const _internal = Object.freeze({
  buildPilotReadinessDashboard, installPilotReadinessDashboardGlobal,
});
export default installPilotReadinessDashboardGlobal;
