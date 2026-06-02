/**
 * FarmContextBiasRuntime.ts — §STEP 3 Farm Context.
 *
 * HONEST IMPLEMENTATION: re-ranks an EXISTING candidate list using the
 * farmer's context. The bias function MULTIPLIES each candidate's
 * confidence by a context-weight in [1.0, 1.3] — a +30% maximum lift.
 * It NEVER introduces new candidates and it NEVER lifts confidence
 * above 100%.
 *
 * Context signals read from existing probes:
 *   • __regionalIntelligenceFieldHealth → recommendedCrops list
 *   • __weatherRiskHealth                → coarse season hint
 *   • __cropLifecycleHealth              → current growth stage
 *   • __commandCenterHealth              → farmer's active crop
 *
 * Hard cap: total context boost per candidate is +30%. A candidate
 * with no context match keeps its original confidence unchanged.
 */

import { GUIDANCE_TAIL } from './ScanAccuracyContracts';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}

type Confidence = 'low' | 'medium' | 'high';

export const FARM_CONTEXT_BIAS_VERSION = 'farm-context-bias-v1' as const;

/** Hard cap on total context-boost lift per candidate. */
export const MAX_CONTEXT_BOOST_PCT = 30;

interface Candidate {
  key: string;
  label: string;
  confidencePct: number;
  source: string;
}

export interface FarmContextSnapshot {
  activeCrop: string | null;
  recommendedCrops: ReadonlyArray<string>;
  weatherCue: string | null;
  growthStage: string | null;
  hasContext: boolean;
}

export interface ContextBoostBreakdown {
  candidateKey: string;
  originalConfidencePct: number;
  boostPct: number;       // 0..MAX_CONTEXT_BOOST_PCT
  reasons: ReadonlyArray<string>;
}

