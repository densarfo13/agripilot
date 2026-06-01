/**
 * src/runtime/reliability/ReliabilityRuntime.ts — Composite
 * reliability diagnostic. Reads scan / queue / continuity /
 * build / Plant.id health probes already pinned by other
 * runtimes; aggregates one envelope.
 */

import { RELIABILITY_RUNTIME_VERSION } from './reliabilityContracts';
import {
  incidentSnapshot, recordIncident, INCIDENT_SIGNAL_VERSION,
} from './IncidentSignalTracker';
import {
  registerHealthProbe, runHealthProbes, HEALTH_REGISTRY_VERSION,
} from './HealthCheckRegistry';

export {
  recordIncident, incidentSnapshot,
  registerHealthProbe, runHealthProbes,
  RELIABILITY_RUNTIME_VERSION,
};

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _num  = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}

export function reliabilityHealth() {
  return _safe(() => {
    const scanRuntime = _probe('__scanRuntimeHealthV8');
    const scanUI      = _probe('__scanUIHealth');
    const queue       = _probe('__queueHealth');
    const continuity  = _probe('__continuityHealth');
    const build       = _probe('__farrowayBuild');
    const founder     = _probe('__founderMetricsHealth');

    const incidents = incidentSnapshot();
    const counts = (incidents as any).counts || {};

    return Object.freeze({
      runtimeVersion:        RELIABILITY_RUNTIME_VERSION,
      initialized:           true,
      scanHealthReady:       !!scanRuntime || !!scanUI,
      offlineHealthReady:    !!queue,
      apiHealthReady:        !!build,
      providerHealthReady:   _isObj(scanRuntime)
        && (scanRuntime as any).classifierAvailable !== false,
      // §7 pilot reliability counters (from the incident signal registry).
      routeErrors:          _num(counts.route_error)        || 0,
      authFailures:         _num(counts.auth_failure)        || 0,
      scanFailures:         _num(counts.scan_failure)        || 0,
      offlineSyncFailures:  _num(counts.sync_failure)        || 0,
      notificationFailures: _num(counts.notification_failure) || 0,
      build: build || null,
      metrics: Object.freeze({
        scanSuccessRate: _num(founder && (founder as any).scanSuccessRate),
        needsReviewRate: _num(founder && (founder as any).needsReviewRate),
        offlineQueueDepth: _num(queue && (queue as any).depth),
        syncFailureCount:  _num(counts.sync_failure) || 0,
        duplicatePreventionCount: _num(counts.duplicate_prevented) || 0,
        permissionDeniedCount:    _num(counts.permission_denied)    || 0,
      }),
      incidents,
      probes: runHealthProbes(),
      versions: Object.freeze({
        incident: INCIDENT_SIGNAL_VERSION,
        registry: HEALTH_REGISTRY_VERSION,
      }),
    });
  }, Object.freeze({
    runtimeVersion: RELIABILITY_RUNTIME_VERSION,
    initialized: false,
    scanHealthReady: false, offlineHealthReady: false,
    apiHealthReady: false, providerHealthReady: false,
  }));
}

export function installReliabilityRuntimeGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__reliabilityHealth !== 'function') {
      w.__reliabilityHealth = function () {
        const out = reliabilityHealth();
        try { console.log('[Farroway · Reliability]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
