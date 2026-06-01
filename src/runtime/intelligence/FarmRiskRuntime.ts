/**
 * FarmRiskRuntime.ts → window.__farmRiskHealth().
 *
 * Composite over predictive (V2), weather risk, soil intelligence, and
 * market intelligence composites. Surfaces a per-category riskLevel
 * (low/medium/high) PLUS a mandatory explanation for each. Spec
 * constraint: "risk level must come with an explanation" — gate locks
 * this; missing explanation fails the build.
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
type RiskLevel = 'low' | 'medium' | 'high' | 'unknown';
const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

export const FARM_RISK_VERSION = 'farm-risk-v1' as const;

export interface RiskAssessment {
  riskLevel: RiskLevel;
  explanation: string;
  source: string;
}

export interface FarmRiskEnvelope {
  runtimeVersion: typeof FARM_RISK_VERSION;
  initialized: true;
  // Per-category risk assessments — each MUST carry explanation + source.
  weatherRisk: Readonly<RiskAssessment>;
  diseaseRisk: Readonly<RiskAssessment>;
  soilRisk: Readonly<RiskAssessment>;
  marketRisk: Readonly<RiskAssessment>;
  // Aggregate.
  overallRiskLevel: RiskLevel;
  overallExplanation: string;
  composedFrom: ReadonlyArray<string>;
  noFabricatedRiskScores: true;
  riskCarriesExplanation: true;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

function _assessFromString(v: any, source: string, fallback: string): Readonly<RiskAssessment> {
  if (typeof v === 'string' && ['low', 'medium', 'high'].indexOf(v) >= 0) {
    const level = v as RiskLevel;
    return Object.freeze<RiskAssessment>({
      riskLevel: level,
      explanation:
        level === 'high' ? 'Elevated risk reported by underlying probe; take preventive action soon.'
        : level === 'medium' ? 'Moderate risk reported by underlying probe; monitor closely.'
        : 'Low risk reported by underlying probe; routine care sufficient.',
      source,
    });
  }
  return Object.freeze<RiskAssessment>({
    riskLevel: 'unknown' as RiskLevel,
    explanation: fallback,
    source: source || 'no probe',
  });
}

export function farmRiskHealth(): Readonly<FarmRiskEnvelope> {
  return _safe(() => {
    const predictive = _probe('__predictiveHealth');
    const weather = _probe('__weatherRiskHealth');
    const soil = _probe('__soilIntelligenceHealth');
    const market = _probe('__marketIntelligenceCompositeHealth')
      || _probe('__marketplaceIntelligenceHealth');
    const composed: string[] = [];
    if (predictive) composed.push('__predictiveHealth');
    if (weather) composed.push('__weatherRiskHealth');
    if (soil) composed.push('__soilIntelligenceHealth');
    if (market) composed.push(market === _probe('__marketIntelligenceCompositeHealth')
      ? '__marketIntelligenceCompositeHealth' : '__marketplaceIntelligenceHealth');

    // Weather risk.
    let weatherRisk: Readonly<RiskAssessment> = _assessFromString(
      null, '__weatherRiskHealth',
      'No weather risk probe yet; treat caution as default.',
    );
    if (weather) {
      const v: any = (weather as any).value || weather;
      const lvl = typeof v.weatherRisk === 'string' ? v.weatherRisk
        : typeof v.riskLevel === 'string' ? v.riskLevel : null;
      weatherRisk = _assessFromString(lvl, '__weatherRiskHealth',
        'Weather signal present but inconclusive; defer to local forecast.');
    }

    // Disease risk via predictive.
    let diseaseRisk: Readonly<RiskAssessment> = _assessFromString(
      null, '__predictiveHealth',
      'No predictive disease probe yet; rely on scan-based detection.',
    );
    if (predictive) {
      const v: any = (predictive as any).value || predictive;
      const lvl = typeof v.diseaseRisk === 'string' ? v.diseaseRisk
        : typeof v.predictedRisk === 'string' ? v.predictedRisk : null;
      diseaseRisk = _assessFromString(lvl, '__predictiveHealth',
        'Predictive signal present but inconclusive; scan leaves regularly.');
    }

    // Soil risk — honest 'unknown' until real soil data arrives.
    let soilRisk: Readonly<RiskAssessment> = Object.freeze<RiskAssessment>({
      riskLevel: 'unknown',
      explanation: 'Soil risk requires real soil data — not yet wired in this build.',
      source: '__soilIntelligenceHealth',
    });
    if (soil) {
      const v: any = (soil as any).value || soil;
      if (v.soilGridsConfigured === true && typeof v.soilRisk === 'string') {
        soilRisk = _assessFromString(v.soilRisk, '__soilIntelligenceHealth',
          'Soil signal present; review soil recommendations.');
      } else {
        soilRisk = Object.freeze<RiskAssessment>({
          riskLevel: 'unknown',
          explanation:
            'Soil intelligence reports soilGridsConfigured=false — no real soil source wired. ' +
            'Risk cannot be assessed without real data.',
          source: '__soilIntelligenceHealth',
        });
      }
    }

    // Market risk via marketplace composite — invert demand into risk.
    let marketRisk: Readonly<RiskAssessment> = _assessFromString(
      null, '__marketIntelligenceCompositeHealth',
      'No marketplace probe yet; assume neutral.',
    );
    if (market) {
      const v: any = (market as any).value || market;
      const demand: string | null = typeof v.marketDemand === 'string' ? v.marketDemand : null;
      if (demand === 'high') {
        marketRisk = Object.freeze<RiskAssessment>({
          riskLevel: 'low',
          explanation: 'Marketplace reports HIGH buyer demand → low market risk for sellers.',
          source: '__marketIntelligenceCompositeHealth.marketDemand',
        });
      } else if (demand === 'medium') {
        marketRisk = Object.freeze<RiskAssessment>({
          riskLevel: 'medium',
          explanation: 'Marketplace reports MEDIUM buyer demand → moderate market risk.',
          source: '__marketIntelligenceCompositeHealth.marketDemand',
        });
      } else if (demand === 'low') {
        marketRisk = Object.freeze<RiskAssessment>({
          riskLevel: 'high',
          explanation: 'Marketplace reports LOW buyer demand → elevated market risk for sellers.',
          source: '__marketIntelligenceCompositeHealth.marketDemand',
        });
      } else {
        marketRisk = Object.freeze<RiskAssessment>({
          riskLevel: 'unknown',
          explanation: 'Marketplace probe present but marketDemand is unknown.',
          source: '__marketIntelligenceCompositeHealth',
        });
      }
    }

    // Aggregate — highest single category wins; 'unknown' never raises overall.
    const levels = [weatherRisk.riskLevel, diseaseRisk.riskLevel, soilRisk.riskLevel, marketRisk.riskLevel];
    let overall: RiskLevel = 'low';
    let overallExpl = 'All categories report low or unknown risk.';
    if (levels.indexOf('high') >= 0) {
      overall = 'high';
      const high = [weatherRisk, diseaseRisk, soilRisk, marketRisk].filter(r => r.riskLevel === 'high');
      overallExpl = 'High risk in: ' + high.map(r => r.source).join(', ');
    } else if (levels.indexOf('medium') >= 0) {
      overall = 'medium';
      const med = [weatherRisk, diseaseRisk, soilRisk, marketRisk].filter(r => r.riskLevel === 'medium');
      overallExpl = 'Medium risk in: ' + med.map(r => r.source).join(', ');
    } else if (levels.every(l => l === 'unknown')) {
      overall = 'unknown';
      overallExpl = 'No risk probes have produced data yet.';
    }

    return Object.freeze<FarmRiskEnvelope>({
      runtimeVersion: FARM_RISK_VERSION,
      initialized: true,
      weatherRisk,
      diseaseRisk,
      soilRisk,
      marketRisk,
      overallRiskLevel: overall,
      overallExplanation: overallExpl,
      composedFrom: Object.freeze(composed) as ReadonlyArray<string>,
      noFabricatedRiskScores: true as const,
      riskCarriesExplanation: true as const,
      confidence: (composed.length >= 3 ? 'high' : composed.length >= 1 ? 'medium' : 'low') as Confidence,
      explanation:
        'Farm risk composite over __predictiveHealth + __weatherRiskHealth + __soilIntelligenceHealth + ' +
        '__marketIntelligenceCompositeHealth. Each per-category risk carries its own explanation + ' +
        'source attribution. Overall risk is the max of present categories; "unknown" never raises ' +
        'overall above what real probes report.',
      limitations:
        'Soil category will report "unknown" until a real soil-data provider is wired. ' + GUIDANCE_TAIL,
    });
  }, Object.freeze<FarmRiskEnvelope>({
    runtimeVersion: FARM_RISK_VERSION,
    initialized: true,
    weatherRisk: Object.freeze({ riskLevel: 'unknown' as RiskLevel, explanation: 'Init.', source: 'init' }),
    diseaseRisk: Object.freeze({ riskLevel: 'unknown' as RiskLevel, explanation: 'Init.', source: 'init' }),
    soilRisk: Object.freeze({ riskLevel: 'unknown' as RiskLevel, explanation: 'Init.', source: 'init' }),
    marketRisk: Object.freeze({ riskLevel: 'unknown' as RiskLevel, explanation: 'Init.', source: 'init' }),
    overallRiskLevel: 'unknown' as RiskLevel,
    overallExplanation: 'Farm risk runtime initialized.',
    composedFrom: Object.freeze([]) as ReadonlyArray<string>,
    noFabricatedRiskScores: true as const, riskCarriesExplanation: true as const,
    confidence: 'low' as Confidence,
    explanation: 'Farm risk runtime initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }));
}

export function installFarmRiskGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__farmRiskHealth !== 'function') {
      w.__farmRiskHealth = function () {
        const out = farmRiskHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Farm Risk]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
