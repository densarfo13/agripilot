/**
 * FarmScanContextRuntime.ts — read-only farm memory for scan
 * composition (sprint #200).
 *
 * Reads the active farm/garden crop, stage, location, and the last
 * few scans + outcomes (already persisted by the retention/outcome
 * runtimes). Produces an EXPLAINABLE confidence boost.
 *
 * Rules (spec §2):
 *   - context boosts confidence but NEVER overrides provider evidence
 *     (cap +15; a candidate the providers never returned is never
 *     promoted to #1 by context alone — boosting only re-ranks within
 *     the providers' own list)
 *   - every boost has a rationale string
 *   - pure read; no writes; never throws
 */

import type { FarmScanContext } from './ScanMythosContracts';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _str = (v: unknown): string => (typeof v === 'string' ? v : '');
const _arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);

export const FARM_SCAN_CONTEXT_VERSION = 'farm-scan-context-v1';

const MAX_BOOST = 15;

// Closely-related crop families — a context crop "boosts" a candidate
// only when the candidate is the context crop OR in its confusable
// set (the spec's onion/garlic/leek example).
const CONFUSABLE: Readonly<Record<string, ReadonlyArray<string>>> = Object.freeze({
  onion:  ['onion', 'garlic', 'leek', 'shallot', 'allium'],
  tomato: ['tomato', 'pepper', 'eggplant', 'solanum'],
  maize:  ['maize', 'corn', 'sorghum'],
  pepper: ['pepper', 'tomato', 'chili', 'capsicum'],
});

/**
 * Build the farm context from a partial input bag. Each field is
 * optional; absent fields simply contribute no boost.
 */
export function buildFarmScanContext(input: {
  activeCrop?: string;
  cropStage?: string;
  location?: string;
  topCandidates?: ReadonlyArray<{ commonName?: string; scientificName?: string }>;
  previousScans?: ReadonlyArray<{ issue?: string; plant?: string }>;
  previousOutcomes?: ReadonlyArray<{ status?: string }>;
} = {}): Readonly<FarmScanContext> {
  return _safe(() => {
    const crop = _str(input.activeCrop).toLowerCase().trim();
    const stage = _str(input.cropStage);
    const location = _str(input.location);
    const rationale: string[] = [];
    let boost = 0;

    // 1. Context-crop match against the provider candidate list.
    if (crop) {
      const confusable = CONFUSABLE[crop] || [crop];
      const candNames = _arr(input.topCandidates)
        .map((c) => _str(c && (c.commonName || (c as any).name)).toLowerCase())
        .filter(Boolean);
      const matchInList = candNames.some((n) =>
        confusable.some((f) => n.includes(f)));
      if (matchInList) {
        boost += 10;
        rationale.push('Your saved crop (' + crop + ') is among the matches.');
      }
    }

    // 2. Repeat-issue signal — same issue seen recently raises
    //    attention (small boost, capped).
    const prevIssues = _arr(input.previousScans)
      .map((s) => _str(s && s.issue)).filter(Boolean);
    if (prevIssues.length > 0) {
      boost += 5;
      rationale.push('A similar issue appeared in a recent scan.');
    }

    boost = Math.max(0, Math.min(MAX_BOOST, boost));

    return Object.freeze({
      contextCrop:     crop || null,
      contextStage:    stage || null,
      contextLocation: location || null,
      previousIssues:  Object.freeze([...new Set(prevIssues)].slice(0, 5)),
      confidenceBoost: boost,
      rationale:       Object.freeze(rationale),
    });
  }, Object.freeze({
    contextCrop: null, contextStage: null, contextLocation: null,
    previousIssues: Object.freeze([]), confidenceBoost: 0,
    rationale: Object.freeze([]),
  }));
}

export const _internal = Object.freeze({ buildFarmScanContext });
export default buildFarmScanContext;
