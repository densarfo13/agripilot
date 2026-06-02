/**
 * MarketIntelligenceRuntime.ts → pins
 * window.__marketIntelligenceCompositeHealth (a distinct supplement
 * name so it composes over the existing V4 __marketplaceIntelligenceHealth
 * global without colliding with it).
 *
 * Surfaces spec-required fields: marketDemand (low/medium/high),
 * buyerInterestScore, recommendedSellingWindow.
 *
 * Honest contract: every score MUST carry a source. When the underlying
 * marketplace probe is absent or empty, returns honest 'unknown' values
 * with confidence 'low' and explanation; never fabricates a buyer score.
 *
 * Self-contained; zero imports; frozen; never throws.
 */

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}
type Confidence = 'low' | 'medium' | 'high';
type MarketDemand = 'low' | 'medium' | 'high' | 'unknown';
const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

export const MARKET_INTELLIGENCE_COMPOSITE_VERSION = 'market-intelligence-composite-v1' as const;

export interface MarketIntelligenceEnvelope {
  runtimeVersion: typeof MARKET_INTELLIGENCE_COMPOSITE_VERSION;
  initialized: true;
  // Spec-required output fields.
  marketDemand: MarketDemand;
  buyerInterestScore: number | null;
  recommendedSellingWindow: string;
  // Honest source attribution — every score traces to its origin.
  scoreSource: string;
  composedFrom: ReadonlyArray<string>;
  // Readiness flags.
  marketplaceProbeReady: boolean;
  postHarvestReady: boolean;
  noFabricatedScores: true;
  noFakeBuyerInterest: true;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

export function marketIntelligenceCompositeHealth(): Readonly<MarketIntelligenceEnvelope> {
  return _safe(() => {
    const mkt = _probe('__marketplaceIntelligenceHealth');
    const post = _probe('__postHarvestHealth');
    const composed: string[] = [];
    if (mkt) composed.push('__marketplaceIntelligenceHealth');
    if (post) composed.push('__postHarvestHealth');

    // Honest extractor — read marketplace probe, fall back to 'unknown'.
    let marketDemand: MarketDemand = 'unknown';
    let buyerInterestScore: number | null = null;
    let scoreSource = 'no marketplace probe';
    let recommendedSellingWindow = 'Not enough data yet';

    if (mkt) {
      const v: any = (mkt as any).value || mkt;
      if (typeof v.marketDemand === 'string'
          && ['low', 'medium', 'high'].indexOf(v.marketDemand) >= 0) {
        marketDemand = v.marketDemand as MarketDemand;
        scoreSource = '__marketplaceIntelligenceHealth.marketDemand';
      }
      if (typeof v.buyerInterestScore === 'number' && isFinite(v.buyerInterestScore)) {
        buyerInterestScore = v.buyerInterestScore;
        scoreSource = '__marketplaceIntelligenceHealth.buyerInterestScore';
      }
      if (typeof v.recommendedSellingWindow === 'string' && v.recommendedSellingWindow) {
        recommendedSellingWindow = v.recommendedSellingWindow;
      } else if (typeof v.sellingWindow === 'string' && v.sellingWindow) {
        recommendedSellingWindow = v.sellingWindow;
      }
    }
    // Post-harvest probe can sharpen the selling window if marketplace lacks it.
    if (recommendedSellingWindow === 'Not enough data yet' && post) {
      const pv: any = (post as any).value || post;
      if (typeof pv.recommendedSellingWindow === 'string' && pv.recommendedSellingWindow) {
        recommendedSellingWindow = pv.recommendedSellingWindow;
      }
    }

    const marketplaceProbeReady = !!mkt;
    const postHarvestReady = !!post;

    return Object.freeze<MarketIntelligenceEnvelope>({
      runtimeVersion: MARKET_INTELLIGENCE_COMPOSITE_VERSION,
      initialized: true,
      marketDemand,
      buyerInterestScore,
      recommendedSellingWindow,
      scoreSource,
      composedFrom: Object.freeze(composed) as ReadonlyArray<string>,
      marketplaceProbeReady,
      postHarvestReady,
      noFabricatedScores: true as const,
      noFakeBuyerInterest: true as const,
      confidence: (marketplaceProbeReady && marketDemand !== 'unknown' ? 'high'
        : marketplaceProbeReady ? 'medium' : 'low') as Confidence,
      explanation:
        'Market intelligence composite over __marketplaceIntelligenceHealth (+ __postHarvestHealth ' +
        'for selling window). Buyer interest score traceable via scoreSource. Returns honest "unknown" ' +
        'when no real marketplace signal is present; never fabricates a score.',
      limitations:
        'Marketplace surface is small in this build; buyer interest reflects platform-internal signal ' +
        'only and may not reflect off-platform demand. ' + GUIDANCE_TAIL,
    });
  }, Object.freeze<MarketIntelligenceEnvelope>({
    runtimeVersion: MARKET_INTELLIGENCE_COMPOSITE_VERSION,
    initialized: true,
    marketDemand: 'unknown' as MarketDemand,
    buyerInterestScore: null,
    recommendedSellingWindow: 'Not enough data yet',
    scoreSource: 'composite threw',
    composedFrom: Object.freeze([]) as ReadonlyArray<string>,
    marketplaceProbeReady: false, postHarvestReady: false,
    noFabricatedScores: true as const, noFakeBuyerInterest: true as const,
    confidence: 'low' as Confidence,
    explanation: 'Market intelligence composite initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }));
}

export function installMarketIntelligenceCompositeGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    const reader = function () {
      const out = marketIntelligenceCompositeHealth();
      try {
        const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
        if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Market Intel Composite]', out);
      } catch { /* swallow */ }
      return out;
    };
    if (typeof w.__marketIntelligenceCompositeHealth !== 'function') {
      w.__marketIntelligenceCompositeHealth = reader;
    }
    // §spec alias — pages and gates consume the bare canonical name
    // alongside the legacy composite name. Both resolve to the same
    // envelope so consumers never see two competing shapes.
    if (typeof w.__marketIntelligenceHealth !== 'function') {
      w.__marketIntelligenceHealth = reader;
    }
    return true;
  }, false);
}
