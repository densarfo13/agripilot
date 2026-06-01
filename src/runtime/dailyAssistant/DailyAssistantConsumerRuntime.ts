/**
 * DailyAssistantConsumerRuntime.ts → window.__dailyAssistantConsumerHealth().
 *
 * Tracks which pages have been migrated to consume DailyAssistantRuntime /
 * TaskChainRuntime (instead of the legacy buildDailyPlan() path or static
 * placeholders). Honest false-by-default — only flips a flag to true when
 * the corresponding page-level marker is observed at runtime via DOM
 * attestation OR via a recorded ConsumerIntegrationReady artifact.
 *
 * The page-level markers are simple `data-consumes="dailyAssistant"`
 * attributes on the surfaces' top-level container. Pages add the marker
 * when they call TaskChainRuntime.buildTaskChain() or read
 * __dailyAssistantHealth() for their primary action source.
 *
 * Self-contained. Frozen, never throws.
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
type Confidence = 'low' | 'medium' | 'high';
const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

export const DAILY_ASSISTANT_CONSUMER_VERSION = 'daily-assistant-consumer-v1' as const;

export interface DailyAssistantConsumerEnvelope {
  runtimeVersion: typeof DAILY_ASSISTANT_CONSUMER_VERSION;
  initialized: true;
  // Integration flags — boolean (not literal-true) because they reflect
  // real per-page adoption. Pages that have migrated set their marker.
  homeIntegrated: boolean;
  tasksIntegrated: boolean;
  myFarmIntegrated: boolean;
  activityIntegrated: boolean;
  fundingIntegrated: boolean;
  sellIntegrated: boolean;
  progressIntegrated: boolean;
  voiceIntegrated: boolean;
  // Live DOM attestations (best-effort, only meaningful after a page renders).
  domAttests: Readonly<{
    homeMarker: boolean;
    tasksMarker: boolean;
    myFarmMarker: boolean;
    activityMarker: boolean;
    fundingMarker: boolean;
    sellMarker: boolean;
    progressMarker: boolean;
    voiceMarker: boolean;
  }>;
  // Composed snapshot of the Daily Assistant active surface (single source
  // of truth that all pages should render).
  activeTaskId: string | null;
  activeTaskTitle: string | null;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

/** Best-effort DOM attestation; never throws. Markers are written by the
 *  consuming pages as `data-consumes="dailyAssistant"` on their root. */
function _domMarkers() {
  return _safe(() => {
    if (typeof document === 'undefined') {
      return {
        homeMarker: false, tasksMarker: false, myFarmMarker: false,
        activityMarker: false, fundingMarker: false, sellMarker: false,
        progressMarker: false, voiceMarker: false,
      };
    }
    const sel = (id: string) => !!document.querySelector(
      `[data-consumes="dailyAssistant"][data-surface="${id}"]`,
    );
    return {
      homeMarker: sel('home'),
      tasksMarker: sel('tasks'),
      myFarmMarker: sel('my-farm'),
      activityMarker: sel('activity'),
      fundingMarker: sel('funding'),
      sellMarker: sel('sell'),
      progressMarker: sel('progress'),
      voiceMarker: sel('voice'),
    };
  }, { homeMarker: false, tasksMarker: false, myFarmMarker: false,
       activityMarker: false, fundingMarker: false, sellMarker: false,
       progressMarker: false, voiceMarker: false });
}

/** Recorded artifact log — pages can append ConsumerIntegrationReady rows
 *  during boot/render to persist the integration claim across DOM changes. */
function _artifactsByKind(): Set<string> {
  return _safe(() => {
    const list = _ls('farroway_consumer_integration_log');
    const out = new Set<string>();
    if (!Array.isArray(list)) return out;
    for (const r of list) {
      if (r && typeof r === 'object' && typeof (r as any).surface === 'string')
        out.add((r as any).surface);
    }
    return out;
  }, new Set<string>());
}

