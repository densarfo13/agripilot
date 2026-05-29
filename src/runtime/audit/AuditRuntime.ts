/**
 * src/runtime/audit/AuditRuntime.ts — Composite + health.
 */

import { AUDIT_RUNTIME_VERSION } from './auditContracts';
import {
  writeAuditEvent, AUDIT_WRITER_VERSION,
} from './AuditEventWriter';
import {
  listAuditEvents, auditEventReaderSnapshot, AUDIT_READER_VERSION,
} from './AuditEventReader';

export { writeAuditEvent, listAuditEvents, AUDIT_RUNTIME_VERSION };

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export function auditHealth() {
  return _safe(() => Object.freeze({
    runtimeVersion: AUDIT_RUNTIME_VERSION,
    initialized:    true,
    appendOnly:     true,
    writerReady:    true,
    readerReady:    true,
    snapshot:       auditEventReaderSnapshot(),
    versions: Object.freeze({
      writer: AUDIT_WRITER_VERSION,
      reader: AUDIT_READER_VERSION,
    }),
  }), Object.freeze({
    runtimeVersion: AUDIT_RUNTIME_VERSION,
    initialized: false,
    appendOnly: false,
    writerReady: false,
    readerReady: false,
  }));
}

export function installAuditRuntimeGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__auditHealth !== 'function') {
      w.__auditHealth = function () {
        const out = auditHealth();
        try { console.log('[Farroway · Audit]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
