/**
 * FarrowayActionContextRuntime.ts → window.__actionContextHealth().
 *
 * The cross-page action context — a single read-only diagnostic that
 * composes the active grow / crop / stage / top action so My Farm,
 * Funding, Sell, Activity, Tasks, Notifications can all share the same
 * "what's the user actually doing right now" view without re-querying.
 *
 * Read-only. Composes existing probes by name (no deep imports).
 * Frozen envelopes; never throws; never blocks any page render.
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

export const FARROWAY_ACTION_CONTEXT_VERSION = 'farroway-action-context-v1' as const;

export interface ActionContext {
  activeGrowId: string | null;
  growerType: 'farmer' | 'gardener';
  cropKey: string | null;
  cropName: string | null;
  stage: string | null;
  topAction: string;
  reason: string;
  estimatedEffort: string;
  riskLevel: 'low' | 'medium' | 'high' | 'unknown';
  nextMilestone: string;
  harvestWindow: string;
  sellReadiness: 'not_ready' | 'preparing' | 'ready' | 'unknown';
  fundingRelevance: 'low' | 'medium' | 'high' | 'unknown';
  scanRecommended: boolean;
  dataGaps: ReadonlyArray<string>;
}

export interface ActionContextHealthEnvelope {
  runtimeVersion: typeof FARROWAY_ACTION_CONTEXT_VERSION;
  initialized: true;
  activeGrowReady: boolean;
  topActionReady: boolean;
  lifecycleReady: boolean;
  taskLinkReady: boolean;
  scanLinkReady: boolean;
  harvestLinkReady: boolean;
  nonBlocking: true;
  context: Readonly<ActionContext>;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

function _growerType(): 'farmer' | 'gardener' {
  return _safe(() => {
    const farm = _obj(_ls('farroway_active_farm'));
    const profile = _obj(_ls('farroway_user_profile'));
    const raw = _str(
      farm && (farm.growerType || farm.mode || farm.type || farm.kind),
      profile && (profile.growerType || profile.mode || profile.type || profile.role),
    ).toLowerCase();
    if (/garden|hobby|home|pot|balcony|indoor/.test(raw)) return 'gardener';
    return 'farmer';
  }, 'farmer');
}

function _harvestWindow(timeframeProbe: any): string {
  return _safe(() => {
    const o = _obj(timeframeProbe);
    if (!o) return 'Approximate harvest range not available yet.';
    const v = _obj((o as any).value) || o;
    const range = _str((v as any).approxRange, (v as any).timeframe, (v as any).range,
      (v as any).harvestWindow, (v as any).estimate);
    return range ? (range + (/approx|about|~|-/.test(range) ? '' : ' (approximate)')) : 'Approximate harvest range not set.';
  }, 'Approximate harvest range not available yet.');
}

/** Build the read-only action context. Never throws; always returns frozen. */
function _buildContext(): Readonly<ActionContext> {
  return _safe(() => {
    // Pull the active grow + recent plant from real local stores only.
    const farm = _obj(_ls('farroway_active_farm'));
    const plants = _arr(_ls('farroway_managed_plants'));
    const focus = plants.length ? _obj(plants[plants.length - 1]) : null;

    const dailyPlanProbe = _probe('__dailyFarmPlanHealth');
    const cropLifecycleProbe = _probe('__cropLifecycleHealth');
    const growTimeframeProbe = _probe('__growTimeframeHealth');
    const postHarvestProbe = _probe('__postHarvestHealth');
    const dailyPlanData = _safe(() => (window as any).buildDailyPlan ? (window as any).buildDailyPlan({}) : null, null);

    // Compose top action from the daily plan if available.
    let topAction = 'Open Farroway daily to check on your plants.';
    let reason = 'Daily care helps your crops stay healthy.';
    let estimatedEffort = '5 min';
    let nextMilestone = 'Pick a crop to see your first milestone.';
    const dp = _obj(dailyPlanData) || _obj(dailyPlanProbe);
    if (dp) {
      const tasks = _arr((dp as any).tasks);
      const t = _obj(tasks[0]);
      if (t) {
        topAction = _str((t as any).title) || topAction;
        reason = _str((t as any).explanation) || reason;
        estimatedEffort = _str((t as any).estimatedEffort) || estimatedEffort;
      }
      nextMilestone = _str((dp as any).nextMilestone) || nextMilestone;
    }

    // Stage from the lifecycle envelope, if present.
    let stage: string | null = null;
    const cl = _obj(cropLifecycleProbe);
    if (cl) stage = _str((cl as any).currentStage) || null;

    // Sell readiness from post-harvest probe + harvest events.
    const ph = _obj(postHarvestProbe);
    let sellReadiness: ActionContext['sellReadiness'] = 'unknown';
    if (ph) {
      const sr = _str((ph as any).sellingReadiness).toLowerCase();
      if (/ready/.test(sr)) sellReadiness = 'ready';
      else if (/prepar|draft/.test(sr)) sellReadiness = 'preparing';
      else sellReadiness = 'not_ready';
    }

    // Crop identity.
    const cropName = focus ? _str((focus as any).cropName, (focus as any).crop, (focus as any).commonName, (focus as any).name) : '';
    const cropKey = focus ? _str((focus as any).cropKey, (focus as any).id, (focus as any).slug) : '';

    // Data gaps — honest list of what's missing for the recommendation surface.
    const gaps: string[] = [];
    if (!focus) gaps.push('No saved crop yet.');
    if (!cl) gaps.push('Crop lifecycle stage not available yet.');
    if (!ph) gaps.push('Post-harvest guidance not loaded yet.');

    const scanRecommended = !!focus && !_arr(_ls('farroway_scan_history_v1')).length;

    return Object.freeze<ActionContext>({
      activeGrowId: focus ? _str((focus as any).id, (focus as any).slug) || null : null,
      growerType: _growerType(),
      cropKey: cropKey || null,
      cropName: cropName || null,
      stage,
      topAction,
      reason,
      estimatedEffort,
      riskLevel: 'unknown',
      nextMilestone,
      harvestWindow: _harvestWindow(growTimeframeProbe),
      sellReadiness,
      fundingRelevance: cropKey ? 'medium' : 'unknown',
      scanRecommended,
      dataGaps: Object.freeze(gaps) as ReadonlyArray<string>,
    });
  }, Object.freeze<ActionContext>({
    activeGrowId: null, growerType: 'farmer', cropKey: null, cropName: null, stage: null,
    topAction: 'Open Farroway daily to check on your plants.',
    reason: 'Daily care helps your crops stay healthy.',
    estimatedEffort: '5 min',
    riskLevel: 'unknown', nextMilestone: 'Add a crop to start.',
    harvestWindow: 'Approximate harvest range not available yet.',
    sellReadiness: 'unknown', fundingRelevance: 'unknown',
    scanRecommended: false,
    dataGaps: Object.freeze(['Not enough data yet.']) as ReadonlyArray<string>,
  }));
}

