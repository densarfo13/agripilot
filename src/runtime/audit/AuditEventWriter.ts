/**
 * src/runtime/audit/AuditEventWriter.ts — Append-only writer
 * for audit events. In-memory log; the wave-5 single writer
 * owns durable persistence.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Append-only — existing entries are never mutated.
 *   • Strips PII from metadata at write time.
 *   • No localStorage / IndexedDB writes.
 */

import {
  AUDIT_RUNTIME_VERSION, AUDIT_ACTIONS, AUDIT_PII_DROP_LIST,
} from './auditContracts';

export const AUDIT_WRITER_VERSION = AUDIT_RUNTIME_VERSION;

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _now = () => _safe(() => new Date().toISOString(), '');

const _validActions = new Set<string>(AUDIT_ACTIONS as readonly string[]);

export interface AuditEvent {
  id:               string;
  actorUserId:      string;
  organizationId?:  string;
  action:           string;
  entityType:       string;
  entityId:         string;
  timestamp:        string;
  metadata:         Record<string, any>;
  ipHash?:          string;
  userAgentHash?:   string;
}

export const _events: AuditEvent[] = [];
const _seen = new Set<string>();

function _hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function _scrubMetadata(meta: any): Record<string, any> {
  if (!_isObj(meta)) return {};
  const out: Record<string, any> = {};
  for (const k of Object.keys(meta)) {
    if (AUDIT_PII_DROP_LIST.indexOf(k) >= 0) continue;
    out[k] = (meta as any)[k];
  }
  return out;
}

interface WriteCtx {
  actorUserId:     string;
  action:          string;
  entityType:      string;
  entityId:        string;
  organizationId?: string;
  metadata?:       Record<string, any>;
  ipHash?:         string;
  userAgentHash?:  string;
}

export function writeAuditEvent(ctx: WriteCtx) {
  return _safe(() => {
    if (!_isObj(ctx)) {
      return Object.freeze({
        runtimeVersion: AUDIT_WRITER_VERSION,
        ok: false, reason: 'invalid_context', event: null,
      });
    }
    const action = _str(ctx.action);
    if (!_validActions.has(action)) {
      return Object.freeze({
        runtimeVersion: AUDIT_WRITER_VERSION,
        ok: false, reason: 'invalid_action', event: null,
      });
    }
    const actorUserId = _str(ctx.actorUserId);
    const entityType  = _str(ctx.entityType);
    const entityId    = _str(ctx.entityId);
    if (!actorUserId || !entityType || !entityId) {
      return Object.freeze({
        runtimeVersion: AUDIT_WRITER_VERSION,
        ok: false, reason: 'missing_fields', event: null,
      });
    }
    const timestamp = _now();
    const dedup = action + '|' + actorUserId + '|'
      + entityType + '|' + entityId + '|' + timestamp;
    if (_seen.has(dedup)) {
      return Object.freeze({
        runtimeVersion: AUDIT_WRITER_VERSION,
        ok: true, reason: 'duplicate', event: null,
      });
    }
    const id = 'audit_' + _hash(dedup);
    const event: AuditEvent = Object.freeze({
      id, actorUserId, action, entityType, entityId, timestamp,
      organizationId: _str(ctx.organizationId),
      metadata:       Object.freeze(_scrubMetadata(ctx.metadata)),
      ipHash:         _str(ctx.ipHash),
      userAgentHash:  _str(ctx.userAgentHash),
    });
    _events.push(event);
    _seen.add(dedup);
    return Object.freeze({
      runtimeVersion: AUDIT_WRITER_VERSION,
      ok: true, reason: '', event,
    });
  }, Object.freeze({
    runtimeVersion: AUDIT_WRITER_VERSION,
    ok: false, reason: 'error', event: null,
  }));
}

/** Test-only — wipe the writer state. */
export function _resetAuditEvents() {
  _events.length = 0;
  _seen.clear();
}
