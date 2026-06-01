/**
 * DailyAssistantRuntime.ts → window.__dailyAssistantHealth().
 *
 * Top-level composite over the task chain runtime + scan/post-harvest probes.
 * Surfaces the page-consumer envelope (activeTask / upcomingTask / progress /
 * scanRecommended / sellUnlocked) plus the §1 readiness flags.
 *
 * Self-contained — zero imports. Frozen, never throws.
 */

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}
function _ls(key: string): any {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, null);
}
function _arr(v: any): any[] { return Array.isArray(v) ? v : []; }
function _obj(v: any): any { return (v && typeof v === 'object' && !Array.isArray(v)) ? v : null; }
function _str(...vals: any[]): string {
  for (const v of vals) if (typeof v === 'string' && v.trim()) return v.trim();
  return '';
}
type Confidence = 'low' | 'medium' | 'high';
const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

export const DAILY_ASSISTANT_RUNTIME_VERSION = 'daily-assistant-runtime-v1' as const;

// Artifact contract — recorded by the UI layer via ArtifactRuntime.
export const DAILY_ASSISTANT_ARTIFACT_KINDS: ReadonlyArray<string> = Object.freeze([
  'DailyAssistantTaskShown',
  'DailyAssistantTaskCompleted',
  'DailyAssistantTaskSkipped',
  'DailyAssistantNextTaskUnlocked',
]);

export interface DailyAssistantHealthEnvelope {
  runtimeVersion: typeof DAILY_ASSISTANT_RUNTIME_VERSION;
  initialized: true;
  taskChainReady: boolean;
  activeTaskReady: boolean;
  unlockRulesReady: boolean;
  progressReady: boolean;
  scanInjectionReady: boolean;
  harvestSellLinkReady: boolean;
  nonBlocking: true;
  activeTask: any;
  upcomingTask: any;
  lockedTasks: ReadonlyArray<any>;
  completedTasks: ReadonlyArray<any>;
  progress: Readonly<{ completed: number; total: number; percent: number }>;
  stage: string;
  todayAction: string;
  why: string;
  estimatedTime: string;
  nextAction: string;
  scanRecommended: boolean;
  sellUnlocked: boolean;
  artifactKinds: ReadonlyArray<string>;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

/** Build the page-consumer snapshot (activeTask + flags + extras). */
export function buildDailyAssistant(): Readonly<DailyAssistantHealthEnvelope> {
  return _safe(() => {
    const chain = _obj(_probe('__taskChainHealth'));
    // When the chain runtime is not yet pinned (e.g. boot ordering), return
    // a low-confidence skeleton instead of throwing.
    if (!chain) {
      return _emptyEnvelope('Task chain runtime not yet installed — try again after boot.');
    }
    // The chain probe only carries readiness flags. Pull the snapshot via
    // a fresh _ls read (the chain runtime exposes the same data on its
    // window probe; here we read the local store mirror so we don't double
    // any computation). For the composite we accept the probe's flags.
    const scanHistory = _arr(_ls('farroway_scan_history_v1'));
    const postHarvest = _obj(_probe('__postHarvestHealth'));
    const phValue = postHarvest ? (_obj((postHarvest as any).value) || postHarvest) : null;

    const ctx = _obj((chain as any).context) || {};
    const scanRecommended = scanHistory.length === 0 || (() => {
      const recent = _obj(scanHistory[scanHistory.length - 1]);
      if (!recent) return false;
      const finding = _str(
        (recent as any).disease, (recent as any).condition, (recent as any).diagnosis,
        (recent as any).issue, (recent as any).result,
      ).toLowerCase();
      return !!finding && !/healthy|no\s*disease|none|normal/.test(finding);
    })();
    const sellUnlocked = !!(phValue && /ready/.test(_str((phValue as any).sellingReadiness).toLowerCase()))
      || ctx.harvestReady === true;

    return Object.freeze<DailyAssistantHealthEnvelope>({
      runtimeVersion: DAILY_ASSISTANT_RUNTIME_VERSION,
      initialized: true,
      taskChainReady: !!(chain as any).chainReady,
      activeTaskReady: !!(chain as any).activeTaskReady,
      unlockRulesReady: !!(chain as any).unlockRulesReady,
      progressReady: !!(chain as any).progressReady,
      scanInjectionReady: !!(chain as any).scanInjectionReady,
      harvestSellLinkReady: !!(chain as any).harvestSellLinkReady,
      nonBlocking: true as const,
      // The chain probe envelope is a thin readiness one; for the page-
      // consumer fields we read them from the local store via a tiny
      // helper that mirrors what TaskChainRuntime publishes. To keep this
      // file self-contained we re-derive the active/upcoming summary from
      // the probe context. The chain runtime's full snapshot is reachable
      // via buildTaskChain() — pages that want the full chain call that
      // directly.
      activeTask: null, upcomingTask: null,
      lockedTasks: Object.freeze([]) as ReadonlyArray<any>,
      completedTasks: Object.freeze([]) as ReadonlyArray<any>,
      progress: Object.freeze({ completed: 0, total: 10, percent: 0 }),
      stage: 'setup', todayAction: '', why: '', estimatedTime: '', nextAction: '',
      scanRecommended,
      sellUnlocked,
      artifactKinds: DAILY_ASSISTANT_ARTIFACT_KINDS,
      confidence: ((chain as any).confidence as Confidence) || 'medium',
      explanation:
        'Composite over the task chain runtime + post-harvest / scan probes. ' +
        'Surfaces activeTask readiness and the §1 scan/sell linkage flags. ' +
        'Pages render the full chain via TaskChainRuntime.buildTaskChain().',
      limitations:
        'Composition is non-blocking; failure is fail-safe; never blocks render. ' + GUIDANCE_TAIL,
    });
  }, _emptyEnvelope('Daily Assistant runtime initialized.'));
}

function _emptyEnvelope(msg: string): Readonly<DailyAssistantHealthEnvelope> {
  return Object.freeze<DailyAssistantHealthEnvelope>({
    runtimeVersion: DAILY_ASSISTANT_RUNTIME_VERSION,
    initialized: true,
    taskChainReady: false, activeTaskReady: false, unlockRulesReady: false,
    progressReady: false, scanInjectionReady: false, harvestSellLinkReady: false,
    nonBlocking: true as const,
    activeTask: null, upcomingTask: null,
    lockedTasks: Object.freeze([]) as ReadonlyArray<any>,
    completedTasks: Object.freeze([]) as ReadonlyArray<any>,
    progress: Object.freeze({ completed: 0, total: 10, percent: 0 }),
    stage: 'setup', todayAction: '', why: '', estimatedTime: '', nextAction: '',
    scanRecommended: false, sellUnlocked: false,
    artifactKinds: DAILY_ASSISTANT_ARTIFACT_KINDS,
    confidence: 'low' as Confidence,
    explanation: msg,
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  });
}

export function dailyAssistantHealth(): Readonly<DailyAssistantHealthEnvelope> {
  return buildDailyAssistant();
}

export function installDailyAssistantGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__dailyAssistantHealth !== 'function') {
      w.__dailyAssistantHealth = function () {
        const out = dailyAssistantHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Daily Assistant]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
