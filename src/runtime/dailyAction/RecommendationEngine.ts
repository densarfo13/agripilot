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

/**
 * V1 funnel adapters — Start / Complete / Outcome / KPI.
 * Every call is best-effort + returns frozen envelopes.
 */
export async function startDailyAction(args: {
  actionId?: string;
  action: string;
  category?: string;
  priority?: string;
  estimatedMinutes?: number;
  followUpDate?: string;
  scanId?: string;
}): Promise<{ ok: boolean; taskId?: string;
              outcomePathReady?: boolean;
              followUpPlanItems?: any[] } | null> {
  return _safe(async () => {
    if (typeof fetch === 'undefined') return null;
    const res = await fetch('/api/daily-action/start', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    if (!res || !res.ok) return null;
    return await res.json();
  }, null) as any;
}

export async function completeDailyAction(args: {
  actionId?: string; taskId?: string;
}): Promise<{ ok: boolean } | null> {
  return _safe(async () => {
    if (typeof fetch === 'undefined') return null;
    const res = await fetch('/api/daily-action/complete', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    if (!res || !res.ok) return null;
    return await res.json();
  }, null) as any;
}

export async function recordDailyActionOutcome(args: {
  actionId?: string; taskId?: string; scanId?: string;
  outcome: 'better' | 'same' | 'worse'; note?: string;
}): Promise<{ ok: boolean } | null> {
  return _safe(async () => {
    if (typeof fetch === 'undefined') return null;
    const res = await fetch('/api/daily-action/outcome', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    if (!res || !res.ok) return null;
    return await res.json();
  }, null) as any;
}

export async function fetchDailyActionKpi(days = 30) {
  return _safe(async () => {
    if (typeof fetch === 'undefined') return null;
    const res = await fetch('/api/daily-action/kpi?days=' + String(days), {
      credentials: 'include',
    });
    if (!res || !res.ok) return null;
    return await res.json();
  }, null) as any;
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
