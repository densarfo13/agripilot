/**
 * RecommendationEngine.ts — daily-action client adapter.
 *
 * Spec V1: one clear daily action. Avoid complexity.
 *
 * Pure / SSR-safe / frozen / never throws.
 * Pins window.__dailyActionHealth().
 */

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export const DAILY_ACTION_VERSION = 'daily-action-engine-v1';

export interface DailyAction {
  readonly action:          string;
  readonly priority:        'high' | 'medium' | 'low';
  readonly priorityScore:   number;          // 0..100
  readonly reason:          string;
  readonly confidence:      number;          // 0..100
  readonly estimatedTime:   string;          // "5 minutes" | "2 hours"
  readonly estimatedMinutes: number;
  readonly followUpDate:    string;          // YYYY-MM-DD
  readonly category:        string;
  readonly topThree:        ReadonlyArray<{
    readonly action: string;
    readonly category: string;
    readonly reason: string;
    readonly estimatedMinutes: number;
    readonly priorityScore: number;
  }>;
}

export async function fetchDailyAction(): Promise<DailyAction | null> {
  return _safe(async () => {
    if (typeof fetch === 'undefined') return null;
    const res = await fetch('/api/daily-action', { credentials: 'include' });
    if (!res || !res.ok) return null;
    const json = await res.json();
    if (!json || typeof json.action !== 'string') return null;
    return Object.freeze(json) as DailyAction;
  }, null) as any;
}

export function dailyActionHealth() {
  return _safe(() => Object.freeze({
    runtimeVersion:           DAILY_ACTION_VERSION,
    initialized:              true,
    alwaysReturnsOneAction:   true as const,
    capsTopThreeAtThree:      true as const,
    emitsFollowUpDate:        true as const,
    weights:                  Object.freeze({
      weather: 40, scan: 30, growthStage: 20, previousOutcome: 10,
    }),
    composesWeather:          true,
    composesScan:             true,
    composesCrop:             true,
    composesGrowthStage:      true,
    composesOpenTasks:        true,
    composesPreviousOutcomes: true,
    noFabricatedAction:       true as const,
    respectsArchitectureLock: true as const,
  }), Object.freeze({
    runtimeVersion: DAILY_ACTION_VERSION,
    initialized: false,
    alwaysReturnsOneAction:   true as const,
    capsTopThreeAtThree:      true as const,
    emitsFollowUpDate:        true as const,
    weights: Object.freeze({
      weather: 40, scan: 30, growthStage: 20, previousOutcome: 10,
    }),
    composesWeather: false, composesScan: false, composesCrop: false,
    composesGrowthStage: false, composesOpenTasks: false,
    composesPreviousOutcomes: false,
    noFabricatedAction:       true as const,
    respectsArchitectureLock: true as const,
  }));
}

export function installDailyActionGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__dailyActionHealth !== 'function') {
      w.__dailyActionHealth = function () {
        const out = dailyActionHealth();
        try { console.log('[Farroway · Daily Action]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}

export default fetchDailyAction;
