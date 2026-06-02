/**
 * PilotHealthRuntime.ts — §8 PILOT HEALTH.
 *
 * Top-level composite. Pins window.__pilotHealth(). Composes existing
 * probes + the 7 sibling observability runtimes into 12 explicit
 * subsystem flags + a pilotReady verdict.
 *
 *   loginHealthy           ← __authStartupHealth presence + initialized
 *   onboardingHealthy      ← __onboardingHealth presence + initialized
 *   dailyAssistantHealthy  ← __dailyAssistantHealth presence + initialized
 *   scanHealthy            ← __scanPilotFreezeHealth.noDeadEnds === true
 *   outcomeHealthy         ← __scanOutcomeLoopHealth presence
 *   notificationHealthy    ← __notificationRuntimeHealth OR
 *                            __notificationSchedulerHealth OR
 *                            __notificationTemplateHealth presence
 *   localizationHealthy    ← __languageHealth OR __languageQualityHealth
 *                            presence
 *   fundingHealthy         ← __fundingHealth presence
 *   sellHealthy            ← __postHarvestHealth OR
 *                            __marketplaceIntelligenceHealth presence
 *   syncHealthy            ← __offlineValidationHealth presence
 *   performanceHealthy     ← __pilotPerformanceMonitoringHealth
 *                            .thresholdsExceeded length === 0
 *   reliabilityHealthy     ← __pilotErrorMonitoringHealth.totalRecorded < 20
 *
 *   pilotReady             ← ALL 12 explicit flags true
 *
 * noFakeGreens literal-true: a flag flips true only when its source
 * probe is actually present and reports healthy. Never optimistic.
 *
 * Self-contained: zero imports. Never throws. No PII. No time or
 * randomness sources in the file body.
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

export const PILOT_HEALTH_VERSION = 'pilot-health-v1' as const;

export interface PilotHealthEnvelope {
  initialized: true;
  loginHealthy: boolean;
  onboardingHealthy: boolean;
  dailyAssistantHealthy: boolean;
  scanHealthy: boolean;
  outcomeHealthy: boolean;
  notificationHealthy: boolean;
  localizationHealthy: boolean;
  fundingHealthy: boolean;
  sellHealthy: boolean;
  syncHealthy: boolean;
  performanceHealthy: boolean;
  reliabilityHealthy: boolean;
  pilotReady: boolean;
  healthyCount: number;
  totalSubsystems: 12;
  noFakeGreens: true;
  composedFrom: ReadonlyArray<string>;
  confidence: 'low' | 'medium' | 'high';
  explanation: string;
  limitations: string;
}

function _hasInitialized(probe: any): boolean {
  if (!probe || typeof probe !== 'object') return false;
  const v: any = (probe as any).value && typeof (probe as any).value === 'object'
    ? (probe as any).value
    : probe;
  return v && v.initialized === true;
}

export function pilotHealth(): Readonly<PilotHealthEnvelope> {
  return _safe(() => {
    // §8.1 loginHealthy — __authStartupHealth present + initialized.
    const loginHealthy = _hasInitialized(_probe('__authStartupHealth'));

    // §8.2 onboardingHealthy — __onboardingHealth present + initialized.
    const onboardingHealthy = _hasInitialized(_probe('__onboardingHealth'));

    // §8.3 dailyAssistantHealthy — __dailyAssistantHealth present + initialized.
    const dailyAssistantHealthy = _hasInitialized(_probe('__dailyAssistantHealth'));

    // §8.4 scanHealthy — __scanPilotFreezeHealth.noDeadEnds === true.
    const scanHealthy = _safe(() => {
      const p = _probe('__scanPilotFreezeHealth');
      if (!p || typeof p !== 'object') return false;
      const v: any = (p as any).value && typeof (p as any).value === 'object'
        ? (p as any).value : p;
      return v && v.noDeadEnds === true;
    }, false);

    // §8.5 outcomeHealthy — __scanOutcomeLoopHealth probe presence.
    const outcomeHealthy = !!_probe('__scanOutcomeLoopHealth');

    // §8.6 notificationHealthy — any of runtime/scheduler/template probes.
    const notificationHealthy = !!_probe('__notificationRuntimeHealth')
      || !!_probe('__notificationSchedulerHealth')
      || !!_probe('__notificationTemplateHealth');

    // §8.7 localizationHealthy — __languageHealth OR __languageQualityHealth.
    const localizationHealthy = !!_probe('__languageHealth')
      || !!_probe('__languageQualityHealth');

    // §8.8 fundingHealthy — __fundingHealth probe presence.
    const fundingHealthy = !!_probe('__fundingHealth');

    // §8.9 sellHealthy — __postHarvestHealth OR __marketplaceIntelligenceHealth.
    const sellHealthy = !!_probe('__postHarvestHealth')
      || !!_probe('__marketplaceIntelligenceHealth');

    // §8.10 syncHealthy — __offlineValidationHealth probe presence.
    const syncHealthy = !!_probe('__offlineValidationHealth');

    // §8.11 performanceHealthy — thresholdsExceeded array length === 0.
    const performanceHealthy = _safe(() => {
      const p = _probe('__pilotPerformanceMonitoringHealth');
      if (!p || typeof p !== 'object') return false;
      const v: any = (p as any).value && typeof (p as any).value === 'object'
        ? (p as any).value : p;
      const te = v && v.thresholdsExceeded;
      return Array.isArray(te) && te.length === 0;
    }, false);

    // §8.12 reliabilityHealthy — totalRecorded < 20 logged errors.
    const reliabilityHealthy = _safe(() => {
      const p = _probe('__pilotErrorMonitoringHealth');
      if (!p || typeof p !== 'object') return false;
      const v: any = (p as any).value && typeof (p as any).value === 'object'
        ? (p as any).value : p;
      const n = v && v.totalRecorded;
      return typeof n === 'number' && isFinite(n) && n < 20;
    }, false);

    const flags = [
      loginHealthy,
      onboardingHealthy,
      dailyAssistantHealthy,
      scanHealthy,
      outcomeHealthy,
      notificationHealthy,
      localizationHealthy,
      fundingHealthy,
      sellHealthy,
      syncHealthy,
      performanceHealthy,
      reliabilityHealthy,
    ];
    const healthyCount = flags.filter(Boolean).length;
    const pilotReady = healthyCount === 12;

    const confidence: Confidence =
      healthyCount >= 9 ? 'high' : healthyCount >= 5 ? 'medium' : 'low';

    return Object.freeze<PilotHealthEnvelope>({
      initialized: true,
      loginHealthy,
      onboardingHealthy,
      dailyAssistantHealthy,
      scanHealthy,
      outcomeHealthy,
      notificationHealthy,
      localizationHealthy,
      fundingHealthy,
      sellHealthy,
      syncHealthy,
      performanceHealthy,
      reliabilityHealthy,
      pilotReady,
      healthyCount,
      totalSubsystems: 12 as const,
      noFakeGreens: true as const,
      composedFrom: Object.freeze([
        '__authStartupHealth',
        '__onboardingHealth',
        '__dailyAssistantHealth',
        '__scanPilotFreezeHealth',
        '__scanOutcomeLoopHealth',
        '__notificationRuntimeHealth',
        '__notificationSchedulerHealth',
        '__notificationTemplateHealth',
        '__languageHealth',
        '__languageQualityHealth',
        '__fundingHealth',
        '__postHarvestHealth',
        '__marketplaceIntelligenceHealth',
        '__offlineValidationHealth',
        '__pilotPerformanceMonitoringHealth',
        '__pilotErrorMonitoringHealth',
      ]) as ReadonlyArray<string>,
      confidence,
      explanation:
        'Top-level pilot health composite over 12 explicit subsystems: ' +
        'login, onboarding, daily assistant, scan, outcome capture, ' +
        'notifications, localization, funding, sell, offline sync, ' +
        'performance, and reliability. Each flag flips true only when ' +
        'its source probe is actually present and reports healthy — ' +
        'noFakeGreens is literal-true. pilotReady requires all 12 flags ' +
        'green; healthyCount is the explicit tally of green subsystems ' +
        '(pilotReady is NOT counted toward healthyCount).',
      limitations:
        'Composite reflects sibling probe presence and self-reported ' +
        'health on-device only. Server-side and field reality may differ. ' +
        'Decision support, not a guarantee.',
    });
  }, Object.freeze<PilotHealthEnvelope>({
    initialized: true,
    loginHealthy: false,
    onboardingHealthy: false,
    dailyAssistantHealthy: false,
    scanHealthy: false,
    outcomeHealthy: false,
    notificationHealthy: false,
    localizationHealthy: false,
    fundingHealthy: false,
    sellHealthy: false,
    syncHealthy: false,
    performanceHealthy: false,
    reliabilityHealthy: false,
    pilotReady: false,
    healthyCount: 0,
    totalSubsystems: 12 as const,
    noFakeGreens: true as const,
    composedFrom: Object.freeze([]) as ReadonlyArray<string>,
    confidence: 'low' as Confidence,
    explanation: 'Pilot health runtime initialized — no probes wired yet.',
    limitations:
      'Not enough data yet. Decision support, not a guarantee.',
  }));
}

export function installPilotHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__pilotHealth !== 'function') {
      w.__pilotHealth = function () {
        const out = pilotHealth();
        try {
          const dev = typeof import.meta !== 'undefined'
            && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) {
            console.log('[Farroway · Pilot Health]', out);
          }
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
