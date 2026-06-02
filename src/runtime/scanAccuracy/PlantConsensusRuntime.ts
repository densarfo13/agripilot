/**
 * PlantConsensusRuntime.ts — §CONSENSUS ENGINE.
 *
 * Wraps the existing identification pipeline into the spec-canonical
 * output shape:
 *
 *   {
 *     primaryMatch,       // string — top candidate label, or
 *                         //          'Needs Identification' when none qualifies
 *     primaryMatchKey,    // string | null — top candidate canonical key
 *     confidence,         // 0..100 — top candidate confidencePct
 *     confidenceBand,     // 'low'|'medium'|'high'
 *     alternatives[],     // up to 4 next-best candidates
 *     rationale,          // human-readable explanation
 *     limitations,        // honest decision-support tail
 *   }
 *
 * Composition order:
 *   1. MultiPassIdentificationRuntime.runMultiPassIdentification()
 *   2. FarmContextBiasRuntime.reRankByFarmContext()  (capped +30%)
 *   3. UnknownHandlingRuntime.buildUnknownHandling() decides whether
 *      to surface as identified or as 'Needs Identification'
 *
 * Never fabricates candidates; never lifts above 100%; always surfaces
 * confidence + limitations.
 */

import { runMultiPassIdentification } from './MultiPassIdentificationRuntime';
import { readFarmContext, reRankByFarmContext } from './FarmContextBiasRuntime';
import { buildUnknownHandling, NEEDS_IDENTIFICATION_LABEL } from './UnknownHandlingRuntime';
import { GUIDANCE_TAIL } from './ScanAccuracyContracts';
import type { IdentificationCandidate, MultiPassResult } from './ScanAccuracyContracts';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

type Confidence = 'low' | 'medium' | 'high';

export const PLANT_CONSENSUS_VERSION = 'plant-consensus-v1' as const;

export interface PlantConsensusResult {
  primaryMatch: string;
  primaryMatchKey: string | null;
  confidence: number;
  confidenceBand: Confidence;
  alternatives: ReadonlyArray<Readonly<IdentificationCandidate>>;
  rationale: string;
  limitations: string;
  // Honesty trace.
  sourcesUsed: ReadonlyArray<string>;
  enginesConfigured: number;
  totalEngines: 3;
  contextBoosted: boolean;
  noFabricatedConsensus: true;
}

