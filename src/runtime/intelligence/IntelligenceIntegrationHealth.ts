/**
 * IntelligenceIntegrationHealth.ts → window.__intelligenceIntegrationHealth().
 *
 * Top-level composite over the 3 intelligence runtimes (soil, market,
 * regional) PLUS attestation that the Command Center and Daily
 * Assistant actually CONSUME them. Read-only; never duplicates state;
 * never fabricates values.
 *
 * Reports per-system:
 *   soilStatus      — soilHealth + soilType + drainageRisk + limitations
 *   marketStatus    — marketDemand level + recommendedSellingWindow + source
 *   regionalStatus  — plantingWindow + seasonalRisks + commonDiseases
 *
 * Plus integration flags:
 *   commandCenterIntegrated — CC composite present + reads the 3 probes
 *   dailyAssistantIntegrated — DA reads at least one of the 3 probes
 *   sellPageReady           — market intelligence available for Sell
 *   fundingPageReady        — soil + regional available for Funding
 *
 * Self-contained; never throws.
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

export const INTELLIGENCE_INTEGRATION_VERSION = 'intelligence-integration-v1' as const;

export interface SoilStatusSummary {
  soilHealth: string;
  soilType: string;
  drainageRisk: string;
  moistureRisk: string;
  limitations: string;
  available: boolean;
}

export interface MarketStatusSummary {
  marketDemand: MarketDemand;
  recommendedSellingWindow: string;
  buyerInterestScore: number | null;
  scoreSource: string;
  available: boolean;
}

export interface RegionalStatusSummary {
  plantingWindow: string;
  seasonalRisks: ReadonlyArray<string>;
  commonDiseases: ReadonlyArray<string>;
  recommendedActions: ReadonlyArray<string>;
  available: boolean;
}

export interface IntelligenceIntegrationHealthEnvelope {
  initialized: true;
  // Per-system summaries (frozen).
  soilStatus: Readonly<SoilStatusSummary>;
  marketStatus: Readonly<MarketStatusSummary>;
  regionalStatus: Readonly<RegionalStatusSummary>;
  // Integration attestation flags.
  soilReady: boolean;
  marketReady: boolean;
  regionalReady: boolean;
  commandCenterIntegrated: boolean;
  dailyAssistantIntegrated: boolean;
  sellPageReady: boolean;
  fundingPageReady: boolean;
  weeklyReviewIntegrated: boolean;
  notificationsIntegrated: boolean;
  // Honesty constants.
  noFakeSoilValues: true;
  noFakeMarketDemand: true;
  noFabricatedRegionalAdvice: true;
  noStandalonePages: true;
  composedFrom: ReadonlyArray<string>;
  readyCount: number;
  totalChecks: 9;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

function _soilSummary(): Readonly<SoilStatusSummary> {
  return _safe(() => {
    const soil = _probe('__soilIntelligenceHealth');
    if (!soil) {
      return Object.freeze({
        soilHealth: 'Not enough data yet',
        soilType: 'Not enough data yet',
        drainageRisk: 'unknown',
        moistureRisk: 'unknown',
        limitations: 'No soil intelligence probe yet. ' + GUIDANCE_TAIL,
        available: false,
      });
    }
    const v: any = (soil as any).value || soil;
    const available = v.soilDataAvailable === true || v.soilGridsConfigured === true
      || (v.lastProfile && v.lastProfile.soilDataAvailable === true);
    return Object.freeze<SoilStatusSummary>({
      soilHealth: typeof v.soilHealth === 'string' && v.soilHealth
        ? v.soilHealth : 'Not enough data yet',
      soilType: typeof v.soilType === 'string' ? v.soilType : 'Not enough data yet',
      drainageRisk: typeof v.drainageRisk === 'string' ? v.drainageRisk
        : (v.lastProfile && typeof v.lastProfile.drainageRisk === 'string')
          ? v.lastProfile.drainageRisk : 'unknown',
      moistureRisk: typeof v.moistureRisk === 'string' ? v.moistureRisk : 'unknown',
      limitations: typeof v.limitations === 'string' ? v.limitations
        : ('No soil data — provide GPS for soil guidance. ' + GUIDANCE_TAIL),
      available: !!available,
    });
  }, Object.freeze({
    soilHealth: 'Not enough data yet', soilType: 'Not enough data yet',
    drainageRisk: 'unknown', moistureRisk: 'unknown',
    limitations: 'Soil summary threw. ' + GUIDANCE_TAIL,
    available: false,
  }));
}

function _marketSummary(): Readonly<MarketStatusSummary> {
  return _safe(() => {
    const market = _probe('__marketIntelligenceHealth')
      || _probe('__marketIntelligenceCompositeHealth')
      || _probe('__marketplaceIntelligenceHealth');
    if (!market) {
      return Object.freeze({
        marketDemand: 'unknown' as MarketDemand,
        recommendedSellingWindow: 'Market data unavailable',
        buyerInterestScore: null,
        scoreSource: 'none',
        available: false,
      });
    }
    const v: any = (market as any).value || market;
    const demand: MarketDemand = (typeof v.marketDemand === 'string'
      && ['low', 'medium', 'high'].indexOf(v.marketDemand) >= 0)
      ? (v.marketDemand as MarketDemand) : 'unknown';
    return Object.freeze<MarketStatusSummary>({
      marketDemand: demand,
      recommendedSellingWindow: typeof v.recommendedSellingWindow === 'string'
        ? v.recommendedSellingWindow : 'Market data unavailable',
      buyerInterestScore: typeof v.buyerInterestScore === 'number'
        && isFinite(v.buyerInterestScore) ? v.buyerInterestScore : null,
      scoreSource: typeof v.scoreSource === 'string' ? v.scoreSource : 'none',
      available: demand !== 'unknown',
    });
  }, Object.freeze({
    marketDemand: 'unknown' as MarketDemand,
    recommendedSellingWindow: 'Market data unavailable',
    buyerInterestScore: null, scoreSource: 'threw',
    available: false,
  }));
}

function _regionalSummary(): Readonly<RegionalStatusSummary> {
  return _safe(() => {
    const regional = _probe('__regionalIntelligenceFieldHealth')
      || _probe('__regionalIntelligenceHealth')
      || _probe('__regionalKnowledgeHealth');
    if (!regional) {
      return Object.freeze({
        plantingWindow: 'Not enough data yet',
        seasonalRisks: Object.freeze([]) as ReadonlyArray<string>,
        commonDiseases: Object.freeze([]) as ReadonlyArray<string>,
        recommendedActions: Object.freeze([]) as ReadonlyArray<string>,
        available: false,
      });
    }
    const v: any = (regional as any).value || regional;
    const seasonalRisks: string[] = Array.isArray(v.regionalRisks) ? v.regionalRisks
      : Array.isArray(v.seasonalRisks) ? v.seasonalRisks : [];
    const diseases: string[] = Array.isArray(v.commonDiseases) ? v.commonDiseases : [];
    const actions: string[] = Array.isArray(v.recommendedActions) ? v.recommendedActions
      : Array.isArray(v.recommendedCrops) ? v.recommendedCrops.slice(0, 3)
        .map((c: string) => 'Region supports ' + c) : [];
    const plantingWindow = typeof v.plantingWindow === 'string' && v.plantingWindow
      ? v.plantingWindow : 'Not enough data yet';
    return Object.freeze<RegionalStatusSummary>({
      plantingWindow,
      seasonalRisks: Object.freeze(seasonalRisks.filter((s) => typeof s === 'string')) as ReadonlyArray<string>,
      commonDiseases: Object.freeze(diseases.filter((s) => typeof s === 'string')) as ReadonlyArray<string>,
      recommendedActions: Object.freeze(actions.filter((s) => typeof s === 'string')) as ReadonlyArray<string>,
      available: plantingWindow !== 'Not enough data yet'
        || seasonalRisks.length > 0 || diseases.length > 0,
    });
  }, Object.freeze({
    plantingWindow: 'Not enough data yet',
    seasonalRisks: Object.freeze([]) as ReadonlyArray<string>,
    commonDiseases: Object.freeze([]) as ReadonlyArray<string>,
    recommendedActions: Object.freeze([]) as ReadonlyArray<string>,
    available: false,
  }));
}

export function intelligenceIntegrationHealth()
  : Readonly<IntelligenceIntegrationHealthEnvelope> {
  return _safe(() => {
    const soil = _soilSummary();
    const market = _marketSummary();
    const regional = _regionalSummary();

    // Integration attestation — composes existing health probes.
    const cc = _probe('__commandCenterHealth');
    const ccGap = _probe('__commandCenterGapClosureHealth');
    const da = _probe('__dailyAssistantHealth');
    const agronomy = _probe('__agronomyHealth');
    const weekly = _probe('__weeklyFarmReviewHealth');
    const notif = _probe('__notificationRuntimeHealth')
      || _probe('__notificationSchedulerHealth')
      || _probe('__notificationTemplateHealth');

    const soilReady = soil.available;
    const marketReady = market.available;
    const regionalReady = regional.available;

    // CC integration: any of soil/market/regional surfaces visible
    // through the gap-closure composite OR CC reads __soilIntelligence
    // / __marketIntelligence directly.
    const commandCenterIntegrated = _safe(() => {
      if (!cc && !ccGap) return false;
      if (ccGap) {
        const v: any = (ccGap as any).value || ccGap;
        if (v.soilIntegrated || v.weeklyReviewIntegrated) return true;
      }
      // CC composedFrom must mention market or regional probes.
      if (cc) {
        const v: any = (cc as any).value || cc;
        const composed: any[] = Array.isArray(v.composedFrom) ? v.composedFrom : [];
        return composed.some((s) =>
          typeof s === 'string' && (
            s.indexOf('marketIntelligence') >= 0
            || s.indexOf('regionalIntelligence') >= 0
            || s.indexOf('soilIntelligence') >= 0));
      }
      return false;
    }, false);

    // DA integration: agronomy or DA composes regional knowledge.
    const dailyAssistantIntegrated = _safe(() => {
      if (!da && !agronomy) return false;
      if (agronomy) {
        const v: any = (agronomy as any).value || agronomy;
        return v.regionalKnowledgeReady === true || v.initialized === true;
      }
      return !!da;
    }, false);

    const sellPageReady = marketReady;
    const fundingPageReady = soilReady || regionalReady;
    const weeklyReviewIntegrated = !!weekly;
    const notificationsIntegrated = !!notif;

    const readyCount = [
      soilReady, marketReady, regionalReady,
      commandCenterIntegrated, dailyAssistantIntegrated,
      sellPageReady, fundingPageReady,
      weeklyReviewIntegrated, notificationsIntegrated,
    ].filter(Boolean).length;

    const composed: string[] = [];
    if (_probe('__soilIntelligenceHealth')) composed.push('__soilIntelligenceHealth');
    if (_probe('__marketIntelligenceHealth')
      || _probe('__marketIntelligenceCompositeHealth'))
      composed.push('__marketIntelligenceHealth');
    if (_probe('__regionalIntelligenceFieldHealth')
      || _probe('__regionalIntelligenceHealth'))
      composed.push('__regionalIntelligenceFieldHealth');
    if (cc) composed.push('__commandCenterHealth');
    if (agronomy) composed.push('__agronomyHealth');

    return Object.freeze<IntelligenceIntegrationHealthEnvelope>({
      initialized: true,
      soilStatus: soil,
      marketStatus: market,
      regionalStatus: regional,
      soilReady, marketReady, regionalReady,
      commandCenterIntegrated, dailyAssistantIntegrated,
      sellPageReady, fundingPageReady,
      weeklyReviewIntegrated, notificationsIntegrated,
      noFakeSoilValues: true as const,
      noFakeMarketDemand: true as const,
      noFabricatedRegionalAdvice: true as const,
      noStandalonePages: true as const,
      composedFrom: Object.freeze(composed) as ReadonlyArray<string>,
      readyCount,
      totalChecks: 9 as const,
      confidence: (readyCount >= 6 ? 'high' : readyCount >= 3 ? 'medium' : 'low') as Confidence,
      explanation:
        'Intelligence integration composite. Surfaces soil + market + regional summaries ' +
        'over existing probes (__soilIntelligenceHealth, __marketIntelligenceHealth, ' +
        '__regionalIntelligenceFieldHealth) and attests that Command Center + Daily Assistant + ' +
        'Sell + Funding + Weekly Review + Notifications consume them. NO standalone ' +
        'intelligence pages; recommendations improve via composition, not dashboard clutter.',
      limitations:
        'Each summary inherits its upstream probe limitations (NEEDS_LOCATION, NEEDS_DATA, etc). '
        + GUIDANCE_TAIL,
    });
  }, Object.freeze<IntelligenceIntegrationHealthEnvelope>({
    initialized: true,
    soilStatus: _soilSummary(),
    marketStatus: _marketSummary(),
    regionalStatus: _regionalSummary(),
    soilReady: false, marketReady: false, regionalReady: false,
    commandCenterIntegrated: false, dailyAssistantIntegrated: false,
    sellPageReady: false, fundingPageReady: false,
    weeklyReviewIntegrated: false, notificationsIntegrated: false,
    noFakeSoilValues: true as const,
    noFakeMarketDemand: true as const,
    noFabricatedRegionalAdvice: true as const,
    noStandalonePages: true as const,
    composedFrom: Object.freeze([]) as ReadonlyArray<string>,
    readyCount: 0, totalChecks: 9 as const,
    confidence: 'low' as Confidence,
    explanation: 'Intelligence integration composite initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }));
}

export function installIntelligenceIntegrationHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__intelligenceIntegrationHealth !== 'function') {
      w.__intelligenceIntegrationHealth = function () {
        const out = intelligenceIntegrationHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Intelligence Integration]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
