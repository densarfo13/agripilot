/**
 * EvidenceFieldResolver.ts — farmer-facing resolution over EvidenceTierEngine.
 *
 * Does NOT re-implement the tier logic (single source of truth = EvidenceTierEngine).
 * It (a) maps each field's engine record to the spec's 8-value status enum +
 * required contract, (b) translates the tier to a FARMER-FRIENDLY label that never
 * leaks the enum / provider / API, and (c) encodes the FarmBrain ingestion-by-tier
 * policy. Pure, total, browser-safe.
 */
import { evaluateField, evaluateScanFields, ALL_TIER_FIELDS, type FieldEvidence } from './EvidenceTierEngine';

export type EvidenceStatus =
  | 'DIRECT_MEASURED' | 'MODEL_ESTIMATED' | 'FUSED_ESTIMATE' | 'LIVE_PROVIDER'
  | 'LAB_REQUIRED' | 'UNKNOWN' | 'NO_LIVE_FEED' | 'UNAVAILABLE';

export interface ResolvedField {
  status: EvidenceStatus;
  value: number | string | null;
  confidence: number;          // 0..100 (0 when no value — spec contract)
  evidenceTier: EvidenceStatus;
  source: string;
  reason: string;
  estimated: boolean;
  lastUpdated: string | null;
}

export const FARMBRAIN_INGESTABLE_TIERS: ReadonlyArray<EvidenceStatus> =
  Object.freeze(['DIRECT_MEASURED', 'MODEL_ESTIMATED', 'FUSED_ESTIMATE', 'LIVE_PROVIDER']);
export const FARMBRAIN_INGEST_MIN_CONFIDENCE = 70;

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

/** Engine (tier, status) → the spec's 8-value status enum. */
function _toStatus(rec: FieldEvidence): EvidenceStatus {
  switch (rec.status) {
    case 'measured': return 'DIRECT_MEASURED';
    case 'estimated': return rec.tier === 'FUSED_ESTIMATE' ? 'FUSED_ESTIMATE' : 'MODEL_ESTIMATED';
    case 'live': return 'LIVE_PROVIDER';
    case 'awaiting_lab': return 'LAB_REQUIRED';
    case 'awaiting_provider': return 'NO_LIVE_FEED';
    case 'awaiting_model': return 'UNAVAILABLE';
    case 'awaiting_input': return 'UNAVAILABLE';
    case 'unknown': default: return 'UNKNOWN';
  }
}

export function resolveField(field: string, ctx: any = {}): ResolvedField {
  return _safe(() => {
    const rec = evaluateField(field, ctx);
    const status = _toStatus(rec);
    return Object.freeze({
      status, evidenceTier: status,
      value: rec.value,
      confidence: rec.confidence == null ? 0 : rec.confidence,   // spec: confidence 0 when no value
      source: rec.source, reason: rec.reason, estimated: rec.estimated,
      lastUpdated: rec.lastUpdated,
    });
  }, Object.freeze({ status: 'UNKNOWN', evidenceTier: 'UNKNOWN', value: null, confidence: 0, source: 'error', reason: 'Could not resolve this field.', estimated: false, lastUpdated: null }));
}

export function resolveAllFields(ctx: any = {}): Record<string, ResolvedField> {
  const out: Record<string, ResolvedField> = {};
  for (const f of ALL_TIER_FIELDS) out[f] = resolveField(f, ctx);
  return Object.freeze(out);
}

/**
 * Farmer-friendly label — NEVER the enum/provider/API. Calm, plain words a
 * low-literacy farmer understands. The status enum stays internal.
 */
export function farmerLabel(status: EvidenceStatus): string {
  switch (status) {
    case 'DIRECT_MEASURED': return 'Measured';
    case 'MODEL_ESTIMATED': return 'Estimated';
    case 'FUSED_ESTIMATE': return 'Likely';
    case 'LIVE_PROVIDER': return 'Live data';
    case 'LAB_REQUIRED': return 'Needs lab test';
    case 'NO_LIVE_FEED': return 'Live data unavailable';
    case 'UNAVAILABLE': return 'Not available yet';
    case 'UNKNOWN': default: return 'Unknown';
  }
}

/** FarmBrain ingestion policy by tier (spec §7). */
export function canFarmBrainIngest(status: EvidenceStatus, confidence: number, value: unknown): boolean {
  if (!FARMBRAIN_INGESTABLE_TIERS.includes(status)) return false; // never LAB/UNKNOWN/UNAVAILABLE/NO_LIVE_FEED
  if (value == null) return false;
  return (Number(confidence) || 0) >= FARMBRAIN_INGEST_MIN_CONFIDENCE;
}

export function evidenceResolverHealth() {
  const ctx = { crop: 'maize', plantingDate: '2026-05-01', nowMs: 1, nowIso: '2026-06-25T00:00:00Z', weather: { tempC: 30 }, soil: { ph: 6.2, moisture: 18 } };
  const all = resolveAllFields(ctx);
  const vals = Object.values(all);
  const STATUSES: EvidenceStatus[] = ['DIRECT_MEASURED', 'MODEL_ESTIMATED', 'FUSED_ESTIMATE', 'LIVE_PROVIDER', 'LAB_REQUIRED', 'UNKNOWN', 'NO_LIVE_FEED', 'UNAVAILABLE'];
  return Object.freeze({
    ok: true, fields: ALL_TIER_FIELDS.length,
    everyFieldHasContract: vals.every(f => STATUSES.includes(f.status) && typeof f.confidence === 'number' && !!f.reason && 'value' in f && 'lastUpdated' in f),
    // Honesty: a value exists only on an ingestable/measured tier; lab fields never carry one.
    labNeverValued: ['nitrogen', 'phosphorus', 'potassium', 'cec'].every(k => all[k].status === 'LAB_REQUIRED' && all[k].value === null),
    ingestionPolicyHonest: canFarmBrainIngest('LAB_REQUIRED', 99, 5) === false && canFarmBrainIngest('UNAVAILABLE', 99, 5) === false,
    farmerLabelNeverLeaksEnum: STATUSES.every(s => !/_/.test(farmerLabel(s))),
  });
}

export function installEvidenceResolverHealth(): void {
  _safe(() => {
    if (typeof window === 'undefined' || (window as any).__evidenceResolverHealth) return;
    Object.defineProperty(window, '__evidenceResolverHealth', {
      configurable: true, enumerable: false, writable: false, value: () => evidenceResolverHealth(),
    });
  }, undefined);
}
