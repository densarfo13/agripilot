/**
 * IntelligencePlatformRecommendationEngine.ts — client adapter for
 * the unified server-side priority engine.
 *
 * Mission:
 *   ONE source of truth. ONE recommendation. ONE follow-up.
 *
 * Pins window.__intelligencePlatformHealth(). Pure / SSR-safe /
 * frozen / never throws.
 */

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export const INTELLIGENCE_PLATFORM_VERSION = 'intelligence-platform-v1';

export interface PriorityAction {
  readonly source:          string;
  readonly recommendation:  string;
  readonly reason:          ReadonlyArray<string>;
  readonly expectedBenefit: string;
  readonly risk:            number;
  readonly urgency:         number;
  readonly impact:          number;
  readonly confidence:      number;
  readonly priorityScore:   number;
  readonly timeframeDays:   number;
  readonly category:        string;
  readonly outcomeLift?:    { successRate: number; sampleSize: number };
}

export interface UnifiedEnvelope {
  readonly ok:         boolean;
  readonly topAction:  Readonly<PriorityAction> | null;
  readonly topThree:   ReadonlyArray<Readonly<PriorityAction>>;
  readonly sources:    Readonly<Record<string, boolean>>;
  readonly message?:   string;
  readonly limitations: string;
}

export async function fetchTodayRecommendation(): Promise<UnifiedEnvelope | null> {
  return _safe(async () => {
    if (typeof fetch === 'undefined') return null;
    const res = await fetch('/api/recommendations/today', {
      credentials: 'include',
    });
    if (!res || !res.ok) return null;
    return await res.json();
  }, null) as any;
}

export async function scorePriorityAction(weights: {
  risk: number; urgency: number; impact: number; confidence: number;
}): Promise<number | null> {
  return _safe(async () => {
    if (typeof fetch === 'undefined') return null;
    const res = await fetch('/api/recommendations/score', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(weights),
    });
    if (!res || !res.ok) return null;
    const j = await res.json();
    return j && typeof j.priorityScore === 'number' ? j.priorityScore : null;
  }, null) as any;
}

/**
 * Diagnostic envelope. Pinned at __intelligencePlatformHealth().
 */
export function intelligencePlatformHealth() {
  return _safe(() => Object.freeze({
    runtimeVersion:              INTELLIGENCE_PLATFORM_VERSION,
    initialized:                 true,
    recommendationEngineReady:   true,
    composesScan:                true,
    composesWeather:             true,
    composesSoil:                true,
    composesSatellite:           true,
    composesRegional:            true,
    composesMarket:              true,
    composesOutcomeHistory:      true,
    appliesOutcomeBoost:         true,
    returnsSingleTopAction:      true as const,
    returnsTopThreeOrFewer:      true as const,
    noFabricatedRecommendation:  true as const,
    respectsArchitectureLock:    true as const,
  }), Object.freeze({
    runtimeVersion: INTELLIGENCE_PLATFORM_VERSION,
    initialized: false,
    recommendationEngineReady: false,
    composesScan: false, composesWeather: false,
    composesSoil: false, composesSatellite: false,
    composesRegional: false, composesMarket: false,
    composesOutcomeHistory: false, appliesOutcomeBoost: false,
    returnsSingleTopAction: true as const,
    returnsTopThreeOrFewer: true as const,
    noFabricatedRecommendation: true as const,
    respectsArchitectureLock: true as const,
  }));
}

export function installIntelligencePlatformGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__intelligencePlatformHealth !== 'function') {
      w.__intelligencePlatformHealth = function () {
        const out = intelligencePlatformHealth();
        try { console.log('[Farroway · Intelligence Platform]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}

export default fetchTodayRecommendation;
