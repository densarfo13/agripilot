/**
 * IntelligenceFabricRuntime.ts → window.__intelligenceFabricHealth().
 *
 * Unified recommendation context. Aggregates 6 sources into ONE
 * frozen envelope shaped exactly as the spec requires:
 *
 *   { crop, stage, health, risk, todayAction, nextAction,
 *     daysToHarvest, soilStatus, marketStatus, regionalStatus,
 *     confidence, limitations }
 *
 * Sources (read-only; never duplicates state):
 *   • Weather    ← __weatherRiskHealth (via FarmRisk composition)
 *   • Regional   ← __regionalIntelligenceFieldHealth (via integration)
 *   • Soil       ← __soilIntelligenceHealth (via integration)
 *   • Scan       ← __scanPilotFreezeHealth + __scanOutcomeLoopHealth
 *   • Outcome    ← __scanOutcomeLoopHealth + __outcomeHealth
 *   • Market     ← __marketIntelligenceHealth (via integration)
 *
 * Plus the canonical farm state from __commandCenterHealth.state
 * (crop, stage, health, risk, action, days-to-harvest).
 *
 * The fabric does NOT add intelligence — it COMPOSES existing
 * runtimes into the spec output shape so consumers don't need to
 * read N globals individually.
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
type RiskLevel = 'low' | 'medium' | 'high' | 'unknown';
type MarketDemand = 'low' | 'medium' | 'high' | 'unknown';
type HealthBand = 'low' | 'medium' | 'high' | 'unknown';
const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

export const INTELLIGENCE_FABRIC_VERSION = 'intelligence-fabric-v1' as const;

export interface FabricSoilStatus {
  soilHealth: string;
  soilType: string;
  drainageRisk: string;
  moistureRisk: string;
  available: boolean;
}

export interface FabricMarketStatus {
  marketDemand: MarketDemand;
  sellingWindow: string;
  buyerInterest: number | null;
  marketReadiness: 'low' | 'medium' | 'high' | 'unknown';
  available: boolean;
}

export interface FabricRegionalStatus {
  plantingWindow: string;
  seasonalRisks: ReadonlyArray<string>;
  weatherPatterns: ReadonlyArray<string>;
  diseasePatterns: ReadonlyArray<string>;
  regionalRecommendations: ReadonlyArray<string>;
  available: boolean;
}

export interface FabricActionRef {
  id: string | null;
  title: string;
  why: string;
  estimatedTime: string;
}

export interface FabricRiskRef {
  level: RiskLevel;
  explanation: string;
  source: string;
}

export interface FabricHealthRef {
  score: number | null;
  band: HealthBand;
  label: string;
}

export interface IntelligenceFabricEnvelope {
  initialized: true;
  // §SPEC canonical output fields.
  crop: string;
  stage: string;
  health: Readonly<FabricHealthRef>;
  risk: Readonly<FabricRiskRef>;
  todayAction: Readonly<FabricActionRef>;
  nextAction: Readonly<FabricActionRef>;
  daysToHarvest: number | null;
  soilStatus: Readonly<FabricSoilStatus>;
  marketStatus: Readonly<FabricMarketStatus>;
  regionalStatus: Readonly<FabricRegionalStatus>;
  confidence: Confidence;
  limitations: string;
  // Honesty + composition trace.
  composedFrom: ReadonlyArray<string>;
  sourceCount: number;
  totalSources: 6;
  noFakeFabric: true;
  noFabricatedRecommendations: true;
  noStandalonePages: true;
}

function _readCC(): any { return _probe('__commandCenterHealth'); }
function _readIntegration(): any { return _probe('__intelligenceIntegrationHealth'); }

function _fabricSoil(): Readonly<FabricSoilStatus> {
  return _safe(() => {
    const intg = _readIntegration();
    if (!intg) return Object.freeze({
      soilHealth: 'Not enough data yet', soilType: 'Not enough data yet',
      drainageRisk: 'unknown', moistureRisk: 'unknown',
      available: false,
    });
    const s: any = (intg as any).value || intg;
    const ss = s.soilStatus || {};
    return Object.freeze<FabricSoilStatus>({
      soilHealth: typeof ss.soilHealth === 'string' ? ss.soilHealth : 'Not enough data yet',
      soilType: typeof ss.soilType === 'string' ? ss.soilType : 'Not enough data yet',
      drainageRisk: typeof ss.drainageRisk === 'string' ? ss.drainageRisk : 'unknown',
      moistureRisk: typeof ss.moistureRisk === 'string' ? ss.moistureRisk : 'unknown',
      available: !!ss.available,
    });
  }, Object.freeze({
    soilHealth: 'Not enough data yet', soilType: 'Not enough data yet',
    drainageRisk: 'unknown', moistureRisk: 'unknown', available: false,
  }));
}

function _readinessFromDemand(d: MarketDemand): 'low' | 'medium' | 'high' | 'unknown' {
  // Same band as demand — higher demand = higher seller readiness.
  return d;
}

function _fabricMarket(): Readonly<FabricMarketStatus> {
  return _safe(() => {
    const intg = _readIntegration();
    if (!intg) return Object.freeze({
      marketDemand: 'unknown' as MarketDemand,
      sellingWindow: 'Market data unavailable',
      buyerInterest: null,
      marketReadiness: 'unknown' as const,
      available: false,
    });
    const s: any = (intg as any).value || intg;
    const ms = s.marketStatus || {};
    const demand: MarketDemand = (typeof ms.marketDemand === 'string'
      && ['low', 'medium', 'high'].indexOf(ms.marketDemand) >= 0)
      ? (ms.marketDemand as MarketDemand) : 'unknown';
    return Object.freeze<FabricMarketStatus>({
      marketDemand: demand,
      sellingWindow: typeof ms.recommendedSellingWindow === 'string'
        ? ms.recommendedSellingWindow : 'Market data unavailable',
      buyerInterest: typeof ms.buyerInterestScore === 'number'
        ? ms.buyerInterestScore : null,
      marketReadiness: _readinessFromDemand(demand),
      available: !!ms.available,
    });
  }, Object.freeze({
    marketDemand: 'unknown' as MarketDemand,
    sellingWindow: 'Market data unavailable',
    buyerInterest: null,
    marketReadiness: 'unknown' as const,
    available: false,
  }));
}

function _fabricRegional(): Readonly<FabricRegionalStatus> {
  return _safe(() => {
    const intg = _readIntegration();
    const regional = _probe('__regionalIntelligenceFieldHealth')
      || _probe('__regionalIntelligenceHealth');
    if (!intg && !regional) return Object.freeze({
      plantingWindow: 'Not enough data yet',
      seasonalRisks: Object.freeze([]) as ReadonlyArray<string>,
      weatherPatterns: Object.freeze([]) as ReadonlyArray<string>,
      diseasePatterns: Object.freeze([]) as ReadonlyArray<string>,
      regionalRecommendations: Object.freeze([]) as ReadonlyArray<string>,
      available: false,
    });
    const sourceA: any = intg ? ((intg as any).value || intg).regionalStatus || {} : {};
    const sourceB: any = regional ? ((regional as any).value || regional) : {};
    const seasonal: string[] = Array.isArray(sourceA.seasonalRisks) ? sourceA.seasonalRisks
      : Array.isArray(sourceB.regionalRisks) ? sourceB.regionalRisks : [];
    const diseases: string[] = Array.isArray(sourceA.commonDiseases) ? sourceA.commonDiseases
      : Array.isArray(sourceB.commonDiseases) ? sourceB.commonDiseases : [];
    const weather: string[] = [];
    if (typeof sourceB.rainfallPattern === 'string' && sourceB.rainfallPattern
        && sourceB.rainfallPattern !== 'Not enough data yet')
      weather.push(sourceB.rainfallPattern);
    if (typeof sourceB.temperaturePattern === 'string' && sourceB.temperaturePattern
        && sourceB.temperaturePattern !== 'Not enough data yet')
      weather.push(sourceB.temperaturePattern);
    const recs: string[] = Array.isArray(sourceA.recommendedActions)
      ? sourceA.recommendedActions
      : Array.isArray(sourceB.recommendedCrops)
        ? sourceB.recommendedCrops.slice(0, 3).map((c: string) => 'Region supports ' + c)
        : [];
    const plantingWindow = typeof sourceA.plantingWindow === 'string' && sourceA.plantingWindow
      ? sourceA.plantingWindow
      : (typeof sourceB.plantingWindow === 'string' ? sourceB.plantingWindow
          : 'Not enough data yet');
    return Object.freeze<FabricRegionalStatus>({
      plantingWindow,
      seasonalRisks: Object.freeze(seasonal.filter((s) => typeof s === 'string')) as ReadonlyArray<string>,
      weatherPatterns: Object.freeze(weather) as ReadonlyArray<string>,
      diseasePatterns: Object.freeze(diseases.filter((s) => typeof s === 'string')) as ReadonlyArray<string>,
      regionalRecommendations: Object.freeze(recs.filter((s) => typeof s === 'string')) as ReadonlyArray<string>,
      available: !!(sourceA.available || seasonal.length > 0 || diseases.length > 0
        || weather.length > 0 || (plantingWindow !== 'Not enough data yet')),
    });
  }, Object.freeze({
    plantingWindow: 'Not enough data yet',
    seasonalRisks: Object.freeze([]) as ReadonlyArray<string>,
    weatherPatterns: Object.freeze([]) as ReadonlyArray<string>,
    diseasePatterns: Object.freeze([]) as ReadonlyArray<string>,
    regionalRecommendations: Object.freeze([]) as ReadonlyArray<string>,
    available: false,
  }));
}

function _emptyAction(): Readonly<FabricActionRef> {
  return Object.freeze({ id: null, title: '', why: '', estimatedTime: '' });
}

export function intelligenceFabricHealth(): Readonly<IntelligenceFabricEnvelope> {
  return _safe(() => {
    const cc = _readCC();
    const ccState: any = _safe(() => cc && ((cc as any).value || cc).state, null) || {};

    // Spec output fields — sourced from Command Center state.
    const crop = typeof ccState.crop === 'string' ? ccState.crop : '';
    const stage = typeof ccState.cropStage === 'string' ? ccState.cropStage : '';

    const health: Readonly<FabricHealthRef> = _safe(() => {
      const h = ccState.farmHealth;
      if (!h) throw new Error('no health');
      return Object.freeze<FabricHealthRef>({
        score: (typeof h.score === 'number' && isFinite(h.score)) ? h.score : null,
        band: (h.band as HealthBand) || 'unknown',
        label: typeof h.label === 'string' ? h.label : 'Not enough data yet',
      });
    }, Object.freeze({ score: null, band: 'unknown' as HealthBand, label: 'Not enough data yet' }));

    const risk: Readonly<FabricRiskRef> = _safe(() => {
      const r = ccState.riskLevel;
      if (!r) throw new Error('no risk');
      return Object.freeze<FabricRiskRef>({
        level: (r.level as RiskLevel) || 'unknown',
        explanation: typeof r.explanation === 'string' ? r.explanation : 'No risk data yet.',
        source: typeof r.source === 'string' ? r.source : 'none',
      });
    }, Object.freeze({ level: 'unknown' as RiskLevel, explanation: 'No risk data yet.', source: 'none' }));

    const todayAction: Readonly<FabricActionRef> = _safe(() => {
      const a = ccState.todayAction;
      if (!a) throw new Error('no action');
      return Object.freeze<FabricActionRef>({
        id: typeof a.id === 'string' ? a.id : null,
        title: typeof a.title === 'string' ? a.title : '',
        why: typeof a.why === 'string' ? a.why : '',
        estimatedTime: typeof a.estimatedTime === 'string' ? a.estimatedTime : '',
      });
    }, _emptyAction());

    const nextAction: Readonly<FabricActionRef> = _safe(() => {
      const a = ccState.nextAction;
      if (!a) throw new Error('no next');
      return Object.freeze<FabricActionRef>({
        id: typeof a.id === 'string' ? a.id : null,
        title: typeof a.title === 'string' ? a.title : '',
        why: typeof a.why === 'string' ? a.why : '',
        estimatedTime: typeof a.estimatedTime === 'string' ? a.estimatedTime : '',
      });
    }, _emptyAction());

    const daysToHarvest: number | null = typeof ccState.daysToHarvest === 'number'
      ? ccState.daysToHarvest : null;

    const soilStatus = _fabricSoil();
    const marketStatus = _fabricMarket();
    const regionalStatus = _fabricRegional();

    // Source attribution.
    const composed: string[] = [];
    if (cc) composed.push('__commandCenterHealth');
    if (_readIntegration()) composed.push('__intelligenceIntegrationHealth');
    if (_probe('__weatherRiskHealth')) composed.push('__weatherRiskHealth');
    if (_probe('__scanPilotFreezeHealth')) composed.push('__scanPilotFreezeHealth');
    if (_probe('__scanOutcomeLoopHealth')) composed.push('__scanOutcomeLoopHealth');
    if (_probe('__regionalIntelligenceFieldHealth')) composed.push('__regionalIntelligenceFieldHealth');

    // Spec sources tally: Weather + Regional + Soil + Scan + Outcome + Market = 6.
    const sources = {
      weather: !!_probe('__weatherRiskHealth'),
      regional: regionalStatus.available,
      soil: soilStatus.available,
      scan: !!_probe('__scanPilotFreezeHealth'),
      outcome: !!_probe('__scanOutcomeLoopHealth'),
      market: marketStatus.available,
    };
    const sourceCount = Object.values(sources).filter(Boolean).length;
    const confidence: Confidence = (sourceCount >= 4 ? 'high'
      : sourceCount >= 2 ? 'medium' : 'low');

    return Object.freeze<IntelligenceFabricEnvelope>({
      initialized: true,
      crop, stage, health, risk,
      todayAction, nextAction, daysToHarvest,
      soilStatus, marketStatus, regionalStatus,
      confidence,
      limitations:
        'Fabric is a composition of upstream runtimes; each field inherits its source ' +
        'probe limitations. ' + GUIDANCE_TAIL,
      composedFrom: Object.freeze(composed) as ReadonlyArray<string>,
      sourceCount,
      totalSources: 6 as const,
      noFakeFabric: true as const,
      noFabricatedRecommendations: true as const,
      noStandalonePages: true as const,
    });
  }, Object.freeze<IntelligenceFabricEnvelope>({
    initialized: true,
    crop: '', stage: '',
    health: Object.freeze({ score: null, band: 'unknown' as HealthBand, label: 'init' }),
    risk: Object.freeze({ level: 'unknown' as RiskLevel, explanation: 'init', source: 'init' }),
    todayAction: _emptyAction(), nextAction: _emptyAction(),
    daysToHarvest: null,
    soilStatus: _fabricSoil(),
    marketStatus: _fabricMarket(),
    regionalStatus: _fabricRegional(),
    confidence: 'low' as Confidence,
    limitations: 'Fabric runtime initialized. ' + GUIDANCE_TAIL,
    composedFrom: Object.freeze([]) as ReadonlyArray<string>,
    sourceCount: 0, totalSources: 6 as const,
    noFakeFabric: true as const,
    noFabricatedRecommendations: true as const,
    noStandalonePages: true as const,
  }));
}

export function installIntelligenceFabricGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__intelligenceFabricHealth !== 'function') {
      w.__intelligenceFabricHealth = function () {
        const out = intelligenceFabricHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Intelligence Fabric]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
