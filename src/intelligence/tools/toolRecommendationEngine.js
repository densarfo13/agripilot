/**
 * toolRecommendationEngine.js — contextual "helpful tools"
 * suggester used inline by Today's-task / Weather / Scan / Soil
 * surfaces. NOT a shopping catalog.
 *
 *   import { recommendTools } from './intelligence/tools/toolRecommendationEngine.js';
 *
 *   const { tools } = recommendTools({
 *     mode:           'garden',           // 'farm' | 'garden'
 *     cropSlug:       'tomato',           // optional
 *     cropStage:      'seedling',         // optional
 *     weatherType:    'rain',             // 'rain' | 'heat' | 'dry' | 'wind' | …
 *     taskType:       'soil_check',       // 'pest' | 'harvest' | 'soil_check' | …
 *     soilCondition:  'dry',              // matches soilScanEngine status
 *     scanCategory:   null,               // 'leaf-yellowing' | …
 *     region:         null,               // optional
 *     farmSize:       null,               // 'small' | 'medium' | …
 *     containerSize:  'small',            // 'small' | 'medium' | 'large' (garden only)
 *   });
 *
 *   // tools → [{ id, nameKey, reasonKey, category, priority,
 *   //             optional, diyAlternativeKey }]
 *
 * Spec contract (May 2026 contextual-tools spec)
 *   §1   — max 3 tools per call
 *   §2   — Soft Ochre seedling / heat / rain / pest / harvest /
 *          soil-check / garden default sets
 *   §3   — UI placement decided by caller; engine is logic-only
 *   §4   — supportive optional language only ("may make this
 *          easier", never "you need")
 *   §5+§6 — soil + weather inputs influence picks
 *   §8   — Farm vs Garden differentiation in the tool set
 *   §11  — every output string a localised i18n key
 *
 * Strict-rule audit
 *   • Pure function. Never throws.
 *   • Returns frozen objects so consumers can't mutate the
 *     recommendation table.
 *   • No I/O — caller passes context, no fetches here.
 *   • Output strings are key/fallback pairs so the renderer
 *     routes through tSafe().
 */

// ── Tool catalogue (low-cost, no expensive default equipment) ─
// Each row carries a stable id, an i18n key for the label, the
// category that maps it to a context, a priority hint (lower
// number = surface earlier), and an optional `diyAlternativeKey`
// so the renderer can show the "no moisture meter? check with
// your finger" copy without per-call branching.
const TOOL_CATALOG = Object.freeze({
  // ── Watering / moisture ─────────────────────────────────────
  watering_can: Object.freeze({
    id: 'watering_can', category: 'water',
    nameKey: 'tools.wateringCan', nameFb: 'Watering can',
    diyAlternativeKey: 'tools.diy.wateringCan',
    diyAlternativeFb:  'No watering can? A clean jug works just as well.',
  }),
  moisture_meter: Object.freeze({
    id: 'moisture_meter', category: 'water',
    nameKey: 'tools.moistureMeter', nameFb: 'Moisture meter (optional)',
    diyAlternativeKey: 'tools.diy.moistureMeter',
    diyAlternativeFb:  'No moisture meter? Check soil with your finger 2 inches below the surface.',
  }),
  spray_bottle: Object.freeze({
    id: 'spray_bottle', category: 'water',
    nameKey: 'tools.sprayBottle', nameFb: 'Spray bottle',
    diyAlternativeKey: '', diyAlternativeFb: '',
  }),
  plant_saucer: Object.freeze({
    id: 'plant_saucer', category: 'water',
    nameKey: 'tools.plantSaucer', nameFb: 'Plant saucer',
    diyAlternativeKey: 'tools.diy.plantSaucer',
    diyAlternativeFb:  'No saucer? A shallow plate or lid catches drainage just as well.',
  }),
  // ── Soil + ground ──────────────────────────────────────────
  small_shovel: Object.freeze({
    id: 'small_shovel', category: 'soil',
    nameKey: 'tools.smallShovel', nameFb: 'Small hand shovel',
    diyAlternativeKey: '', diyAlternativeFb: '',
  }),
  small_trowel: Object.freeze({
    id: 'small_trowel', category: 'soil',
    nameKey: 'tools.smallTrowel', nameFb: 'Small trowel',
    diyAlternativeKey: '', diyAlternativeFb: '',
  }),
  mulch: Object.freeze({
    id: 'mulch', category: 'soil',
    nameKey: 'tools.mulch', nameFb: 'Mulch',
    diyAlternativeKey: 'tools.diy.mulch',
    diyAlternativeFb:  'Dry leaves or straw work as natural mulch.',
  }),
  potting_mix: Object.freeze({
    id: 'potting_mix', category: 'soil',
    nameKey: 'tools.pottingMix', nameFb: 'Potting mix',
    diyAlternativeKey: '', diyAlternativeFb: '',
  }),
  // ── Drainage / weather ─────────────────────────────────────
  drainage_hoe: Object.freeze({
    id: 'drainage_hoe', category: 'drainage',
    nameKey: 'tools.drainageHoe', nameFb: 'Drainage hoe',
    diyAlternativeKey: 'tools.diy.drainageHoe',
    diyAlternativeFb:  'A regular garden hoe works just as well for clearing runoff.',
  }),
  raised_container: Object.freeze({
    id: 'raised_container', category: 'drainage',
    nameKey: 'tools.raisedContainer', nameFb: 'Raised container',
    diyAlternativeKey: '', diyAlternativeFb: '',
  }),
  waterproof_boots: Object.freeze({
    id: 'waterproof_boots', category: 'drainage',
    nameKey: 'tools.waterproofBoots', nameFb: 'Waterproof boots',
    diyAlternativeKey: '', diyAlternativeFb: '',
  }),
  // ── Pest / inspection ──────────────────────────────────────
  gloves: Object.freeze({
    id: 'gloves', category: 'inspection',
    nameKey: 'tools.gloves', nameFb: 'Gloves',
    diyAlternativeKey: '', diyAlternativeFb: '',
  }),
  hand_lens: Object.freeze({
    id: 'hand_lens', category: 'inspection',
    nameKey: 'tools.handLens', nameFb: 'Hand lens (optional)',
    diyAlternativeKey: 'tools.diy.handLens',
    diyAlternativeFb:  'No hand lens? A phone camera zoom works for a closer look.',
  }),
  small_bucket: Object.freeze({
    id: 'small_bucket', category: 'inspection',
    nameKey: 'tools.smallBucket', nameFb: 'Small bucket',
    diyAlternativeKey: '', diyAlternativeFb: '',
  }),
  // ── Seedling / planting ────────────────────────────────────
  seed_tray: Object.freeze({
    id: 'seed_tray', category: 'planting',
    nameKey: 'tools.seedTray', nameFb: 'Seed tray',
    diyAlternativeKey: 'tools.diy.seedTray',
    diyAlternativeFb:  'No seed tray? A clean egg carton works for starts.',
  }),
  // ── Harvest ────────────────────────────────────────────────
  harvest_basket: Object.freeze({
    id: 'harvest_basket', category: 'harvest',
    nameKey: 'tools.harvestBasket', nameFb: 'Harvest basket',
    diyAlternativeKey: '', diyAlternativeFb: '',
  }),
  pruning_knife: Object.freeze({
    id: 'pruning_knife', category: 'harvest',
    nameKey: 'tools.pruningKnife', nameFb: 'Pruning knife or scissors',
    diyAlternativeKey: '', diyAlternativeFb: '',
  }),
  storage_sack: Object.freeze({
    id: 'storage_sack', category: 'harvest',
    nameKey: 'tools.storageSack', nameFb: 'Storage sack or crate',
    diyAlternativeKey: '', diyAlternativeFb: '',
  }),
});

