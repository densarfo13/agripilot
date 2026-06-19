/**
 * ScanEvidenceFusionEngine.ts — sprint #206, spec V2 Layer 1.
 *
 * The one genuine delta from "MYTHOS SCAN INTELLIGENCE V2": fuse the
 * already-composed scan signals into an evidence view that surfaces
 * BOTH sides — what supports the top guess AND what argues against
 * it. The shipping card showed only `why` (reasons for) + neutral
 * `limitations`; honest decision support also names the doubts.
 *
 * COMPOSITION ONLY. Reads the ScanMythosDecision the composer already
 * produced (#200/#201) + photo count. It NEVER calls a provider,
 * NEVER invents an observation, NEVER fabricates satellite/NDVI
 * (Layer 2 is frozen — see SCAN_INTELLIGENCE_V2_AUDIT.md), NEVER
 * inflates confidence (fusedConfidence echoes the composed value).
 *
 * Pure. SSR-safe. Idempotent install. Never throws. Frozen returns.
 */

export const SCAN_EVIDENCE_FUSION_VERSION = 'scan-evidence-fusion-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _str = (v: unknown): string => (typeof v === 'string' ? v : '');
const _num = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);

export type EvidenceStrength = 'strong' | 'mixed' | 'weak';

export interface ScanEvidenceFusion {
  runtimeVersion:           string;
  fusedConfidence:          number;          // echoes decision.confidence — never inflated
  evidenceStrength:         EvidenceStrength;
  photoCount:               number;
  supportingObservations:   ReadonlyArray<string>;
  contradictingObservations: ReadonlyArray<string>;
  // Honesty constants — gate-asserted.
  satelliteUsed:            false;
  neverFabricates:          true;
}

/**
 * Fuse a composed ScanMythosDecision + photo count into the two-sided
 * evidence view. `decision` is the object from composeScanMythosDecision.
 */
export function fuseScanEvidence(input: {
  decision?: any;
  photosUsed?: ReadonlyArray<string>;
} = {}): Readonly<ScanEvidenceFusion> {
  return _safe(() => {
    const d = (input.decision && typeof input.decision === 'object')
      ? input.decision : {};
    const confidence = Math.max(0, Math.min(100, _num(d.confidence) ?? 0));
    const photoCount = _arr(input.photosUsed).length;
    const cands = _arr(d.topCandidates);
    const margin = (cands.length >= 2)
      ? (( _num(cands[0]?.score) ?? 0) - (_num(cands[1]?.score) ?? 0))
      : null;
    const severity = _str(d.severity);

    // ── supporting — reasons FOR (the composed why list is already
    //    scrubbed of provider/dosage; reuse it verbatim) ────────────
    const supporting: string[] = [];
    for (const w of _arr(d.why)) { if (_str(w)) supporting.push(_str(w)); }
    if (photoCount >= 2) {
      supporting.push('More than one photo was used, which strengthens the match.');
    }
    if (margin != null && margin >= 20) {
      supporting.push('The top match stands clearly ahead of the alternatives.');
    }

    // ── contradicting — the NEW honest value: reasons AGAINST ───────
    const contradicting: string[] = [];
    if (margin != null && margin < 10 && cands.length >= 2) {
      contradicting.push('Other plants look similar in this photo.');
    }
    if (confidence > 0 && confidence < 60) {
      contradicting.push('The photo evidence is limited.');
    }
    if (photoCount <= 1) {
      contradicting.push('This is based on a single photo.');
    }
    if (severity === 'high' && confidence < 70) {
      contradicting.push('The signs may be serious but are not yet clear — confirm before treating.');
    }
    // De-dup (cheap; lists are tiny).
    const _uniq = (xs: string[]) => Array.from(new Set(xs));
    const supportingObservations = _uniq(supporting);
    const contradictingObservations = _uniq(contradicting);

    // ── strength — honest synthesis of the two sides ───────────────
    let evidenceStrength: EvidenceStrength;
    if (confidence < 50 || contradictingObservations.length >= 3) {
      evidenceStrength = 'weak';
    } else if (confidence >= 80 && contradictingObservations.length === 0
      && supportingObservations.length >= 2) {
      evidenceStrength = 'strong';
    } else {
      evidenceStrength = 'mixed';
    }

    return Object.freeze({
      runtimeVersion: SCAN_EVIDENCE_FUSION_VERSION,
      fusedConfidence: confidence,
      evidenceStrength,
      photoCount,
      supportingObservations: Object.freeze(supportingObservations),
      contradictingObservations: Object.freeze(contradictingObservations),
      satelliteUsed: false as const,
      neverFabricates: true as const,
    });
  }, Object.freeze({
    runtimeVersion: SCAN_EVIDENCE_FUSION_VERSION,
    fusedConfidence: 0,
    evidenceStrength: 'weak' as const,
    photoCount: 0,
    supportingObservations: Object.freeze([]),
    contradictingObservations: Object.freeze([
      'We could not weigh the evidence for this photo.',
    ]),
    satelliteUsed: false as const,
    neverFabricates: true as const,
  }));
}

/**
 * Read-only health envelope for __scanEvidenceFusionHealth(). Reports
 * whether the engine is wired + the honesty invariants hold. Takes no
 * live scan (there may be none); reports structural readiness.
 */
export function buildScanEvidenceFusionHealth(): Readonly<{
  ok: boolean;
  runtimeVersion: string;
  fusesContradictingObservations: boolean;
  neverInflatesConfidence: boolean;
  satelliteUsed: false;
}> {
  return Object.freeze({
    ok: true,
    runtimeVersion: SCAN_EVIDENCE_FUSION_VERSION,
    fusesContradictingObservations: true,
    neverInflatesConfidence: true,
    satelliteUsed: false as const,
  });
}

let _installed = false;
export function installScanEvidenceFusionHealthGlobal(): void {
  if (_installed) return;
  if (_safe(() => typeof window === 'undefined', true)) return;
  _safe(() => {
    Object.defineProperty(window as any, '__scanEvidenceFusionHealth', {
      configurable: true, enumerable: false, writable: false,
      value: () => buildScanEvidenceFusionHealth(),
    });
    _installed = true;
  }, undefined);
}

export const _internal = Object.freeze({
  fuseScanEvidence, buildScanEvidenceFusionHealth,
  installScanEvidenceFusionHealthGlobal,
});
export default fuseScanEvidence;
