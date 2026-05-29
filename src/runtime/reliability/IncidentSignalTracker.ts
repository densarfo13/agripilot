/**
 * src/runtime/reliability/IncidentSignalTracker.ts — In-memory
 * incident counter for reliability diagnostics.
 */

import {
  RELIABILITY_RUNTIME_VERSION, INCIDENT_KINDS,
} from './reliabilityContracts';

export const INCIDENT_SIGNAL_VERSION = RELIABILITY_RUNTIME_VERSION;

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _now = () => _safe(() => new Date().toISOString(), '');

const _counts: Record<string, number> = Object.create(null);
for (const k of INCIDENT_KINDS) _counts[k] = 0;

const _recent: Array<{ kind: string; at: string; detail?: string }> = [];
const MAX_RECENT = 100;
const _validKinds = new Set<string>(INCIDENT_KINDS as readonly string[]);

export function recordIncident(kind: string, detail?: string) {
  return _safe(() => {
    const k = _str(kind);
    if (!_validKinds.has(k)) {
      return Object.freeze({
        runtimeVersion: INCIDENT_SIGNAL_VERSION,
        ok: false, reason: 'invalid_kind',
      });
    }
    _counts[k] = (_counts[k] || 0) + 1;
    _recent.push({ kind: k, at: _now(), detail: _str(detail) });
    if (_recent.length > MAX_RECENT) {
      _recent.splice(0, _recent.length - MAX_RECENT);
    }
    return Object.freeze({
      runtimeVersion: INCIDENT_SIGNAL_VERSION,
      ok: true, kind: k, count: _counts[k],
    });
  }, Object.freeze({
    runtimeVersion: INCIDENT_SIGNAL_VERSION,
    ok: false, reason: 'error',
  }));
}

export function incidentSnapshot() {
  return Object.freeze({
    runtimeVersion: INCIDENT_SIGNAL_VERSION,
    counts:         Object.freeze({ ..._counts }),
    recentSize:     _recent.length,
  });
}

export function _resetIncidents() {
  for (const k of Object.keys(_counts)) _counts[k] = 0;
  _recent.length = 0;
}
