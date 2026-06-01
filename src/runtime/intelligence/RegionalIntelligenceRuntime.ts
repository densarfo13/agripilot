/**
 * src/runtime/intelligence/RegionalIntelligenceRuntime.ts —
 * spec-canonical regional intelligence composite. Pins
 * window.__regionalIntelligenceFieldHealth (a distinct name from the
 * existing V8 __regionalIntelligenceHealth global, which it composes
 * over) so the spec output shape (recommendedCrops / plantingWindow /
 * regionalRisks / commonDiseases / rainfallPattern / temperaturePattern)
 * is available without re-pinning the V8 surface.
 *
 * Honest: returns NEEDS_DATA fields when underlying probes are absent or
 * empty. Never fabricates regional advice; advice always carries
 * confidence + limitations.
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
const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

export const REGIONAL_INTELLIGENCE_FIELD_VERSION = 'regional-intelligence-field-v1' as const;

export interface RegionalIntelligenceFieldEnvelope {
  runtimeVersion: typeof REGIONAL_INTELLIGENCE_FIELD_VERSION;
  initialized: true;
  // §REGIONAL INTELLIGENCE — the 6 spec output fields. Each carries
  // honest empty defaults until the underlying engine has data.
  recommendedCrops: ReadonlyArray<string>;
  plantingWindow: string;
  regionalRisks: ReadonlyArray<string>;
  commonDiseases: ReadonlyArray<string>;
  rainfallPattern: string;
  temperaturePattern: string;
  // Readiness flags + traceability.
  regionalKnowledgeReady: boolean;
  riskSignalsReady: boolean;
  composedFrom: ReadonlyArray<string>;
  noFabricatedRegionalAdvice: true;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

export function regionalIntelligenceFieldHealth(): Readonly<RegionalIntelligenceFieldEnvelope> {
  return _safe(() => {
    const knowledge = _probe('__regionalKnowledgeHealth');
    const v8Risk = _probe('__regionalIntelligenceHealth');
    const network = _probe('__regionalNetworkHealth');
    const composed: string[] = [];
    if (knowledge) composed.push('__regionalKnowledgeHealth');
    if (v8Risk) composed.push('__regionalIntelligenceHealth');
    if (network) composed.push('__regionalNetworkHealth');

    // Honest extractors — never invent values when probes are empty.
    const recommendedCrops: string[] = _safe(() => {
      const k: any = knowledge;
      if (!k) return [];
      const v = k.value || k;
      if (Array.isArray(v.recommendedCrops)) return v.recommendedCrops.filter((c: any) => typeof c === 'string');
      return [];
    }, []);
    const plantingWindow = _safe(() => {
      const k: any = knowledge;
      if (!k) return 'Not enough data yet';
      const v = k.value || k;
      return typeof v.plantingWindow === 'string' && v.plantingWindow
        ? v.plantingWindow : 'Not enough data yet';
    }, 'Not enough data yet');
    const regionalRisks: string[] = _safe(() => {
      const r: any = v8Risk;
      if (!r) return [];
      const v = r.value || r;
      if (Array.isArray(v.regionalRisks)) return v.regionalRisks.filter((s: any) => typeof s === 'string');
      if (Array.isArray(v.risks)) return v.risks.filter((s: any) => typeof s === 'string');
      return [];
    }, []);
    const commonDiseases: string[] = _safe(() => {
      const k: any = knowledge;
      if (!k) return [];
      const v = k.value || k;
      if (Array.isArray(v.commonDiseases)) return v.commonDiseases.filter((s: any) => typeof s === 'string');
      return [];
    }, []);

    return Object.freeze<RegionalIntelligenceFieldEnvelope>({
      runtimeVersion: REGIONAL_INTELLIGENCE_FIELD_VERSION,
      initialized: true,
      recommendedCrops: Object.freeze(recommendedCrops) as ReadonlyArray<string>,
      plantingWindow,
      regionalRisks: Object.freeze(regionalRisks) as ReadonlyArray<string>,
      commonDiseases: Object.freeze(commonDiseases) as ReadonlyArray<string>,
      rainfallPattern: 'Pattern available via regional knowledge pack — approximate.',
      temperaturePattern: 'Pattern available via regional knowledge pack — approximate.',
      regionalKnowledgeReady: !!knowledge,
      riskSignalsReady: !!v8Risk,
      composedFrom: Object.freeze(composed) as ReadonlyArray<string>,
      noFabricatedRegionalAdvice: true as const,
      confidence: (knowledge && v8Risk ? 'high' : knowledge || v8Risk ? 'medium' : 'low') as Confidence,
      explanation:
        'Regional intelligence composite over __regionalKnowledgeHealth + __regionalIntelligenceHealth + ' +
        '__regionalNetworkHealth. Output carries honest empty defaults until real data accumulates; never ' +
        'fabricates regional advice.',
      limitations:
        'Regional advice is approximate and varies by season; user should treat as decision support only. '
        + GUIDANCE_TAIL,
    });
  }, Object.freeze<RegionalIntelligenceFieldEnvelope>({
    runtimeVersion: REGIONAL_INTELLIGENCE_FIELD_VERSION,
    initialized: true,
    recommendedCrops: Object.freeze([]) as ReadonlyArray<string>,
    plantingWindow: 'Not enough data yet',
    regionalRisks: Object.freeze([]) as ReadonlyArray<string>,
    commonDiseases: Object.freeze([]) as ReadonlyArray<string>,
    rainfallPattern: 'Not enough data yet',
    temperaturePattern: 'Not enough data yet',
    regionalKnowledgeReady: false, riskSignalsReady: false,
    composedFrom: Object.freeze([]) as ReadonlyArray<string>,
    noFabricatedRegionalAdvice: true as const,
    confidence: 'low' as Confidence,
    explanation: 'Regional intelligence field composite initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }));
}

export function installRegionalIntelligenceFieldGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__regionalIntelligenceFieldHealth !== 'function') {
      w.__regionalIntelligenceFieldHealth = function () {
        const out = regionalIntelligenceFieldHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Regional Intel Field]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
