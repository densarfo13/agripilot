/**
 * SoilIntelligenceRuntime.ts → window.__soilIntelligenceHealth().
 *
 * HONEST IMPLEMENTATION: this Farroway codebase does not currently call
 * the SoilGrids API or any other real soil-data source. Per the spec's
 * hard constraint ("no fake data, no fabricated scores"), this runtime
 * reports `soilGridsConfigured:false` and honest NEEDS_DATA strings for
 * every soil field until a real integration is wired.
 *
 * The runtime EXISTS so:
 *   • the spec import path resolves
 *   • a future SoilGrids integration drops in behind this envelope
 *   • the gate locks the contract: every soil recommendation must carry
 *     rationale + confidence + limitations; never a fabricated score
 *
 * Self-contained; zero imports; frozen; never throws.
 */

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
type Confidence = 'low' | 'medium' | 'high';
const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

export const SOIL_INTELLIGENCE_VERSION = 'soil-intelligence-v1' as const;

export interface SoilIntelligenceEnvelope {
  runtimeVersion: typeof SOIL_INTELLIGENCE_VERSION;
  initialized: true;
  // Real integration not yet wired; literal-false until a real soil API
  // is added (the spec requires this honesty).
  soilGridsConfigured: false;
  realDataAvailable: false;
  // Honest output fields — strings rather than fake numbers.
  soilType: string;
  organicMatter: string;
  soilPH: string;
  waterRetention: string;
  drainage: string;
  // Health + recommendations.
  soilHealth: string;          // honest 'Not enough data yet' until real
  soilLimitations: string;
  soilRecommendations: ReadonlyArray<string>;
  noFabricatedScores: true;
  noFabricatedSoilValues: true;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

export function soilIntelligenceHealth(): Readonly<SoilIntelligenceEnvelope> {
  return _safe(() => Object.freeze<SoilIntelligenceEnvelope>({
    runtimeVersion: SOIL_INTELLIGENCE_VERSION,
    initialized: true,
    soilGridsConfigured: false as const,
    realDataAvailable: false as const,
    soilType: 'Not enough data yet',
    organicMatter: 'Not enough data yet',
    soilPH: 'Not enough data yet',
    waterRetention: 'Not enough data yet',
    drainage: 'Not enough data yet',
    soilHealth: 'Not enough data yet',
    soilLimitations:
      'Soil profile requires real soil data (e.g. SoilGrids API) — not yet wired in this build.',
    soilRecommendations: Object.freeze([]) as ReadonlyArray<string>,
    noFabricatedScores: true as const,
    noFabricatedSoilValues: true as const,
    confidence: 'low' as Confidence,
    explanation:
      'Soil intelligence is structurally ready but the real soil-data provider is not yet wired. ' +
      'Returns honest NEEDS_DATA strings rather than fabricated soil values. When a real provider is ' +
      'integrated, soilGridsConfigured will flip true and the fields will carry real values + rationale.',
    limitations:
      'No fake soil data. Recommendations cannot be made without a real soil source. ' + GUIDANCE_TAIL,
  }), Object.freeze<SoilIntelligenceEnvelope>({
    runtimeVersion: SOIL_INTELLIGENCE_VERSION,
    initialized: true,
    soilGridsConfigured: false as const,
    realDataAvailable: false as const,
    soilType: 'Not enough data yet',
    organicMatter: 'Not enough data yet',
    soilPH: 'Not enough data yet',
    waterRetention: 'Not enough data yet',
    drainage: 'Not enough data yet',
    soilHealth: 'Not enough data yet',
    soilLimitations: 'Soil runtime threw.',
    soilRecommendations: Object.freeze([]) as ReadonlyArray<string>,
    noFabricatedScores: true as const,
    noFabricatedSoilValues: true as const,
    confidence: 'low' as Confidence,
    explanation: 'Soil intelligence runtime initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }));
}

export function installSoilIntelligenceGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__soilIntelligenceHealth !== 'function') {
      w.__soilIntelligenceHealth = function () {
        const out = soilIntelligenceHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Soil Intelligence]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
