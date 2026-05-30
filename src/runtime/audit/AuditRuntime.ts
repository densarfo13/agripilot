/**
 * src/runtime/audit/AuditRuntime.ts — Composite + health.
 */

import {
  AUDIT_RUNTIME_VERSION,
  AUDIT_ACTIONS,
  AUDIT_EVENT_COVERAGE,
} from './auditContracts';
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
  return _safe(() => {
    // Wave-40 — coverage attestation. The 18 spec event types
    // map to AUDIT_ACTIONS tokens; coverage is "covered" iff the
    // token is registered as a legal audit action.
    const eventCoverage = AUDIT_EVENT_COVERAGE.map((m) => Object.freeze({
      spec: m.spec, action: m.action,
      covered: (AUDIT_ACTIONS as readonly string[]).indexOf(m.action) >= 0,
    }));
    const coveredCount = eventCoverage.filter((e) => e.covered).length;
    const allCovered = coveredCount === eventCoverage.length;
    return Object.freeze({
      runtimeVersion: AUDIT_RUNTIME_VERSION,
      initialized:    true,
      appendOnly:     true,
      writerReady:    true,
      readerReady:    true,
      // Wave-40 attestations.
      canonicalEventsCovered: allCovered,
      coveredCount,
      totalEvents:    eventCoverage.length,
      eventCoverage:  Object.freeze(eventCoverage),
      snapshot:       auditEventReaderSnapshot(),
      versions: Object.freeze({
        writer: AUDIT_WRITER_VERSION,
        reader: AUDIT_READER_VERSION,
      }),
    });
  }, Object.freeze({
    runtimeVersion: AUDIT_RUNTIME_VERSION,
    initialized: false,
    appendOnly: false,
    writerReady: false,
    readerReady: false,
    canonicalEventsCovered: false,
    coveredCount: 0,
    totalEvents: AUDIT_EVENT_COVERAGE.length,
    eventCoverage: Object.freeze([]),
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
