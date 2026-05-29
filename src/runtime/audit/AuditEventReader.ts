/**
 * src/runtime/audit/AuditEventReader.ts — Scoped reader.
 * Enterprise/admin can view scoped audit logs; everything else
 * fails closed.
 */

import { AUDIT_RUNTIME_VERSION } from './auditContracts';
import { _events, AuditEvent } from './AuditEventWriter';

export const AUDIT_READER_VERSION = AUDIT_RUNTIME_VERSION;

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

interface ReaderCtx {
  viewerRole?:      string;
  organizationId?:  string;
  limit?:           number;
}

/**
 * Return events the viewer is allowed to see. Admin gets all.
 * NGO/organization roles get only their org. Anything else → [].
 */
export function listAuditEvents(ctx: ReaderCtx): ReadonlyArray<AuditEvent> {
  return _safe(() => {
    const c = _isObj(ctx) ? ctx : {} as ReaderCtx;
    const role  = _str(c.viewerRole);
    const limit = typeof c.limit === 'number' ? c.limit : 200;

    if (role === 'admin') {
      return Object.freeze(_events.slice(-limit).map((e) =>
        Object.freeze({ ...e })));
    }
    if (role === 'ngo_admin' || role === 'organization_admin'
        || role === 'field_officer') {
      const orgId = _str(c.organizationId);
      if (!orgId) return Object.freeze([]);
      return Object.freeze(
        _events
          .filter((e) => _str(e.organizationId) === orgId)
          .slice(-limit)
          .map((e) => Object.freeze({ ...e })));
    }
    return Object.freeze([]);
  }, Object.freeze([] as AuditEvent[]));
}

export function auditEventReaderSnapshot() {
  return Object.freeze({
    runtimeVersion: AUDIT_READER_VERSION,
    totalEvents:    _events.length,
    appendOnly:     true,
  });
}