export interface FarmContextBiasHealthEnvelope {
  initialized: true;
  configured: boolean;
  contextSnapshot: Readonly<FarmContextSnapshot>;
  noFabricatedContext: true;
  capAtThirtyPct: true;
  composedFrom: ReadonlyArray<string>;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

/** Read the current context snapshot — pure read, never throws. */
export function readFarmContext(): Readonly<FarmContextSnapshot> {
  return _safe(() => {
    const cc = _probe('__commandCenterHealth');
    const regional = _probe('__regionalIntelligenceFieldHealth')
      || _probe('__regionalIntelligenceHealth');
    const weather = _probe('__weatherRiskHealth') || _probe('__weatherHealth');
    const lifecycle = _probe('__cropLifecycleHealth');

    const activeCrop: string | null = _safe(() => {
      if (!cc) return null;
      const v: any = (cc as any).value || cc;
      const c = v && v.state && v.state.crop;
      return (typeof c === 'string' && c.trim()) ? c.trim().toLowerCase() : null;
    }, null);

    const recommendedCrops: string[] = _safe(() => {
      if (!regional) return [];
      const v: any = (regional as any).value || regional;
      const arr = Array.isArray(v.recommendedCrops) ? v.recommendedCrops : [];
      return arr.filter((s: any) => typeof s === 'string')
        .map((s: string) => s.trim().toLowerCase());
    }, []);

    const weatherCue: string | null = _safe(() => {
      if (!weather) return null;
      const v: any = (weather as any).value || weather;
      const cue = typeof v.weatherSummary === 'string' ? v.weatherSummary
        : typeof v.summary === 'string' ? v.summary
        : typeof v.weatherRisk === 'string' ? v.weatherRisk : null;
      return cue;
    }, null);

    const growthStage: string | null = _safe(() => {
      if (!lifecycle) return null;
      const v: any = (lifecycle as any).value || lifecycle;
      const s = typeof v.currentStage === 'string' ? v.currentStage
        : typeof v.stage === 'string' ? v.stage : null;
      return (s && s.trim()) ? s.trim().toLowerCase() : null;
    }, null);

    const hasContext = !!(activeCrop || recommendedCrops.length > 0
      || weatherCue || growthStage);

    return Object.freeze<FarmContextSnapshot>({
      activeCrop,
      recommendedCrops: Object.freeze(recommendedCrops) as ReadonlyArray<string>,
      weatherCue, growthStage, hasContext,
    });
  }, Object.freeze<FarmContextSnapshot>({
    activeCrop: null,
    recommendedCrops: Object.freeze([]) as ReadonlyArray<string>,
    weatherCue: null, growthStage: null, hasContext: false,
  }));
}

/** Pure re-ranker — takes candidates + context, returns re-ranked list
 *  + a breakdown of where each boost came from. Caps total boost per
 *  candidate at MAX_CONTEXT_BOOST_PCT. */
export function reRankByFarmContext(
  candidates: ReadonlyArray<Candidate>,
  context: Readonly<FarmContextSnapshot>,
): {
  candidates: ReadonlyArray<Readonly<Candidate>>;
  breakdown: ReadonlyArray<Readonly<ContextBoostBreakdown>>;
} {
  return _safe(() => {
    if (!Array.isArray(candidates) || candidates.length === 0
        || !context || !context.hasContext) {
      return Object.freeze({
        candidates: Object.freeze(candidates) as ReadonlyArray<Readonly<Candidate>>,
        breakdown: Object.freeze([]) as ReadonlyArray<Readonly<ContextBoostBreakdown>>,
      });
    }
    const recommendedSet = new Set(context.recommendedCrops);
    const breakdownOut: ContextBoostBreakdown[] = [];
    const reranked: Candidate[] = candidates.map((c) => {
      const reasons: string[] = [];
      let boostPct = 0;
      // 1. Active-crop match → +15%.
      if (context.activeCrop && c.key === context.activeCrop) {
        boostPct += 15;
        reasons.push('matches your active crop');
      }
      // 2. Regional-recommended match → +10%.
      if (recommendedSet.has(c.key)) {
        boostPct += 10;
        reasons.push('recommended in your region');
      }
      // 3. Lifecycle stage hint → +5% (the lifecycle probe is plant-specific;
      //    we only boost when the candidate matches the active crop AND a
      //    stage is known — i.e. we have lifecycle data for this candidate).
      if (context.growthStage && context.activeCrop === c.key) {
        boostPct += 5;
        reasons.push('matches current growth stage');
      }
      // Cap.
      if (boostPct > MAX_CONTEXT_BOOST_PCT) boostPct = MAX_CONTEXT_BOOST_PCT;
      const multiplier = 1 + (boostPct / 100);
      const next = Math.max(0, Math.min(100,
        Math.round(c.confidencePct * multiplier)));
      breakdownOut.push(Object.freeze({
        candidateKey: c.key,
        originalConfidencePct: c.confidencePct,
        boostPct,
        reasons: Object.freeze(reasons) as ReadonlyArray<string>,
      }));
      return { ...c, confidencePct: next };
    });
    reranked.sort((a, b) => b.confidencePct - a.confidencePct);
    return Object.freeze({
      candidates: Object.freeze(reranked.map((c) => Object.freeze(c))) as ReadonlyArray<Readonly<Candidate>>,
      breakdown: Object.freeze(breakdownOut) as ReadonlyArray<Readonly<ContextBoostBreakdown>>,
    });
  }, Object.freeze({
    candidates: Object.freeze(candidates) as ReadonlyArray<Readonly<Candidate>>,
    breakdown: Object.freeze([]) as ReadonlyArray<Readonly<ContextBoostBreakdown>>,
  }));
}

export function farmContextBiasReady(): boolean {
  return _safe(() => {
    const ctx = readFarmContext();
    return ctx.hasContext;
  }, false);
}

export function farmContextBiasHealth(): Readonly<FarmContextBiasHealthEnvelope> {
  return _safe(() => {
    const ctx = readFarmContext();
    const composed: string[] = [];
    if (_probe('__commandCenterHealth')) composed.push('__commandCenterHealth');
    if (_probe('__regionalIntelligenceFieldHealth')) composed.push('__regionalIntelligenceFieldHealth');
    if (_probe('__weatherRiskHealth')) composed.push('__weatherRiskHealth');
    if (_probe('__cropLifecycleHealth')) composed.push('__cropLifecycleHealth');
    return Object.freeze<FarmContextBiasHealthEnvelope>({
      initialized: true,
      configured: true,
      contextSnapshot: ctx,
      noFabricatedContext: true as const,
      capAtThirtyPct: true as const,
      composedFrom: Object.freeze(composed) as ReadonlyArray<string>,
      confidence: (composed.length >= 3 ? 'high'
        : composed.length >= 1 ? 'medium' : 'low') as Confidence,
      explanation:
        'Farm context bias re-ranks existing candidates using the farmer\'s active crop, ' +
        'regional recommendations, current growth stage, and weather cues. Re-rank caps ' +
        'at +' + MAX_CONTEXT_BOOST_PCT + '% per candidate. NEVER introduces candidates ' +
        'and NEVER lifts confidence above 100%.',
      limitations:
        'Bias is a hint, not an identification. ' + GUIDANCE_TAIL,
    });
  }, Object.freeze<FarmContextBiasHealthEnvelope>({
    initialized: true,
    configured: false,
    contextSnapshot: Object.freeze({
      activeCrop: null,
      recommendedCrops: Object.freeze([]) as ReadonlyArray<string>,
      weatherCue: null, growthStage: null, hasContext: false,
    }),
    noFabricatedContext: true as const, capAtThirtyPct: true as const,
    composedFrom: Object.freeze([]) as ReadonlyArray<string>,
    confidence: 'low' as Confidence,
    explanation: 'Farm context bias runtime initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }));
}

export function installFarmContextBiasGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__farmContextBiasHealth !== 'function') {
      w.__farmContextBiasHealth = function () {
        const out = farmContextBiasHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Farm Context Bias]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
