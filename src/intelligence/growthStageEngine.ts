/**
 * src/intelligence/growthStageEngine.ts — unified growth stages.
 *
 *   import { GROWTH_STAGE, deriveGrowthStage, stageTasks }
 *     from 'src/intelligence/growthStageEngine';
 *
 * What this is
 * ────────────
 *   The spec calls for a unified 6-stage growth model across all
 *   grow types: Seed · Sprout · Vegetative · Flowering · Fruiting
 *   · Harvest. The existing wave-10 CROP_STAGE handles crop-side
 *   stages; this engine generalizes the same model so flowers /
 *   herbs / houseplants can plug in.
 *
 *   Composition-only — does NOT replace the wave-10 cropStageEngine.
 *   When the caller already has a wave-10 stage envelope, we map it
 *   into the unified GROWTH_STAGE vocabulary. Otherwise we derive
 *   from caller-supplied plantedAt + growthDays.
 *
 * Returns a frozen envelope:
 *   {
 *     stage:       'seed' | 'sprout' | ... | 'harvest',
 *     daysIn,
 *     daysToNext, nextStage,
 *     stageTasks:  [{ kind, priority, labelKey, labelDefault }],
 *     runtimeVersion,
 *   }
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Composition-only.
 *   • Honest 'unknown' when input is thin.
 */

export const GROWTH_STAGE_ENGINE_VERSION = 'growth-stage-engine-v1';

export const GROWTH_STAGE = Object.freeze({
  SEED:       'seed',
  SPROUT:     'sprout',
  VEGETATIVE: 'vegetative',
  FLOWERING:  'flowering',
  FRUITING:   'fruiting',
  HARVEST:    'harvest',
});

const ORDER: ReadonlyArray<string> = [
  GROWTH_STAGE.SEED, GROWTH_STAGE.SPROUT, GROWTH_STAGE.VEGETATIVE,
  GROWTH_STAGE.FLOWERING, GROWTH_STAGE.FRUITING, GROWTH_STAGE.HARVEST,
];

// Map wave-10 cropStageEngine values into the unified vocabulary.
// CROP_STAGE: SEED, GERMINATION, VEGETATIVE, FLOWERING,
//             FRUIT_DEVELOPMENT, HARVEST.
const WAVE10_MAP: Record<string, string> = {
  SEED:              GROWTH_STAGE.SEED,
  GERMINATION:       GROWTH_STAGE.SPROUT,
  VEGETATIVE:        GROWTH_STAGE.VEGETATIVE,
  FLOWERING:         GROWTH_STAGE.FLOWERING,
  FRUIT_DEVELOPMENT: GROWTH_STAGE.FRUITING,
  HARVEST:           GROWTH_STAGE.HARVEST,
};

// Default stage durations as a share of total growthDays.
// Houseplants override these per type at call time when not
// flowering or fruiting.
const STAGE_SHARE: Record<string, number> = {
  seed:       0.05,
  sprout:     0.10,
  vegetative: 0.45,
  flowering:  0.20,
  fruiting:   0.15,
  harvest:    0.05,
};

interface StageCtx {
  plantedAt?: string;
  growthDays?: number;
  growType?: string;
  wave10Stage?: { stage?: string };
  now?: number;
}

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _num   = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

const MS_PER_DAY = 86400000;

function _stageFromElapsed(elapsedDays: number, growthDays: number,
                            growType: string): string {
  // Houseplants stay 'vegetative' indefinitely unless caller
  // overrides via wave10 stage; they don't really fruit.
  if (growType === 'houseplant') return GROWTH_STAGE.VEGETATIVE;
  if (growthDays <= 0) return GROWTH_STAGE.VEGETATIVE;

  let cumulative = 0;
  for (const stage of ORDER) {
    cumulative += STAGE_SHARE[stage] * growthDays;
    if (elapsedDays <= cumulative) return stage;
  }
  return GROWTH_STAGE.HARVEST;
}

