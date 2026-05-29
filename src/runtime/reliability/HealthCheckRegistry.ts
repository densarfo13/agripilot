/**
 * src/runtime/reliability/HealthCheckRegistry.ts — Registry of
 * health probes. Each probe is a thunk; reading the registry
 * runs them all and aggregates the result.
 */

import { RELIABILITY_RUNTIME_VERSION } from './reliabilityContracts';

export const HEALTH_REGISTRY_VERSION = RELIABILITY_RUNTIME_VERSION;

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

type ProbeFn = () => any;
const _probes: Record<string, ProbeFn> = Object.create(null);

export function registerHealthProbe(name: string, fn: ProbeFn) {
  return _safe(() => {
    if (!name || typeof fn !== 'function') return false;
    _probes[name] = fn;
    return true;
  }, false);
}

export function runHealthProbes() {
  return _safe(() => {
    const result: Record<string, any> = {};
    for (const name of Object.keys(_probes)) {
      try { result[name] = _probes[name](); }
      catch (e) { result[name] = { ok: false,
        error: String(e && (e as any).message || e) }; }
    }
    return Object.freeze({
      runtimeVersion: HEALTH_REGISTRY_VERSION,
      probes: Object.freeze(result),
      count:  Object.keys(_probes).length,
    });
  }, Object.freeze({
    runtimeVersion: HEALTH_REGISTRY_VERSION,
    probes: Object.freeze({}), count: 0,
  }));
}
