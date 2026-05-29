/**
 * src/runtime/consent/ConsentRegistry.ts — Append-only consent log.
 *
 * In-memory registry of consent decisions. Latest record wins
 * on read; nothing is ever overwritten in place so the history
 * stays auditable.
 *
 * Strict-rule audit
 *   • Pure runtime: no React, no fetch, no localStorage writes.
 *   • Engine returns FROZEN envelopes.
 *   • All fallible work wrapped in _safe; engine never throws.
 *   • SSR-safe: no window touches.
 *   • No PII persisted (userId is the caller's opaque handle).
 */

import {
  CONSENT_TYPES, CONSENT_SOURCES, CONSENT_POLICY_VERSION,
} from './consentContracts';
import type {
  ConsentRecord, ConsentType, ConsentSource,
} from './consentContracts';

export const CONSENT_REGISTRY_VERSION =
  "farroway-consent-registry-v1";

const _isObj = (v: unknown): v is Record<string, unknown> =>
  v != null && typeof v === "object";
const _arr = <T,>(v: unknown): T[] =>
  Array.isArray(v) ? (v as T[]) : [];
const _str = (v: unknown): string =>
  typeof v === "string" ? v : "";
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

const _isConsentType = (v: unknown): v is ConsentType =>
  typeof v === "string"
  && (CONSENT_TYPES as readonly string[]).indexOf(v) >= 0;

const _isConsentSource = (v: unknown): v is ConsentSource =>
  typeof v === "string"
  && (CONSENT_SOURCES as readonly string[]).indexOf(v) >= 0;

// Append-only log. Module-scoped — one per runtime instance.
const _log: ConsentRecord[] = [];

export interface UpsertConsentInput {
  userId: string;
  type: ConsentType;
  granted: boolean;
  source: ConsentSource;
  version?: string;
}

export interface ConsentUpsertResult {
  ok: boolean;
  reason?: string;
  record: ConsentRecord | null;
}

const _frozenFailure = (reason: string): ConsentUpsertResult =>
  Object.freeze({ ok: false, reason, record: null });

/**
 * Append a new consent decision. Validates the enum + shape;
 * defaults version to CONSENT_POLICY_VERSION. Emits a frozen
 * ConsentRecord on success.
 */
export function upsertConsent(
  input: UpsertConsentInput,
): ConsentUpsertResult {
  return _safe(() => {
    if (!_isObj(input)) {
      return _frozenFailure("invalid_input");
    }
    const userId = _str(input.userId).trim();
    if (!userId) return _frozenFailure("invalid_user_id");
    if (!_isConsentType(input.type)) {
      return _frozenFailure("invalid_consent_type");
    }
    if (!_isConsentSource(input.source)) {
      return _frozenFailure("invalid_consent_source");
    }
    const granted = input.granted === true;
    const version = _str(input.version).trim()
      || CONSENT_POLICY_VERSION;

    const record: ConsentRecord = Object.freeze({
      userId,
      type:       input.type,
      granted,
      source:     input.source,
      version,
      recordedAt: Date.now(),
    });
    _log.push(record);
    return Object.freeze({ ok: true, record });
  }, _frozenFailure("upsert_threw"));
}

/**
 * Convenience wrapper — revoke is just an append with
 * granted:false so the history shows the transition.
 */
export function revokeConsent(
  userId: string,
  type: ConsentType,
  source: ConsentSource = "settings_page",
): ConsentUpsertResult {
  return upsertConsent({ userId, type, granted: false, source });
}

/**
 * Latest record for (userId, type) — or null if none exists.
 */
export function findConsent(
  userId: string,
  type: ConsentType,
): ConsentRecord | null {
  return _safe(() => {
    const uid = _str(userId).trim();
    if (!uid) return null;
    if (!_isConsentType(type)) return null;
    for (let i = _log.length - 1; i >= 0; i--) {
      const r = _log[i];
      if (r.userId === uid && r.type === type) return r;
    }
    return null;
  }, null);
}

/**
 * All consent rows for a single user. Frozen outer array;
 * inner records are already frozen on insert.
 */
export function listConsents(
  userId: string,
): ReadonlyArray<ConsentRecord> {
  return _safe(() => {
    const uid = _str(userId).trim();
    if (!uid) return Object.freeze([]) as ReadonlyArray<ConsentRecord>;
    const out: ConsentRecord[] = [];
    for (let i = 0; i < _log.length; i++) {
      if (_log[i].userId === uid) out.push(_log[i]);
    }
    return Object.freeze(out) as ReadonlyArray<ConsentRecord>;
  }, Object.freeze([]) as ReadonlyArray<ConsentRecord>);
}

export interface ConsentSnapshotRow {
  type: ConsentType;
  granted: number;
  revoked: number;
}

export interface ConsentRegistrySnapshot {
  version: string;
  totalRecords: number;
  perType: ReadonlyArray<ConsentSnapshotRow>;
}

/**
 * Counts of latest-state per (userId, type) bucketed by type.
 * A user who flipped grant→revoke→grant counts once in
 * "granted" — never both, never double.
 */
export function consentRegistrySnapshot(): ConsentRegistrySnapshot {
  return _safe(() => {
    // latest record per (userId, type)
    const latest = new Map<string, ConsentRecord>();
    for (let i = 0; i < _log.length; i++) {
      const r = _log[i];
      latest.set(r.userId + "|" + r.type, r);
    }
    const counts = new Map<ConsentType,
      { granted: number; revoked: number }>();
    for (const t of CONSENT_TYPES) {
      counts.set(t, { granted: 0, revoked: 0 });
    }
    latest.forEach((r) => {
      const bucket = counts.get(r.type);
      if (!bucket) return;
      if (r.granted) bucket.granted += 1;
      else bucket.revoked += 1;
    });
    const perType = _arr<ConsentSnapshotRow>(
      Array.from(counts.entries()).map(([type, c]) =>
        Object.freeze({
          type,
          granted: c.granted,
          revoked: c.revoked,
        })),
    );
    return Object.freeze({
      version:      CONSENT_REGISTRY_VERSION,
      totalRecords: _log.length,
      perType:      Object.freeze(perType),
    });
  }, Object.freeze({
    version:      CONSENT_REGISTRY_VERSION,
    totalRecords: 0,
    perType:      Object.freeze([]),
  }));
}
