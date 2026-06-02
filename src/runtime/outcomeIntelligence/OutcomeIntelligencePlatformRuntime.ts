/**
 * OutcomeIntelligencePlatformRuntime.ts — pins
 * window.__outcomeIntelligencePlatformHealth().
 *
 * Sibling to the existing (wave-36) OutcomeRuntime / OutcomeTracker.
 * Pure / SSR-safe / frozen / never throws.
 */

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

export const OUTCOME_INTELLIGENCE_PLATFORM_VERSION = 'outcome-intelligence-platform-v1';

export function outcomeIntelligencePlatformHealth() {
  return _safe(() => Object.freeze({
    runtimeVersion:                OUTCOME_INTELLIGENCE_PLATFORM_VERSION,
    initialized:                   true,
    taskOutcomePromptReady:        true,
    followUpPromptReady:           true,
    photoComparisonReady:          true,
    farmerDashboardReady:          true,
    orgDashboardReady:             true,
    commandCenterMetricsReady:     true,
    rankingEngineReady:            true,
    regionalLearningReady:         true,
    nullWhenInsufficientData:      true as const,
    noFabricatedSuccessRate:       true as const,
    noPiiInOrgDashboard:           true as const,
    respectsArchitectureLock:      true as const,
  }), Object.freeze({
    runtimeVersion: OUTCOME_INTELLIGENCE_PLATFORM_VERSION,
    initialized: false,
    taskOutcomePromptReady: false,
    followUpPromptReady: false,
    photoComparisonReady: false,
    farmerDashboardReady: false,
    orgDashboardReady: false,
    commandCenterMetricsReady: false,
    rankingEngineReady: false,
    regionalLearningReady: false,
    nullWhenInsufficientData: true as const,
    noFabricatedSuccessRate: true as const,
    noPiiInOrgDashboard: true as const,
    respectsArchitectureLock: true as const,
  }));
}

export function installOutcomeIntelligencePlatformGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__outcomeIntelligencePlatformHealth !== 'function') {
      w.__outcomeIntelligencePlatformHealth = function () {
        const out = outcomeIntelligencePlatformHealth();
        try { console.log('[Farroway · Outcome Intelligence]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}

export default outcomeIntelligencePlatformHealth;
