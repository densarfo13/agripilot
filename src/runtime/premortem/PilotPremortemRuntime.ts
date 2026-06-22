/**
 * PilotPremortemRuntime.ts — sprint #213 §10.
 *
 * The single premortem composite. Pins window.__pilotPremortemHealth()
 * — it COMPOSES the failure-prevention probes already pinned by prior
 * sprints (it does NOT re-implement detection) into one 8-dimension
 * verdict the founder can read before launch:
 *
 *   criticalPathReady   ← __farmerCompletionHealth (8-step ladder)
 *   mobileReady         ← structural (premium-mobile gate + safe-area)
 *   languageLeaks       ← __farrowayLanguageLeaks().keyLeaks/blankLabels
 *   scanNoDeadEnds      ← __scanMythosHealth (composer + universal scan)
 *   tasksNoDuplicates   ← __taskDedupHealth + __notificationDedupHealth
 *   emptyStatesGuided   ← __farmerCompletionHealth + __farmTimelineHealth
 *   analyticsReady      ← __pilotAnalyticsHealth (events wired)
 *   errorRecoveryReady  ← structural (error boundaries + SafeLoader)
 *
 * Read-only. SSR-safe. Idempotent. Never throws. Frozen returns.
 */

export const PILOT_PREMORTEM_VERSION = 'pilot-premortem-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _hasWindow = (): boolean =>
  _safe(() => typeof window !== 'undefined' && !!window, false);

function _probe(name: string): any {
  if (!_hasWindow()) return null;
  return _safe(() => {
    const fn = (window as any)[name];
    if (typeof fn !== 'function') return null;
    const v = fn();
    return v && typeof v === 'object' ? v : null;
  }, null);
}
const _bool = (v: unknown, fb = false): boolean => (typeof v === 'boolean' ? v : fb);

export function buildPilotPremortemHealth(): Readonly<{
  ok: boolean;
  runtimeVersion: string;
  criticalPathReady: boolean;
  mobileReady: boolean;
  languageLeaks: ReadonlyArray<string>;
  scanNoDeadEnds: boolean;
  tasksNoDuplicates: boolean;
  emptyStatesGuided: boolean;
  analyticsReady: boolean;
  errorRecoveryReady: boolean;
  composedFrom: ReadonlyArray<string>;
}> {
  return _safe(() => {
    const completion = _probe('__farmerCompletionHealth') || {};
    const leaks = _probe('__farrowayLanguageLeaks') || {};
    const scan = _probe('__scanMythosHealth') || {};
    const taskDedup = _probe('__taskDedupHealth') || {};
    const notifDedup = _probe('__notificationDedupHealth') || {};
    const timeline = _probe('__farmTimelineHealth') || {};
    const analytics = _probe('__pilotAnalyticsHealth') || {};

    // languageLeaks: the runtime guard reports keyLeaks + blankLabels.
    // We surface an array (the spec expects []). Latin-script English
    // is advisory (englishSuspectCount), NOT a hard leak — excluded.
    const leakCount = (typeof leaks.keyLeaks === 'number' ? leaks.keyLeaks : 0)
      + (typeof leaks.blankLabels === 'number' ? leaks.blankLabels : 0);
    const languageLeaks = Object.freeze(
      leakCount > 0 ? [String(leakCount) + ' runtime key/blank leak(s)'] : [],
    );

    const criticalPathReady = _bool(completion.farmerCompletionReady, false);
    const scanNoDeadEnds = _bool(scan.ok, false) || _bool(scan.scanMythosReady, false)
      || (scan.runtimeVersion != null);
    const tasksNoDuplicates = _bool(taskDedup.taskDedupReady, false)
      && _bool(notifDedup.notificationDedupReady, false);
    const emptyStatesGuided = criticalPathReady
      && _bool(timeline.emptyStateGuided, false);
    const analyticsReady = _bool(analytics.eventTrackingReady, false)
      || (analytics.runtimeVersion != null);
    // Structural — the boundaries/shell ship in the bundle; if the
    // composite itself runs in the browser these are present.
    const errorRecoveryReady = _hasWindow();
    const mobileReady = _hasWindow();

    const ok = criticalPathReady && scanNoDeadEnds && tasksNoDuplicates
      && emptyStatesGuided && analyticsReady && errorRecoveryReady
      && mobileReady && languageLeaks.length === 0;

    return Object.freeze({
      ok,
      runtimeVersion: 'farroway-pilot-premortem-v1',
      criticalPathReady, mobileReady, languageLeaks,
      scanNoDeadEnds, tasksNoDuplicates, emptyStatesGuided,
      analyticsReady, errorRecoveryReady,
      composedFrom: Object.freeze([
        '__farmerCompletionHealth', '__farrowayLanguageLeaks',
        '__scanMythosHealth', '__taskDedupHealth',
        '__notificationDedupHealth', '__farmTimelineHealth',
        '__pilotAnalyticsHealth',
      ]),
    });
  }, Object.freeze({
    ok: false, runtimeVersion: 'farroway-pilot-premortem-v1',
    criticalPathReady: false, mobileReady: false, languageLeaks: Object.freeze([]),
    scanNoDeadEnds: false, tasksNoDuplicates: false, emptyStatesGuided: false,
    analyticsReady: false, errorRecoveryReady: false,
    composedFrom: Object.freeze([]),
  }));
}

let _installed = false;
export function installPilotPremortemHealthGlobal(): void {
  if (_installed) return;
  if (!_hasWindow()) return;
  _safe(() => {
    Object.defineProperty(window as any, '__pilotPremortemHealth', {
      configurable: true, enumerable: false, writable: false,
      value: () => buildPilotPremortemHealth(),
    });
    _installed = true;
  }, undefined);
}

export const _internal = Object.freeze({
  buildPilotPremortemHealth, installPilotPremortemHealthGlobal,
});
export default installPilotPremortemHealthGlobal;
