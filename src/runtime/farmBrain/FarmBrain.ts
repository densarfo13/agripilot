/**
 * FarmBrain.ts — sprint #207, spec "Mythos Farm Brain V1".
 *
 * A READ-ONLY composite over the farm state the app already holds. It
 * is NOT a new datastore and NOT a new intelligence layer: it reads
 * the crop / stage / history signals other runtimes already produce
 * and shapes them into one "farm state" envelope, plus the single
 * most useful onboarding next-step for empty Home states.
 *
 * Honesty rules (gate-asserted):
 *   • satelliteHistory is ALWAYS [] — satellite is frozen (Do-Not-Build;
 *     founder #200/#206 call). FarmBrain never fabricates it.
 *   • Counts/flags reflect ONLY what was passed in. No invented data.
 *   • nextRecommendedAction returns null once real data exists — it is
 *     an onboarding aid, never a replacement for the real today-action.
 *
 * Pure. SSR-safe. Idempotent install. Never throws. Frozen returns.
 */

export const FARM_BRAIN_VERSION = 'farm-brain-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const _arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);

export interface FarmBrainState {
  runtimeVersion:   string;
  farmId:           string | null;
  crop:             string | null;
  plantingDate:     string | null;
  growthStage:      string | null;
  scanCount:        number;
  taskCount:        number;
  weatherKnown:     boolean;
  satelliteHistory: ReadonlyArray<never>; // ALWAYS [] — satellite frozen
  hasCrop:          boolean;
  hasScan:          boolean;
  hasActivity:      boolean;
  isNew:            boolean;               // no crop + no scan + no task
}

export interface FarmBrainNextAction {
  key:      string;   // i18n key root
  titleKey: string;
  title:    string;   // English fallback
  guideKey: string;
  guide:    string;
  cta:      string;   // route to navigate
}

/**
 * Compose the read-only farm-state envelope from already-known signals.
 */
export function buildFarmBrain(input: {
  farmId?: string | null;
  crop?: string | null;
  plantingDate?: string | null;
  growthStage?: string | null;
  scanHistory?: ReadonlyArray<unknown>;
  taskHistory?: ReadonlyArray<unknown>;
  weatherKnown?: boolean;
} = {}): Readonly<FarmBrainState> {
  return _safe(() => {
    const crop = _str(input.crop) || null;
    const scanCount = _arr(input.scanHistory).length;
    const taskCount = _arr(input.taskHistory).length;
    const hasCrop = !!crop;
    const hasScan = scanCount > 0;
    const hasActivity = taskCount > 0;
    return Object.freeze({
      runtimeVersion: FARM_BRAIN_VERSION,
      farmId: _str(input.farmId) || null,
      crop,
      plantingDate: _str(input.plantingDate) || null,
      growthStage: _str(input.growthStage) || null,
      scanCount,
      taskCount,
      weatherKnown: !!input.weatherKnown,
      satelliteHistory: Object.freeze([]) as ReadonlyArray<never>,
      hasCrop, hasScan, hasActivity,
      isNew: !hasCrop && !hasScan && !hasActivity,
    });
  }, Object.freeze({
    runtimeVersion: FARM_BRAIN_VERSION,
    farmId: null, crop: null, plantingDate: null, growthStage: null,
    scanCount: 0, taskCount: 0, weatherKnown: false,
    satelliteHistory: Object.freeze([]) as ReadonlyArray<never>,
    hasCrop: false, hasScan: false, hasActivity: false, isNew: true,
  }));
}

/**
 * The single most useful onboarding next-step for an empty Home state.
 * Returns null once the farmer has a real action (caller shows that
 * instead). NEVER a generic "Not enough data yet".
 */
export function nextRecommendedAction(
  brain: Partial<FarmBrainState> | null | undefined,
): Readonly<FarmBrainNextAction> | null {
  return _safe(() => {
    const b = brain || {};
    if (!b.hasCrop) {
      return Object.freeze({
        key: 'farmBrain.next.addCrop',
        titleKey: 'farmBrain.next.addCrop.title',
        title: 'Add your crop to get your first plan',
        guideKey: 'farmBrain.next.addCrop.guide',
        guide: 'Tell us your crop and planting date — we build your daily plan from there.',
        cta: '/profile',
      });
    }
    if (!b.hasScan) {
      return Object.freeze({
        key: 'farmBrain.next.firstScan',
        titleKey: 'farmBrain.next.firstScan.title',
        title: 'Scan a plant to begin',
        guideKey: 'farmBrain.next.firstScan.guide',
        guide: 'Take one clear photo of a leaf — we check it and suggest what to do.',
        cta: '/scan',
      });
    }
    if (!b.hasActivity) {
      return Object.freeze({
        key: 'farmBrain.next.startAction',
        titleKey: 'farmBrain.next.startAction.title',
        title: 'Start your first action',
        guideKey: 'farmBrain.next.startAction.guide',
        guide: 'Open today’s plan and mark your first task done.',
        cta: '/tasks',
      });
    }
    return null; // real data exists — the normal today-action shows
  }, null);
}

// NOTE: __farmBrainHealth is pinned by FarmBrainRuntime (sprint #208)
// with the spec's 7 readiness flags. This module stays the pure
// state+next-action composite; the health install lives in the
// runtime to avoid two modules racing on the same global.

export const _internal = Object.freeze({
  buildFarmBrain, nextRecommendedAction,
});
export default buildFarmBrain;
