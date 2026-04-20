/**
 * dailyTaskRules.js — v1 starter task rules for the daily task
 * engine.
 *
 * Shape:
 *   RULES[stage] = {
 *     generic: Task[]        // crop-agnostic fallback (always available)
 *     crops?: {              // optional crop-specific overrides
 *       [cropCode]: Task[]
 *     }
 *   }
 *
 * Task:
 *   {
 *     id:        stable string (for completion dedup + analytics)
 *     titleKey:  i18n key (hardcoded fallback lives in translations.js)
 *     whyKey:    i18n key
 *     priority:  'high' | 'medium' | 'low'
 *     dueHint:   'today' | 'this_week' | 'soon'
 *     note?:     optional farmer-friendly note
 *   }
 *
 * Stages (spec §3):
 *   pre_planting | planting | early_growth | mid_growth
 *   | harvest | post_harvest
 *
 * Adding a crop override is a one-line addition — the engine will
 * prefer the override list when it exists, else fall back to the
 * generic list.
 */

const freeze = Object.freeze;

// ─── Pre-planting (land prep, seed, inputs) ───────────────────────
const PRE_PLANTING = freeze({
  generic: freeze([
    freeze({ id: 'pre_planting.clear_land',      titleKey: 'daily.pre_planting.clear_land.title',      whyKey: 'daily.pre_planting.clear_land.why',      priority: 'high',   dueHint: 'today'    }),
    freeze({ id: 'pre_planting.check_drainage',  titleKey: 'daily.pre_planting.check_drainage.title',  whyKey: 'daily.pre_planting.check_drainage.why',  priority: 'medium', dueHint: 'this_week' }),
    freeze({ id: 'pre_planting.source_seed',     titleKey: 'daily.pre_planting.source_seed.title',     whyKey: 'daily.pre_planting.source_seed.why',     priority: 'high',   dueHint: 'this_week' }),
    freeze({ id: 'pre_planting.mark_rows',       titleKey: 'daily.pre_planting.mark_rows.title',       whyKey: 'daily.pre_planting.mark_rows.why',       priority: 'medium', dueHint: 'this_week' }),
  ]),
  crops: freeze({
    cassava: freeze([
      freeze({ id: 'pre_planting.prepare_ridges',    titleKey: 'daily.pre_planting.prepare_ridges.title',    whyKey: 'daily.pre_planting.prepare_ridges.why',    priority: 'high',   dueHint: 'this_week' }),
      freeze({ id: 'pre_planting.source_cuttings',   titleKey: 'daily.pre_planting.source_cuttings.title',   whyKey: 'daily.pre_planting.source_cuttings.why',   priority: 'high',   dueHint: 'this_week' }),
      freeze({ id: 'pre_planting.check_drainage',    titleKey: 'daily.pre_planting.check_drainage.title',    whyKey: 'daily.pre_planting.check_drainage.why',    priority: 'medium', dueHint: 'this_week' }),
    ]),
    rice: freeze([
      freeze({ id: 'pre_planting.plan_water',        titleKey: 'daily.pre_planting.plan_water.title',        whyKey: 'daily.pre_planting.plan_water.why',        priority: 'high',   dueHint: 'this_week' }),
      freeze({ id: 'pre_planting.source_seed',       titleKey: 'daily.pre_planting.source_seed.title',       whyKey: 'daily.pre_planting.source_seed.why',       priority: 'high',   dueHint: 'this_week' }),
      freeze({ id: 'pre_planting.clear_land',        titleKey: 'daily.pre_planting.clear_land.title',        whyKey: 'daily.pre_planting.clear_land.why',        priority: 'medium', dueHint: 'today'    }),
    ]),
  }),
});