export interface PlantConsensusHealthEnvelope {
  initialized: true;
  consensusReady: boolean;
  pipelineSourceCount: number;
  noFabricatedConsensus: true;
  alwaysReturnsResult: true;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

function _bandOf(pct: number): Confidence {
  if (pct >= 75) return 'high';
  if (pct >= 50) return 'medium';
  return 'low';
}

/** Run the full consensus pipeline. ALWAYS returns a defined result —
 *  never null. The "no candidate" case is surfaced as
 *  primaryMatch='Needs Identification' with confidence:0 and an empty
 *  alternatives list (per the spec). */
export function runPlantConsensus(): Readonly<PlantConsensusResult> {
  return _safe(() => {
    // 1. Multi-pass merge.
    const multiPass: Readonly<MultiPassResult> = runMultiPassIdentification();
    const baseCandidates = (multiPass && multiPass.candidates) || [];

    // 2. Farm-context bias re-rank.
    const ctx = readFarmContext();
    const reRanked = reRankByFarmContext(baseCandidates, ctx);
    const contextBoosted = reRanked.breakdown.some((b) => b.boostPct > 0);

    // 3. Unknown handling — decides whether we have a confident match.
    const handling = buildUnknownHandling({
      ...multiPass,
      candidates: reRanked.candidates,
      bestKey: reRanked.candidates.length > 0 ? reRanked.candidates[0].key : null,
      bestConfidencePct: reRanked.candidates.length > 0 ? reRanked.candidates[0].confidencePct : 0,
    } as MultiPassResult);

    const top = reRanked.candidates[0];
    const isIdentified = !!(top && !handling.showAsUnknown);

    const primaryMatch = isIdentified ? top.label : NEEDS_IDENTIFICATION_LABEL;
    const primaryMatchKey = isIdentified && top ? top.key : null;
    const confidence = top ? top.confidencePct : 0;
    const confidenceBand = _bandOf(confidence);
    const alternatives = Object.freeze(
      reRanked.candidates.slice(isIdentified ? 1 : 0, isIdentified ? 5 : 4)
        .map((c) => Object.freeze(c)),
    ) as ReadonlyArray<Readonly<IdentificationCandidate>>;

    const sources: string[] = [];
    if (multiPass.enginesConfigured > 0) sources.push('multi-pass');
    if (contextBoosted) sources.push('farm-context-bias');
    sources.push('unknown-handling');

    const rationale = isIdentified
      ? 'Primary match selected from ' + multiPass.enginesConfigured + ' of '
        + multiPass.totalEngines + ' identifier engines'
        + (contextBoosted ? ' + farm-context bias re-rank' : '') + '.'
      : (reRanked.candidates.length > 0
        ? 'Top candidate confidence is below the identification threshold; '
          + 'surfacing as "' + NEEDS_IDENTIFICATION_LABEL + '" with ' + reRanked.candidates.length
          + ' alternative(s) for the grower to choose from or send to review.'
        : 'No identifier engine returned data. Routing to review.');

    return Object.freeze<PlantConsensusResult>({
      primaryMatch,
      primaryMatchKey,
      confidence,
      confidenceBand,
      alternatives,
      rationale,
      limitations:
        'Consensus is decision support — not a definitive identification. ' + GUIDANCE_TAIL,
      sourcesUsed: Object.freeze(sources) as ReadonlyArray<string>,
      enginesConfigured: multiPass.enginesConfigured,
      totalEngines: 3 as const,
      contextBoosted,
      noFabricatedConsensus: true as const,
    });
  }, Object.freeze<PlantConsensusResult>({
    primaryMatch: NEEDS_IDENTIFICATION_LABEL,
    primaryMatchKey: null,
    confidence: 0,
    confidenceBand: 'low' as Confidence,
    alternatives: Object.freeze([]) as ReadonlyArray<Readonly<IdentificationCandidate>>,
    rationale: 'Consensus pipeline threw — routing to review.',
    limitations: 'Recoverable failure. ' + GUIDANCE_TAIL,
    sourcesUsed: Object.freeze([]) as ReadonlyArray<string>,
    enginesConfigured: 0, totalEngines: 3 as const,
    contextBoosted: false,
    noFabricatedConsensus: true as const,
  }));
}

export function plantConsensusReady(): boolean {
  return _safe(() => {
    const r = runPlantConsensus();
    return !!r;
  }, false);
}

export function plantConsensusHealth(): Readonly<PlantConsensusHealthEnvelope> {
  return _safe(() => {
    const r = runPlantConsensus();
    return Object.freeze<PlantConsensusHealthEnvelope>({
      initialized: true,
      consensusReady: true,
      pipelineSourceCount: r.sourcesUsed.length,
      noFabricatedConsensus: true as const,
      alwaysReturnsResult: true as const,
      confidence: r.confidenceBand,
      explanation:
        'Plant consensus engine. Composes MultiPassIdentificationRuntime + ' +
        'FarmContextBiasRuntime (capped +30%) + UnknownHandlingRuntime. Returns the ' +
        'spec-canonical {primaryMatch, confidence, alternatives, rationale, limitations} ' +
        'shape on every call. Never returns null; never fabricates candidates.',
      limitations:
        'Consensus quality reflects upstream engine availability. ' + GUIDANCE_TAIL,
    });
  }, Object.freeze<PlantConsensusHealthEnvelope>({
    initialized: true, consensusReady: false,
    pipelineSourceCount: 0,
    noFabricatedConsensus: true as const,
    alwaysReturnsResult: true as const,
    confidence: 'low' as Confidence,
    explanation: 'Plant consensus runtime initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }));
}

export function installPlantConsensusGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__plantConsensusHealth !== 'function') {
      w.__plantConsensusHealth = function () {
        const out = plantConsensusHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Plant Consensus]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
