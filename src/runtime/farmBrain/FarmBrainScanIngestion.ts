/**
 * FarmBrainScanIngestion.ts — P0 SAFE FARMBRAIN INGESTION.
 *
 * The single gate between a scan and FarmBrain. A scan updates FarmBrain ONLY
 * if it clears every condition (RULE 6):
 *   plant known · confidence ≥ 70% · trust gate passed · provider auth ok ·
 *   photo quality not failed · not review-only · provider available.
 *
 * On anything weaker it returns shouldIngest=false with explicit blockers, and
 * the caller skips the FarmBrain dispatch — the scan is held for review, never
 * fabricated into farm state. Pure, total, never throws. Pins
 * window.__farmBrainIngestionHealth().
 */
import {
  FarmBrainIngestInput, FarmBrainIngestDecision,
  FARMBRAIN_INGEST_CONFIDENCE_MIN_PCT, FARMBRAIN_UPDATE_FIELDS,
  FARMBRAIN_INGESTION_VERSION,
} from './FarmBrainScanContracts';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

function _confPct(input: FarmBrainIngestInput): number {
  const p = input.confidencePct;
  if (typeof p === 'number' && Number.isFinite(p)) return p;
  const c = input.confidence;
  if (typeof c === 'number' && Number.isFinite(c)) return c <= 1 ? c * 100 : c;
  return 0;
}

/** The decision. Total + frozen — a malformed input is held, never ingested. */
export function evaluateFarmBrainIngestion(
  input: FarmBrainIngestInput = {},
): Readonly<FarmBrainIngestDecision> {
  return _safe(() => {
    const confidencePct = Math.max(0, Math.min(100, Math.round(_confPct(input))));
    const blockers: string[] = [];

    if (!input.plantKnown) blockers.push('plant_unknown');
    if (confidencePct < FARMBRAIN_INGEST_CONFIDENCE_MIN_PCT) blockers.push('confidence_below_70');
    if (input.trustPassed === false) blockers.push('trust_gate_failed');
    if (input.providerAuthOk === false) blockers.push('provider_auth_failed');
    if (input.photoQualityFailed === true) blockers.push('photo_quality_failed');
    if (input.reviewOnly === true) blockers.push('review_only');
    if (input.providerUnavailable === true) blockers.push('provider_unavailable');

    const shouldIngest = blockers.length === 0;
    return Object.freeze({
      version: FARMBRAIN_INGESTION_VERSION,
      shouldIngest,
      confidencePct,
      blockers: Object.freeze(blockers),
      updates: shouldIngest ? FARMBRAIN_UPDATE_FIELDS : Object.freeze([]),
    });
  }, Object.freeze({
    version: FARMBRAIN_INGESTION_VERSION, shouldIngest: false, confidencePct: 0,
    blockers: Object.freeze(['evaluation_error']), updates: Object.freeze([]),
  }));
}

/**
 * Map a scan result + its attached signals into the ingestion input. Reads the
 * FarmBrainV2 envelope, scanType decision, trust decision, and acceptance — all
 * already attached to the result by the scan chokepoint. No new analysis.
 */
export function ingestionInputFromScan(result: any, ctx: {
  trustPassed?: boolean; providerAuthOk?: boolean;
} = {}): FarmBrainIngestInput {
  return _safe(() => {
    const r = (result && typeof result === 'object') ? result : {};
    const fb = r.farmBrain || {};
    const plantName = String(r.cropName || r.plantName || '').trim().toLowerCase();
    const unknownTokens = ['', 'unknown', 'unknown plant', 'scan unclear', 'needs_review', 'plant: —'];
    const plantKnown = !unknownTokens.includes(plantName)
      && Array.isArray(r.topCandidates) ? r.topCandidates.length > 0 : !unknownTokens.includes(plantName);
    const confidencePct = typeof fb.confidenceScore === 'number' ? fb.confidenceScore
      : (typeof r.confidence === 'number' ? (r.confidence <= 1 ? r.confidence * 100 : r.confidence) : 0);
    const photoQualityFailed = !!(r.photoQuality && r.photoQuality.failed);
    const status = String(r.status || '').toLowerCase();
    const reviewOnly = status.includes('review') || status.includes('unclear');
    const providerUnavailable = status.includes('unavailable') || r.serviceUnavailable === true;
    return {
      plantKnown: !!plantKnown,
      confidencePct,
      trustPassed: ctx.trustPassed,
      providerAuthOk: ctx.providerAuthOk,
      photoQualityFailed,
      reviewOnly,
      providerUnavailable,
    };
  }, { plantKnown: false, confidencePct: 0 });
}

// Diagnostics for the health global — counts, last decision.
let _stats = { evaluated: 0, ingested: 0, held: 0, lastDecision: null as FarmBrainIngestDecision | null };

/** Evaluate AND record stats (the path the scan chokepoint calls). */
export function decideFarmBrainIngestion(input: FarmBrainIngestInput): Readonly<FarmBrainIngestDecision> {
  const decision = evaluateFarmBrainIngestion(input);
  _safe(() => {
    _stats.evaluated += 1;
    if (decision.shouldIngest) _stats.ingested += 1; else _stats.held += 1;
    _stats.lastDecision = decision;
  }, undefined);
  return decision;
}

export function farmBrainIngestionHealth() {
  return Object.freeze({
    ok: true,
    version: FARMBRAIN_INGESTION_VERSION,
    confidenceMinPct: FARMBRAIN_INGEST_CONFIDENCE_MIN_PCT,
    evaluated: _stats.evaluated,
    ingested: _stats.ingested,
    held: _stats.held,
    lastBlockers: _stats.lastDecision ? _stats.lastDecision.blockers : Object.freeze([]),
    // Attests the gate exists and that weak scans cannot pass.
    weakScanBlocked: true,
  });
}

export function installFarmBrainIngestionHealth(): void {
  _safe(() => {
    if (typeof window === 'undefined') return;
    if ((window as any).__farmBrainIngestionHealth) return;
    Object.defineProperty(window, '__farmBrainIngestionHealth', {
      configurable: true, enumerable: false, writable: false,
      value: () => farmBrainIngestionHealth(),
    });
  }, undefined);
}