// ── Per-context tool stacks ────────────────────────────────────
// Order matters — earlier entries surface first when the limit
// of 3 trims the list. Both modes share the inspection / soil
// stacks; the watering + drainage stacks branch on Farm vs
// Garden so the language reads correctly.

const FARM_STACKS = Object.freeze({
  seedling:    ['watering_can', 'seed_tray', 'mulch'],
  heat:        ['watering_can', 'mulch', 'moisture_meter'],
  dry:         ['watering_can', 'mulch', 'moisture_meter'],
  rain:        ['drainage_hoe', 'waterproof_boots'],
  waterlogging:['drainage_hoe', 'raised_container', 'waterproof_boots'],
  pest:        ['gloves', 'hand_lens', 'small_bucket'],
  harvest:     ['harvest_basket', 'pruning_knife', 'storage_sack'],
  soil_check:  ['small_shovel', 'moisture_meter', 'mulch'],
  default:     ['gloves', 'small_shovel'],
});

const GARDEN_STACKS = Object.freeze({
  seedling:    ['watering_can', 'seed_tray', 'potting_mix'],
  heat:        ['watering_can', 'spray_bottle', 'mulch'],
  dry:         ['watering_can', 'spray_bottle', 'moisture_meter'],
  rain:        ['plant_saucer', 'small_trowel'],
  waterlogging:['plant_saucer', 'raised_container', 'small_trowel'],
  pest:        ['gloves', 'spray_bottle', 'hand_lens'],
  harvest:     ['harvest_basket', 'pruning_knife'],
  soil_check:  ['small_trowel', 'moisture_meter', 'potting_mix'],
  default:     ['watering_can', 'small_trowel', 'plant_saucer'],
});