const STAGE_TASK_LIBRARY: Record<string, ReadonlyArray<any>> = {
  seed: [
    { kind: 'monitor_germination', priority: 1,
      labelKey: 'grow.stage.task.monitorGermination',
      labelDefault: 'Watch for germination — keep soil moist.' },
  ],
  sprout: [
    { kind: 'protect_seedlings', priority: 1,
      labelKey: 'grow.stage.task.protectSeedlings',
      labelDefault: 'Protect seedlings from full sun and pests.' },
  ],
  vegetative: [
    { kind: 'feed_nitrogen', priority: 1,
      labelKey: 'grow.stage.task.feedNitrogen',
      labelDefault: 'Feed nitrogen-rich fertilizer for leaf growth.' },
  ],
  flowering: [
    { kind: 'feed_phosphorus', priority: 1,
      labelKey: 'grow.stage.task.feedPhosphorus',
      labelDefault: 'Switch to a phosphorus-heavy bloom fertilizer.' },
    { kind: 'pollinator_invite', priority: 2,
      labelKey: 'grow.stage.task.pollinatorInvite',
      labelDefault: 'Avoid sprays — let pollinators visit.' },
  ],
  fruiting: [
    { kind: 'feed_potassium', priority: 1,
      labelKey: 'grow.stage.task.feedPotassium',
      labelDefault: 'Apply potassium for fruit set.' },
    { kind: 'support_stems', priority: 2,
      labelKey: 'grow.stage.task.supportStems',
      labelDefault: 'Add support for heavy fruit-bearing stems.' },
  ],
  harvest: [
    { kind: 'pick_ripe', priority: 1,
      labelKey: 'grow.stage.task.pickRipe',
      labelDefault: 'Pick ripe fruit / harvest mature produce.' },
  ],
};

export function stageTasks(stage: string) {
  return _safe(() => Object.freeze(
    (STAGE_TASK_LIBRARY[_str(stage)] || []).map((t) => Object.freeze(t))
  ), Object.freeze([] as any[]));
}

export function deriveGrowthStage(ctx: StageCtx) {
  return _safe(() => {
    const c = _isObj(ctx) ? ctx : {} as StageCtx;

    // 1. Prefer caller-supplied wave-10 cropStageEngine output.
    if (_isObj(c.wave10Stage)) {
      const mapped = WAVE10_MAP[_str(c.wave10Stage.stage)];
      if (mapped) {
        return Object.freeze({
          runtimeVersion: GROWTH_STAGE_ENGINE_VERSION,
          stage: mapped,
          source: 'wave10_map',
          daysIn: null,
          daysToNext: null,
          nextStage: _str(ORDER[ORDER.indexOf(mapped) + 1] || ''),
          stageTasks: stageTasks(mapped),
        });
      }
    }

    // 2. Derive from plantedAt + growthDays.
    const plantedMs = _safe(() =>
      new Date(_str(c.plantedAt)).getTime(), NaN);
    const nowMs     = _num(c.now) || Date.now();
    const growthDays = _num(c.growthDays);

    if (!Number.isFinite(plantedMs) || growthDays == null) {
      return Object.freeze({
        runtimeVersion: GROWTH_STAGE_ENGINE_VERSION,
        stage: 'unknown',
        source: 'insufficient_input',
        daysIn: null,
        daysToNext: null,
        nextStage: '',
        stageTasks: Object.freeze([]),
      });
    }

    const elapsedDays = Math.floor((nowMs - plantedMs) / MS_PER_DAY);
    const stage = _stageFromElapsed(elapsedDays, growthDays,
      _str(c.growType));
    const idx = ORDER.indexOf(stage);
    const nextStage = idx >= 0 && idx < ORDER.length - 1
      ? ORDER[idx + 1] : '';

    let cumDays = 0;
    for (const s of ORDER) {
      cumDays += STAGE_SHARE[s] * growthDays;
      if (s === stage) break;
    }
    const daysToNext = Math.max(0,
      Math.round(cumDays - elapsedDays));

    return Object.freeze({
      runtimeVersion: GROWTH_STAGE_ENGINE_VERSION,
      stage,
      source: 'derived',
      daysIn: Math.max(0, elapsedDays),
      daysToNext,
      nextStage,
      stageTasks: stageTasks(stage),
    });
  }, Object.freeze({
    runtimeVersion: GROWTH_STAGE_ENGINE_VERSION,
    stage: 'unknown',
    source: 'error',
    daysIn: null, daysToNext: null, nextStage: '',
    stageTasks: Object.freeze([]),
  }));
}

export { ORDER as GROWTH_STAGE_ORDER };
