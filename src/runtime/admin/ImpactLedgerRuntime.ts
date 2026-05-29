/**
 * src/runtime/admin/ImpactLedgerRuntime.ts — Append-only
 * impact ledger. Every meaningful record-shaped event from the
 * platform (scan complete, plant created, intervention done,
 * etc.) lands here for admin / NGO reporting.
 *
 * Strict-rule audit
 *   • Pure runtime. SSR-safe. Never throws.
 *   • Append-only — entries are not mutated after recording.
 *   • No persistence writes — durable storage belongs to the
 *     wave-5 single writer + the pending Prisma migration.
 *   • No fake data. Empty pools surface honest empty state.
 */

import {
  ADMIN_IMPACT_VERSION, IMPACT_TYPES, ADMIN_EMPTY_STATE,
} from './adminImpactContracts';

export const IMPACT_LEDGER_VERSION = 'impact-ledger-runtime-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _now = () => _safe(() => new Date().toISOString(), '');

const _validTypes = new Set<string>(IMPACT_TYPES as readonly string[]);

export interface ImpactRecord {
  id:                  string;
  userId?:             string;
  farmId?:             string;
  gardenId?:           string;
  plantId?:            string;
  organizationId?:     string;
  programId?:          string;
  type:                string;
  value:               Record<string, any>;
  evidenceArtifactId?: string;
  createdAt:           string;
}

const _records: ImpactRecord[] = [];
const _seen = new Set<string>();

function _hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

interface RecordCtx {
  type:                string;
  userId?:             string;
  farmId?:             string;
  gardenId?:           string;
  plantId?:            string;
  organizationId?:     string;
  programId?:          string;
  value?:              Record<string, any>;
  evidenceArtifactId?: string;
}

export function recordImpact(ctx: RecordCtx) {
  return _safe(() => {
    if (!_isObj(ctx)) {
      return Object.freeze({
        runtimeVersion: IMPACT_LEDGER_VERSION,
        ok: false, reason: 'invalid_context', record: null,
      });
    }
    const type = _str(ctx.type);
    if (!_validTypes.has(type)) {
      return Object.freeze({
        runtimeVersion: IMPACT_LEDGER_VERSION,
        ok: false, reason: 'invalid_type', record: null,
      });
    }
    const createdAt = _now();
    const dedup = type + '|' + _str(ctx.userId) + '|'
      + _str(ctx.plantId || ctx.farmId || ctx.gardenId)
      + '|' + _str(ctx.evidenceArtifactId)
      + '|' + createdAt;
    if (_seen.has(dedup)) {
      const existing = _records.find((r) => _isObj(r)
        && r.type === type
        && _str(r.userId) === _str(ctx.userId)
        && _str(r.evidenceArtifactId) === _str(ctx.evidenceArtifactId));
      return Object.freeze({
        runtimeVersion: IMPACT_LEDGER_VERSION,
        ok: true, reason: 'duplicate', record: existing || null,
      });
    }
    const id = 'impact_' + _hash(dedup);
    const value = _isObj(ctx.value) ? Object.freeze({ ...ctx.value }) : Object.freeze({});
    const record: ImpactRecord = Object.freeze({
      id, type, createdAt, value,
      userId:             _str(ctx.userId)             || undefined,
      farmId:             _str(ctx.farmId)             || undefined,
      gardenId:           _str(ctx.gardenId)           || undefined,
      plantId:            _str(ctx.plantId)            || undefined,
      organizationId:     _str(ctx.organizationId)     || undefined,
      programId:          _str(ctx.programId)          || undefined,
      evidenceArtifactId: _str(ctx.evidenceArtifactId) || undefined,
    });
    _records.push(record);
    _seen.add(dedup);
    return Object.freeze({
      runtimeVersion: IMPACT_LEDGER_VERSION,
      ok: true, reason: '', record,
    });
  }, Object.freeze({
    runtimeVersion: IMPACT_LEDGER_VERSION,
    ok: false, reason: 'error', record: null,
  }));
}

export function listImpactRecords(opts?: { organizationId?: string;
                                              programId?: string;
                                              type?: string;
                                              limit?: number }):
    ReadonlyArray<ImpactRecord> {
  return _safe(() => {
    const o = _isObj(opts) ? opts as any : {};
    const limit = typeof o.limit === 'number' ? o.limit : 500;
    let pool = _records;
    if (_str(o.organizationId)) {
      pool = pool.filter((r) => _str(r.organizationId) === _str(o.organizationId));
    }
    if (_str(o.programId)) {
      pool = pool.filter((r) => _str(r.programId) === _str(o.programId));
    }
    if (_str(o.type)) {
      pool = pool.filter((r) => _str(r.type) === _str(o.type));
    }
    return Object.freeze(pool.slice(-limit).map((r) =>
      Object.freeze({ ...r })));
  }, Object.freeze([] as ImpactRecord[]));
}

export function impactLedgerSnapshot(opts?: { organizationId?: string }) {
  return _safe(() => {
    const pool = listImpactRecords(opts);
    const counts: Record<string, number> = {};
    for (const t of IMPACT_TYPES) counts[t] = 0;
    for (const r of pool) {
      counts[r.type] = (counts[r.type] || 0) + 1;
    }
    return Object.freeze({
      runtimeVersion: IMPACT_LEDGER_VERSION,
      total: pool.length,
      counts: Object.freeze(counts),
      emptyState: pool.length === 0 ? ADMIN_EMPTY_STATE : '',
      fakeData: false,
    });
  }, Object.freeze({
    runtimeVersion: IMPACT_LEDGER_VERSION,
    total: 0, counts: Object.freeze({}),
    emptyState: ADMIN_EMPTY_STATE, fakeData: false,
  }));
}

export { ADMIN_IMPACT_VERSION };

export function _resetImpactLedger() {
  _records.length = 0;
  _seen.clear();
}