export function buildActionContext(): Readonly<ActionContext> {
  return _buildContext();
}

export function actionContextHealth(): Readonly<ActionContextHealthEnvelope> {
  return _safe(() => {
    const ctx = _buildContext();
    return Object.freeze({
      runtimeVersion: FARROWAY_ACTION_CONTEXT_VERSION,
      initialized: true,
      activeGrowReady: !!ctx.activeGrowId,
      topActionReady: typeof ctx.topAction === 'string' && ctx.topAction.length > 0,
      lifecycleReady: !!_probe('__cropLifecycleHealth'),
      taskLinkReady: !!_probe('__dailyPlanTaskHealth'),
      scanLinkReady: !!_probe('__dailyPlanScanHealth'),
      harvestLinkReady: !!_probe('__postHarvestHealth'),
      nonBlocking: true as const,
      context: ctx,
      confidence: (ctx.activeGrowId ? 'high' : 'medium') as Confidence,
      explanation:
        'Cross-page action context composes the active grow, crop, stage, top action, harvest ' +
        'window, sell readiness, and data gaps. Pages read this to render an action-first surface.',
      limitations:
        'Composition is non-blocking; failure is fail-safe; never blocks any page render. ' + GUIDANCE_TAIL,
    });
  }, Object.freeze({
    runtimeVersion: FARROWAY_ACTION_CONTEXT_VERSION,
    initialized: true,
    activeGrowReady: false, topActionReady: false, lifecycleReady: false,
    taskLinkReady: false, scanLinkReady: false, harvestLinkReady: false,
    nonBlocking: true as const,
    context: _buildContext(),
    confidence: 'low' as Confidence,
    explanation: 'Action context runtime initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }) as ActionContextHealthEnvelope);
}

export function installActionContextGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__actionContextHealth !== 'function') {
      w.__actionContextHealth = function () {
        const out = actionContextHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Action Context]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
