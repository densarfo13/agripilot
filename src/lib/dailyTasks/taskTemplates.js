/**
 * taskTemplates.js — small, opinionated task library for the
 * daily-task engine.
 *
 * Shape:
 *   TEMPLATES[stage] = {
 *     generic: Template[]
 *     crops?: { [cropCode]: Template[] }
 *   }
 *
 * Template:
 *   {
 *     id:        stable string (used for completion dedup)
 *     type:      'irrigation' | 'pest' | 'nutrient' | 'weeding'
 *                  | 'harvest' | 'land_prep' | 'scout' | 'storage'
 *     priority:  'high' | 'medium' | 'low'
 *     title:     short imperative line
 *     description: one-sentence how-to
 *     why:       one-sentence reason (drives the "Why this?" bubble)
 *   }
 *
 * Kept intentionally small — the engine picks 1 high + 1–2 medium +
 * maybe 1 low per day, so a template pool of ~6–10 items per stage
 * comfortably covers a season without repeating every day.
 */

const t = Object.freeze;

// ─── Pre-planting ────────────────────────────────────────────────
const PRE_PLANTING = t({
  generic: t([
    t({ id: 'prep.clear_land', type: 'land_prep', priority: 'high',
        title: 'Clear the field of weeds and debris',
        description: 'Remove tall grass, stumps, and leftover crop residue from the plot.',
        why: 'A clean field gives seedlings the best start and cuts pest hiding spots.' }),
    t({ id: 'prep.check_soil', type: 'land_prep', priority: 'medium',
        title: 'Check the soil is workable',
        description: 'Squeeze a handful of soil — it should crumble, not ball up tightly.',
        why: 'Planting into soggy soil compacts it and drowns new roots.' }),
    t({ id: 'prep.source_inputs', type: 'land_prep', priority: 'medium',
        title: 'Source seed, fertiliser and tools',
        description: 'Buy or set aside what you need before planting day so nothing delays you.',
        why: 'Last-minute supply runs lose a planting window, and prices jump at peak.' }),
    t({ id: 'prep.plan_rows', type: 'land_prep', priority: 'low',
        title: 'Plan the row layout',
        description: 'Decide row spacing now and mark it with pegs and string.',
        why: 'Even spacing makes weeding, spraying, and harvest much easier later.' }),
  ]),
  crops: t({
    rice: t([
      t({ id: 'prep.rice.bund', type: 'land_prep', priority: 'high',
          title: 'Inspect and rebuild paddy bunds',
          description: 'Walk every bund and reinforce any weak or broken sections.',
          why: 'Strong bunds hold water evenly; a broken one drains the whole paddy.' }),
    ]),
  }),
});

// ─── Planting / early growth ─────────────────────────────────────
const PLANTING = t({
  generic: t([
    t({ id: 'plant.sow_today', type: 'land_prep', priority: 'high',
        title: 'Plant the next section of the field',
        description: 'Sow the planned rows today while the soil conditions are right.',
        why: 'Planting on time keeps the crop in sync with the rains and market.' }),
    t({ id: 'plant.check_germination', type: 'scout', priority: 'medium',
        title: 'Check germination in seeded rows',
        description: 'Walk the rows and count seedlings in a few metres of each.',
        why: 'Spotting thin rows early lets you replant gaps before weeds take over.' }),
    t({ id: 'plant.water_seedlings', type: 'irrigation', priority: 'medium',
        title: 'Water young seedlings gently',
        description: 'Use a watering can or low-pressure hose — avoid washing seed out.',
        why: 'Young roots dry out fast, and a missed watering can set growth back a week.' }),
    t({ id: 'plant.apply_starter', type: 'nutrient', priority: 'low',
        title: 'Apply starter fertiliser if planned',
        description: 'Side-dress a small dose along the row; keep it off the leaves.',
        why: 'A small starter dose powers fast early growth before heavier feeding.' }),
  ]),
});

// ─── Mid-growth (the bulk of the season) ─────────────────────────
const MID_GROWTH = t({
  generic: t([
    t({ id: 'mid.scout_pests', type: 'pest', priority: 'high',
        title: 'Scout the field for pests and damage',
        description: 'Walk the rows and check underside of leaves for eggs, holes or unusual spots.',
        why: 'Catching pests early keeps treatment cheap and contained.' }),
    t({ id: 'mid.weed_inspection', type: 'weeding', priority: 'medium',
        title: 'Weed the most crowded rows',
        description: 'Pull or hoe weeds in the rows where the crop looks smallest.',
        why: 'Weeds drink water and feed the crop needs — removing them boosts yield.' }),
    t({ id: 'mid.check_moisture', type: 'irrigation', priority: 'medium',
        title: 'Check soil moisture in 3 spots',
        description: 'Push a finger 5 cm into the soil; it should feel cool and slightly damp.',
        why: 'Visual checks miss dry spots — the finger test catches them.' }),
    t({ id: 'mid.side_dress', type: 'nutrient', priority: 'low',
        title: 'Side-dress fertiliser if due',
        description: 'Apply your second-round fertiliser along the rows if the schedule says so.',
        why: 'Mid-season feeding fuels the grain/pod/tuber filling stage.' }),
    t({ id: 'mid.record_growth', type: 'scout', priority: 'low',
        title: 'Record a growth check',
        description: 'Take a quick photo or note of how the crop looks today.',
        why: 'A weekly record makes problems obvious weeks before they hurt yield.' }),
  ]),
});

