/**
 * taskWordingHelpers.js — builders that produce short, verb-first,
 * farmer-friendly task titles and explanations.
 *
 *   Pattern: Verb + crop + action + timing
 *   Examples:
 *     Water tomatoes today
 *     Inspect pepper leaves for pests
 *     Plant sweet potato slips this week
 *
 * Each helper returns `{ title, detail }` where:
 *   - title is the farmer-facing card title (short, action-first)
 *   - detail is a one-sentence "why / how" line (≤ ~110 chars)
 *
 * Callers compose these helpers into CycleTaskPlan rows, crop stage
 * overlays, or ad-hoc today-feed entries. The output is deterministic
 * — same inputs always produce the same title — so tests can pin it.
 */

/**
 * Friendly display name for a crop key. Keeps the label natural
 * when used mid-sentence ("Water tomatoes today", "Plant sweet
 * potato slips"). New crops drop in here as one entry.
 */
const CROP_LABEL = Object.freeze({
  tomato: 'tomatoes',
  pepper: 'peppers',
  lettuce: 'lettuce',
  kale: 'kale',
  okra: 'okra',
  sweet_potato: 'sweet potatoes',
  sorghum: 'sorghum',
  peanut: 'peanuts',
  corn: 'corn',
  sweet_corn: 'sweet corn',
  cotton: 'cotton',
  cucumber: 'cucumbers',
  squash: 'squash',
  zucchini: 'zucchini',
  strawberry: 'strawberries',
  beans: 'beans',
  onion: 'onions',
  carrot: 'carrots',
  cabbage: 'cabbage',
});

const DEFAULT_TIMING = 'today';

function cropLabel(crop) {
  if (!crop) return 'crop';
  const key = String(crop).toLowerCase();
  return CROP_LABEL[key] || key.replace(/_/g, ' ');
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/**
 * Compose the final sentence out of verb + crop + optional action
 * + timing. Verb is always first; timing is always last.
 */
function compose({ verb, crop, action, timing }) {
  const parts = [cap(verb), cropLabel(crop)];
  if (action) parts.push(action);
  if (timing) parts.push(timing);
  return parts.join(' ');
}

/** Watering task. */
export function buildWateringTask({ crop, timing = DEFAULT_TIMING, depth } = {}) {
  const title = compose({ verb: 'water', crop, timing });
  const detail = depth === 'deep'
    ? `Give ${cropLabel(crop)} a deep, slow soaking at the base. Avoid wetting the leaves.`
    : `Keep the top inch of soil around ${cropLabel(crop)} damp — not soggy.`;
  return { title, detail };
}

/**
 * Planting task — stage aware ("slips", "seeds", "transplants").
 * When `stage` is omitted the helper auto-picks the right word
 * based on how the crop is typically started.
 */
export function buildPlantingTask({ crop, stage, timing = 'this week' } = {}) {
  const stageWord = stageToWord(crop, stage);
  const title = compose({ verb: 'plant', crop, action: stageWord, timing });
  const detail = stageWord === 'slips'
    ? `Use rooted slips, not seeds — mound the bed and water in.`
    : stageWord === 'transplants'
      ? `Bury to the first leaf set and water in gently.`
      : `Follow the spacing on the seed packet and firm the soil over the rows.`;
  return { title, detail };
}

/** Pest or leaf inspection task. */
export function buildPestInspectionTask({ crop, timing = DEFAULT_TIMING, focus = 'leaves' } = {}) {
  const focusWord = focus === 'rows' ? 'rows' : 'leaves';
  const title = compose({ verb: 'inspect', crop, action: `${focusWord} for pests`, timing });
  const detail = focusWord === 'rows'
    ? `Walk the rows slowly. Flip leaves and check stems for chewed edges or insects.`
    : `Flip ${cropLabel(crop)} leaves and check the undersides — catch pests before damage spreads.`;
  return { title, detail };
}

/** Fertilizer / side-dress task. */
export function buildFertilizerTask({ crop, timing = 'this week', nutrient = 'balanced' } = {}) {
  const action = nutrient === 'nitrogen' ? 'with nitrogen' : 'with a balanced feed';
  const title = compose({ verb: 'feed', crop, action, timing });
  const detail = nutrient === 'nitrogen'
    ? `Side-dress along the row. Nitrogen at knee-high is worth the effort.`
    : `Compost or a balanced fertilizer at the base — water it in so roots can reach it.`;
  return { title, detail };
}

/** Harvest task. */
export function buildHarvestTask({ crop, timing = DEFAULT_TIMING, cue } = {}) {
  const title = compose({ verb: 'harvest', crop, timing });
  const detail = cue
    ? `Pick ${cropLabel(crop)} when ${cue}. Daily picking keeps plants producing.`
    : `Pick ${cropLabel(crop)} at the right size. Daily picking keeps plants producing.`;
  return { title, detail };
}

/** Weed control task. */
export function buildWeedControlTask({ crop, timing = 'this week' } = {}) {
  const title = compose({ verb: 'weed', crop, action: 'rows', timing });
  const detail = `Catch weeds while they're small — they steal water and food from ${cropLabel(crop)}.`;
  return { title, detail };
}

/**
 * Resolve which plant material word makes sense for the crop.
 *   sweet_potato → 'slips'
 *   tomato / pepper / eggplant / strawberry → 'transplants'
 *   everything else → 'seeds'
 */
function stageToWord(crop, stage) {
  const key = String(crop || '').toLowerCase();
  if (stage === 'slips' || key === 'sweet_potato') return 'slips';
  if (stage === 'transplants') return 'transplants';
  if (stage === 'seeds') return 'seeds';
  // Auto-pick based on how the crop is typically started
  if (['tomato', 'pepper', 'eggplant', 'strawberry'].includes(key)) return 'transplants';
  return 'seeds';
}

export const _internal = { CROP_LABEL, cropLabel, compose };