// ─── Planting ─────────────────────────────────────────────────────
const PLANTING = freeze({
  generic: freeze([
    freeze({ id: 'planting.plant_seed',       titleKey: 'daily.planting.plant_seed.title',       whyKey: 'daily.planting.plant_seed.why',       priority: 'high',   dueHint: 'today'     }),
    freeze({ id: 'planting.confirm_spacing',  titleKey: 'daily.planting.confirm_spacing.title',  whyKey: 'daily.planting.confirm_spacing.why',  priority: 'medium', dueHint: 'today'     }),
    freeze({ id: 'planting.water_after',      titleKey: 'daily.planting.water_after.title',      whyKey: 'daily.planting.water_after.why',      priority: 'medium', dueHint: 'this_week' }),
  ]),
  crops: freeze({
    maize: freeze([
      freeze({ id: 'planting.plant_seed',       titleKey: 'daily.planting.plant_seed.title',      whyKey: 'daily.planting.plant_seed.why',      priority: 'high',   dueHint: 'today' }),
      freeze({ id: 'planting.confirm_spacing',  titleKey: 'daily.planting.confirm_spacing.title', whyKey: 'daily.planting.confirm_spacing.why', priority: 'high',   dueHint: 'today' }),
      freeze({ id: 'planting.water_after',      titleKey: 'daily.planting.water_after.title',     whyKey: 'daily.planting.water_after.why',     priority: 'medium', dueHint: 'this_week' }),
    ]),
    rice: freeze([
      freeze({ id: 'planting.flood_field',      titleKey: 'daily.planting.flood_field.title',    whyKey: 'daily.planting.flood_field.why',    priority: 'high', dueHint: 'today' }),
      freeze({ id: 'planting.plant_seed',       titleKey: 'daily.planting.plant_seed.title',     whyKey: 'daily.planting.plant_seed.why',     priority: 'high', dueHint: 'today' }),
    ]),
  }),
});

// ─── Early growth (0–30 days after planting) ──────────────────────
const EARLY_GROWTH = freeze({
  generic: freeze([
    freeze({ id: 'early.inspect_emergence',  titleKey: 'daily.early.inspect_emergence.title',  whyKey: 'daily.early.inspect_emergence.why',  priority: 'high',   dueHint: 'today'     }),
    freeze({ id: 'early.weed_control',       titleKey: 'daily.early.weed_control.title',       whyKey: 'daily.early.weed_control.why',       priority: 'medium', dueHint: 'this_week' }),
    freeze({ id: 'early.check_pests',        titleKey: 'daily.early.check_pests.title',        whyKey: 'daily.early.check_pests.why',        priority: 'medium', dueHint: 'this_week' }),
  ]),
  crops: freeze({
    cassava: freeze([
      freeze({ id: 'early.weed_control',       titleKey: 'daily.early.weed_control.title',       whyKey: 'daily.early.weed_control.why',       priority: 'high',   dueHint: 'this_week' }),
      freeze({ id: 'early.inspect_emergence',  titleKey: 'daily.early.inspect_emergence.title',  whyKey: 'daily.early.inspect_emergence.why',  priority: 'medium', dueHint: 'today'    }),
      freeze({ id: 'early.check_pests',        titleKey: 'daily.early.check_pests.title',        whyKey: 'daily.early.check_pests.why',        priority: 'medium', dueHint: 'this_week' }),
    ]),
    maize: freeze([
      freeze({ id: 'early.inspect_emergence',  titleKey: 'daily.early.inspect_emergence.title',  whyKey: 'daily.early.inspect_emergence.why',  priority: 'high',   dueHint: 'today'    }),
      freeze({ id: 'early.apply_fertilizer',   titleKey: 'daily.early.apply_fertilizer.title',   whyKey: 'daily.early.apply_fertilizer.why',   priority: 'medium', dueHint: 'this_week' }),
      freeze({ id: 'early.weed_control',       titleKey: 'daily.early.weed_control.title',       whyKey: 'daily.early.weed_control.why',       priority: 'medium', dueHint: 'this_week' }),
    ]),
  }),
});