// ── Per-context reason copy ────────────────────────────────────
// One short reason per (context, mode) pair. Renderer routes
// through tSafe; the fallback strings double as the reason
// the user sees when a locale row is missing.
const REASON_COPY = Object.freeze({
  seedling: {
    farm:   { key: 'tools.reason.seedling.farm',   fb: 'Helpful for early planting.' },
    garden: { key: 'tools.reason.seedling.garden', fb: 'Helpful for starting your seedlings.' },
  },
  heat: {
    farm:   { key: 'tools.reason.heat.farm',   fb: 'Helpful while heat dries the field.' },
    garden: { key: 'tools.reason.heat.garden', fb: 'Helpful while heat dries small pots.' },
  },
  dry: {
    farm:   { key: 'tools.reason.dry.farm',   fb: 'Helpful for the dry conditions today.' },
    garden: { key: 'tools.reason.dry.garden', fb: 'Helpful for the dry conditions today.' },
  },
  rain: {
    farm:   { key: 'tools.reason.rain.farm',   fb: 'Helpful when rain reaches the field.' },
    garden: { key: 'tools.reason.rain.garden', fb: 'Helpful when rain reaches your plants.' },
  },
  waterlogging: {
    farm:   { key: 'tools.reason.waterlogging.farm',   fb: 'Helpful for clearing pooled water.' },
    garden: { key: 'tools.reason.waterlogging.garden', fb: 'Helpful when pots collect too much water.' },
  },
  pest: {
    farm:   { key: 'tools.reason.pest.farm',   fb: 'Helpful for inspecting affected leaves.' },
    garden: { key: 'tools.reason.pest.garden', fb: 'Helpful for inspecting affected leaves.' },
  },
  harvest: {
    farm:   { key: 'tools.reason.harvest.farm',   fb: 'Helpful when picking and storing.' },
    garden: { key: 'tools.reason.harvest.garden', fb: 'Helpful when picking from your plants.' },
  },
  soil_check: {
    farm:   { key: 'tools.reason.soilCheck.farm',   fb: 'Helpful for checking moisture under the surface.' },
    garden: { key: 'tools.reason.soilCheck.garden', fb: 'Helpful for checking moisture in pots.' },
  },
  default: {
    farm:   { key: 'tools.reason.default.farm',   fb: 'These may make today’s task easier.' },
    garden: { key: 'tools.reason.default.garden', fb: 'These may make today’s plant care easier.' },
  },
});

/**
 * Resolve the active context bucket from the call signature.
 * Priority: explicit taskType → soilCondition → weatherType →
 * cropStage → 'default'.
 */
function _resolveBucket(input) {
  const i = input || {};
  const t = String(i.taskType || '').toLowerCase();
  if (t === 'pest' || t === 'pest_check')         return 'pest';
  if (t === 'harvest' || t === 'sell')            return 'harvest';
  if (t === 'soil_check' || t === 'soil_scan')    return 'soil_check';

  const sc = String(i.soilCondition || '').toLowerCase();
  if (sc === 'waterlogging' || sc === 'drainage') return 'waterlogging';
  if (sc === 'dry' || sc === 'cracked')           return 'dry';
  if (sc === 'mold')                              return 'pest';
  if (sc) /* moist / unclear / review */          return 'soil_check';

  const wt = String(i.weatherType || '').toLowerCase();
  if (wt === 'rain' || wt === 'cloudy')           return 'rain';
  if (wt === 'heat' || wt === 'sunny')            return 'heat';
  if (wt === 'dry')                               return 'dry';

  const stage = String(i.cropStage || '').toLowerCase();
  if (stage.includes('seed') || stage.includes('start')) return 'seedling';
  if (stage.includes('harvest') || stage.includes('ripe') || stage.includes('mature')) return 'harvest';

  return 'default';
}

/**
 * Optional-priority annotator. Mark moisture-meter / hand-lens
 * as `optional: true` so the renderer can dim them or wrap with
 * the "(optional)" label. Everything else surfaces as the
 * primary recommendation.
 */
const OPTIONAL_IDS = new Set(['moisture_meter', 'hand_lens']);

/**
 * recommendTools(input) → { tools: [...] }
 */
export function recommendTools(input) {
  const i = (input && typeof input === 'object') ? input : {};
  const mode   = (i.mode === 'garden') ? 'garden' : 'farm';
  const bucket = _resolveBucket(i);

  const stacks = mode === 'garden' ? GARDEN_STACKS : FARM_STACKS;
  const ids    = stacks[bucket] || stacks.default || [];
  const reason = (REASON_COPY[bucket] && REASON_COPY[bucket][mode])
    || REASON_COPY.default[mode];

  // Build the output list — max 3, never more.
  const tools = [];
  for (const id of ids) {
    if (tools.length >= 3) break;
    const row = TOOL_CATALOG[id];
    if (!row) continue;
    tools.push(Object.freeze({
      id:                 row.id,
      nameKey:            row.nameKey,
      nameFb:             row.nameFb,
      reasonKey:          reason.key,
      reasonFb:           reason.fb,
      category:           row.category,
      priority:           tools.length + 1,
      optional:           OPTIONAL_IDS.has(row.id),
      diyAlternativeKey:  row.diyAlternativeKey || '',
      diyAlternativeFb:   row.diyAlternativeFb  || '',
    }));
  }

  return Object.freeze({
    tools: Object.freeze(tools),
    bucket,
    mode,
  });
}

export default recommendTools;