export function dailyAssistantConsumerHealth(): Readonly<DailyAssistantConsumerEnvelope> {
  return _safe(() => {
    const dom = _domMarkers();
    const recorded = _artifactsByKind();
    const da = _probe('__dailyAssistantHealth');
    const chain = _probe('__taskChainHealth');
    const activeTaskTitle = _safe(() => {
      // Best-effort: pull the active task title from window state if the
      // chain runtime exposes it. We re-derive it cheaply.
      if (typeof window === 'undefined') return null;
      // Pages render the active task into a data-active-task-title attribute
      // so any tab can read it without re-running the chain logic.
      const el = typeof document !== 'undefined'
        ? document.querySelector('[data-active-task-title]')
        : null;
      return el ? el.getAttribute('data-active-task-title') : null;
    }, null);
    const activeTaskId = _safe(() => {
      if (typeof document === 'undefined') return null;
      const el = document.querySelector('[data-active-task-id]');
      return el ? el.getAttribute('data-active-task-id') : null;
    }, null);

    const integrated = (surface: string, marker: boolean): boolean =>
      marker || recorded.has(surface);

    return Object.freeze<DailyAssistantConsumerEnvelope>({
      runtimeVersion: DAILY_ASSISTANT_CONSUMER_VERSION,
      initialized: true,
      homeIntegrated: integrated('home', dom.homeMarker),
      tasksIntegrated: integrated('tasks', dom.tasksMarker),
      myFarmIntegrated: integrated('my-farm', dom.myFarmMarker),
      activityIntegrated: integrated('activity', dom.activityMarker),
      fundingIntegrated: integrated('funding', dom.fundingMarker),
      sellIntegrated: integrated('sell', dom.sellMarker),
      progressIntegrated: integrated('progress', dom.progressMarker),
      voiceIntegrated: integrated('voice', dom.voiceMarker),
      domAttests: Object.freeze(dom),
      activeTaskId,
      activeTaskTitle,
      confidence: (da && chain ? 'high' : 'medium') as Confidence,
      explanation:
        'Tracks which pages consume DailyAssistantRuntime / TaskChainRuntime via DOM markers ' +
        '(data-consumes="dailyAssistant" + data-surface=...) and recorded ConsumerIntegrationReady ' +
        'artifacts. Honest false until a page is actually migrated.',
      limitations:
        'DOM attestations only meaningful after the page renders; recorded artifacts persist across navigation. '
        + GUIDANCE_TAIL,
    });
  }, Object.freeze<DailyAssistantConsumerEnvelope>({
    runtimeVersion: DAILY_ASSISTANT_CONSUMER_VERSION,
    initialized: true,
    homeIntegrated: false, tasksIntegrated: false, myFarmIntegrated: false,
    activityIntegrated: false, fundingIntegrated: false, sellIntegrated: false,
    progressIntegrated: false, voiceIntegrated: false,
    domAttests: Object.freeze({
      homeMarker: false, tasksMarker: false, myFarmMarker: false,
      activityMarker: false, fundingMarker: false, sellMarker: false,
      progressMarker: false, voiceMarker: false,
    }),
    activeTaskId: null, activeTaskTitle: null,
    confidence: 'low' as Confidence,
    explanation: 'Consumer health runtime initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }));
}

/** Append a ConsumerIntegrationReady artifact for the given surface. Pages
 *  call this once during mount so the diagnostic persists across DOM
 *  re-renders. */
export function recordConsumerIntegration(surface: string): void {
  _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (!surface || typeof surface !== 'string') return;
    const KEY = 'farroway_consumer_integration_log';
    const raw = window.localStorage.getItem(KEY);
    const list = _safe(() => { const p = JSON.parse(raw || '[]'); return Array.isArray(p) ? p : []; }, []);
    // Idempotency — skip if this surface was already recorded.
    if (list.some((r: any) => r && r.surface === surface)) return;
    list.push({ kind: 'ConsumerIntegrationReady', surface, ts: Date.now() });
    const bounded = list.length > 100 ? list.slice(list.length - 100) : list;
    window.localStorage.setItem(KEY, JSON.stringify(bounded));
  }, undefined);
}

export function installDailyAssistantConsumerGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__dailyAssistantConsumerHealth !== 'function') {
      w.__dailyAssistantConsumerHealth = function () {
        const out = dailyAssistantConsumerHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Consumer]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