// ─── Mid growth (30+ days; active management) ─────────────────────
const MID_GROWTH = freeze({
  generic: freeze([
    freeze({ id: 'mid.monitor_moisture',  titleKey: 'daily.mid.monitor_moisture.title',  whyKey: 'daily.mid.monitor_moisture.why',  priority: 'medium', dueHint: 'today'     }),
    freeze({ id: 'mid.check_pests',       titleKey: 'daily.mid.check_pests.title',       whyKey: 'daily.mid.check_pests.why',       priority: 'medium', dueHint: 'this_week' }),
    freeze({ id: 'mid.weed_control',      titleKey: 'daily.mid.weed_control.title',      whyKey: 'daily.mid.weed_control.why',      priority: 'medium', dueHint: 'this_week' }),
    freeze({ id: 'mid.topdress',          titleKey: 'daily.mid.topdress.title',          whyKey: 'daily.mid.topdress.why',          priority: 'low',    dueHint: 'this_week' }),
  ]),
  crops: freeze({
    rice: freeze([
      freeze({ id: 'mid.manage_water',      titleKey: 'daily.mid.manage_water.title',      whyKey: 'daily.mid.manage_water.why',      priority: 'high',   dueHint: 'today'     }),
      freeze({ id: 'mid.check_pests',       titleKey: 'daily.mid.check_pests.title',       whyKey: 'daily.mid.check_pests.why',       priority: 'medium', dueHint: 'this_week' }),
      freeze({ id: 'mid.weed_control',      titleKey: 'daily.mid.weed_control.title',      whyKey: 'daily.mid.weed_control.why',      priority: 'medium', dueHint: 'this_week' }),
    ]),
  }),
});

// ─── Harvest ──────────────────────────────────────────────────────
const HARVEST = freeze({
  generic: freeze([
    freeze({ id: 'harvest.check_readiness',  titleKey: 'daily.harvest.check_readiness.title',  whyKey: 'daily.harvest.check_readiness.why',  priority: 'high',   dueHint: 'today'    }),
    freeze({ id: 'harvest.prepare_tools',    titleKey: 'daily.harvest.prepare_tools.title',    whyKey: 'daily.harvest.prepare_tools.why',    priority: 'medium', dueHint: 'today'    }),
    freeze({ id: 'harvest.plan_labour',      titleKey: 'daily.harvest.plan_labour.title',      whyKey: 'daily.harvest.plan_labour.why',      priority: 'medium', dueHint: 'this_week' }),
  ]),
});

// ─── Post-harvest ─────────────────────────────────────────────────
const POST_HARVEST = freeze({
  generic: freeze([
    freeze({ id: 'post.dry_and_store',    titleKey: 'daily.post.dry_and_store.title',    whyKey: 'daily.post.dry_and_store.why',    priority: 'high',   dueHint: 'today'     }),
    freeze({ id: 'post.record_yield',     titleKey: 'daily.post.record_yield.title',     whyKey: 'daily.post.record_yield.why',     priority: 'medium', dueHint: 'this_week' }),
    freeze({ id: 'post.plan_next_cycle',  titleKey: 'daily.post.plan_next_cycle.title',  whyKey: 'daily.post.plan_next_cycle.why',  priority: 'medium', dueHint: 'this_week' }),
  ]),
});

export const RULES = freeze({
  pre_planting: PRE_PLANTING,
  planting:     PLANTING,
  early_growth: EARLY_GROWTH,
  mid_growth:   MID_GROWTH,
  harvest:      HARVEST,
  post_harvest: POST_HARVEST,
});

export const SUPPORTED_STAGES = freeze([
  'pre_planting', 'planting', 'early_growth', 'mid_growth', 'harvest', 'post_harvest',
]);

export const PRIORITY_RANK = freeze({ high: 0, medium: 1, low: 2 });

/**
 * PLANTING_STATUS_TO_STAGE — v1 mapping used when the caller only
 * knows a high-level status rather than the fine-grained stage.
 */
export const PLANTING_STATUS_TO_STAGE = freeze({
  not_started:  'pre_planting',
  planted:      'planting',
  growing:      'early_growth',
  near_harvest: 'harvest',
});

export const _internal = freeze({
  PRE_PLANTING, PLANTING, EARLY_GROWTH, MID_GROWTH, HARVEST, POST_HARVEST,
});
