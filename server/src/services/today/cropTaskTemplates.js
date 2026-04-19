/**
 * cropTaskTemplates.js — per-crop stage overlays the today engine
 * consults when picking the primary action.
 *
 * These templates don't replace CycleTaskPlan rows (those are
 * already persisted when a cycle starts). They're a lightweight
 * "here is the most-relevant thing to do this week" lookup the
 * engine uses as a tie-breaker when several tasks compete.
 *
 * Structure:
 *   { cropKey: { stageKey: { title, detail, priorityBoost } } }
 * Stage keys map to V2CropCycle.lifecycleStatus values.
 */

export const CROP_TASK_TEMPLATES = Object.freeze({
  tomato: {
    planned:       { title: 'Warm the soil and harden off transplants', detail: 'Tomatoes transplant best once the soil is consistently above 60°F.', priorityBoost: 4 },
    planting:      { title: 'Plant tomatoes deep and stake immediately',  detail: 'Bury up to the first leaf set and add stakes now — retrofitting later breaks roots.', priorityBoost: 8 },
    growing:       { title: 'Pinch suckers and keep watering steady',    detail: 'Remove the small shoots in the leaf forks every week.', priorityBoost: 5 },
    flowering:     { title: 'Ease off nitrogen, watch for blossom drop', detail: 'Too much nitrogen at flowering drops fruit. Keep water consistent.', priorityBoost: 6 },
    harvest_ready: { title: 'Pick ripe tomatoes daily',                  detail: 'Daily picking keeps the plant producing fruit.', priorityBoost: 9 },
  },
  lettuce: {
    planned:       { title: 'Prep a cool, shaded bed',                   detail: 'Lettuce bolts in heat — stage soil where it will get afternoon shade.', priorityBoost: 3 },
    planting:      { title: 'Sow lettuce thinly, 1/4 inch deep',         detail: 'Thin sowing avoids overcrowding and heat stress.', priorityBoost: 7 },
    growing:       { title: 'Water often but lightly',                   detail: 'Shallow roots need the top inch kept damp.', priorityBoost: 5 },
    harvest_ready: { title: 'Cut outer leaves before they bolt',         detail: 'Cut-and-come-again extends the harvest by weeks.', priorityBoost: 8 },
  },
  peanut: {
    planned:       { title: 'Deep-till the bed before planting',         detail: 'Peanuts peg into loose soil — till 6 inches deep.', priorityBoost: 4 },
    planting:      { title: 'Plant peanuts into 65°F+ soil',             detail: 'Cold soil rots the seed before it germinates.', priorityBoost: 8 },
    growing:       { title: 'Weed aggressively in the first 4 weeks',    detail: 'Weeds smother young peanuts; after 4 weeks they outrun competition.', priorityBoost: 6 },
    flowering:     { title: 'Keep water steady during pegging',          detail: 'Water stress at pegging is the biggest yield killer.', priorityBoost: 7 },
    harvest_ready: { title: 'Lift, cure, and pick',                      detail: 'Dig when shell veins darken; cure in a warm dry spot for 10 days.', priorityBoost: 8 },
  },
  sorghum: {
    planned:       { title: 'Wait for 60°F+ soil before sowing',         detail: 'Sorghum seeds rot in cold soil.', priorityBoost: 3 },
    planting:      { title: 'Seed shallow into a firm bed',              detail: '1 inch deep gives the best emergence.', priorityBoost: 7 },
    growing:       { title: 'Scout for sugarcane aphid',                 detail: 'Sugarcane aphid is the biggest yield thief in most regions.', priorityBoost: 5 },
    flowering:     { title: 'Maintain even soil moisture',               detail: 'Drought stress at boot stage cuts head fill.', priorityBoost: 6 },
    harvest_ready: { title: 'Harvest at hard dough stage',               detail: 'Grain should shatter when pressed hard.', priorityBoost: 8 },
  },
  sweet_potato: {
    planned:       { title: 'Mound the bed for slips',                   detail: 'Plant into 8–10-inch mounds for loose warm soil.', priorityBoost: 4 },
    planting:      { title: 'Plant slips, not seeds',                    detail: 'Sweet potatoes grow from rooted slips, not seeds.', priorityBoost: 8 },
    growing:       { title: 'Water steady for the first two weeks',      detail: 'Once vines spread they handle dry spells well.', priorityBoost: 5 },
    harvest_ready: { title: 'Harvest before frost, cure 10 days',        detail: 'Dig carefully, cure in a warm dry spot, then store.', priorityBoost: 8 },
  },
});

/** Resolve a template row for a crop + stage. */
export function getCropStageOverlay({ cropKey, stage }) {
  const byStage = CROP_TASK_TEMPLATES[cropKey];
  if (!byStage) return null;
  return byStage[stage] || null;
}

export const SUPPORTED_CROP_KEYS = Object.freeze(Object.keys(CROP_TASK_TEMPLATES));