// ─── Harvest ─────────────────────────────────────────────────────
const HARVEST = t({
  generic: t([
    t({ id: 'harvest.check_readiness', type: 'harvest', priority: 'high',
        title: 'Test if the crop is ready to harvest',
        description: 'Sample a few plants — check for the usual readiness signs (colour, firmness, dryness).',
        why: 'Harvesting at peak readiness locks in the best quality and price.' }),
    t({ id: 'harvest.prepare_tools', type: 'harvest', priority: 'medium',
        title: 'Prepare harvest tools and containers',
        description: 'Clean baskets, bags and cutting tools so nothing slows the team down.',
        why: 'Missing tools mid-harvest costs hours — and crop left in the sun loses quality.' }),
    t({ id: 'harvest.arrange_storage', type: 'storage', priority: 'medium',
        title: 'Clear and clean the storage area',
        description: 'Sweep out the store, check for pests, and line shelves or bags.',
        why: 'Clean storage is the difference between selling the crop and losing it.' }),
    t({ id: 'harvest.line_up_buyer', type: 'harvest', priority: 'low',
        title: 'Confirm at least one buyer',
        description: 'Message or call a buyer to confirm price and pickup window.',
        why: 'A confirmed buyer means the harvest turns into cash, not spoilage.' }),
  ]),
});

// ─── Post-harvest ────────────────────────────────────────────────
const POST_HARVEST = t({
  generic: t([
    t({ id: 'post.dry_storage', type: 'storage', priority: 'high',
        title: 'Dry and store the harvest properly',
        description: 'Spread the crop to dry fully before bagging, and stack bags off the ground.',
        why: 'Moisture during storage is the #1 cause of post-harvest loss.' }),
    t({ id: 'post.field_cleanup', type: 'land_prep', priority: 'medium',
        title: 'Clear crop residue from the field',
        description: 'Remove stalks and unused plant matter so pests don\u2019t overwinter there.',
        why: 'Leftover residue is where next season\u2019s pests hide.' }),
    t({ id: 'post.record_yield', type: 'scout', priority: 'low',
        title: 'Record this season\u2019s yield',
        description: 'Write down the total bags / kg harvested and any big issues you noticed.',
        why: 'One season\u2019s record is the start of real year-on-year improvement.' }),
  ]),
});

// Stage-key → rule set. Accepts both modern and legacy stage names.
export const TEMPLATES = t({
  pre_planting:  PRE_PLANTING,
  planning:      PRE_PLANTING,     // legacy alias
  planting:      PLANTING,
  planted:       PLANTING,          // legacy alias
  early_growth:  PLANTING,
  mid_growth:    MID_GROWTH,
  growing:       MID_GROWTH,        // legacy alias
  harvest:       HARVEST,
  post_harvest:  POST_HARVEST,
});

// Universal fallback when the stage is missing / unknown — a safe
// mid-growth-style day so the engine always has something to show.
export const GENERIC_FALLBACK = MID_GROWTH.generic;

// ─── Weather-driven templates (layered on top of the stage pool) ─
// The engine prepends these when the matching weather status is
// active, always at high priority, so the most urgent one wins.
export const WEATHER_TEMPLATES = t({
  excessive_heat: t({
    id: 'weather.hot.water_morning', type: 'irrigation', priority: 'high',
    title: 'Water crops early morning before the heat',
    description: 'Finish watering before 9am; avoid midday watering — it evaporates fast.',
    why: 'Heat stress in the afternoon is where most yield is lost; early water protects the roots.',
  }),
  low_rain: t({
    id: 'weather.dry.irrigate', type: 'irrigation', priority: 'high',
    title: 'Irrigate the driest rows today',
    description: 'Focus on rows that looked thirsty yesterday; a slow soak beats a quick splash.',
    why: 'Several dry days in a row dry out the topsoil fast — early watering keeps roots active.',
  }),
  dry_ahead: t({
    id: 'weather.dry_ahead.prep', type: 'irrigation', priority: 'high',
    title: 'Prepare for a dry stretch',
    description: 'Mulch around plant bases and check water storage is full.',
    why: 'A few days of planning now saves days of recovery when the rain doesn\u2019t come.',
  }),
  heavy_rain: t({
    id: 'weather.rain.drainage', type: 'land_prep', priority: 'high',
    title: 'Clear drainage channels before the rain',
    description: 'Walk the main channels and open any that are blocked by soil or debris.',
    why: 'Standing water drowns roots and spreads disease; drainage is the first defence.',
  }),
  rain_expected: t({
    id: 'weather.rain.protect_seed', type: 'storage', priority: 'high',
    title: 'Move seed and tools to dry storage',
    description: 'Anything that shouldn\u2019t get wet goes under cover before the rain arrives.',
    why: 'Wet seed loses germination fast, and rusty tools slow every job for weeks.',
  }),
});

// ─── Farm-type modifiers ─────────────────────────────────────────
// Applied by the engine to filter the template pool so backyard
// farmers don't get commercial-scale advice, and commercial farmers
// see the deeper inspection / record-keeping items.
export const ALLOW_BY_FARM_TYPE = t({
  backyard:   new Set(['irrigation', 'pest', 'weeding', 'harvest', 'nutrient', 'land_prep']),
  small_farm: new Set(['irrigation', 'pest', 'nutrient', 'weeding', 'harvest',
                       'land_prep', 'scout', 'storage']),
  commercial: new Set(['irrigation', 'pest', 'nutrient', 'weeding', 'harvest',
                       'land_prep', 'scout', 'storage']),
});

export const _internal = Object.freeze({
  PRE_PLANTING, PLANTING, MID_GROWTH, HARVEST, POST_HARVEST,
});
