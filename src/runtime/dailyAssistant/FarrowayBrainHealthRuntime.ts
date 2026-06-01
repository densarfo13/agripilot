/**
 * FarrowayBrainHealthRuntime.ts → window.__farrowayBrainHealth().
 *
 * Single-brain composite. Attests that every page consumes the
 * DailyAssistantRuntime (no duplicate state). Composes over:
 *   • __dailyAssistantHealth          (chain ready)
 *   • __dailyAssistantConsumerHealth  (per-page integration flags)
 *   • __notificationTemplateHealth    (notification consumer)
 *   • __taskChainProgressHealth       (progress consumer)
 *
 * Honest false-by-default: a `Connected` flag is true only when the
 * corresponding consumer flag is true. No fake green.
 *
 * Self-contained; never throws; never blocks render.
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

export const FARROWAY_BRAIN_HEALTH_VERSION = 'farroway-brain-health-v1' as const;

export interface FarrowayBrainHealthEnvelope {
  runtimeVersion: typeof FARROWAY_BRAIN_HEALTH_VERSION;
  initialized: true;
  runtimeReady: boolean;
  // Per-page connectivity flags. The spec lists 10; the diagnostic
  // honestly reports each based on the consumer-health envelope.
  homeConnected: boolean;
  tasksConnected: boolean;
  myFarmConnected: boolean;
  activityConnected: boolean;
  fundingConnected: boolean;
  sellConnected: boolean;
  scanConnected: boolean;
  notificationConnected: boolean;
  progressConnected: boolean;
  voiceConnected: boolean;
  // Aggregate verdict — fraction integrated.
  integratedCount: number;
  totalPages: number;
  singleBrainReady: boolean; // true only when all 10 are connected
  // Source composites.
  composedFrom: ReadonlyArray<string>;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

export function farrowayBrainHealth(): Readonly<FarrowayBrainHealthEnvelope> {
  return _safe(() => {
    const da = _probe('__dailyAssistantHealth');
    const consumer = _probe('__dailyAssistantConsumerHealth');
    const tpl = _probe('__notificationTemplateHealth');
    const progress = _probe('__taskChainProgressHealth');
    const voice = _probe('__taskVoiceUIHealth');

    const runtimeReady = !!(da && (da as any).taskChainReady === true
      && (da as any).initialized === true);

    // Per-page flags pull from the consumer health envelope when present,
    // honestly default to false when not.
    const c = (consumer && typeof consumer === 'object') ? consumer : {};
    const homeConnected     = !!(c as any).homeIntegrated;
    const tasksConnected    = !!(c as any).tasksIntegrated;
    const myFarmConnected   = !!(c as any).myFarmIntegrated;
    const activityConnected = !!(c as any).activityIntegrated;
    const fundingConnected  = !!(c as any).fundingIntegrated;
    const sellConnected     = !!(c as any).sellIntegrated;
    // Scan injects follow-up tasks via the chain ctx flag scanFollowUpPending.
    // Honest reporting: connected when the chain reports scanInjectionReady.
    const scanConnected = !!(da && (da as any).scanInjectionReady === true);
    const notificationConnected = !!(tpl && (tpl as any).resolverReady === true);
    const progressConnected = !!(progress && (progress as any).progressBarReady === true);
    const voiceConnected = !!(voice && (voice as any).pageListenButtonReady === true);

    const flags = [
      homeConnected, tasksConnected, myFarmConnected, activityConnected,
      fundingConnected, sellConnected, scanConnected, notificationConnected,
      progressConnected, voiceConnected,
    ];
    const integratedCount = flags.filter(Boolean).length;
    const totalPages = flags.length;
    const singleBrainReady = integratedCount === totalPages;

    const composed: string[] = [];
    if (da) composed.push('__dailyAssistantHealth');
    if (consumer) composed.push('__dailyAssistantConsumerHealth');
    if (tpl) composed.push('__notificationTemplateHealth');
    if (progress) composed.push('__taskChainProgressHealth');
    if (voice) composed.push('__taskVoiceUIHealth');

    return Object.freeze<FarrowayBrainHealthEnvelope>({
      runtimeVersion: FARROWAY_BRAIN_HEALTH_VERSION,
      initialized: true,
      runtimeReady,
      homeConnected, tasksConnected, myFarmConnected, activityConnected,
      fundingConnected, sellConnected, scanConnected, notificationConnected,
      progressConnected, voiceConnected,
      integratedCount, totalPages, singleBrainReady,
      composedFrom: Object.freeze(composed) as ReadonlyArray<string>,
      confidence: (runtimeReady && composed.length >= 3 ? 'high'
        : runtimeReady ? 'medium' : 'low') as Confidence,
      explanation:
        'Single-brain composite: every page consumes DailyAssistantRuntime via the chain runtime + ' +
        'consumer-health probes. Per-page flags are honest — true only when the consumer probe + ' +
        'underlying runtime confirm connectivity.',
      limitations:
        'Page-specific integrations adopt the runtime incrementally; flags flip true as each page ' +
        'is migrated. ' + GUIDANCE_TAIL,
    });
  }, Object.freeze<FarrowayBrainHealthEnvelope>({
    runtimeVersion: FARROWAY_BRAIN_HEALTH_VERSION,
    initialized: true,
    runtimeReady: false,
    homeConnected: false, tasksConnected: false, myFarmConnected: false,
    activityConnected: false, fundingConnected: false, sellConnected: false,
    scanConnected: false, notificationConnected: false,
    progressConnected: false, voiceConnected: false,
    integratedCount: 0, totalPages: 10, singleBrainReady: false,
    composedFrom: Object.freeze([]) as ReadonlyArray<string>,
    confidence: 'low' as Confidence,
    explanation: 'Single-brain composite initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }));
}

export function installFarrowayBrainHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__farrowayBrainHealth !== 'function') {
      w.__farrowayBrainHealth = function () {
        const out = farrowayBrainHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Brain]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
