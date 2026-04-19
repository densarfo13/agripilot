/**
 * cropTaskEngine.js — crop-specific task generation with stage,
 * weather, risk, and behavior awareness.
 *
 * Generates a *set* of stage-appropriate tasks for one crop cycle
 * (not just the stage-overlay one the Today engine was using), then
 * hands them to `adjustTasksForWeather` and a priority sort so the
 * Today payload is produced by a single pipeline.
 *
 * Templates cover the 8 crops the spec requires:
 *   tomato, pepper, lettuce, beans, peanut, corn, sorghum, sweet_potato
 */

import { adjustTasksForWeather } from '../weather/adjustTasksForWeather.js';
import { getWeatherRisk } from '../weather/weatherRiskEngine.js';

// ─── Template shape ────────────────────────────────────────
// A task template is a plain object. We don't persist IDs here — the
// caller (task-plan service or Today engine) assigns them.
//
//   { code, title, detail, priority, urgencyBase, stage, tags[] }
//
// The `tags` field is what the weather adjuster + feedback engine
// pattern-match on (watering / planting / pest / harvest / stake /
// spray). Keeping them explicit avoids the regex guessing game the
// older Today engine had to do on titles.

const T = (template) => Object.freeze({ priority: 'medium', urgencyBase: 50, tags: [], ...template });

export const CROP_TASK_LIBRARY = Object.freeze({
  tomato: {
    planned: [
      T({ code: 'soil_warm',    title: 'Warm the soil before transplanting tomatoes', detail: 'Wait until soil is consistently above 60°F.', tags: ['planning'] }),
    ],
    planting: [
      T({ code: 'plant_tomato', title: 'Plant tomatoes deep',                         detail: 'Bury up to the first true leaves for a strong root system.',       priority: 'high',   urgencyBase: 80, tags: ['planting'] }),
      T({ code: 'mulch',        title: 'Mulch around the tomatoes',                   detail: 'Traps moisture and keeps soil temp even.',                         urgencyBase: 55, tags: ['mulch'] }),
    ],
    growing: [
      T({ code: 'water_tomato', title: 'Water tomatoes deeply',                       detail: 'Deep, infrequent water grows deep roots.',                          urgencyBase: 65, tags: ['watering'] }),
      T({ code: 'stake_tomato', title: 'Stake or cage tomatoes',                      detail: 'Keep fruit off the ground to prevent rot.',                         urgencyBase: 60, tags: ['stake'] }),
      T({ code: 'scout_pests',  title: 'Scout leaves for pests',                      detail: 'Check undersides of leaves for aphids or hornworms.',               urgencyBase: 50, tags: ['pest'] }),
    ],
    flowering: [
      T({ code: 'water_tomato', title: 'Water tomatoes deeply',                       detail: 'Consistent moisture prevents blossom-end rot.',                     priority: 'high', urgencyBase: 75, tags: ['watering'] }),
      T({ code: 'scout_pests',  title: 'Inspect for leaf spot',                       detail: 'Humidity drives fungal disease now.',                               urgencyBase: 55, tags: ['pest'] }),
    ],
    harvest_ready: [
      T({ code: 'harvest',      title: 'Harvest ripe tomatoes',                       detail: 'Pick when colored but still firm.',                                 priority: 'high', urgencyBase: 85, tags: ['harvest'] }),
    ],
  },

  pepper: {
    planned: [
      T({ code: 'start_indoors',  title: 'Start pepper seeds indoors',                detail: 'Peppers need 8+ weeks indoors before transplanting.',               tags: ['planning'] }),
    ],
    planting: [
      T({ code: 'plant_pepper',   title: 'Transplant peppers into warm soil',         detail: 'Do not plant before soil is 65°F.',                                 priority: 'high', urgencyBase: 80, tags: ['planting'] }),
    ],
    growing: [
      T({ code: 'water_pepper',   title: 'Water peppers evenly',                      detail: 'Uneven water causes blossom-end rot and cracking.',                urgencyBase: 65, tags: ['watering'] }),
      T({ code: 'scout_pests',    title: 'Scout for aphids and pepper weevil',        detail: 'Aphids cluster on new growth.',                                     urgencyBase: 55, tags: ['pest'] }),
    ],
    flowering: [
      T({ code: 'support_plants', title: 'Support heavy pepper plants',               detail: 'Stake or cage before fruit weight splits the stem.',               urgencyBase: 55, tags: ['stake'] }),
    ],
    harvest_ready: [
      T({ code: 'harvest',        title: 'Harvest peppers at full color',             detail: 'Flavor and heat peak at full color.',                              priority: 'high', urgencyBase: 85, tags: ['harvest'] }),
    ],
  },

  lettuce: {
    planned: [
      T({ code: 'shade_bed',    title: 'Prep a shaded bed for lettuce',               detail: 'Lettuce bolts in heat — afternoon shade helps.',                    tags: ['planning'] }),
    ],
    planting: [
      T({ code: 'sow',          title: 'Sow lettuce seeds shallow',                   detail: 'Needs light to germinate — sow 1/8" deep.',                         priority: 'high', urgencyBase: 80, tags: ['planting'] }),
    ],
    growing: [
      T({ code: 'water_lettuce', title: 'Water lettuce lightly and often',            detail: 'Shallow roots — keep the top inch moist.',                          urgencyBase: 65, tags: ['watering'] }),
      T({ code: 'thin',         title: 'Thin lettuce seedlings',                      detail: 'Give each plant 6" to avoid disease.',                              urgencyBase: 50, tags: ['thinning'] }),
    ],
    harvest_ready: [
      T({ code: 'harvest',      title: 'Harvest outer lettuce leaves',                detail: 'Cut outer leaves and let center keep growing.',                     priority: 'high', urgencyBase: 80, tags: ['harvest'] }),
    ],
  },

  beans: {
    planned: [
      T({ code: 'inoculate',    title: 'Inoculate bean seed with rhizobia',           detail: 'Improves nitrogen fixation — worth the extra minute.',              tags: ['planning'] }),
    ],
    planting: [
      T({ code: 'plant_beans',  title: 'Plant beans after soil warms',                detail: 'Soil must be above 60°F or seed rots.',                             priority: 'high', urgencyBase: 75, tags: ['planting'] }),
    ],
    growing: [
      T({ code: 'water_beans',  title: 'Water beans at the base',                     detail: 'Wet leaves spread disease.',                                         urgencyBase: 60, tags: ['watering'] }),
      T({ code: 'scout_pests',  title: 'Check for bean beetles',                      detail: 'Pick and crush adults early.',                                      urgencyBase: 55, tags: ['pest'] }),
    ],
    flowering: [
      T({ code: 'mulch',        title: 'Mulch around beans to keep roots cool',      detail: 'Heat drops bean flowers.',                                          urgencyBase: 55, tags: ['mulch'] }),
    ],
    harvest_ready: [
      T({ code: 'harvest',      title: 'Pick beans every 2–3 days',                   detail: 'Frequent picking keeps plants producing.',                          priority: 'high', urgencyBase: 85, tags: ['harvest'] }),
    ],
  },

  peanut: {
    planned: [
      T({ code: 'till',         title: 'Till loose soil for peanuts',                 detail: 'Pegs need loose soil at least 6" deep.',                            tags: ['planning'] }),
    ],
    planting: [
      T({ code: 'plant_peanut', title: 'Plant peanut seeds',                          detail: 'Plant 1.5–2" deep once soil is 65°F.',                              priority: 'high', urgencyBase: 75, tags: ['planting'] }),
    ],
    growing: [
      T({ code: 'weed',         title: 'Weed around peanut rows',                     detail: 'Peanuts are poor competitors early on.',                            urgencyBase: 55, tags: ['weed'] }),
      T({ code: 'check_moist',  title: 'Check soil moisture',                         detail: 'Consistent moisture supports pegging.',                             urgencyBase: 60, tags: ['moisture'] }),
    ],
    flowering: [
      T({ code: 'water_peanut', title: 'Water peanuts deeply during pegging',         detail: 'Deep water pushes pegs into soil.',                                  urgencyBase: 70, tags: ['watering'] }),
    ],
    harvest_ready: [
      T({ code: 'harvest',      title: 'Dig peanuts when shell veins darken',         detail: 'Do not wait for frost — pod drop gets worse with time.',            priority: 'high', urgencyBase: 85, tags: ['harvest'] }),
    ],
  },

  corn: {
    planned: [
      T({ code: 'fertilize',    title: 'Side-dress corn bed with nitrogen',          detail: 'Corn is a heavy feeder.',                                           tags: ['planning'] }),
    ],
    planting: [
      T({ code: 'plant_corn',   title: 'Plant corn in blocks',                        detail: 'Block planting pollinates better than rows.',                       priority: 'high', urgencyBase: 80, tags: ['planting'] }),
    ],
    growing: [
      T({ code: 'water_corn',   title: 'Water corn at knee-high stage',               detail: 'Needs steady moisture through tasseling.',                          urgencyBase: 65, tags: ['watering'] }),
      T({ code: 'scout_pests',  title: 'Scout for earworm + borer',                   detail: 'Check tassels and ear tips.',                                        urgencyBase: 55, tags: ['pest'] }),
    ],
    flowering: [
      T({ code: 'water_corn',   title: 'Keep corn watered through silking',           detail: 'Moisture stress at silking tanks yield.',                           priority: 'high', urgencyBase: 75, tags: ['watering'] }),
    ],
    harvest_ready: [
      T({ code: 'harvest',      title: 'Harvest sweet corn in the morning',           detail: 'Sugars are highest then.',                                          priority: 'high', urgencyBase: 85, tags: ['harvest'] }),
    ],
  },

  sorghum: {
    planned: [
      T({ code: 'soil_warm',    title: 'Wait for 60°F soil before sowing sorghum',    detail: 'Cold soil rots sorghum seed.',                                       tags: ['planning'] }),
    ],
    planting: [
      T({ code: 'plant_sorghum', title: 'Plant sorghum shallow',                      detail: '1" deep, firm seed-to-soil contact.',                               priority: 'high', urgencyBase: 75, tags: ['planting'] }),
    ],
    growing: [
      T({ code: 'scout_pests',  title: 'Walk sorghum rows for midge + aphid',         detail: 'Midge hits at flowering — catch it early.',                         urgencyBase: 55, tags: ['pest'] }),
    ],
    flowering: [
      T({ code: 'water_sorghum', title: 'Water sorghum at heading',                   detail: 'Heading is the thirstiest stage.',                                  urgencyBase: 65, tags: ['watering'] }),
    ],
    harvest_ready: [
      T({ code: 'harvest',      title: 'Harvest sorghum at hard-dough',               detail: 'Grain shatters when pressed hard.',                                 priority: 'high', urgencyBase: 80, tags: ['harvest'] }),
    ],
  },

  sweet_potato: {
    planned: [
      T({ code: 'mound',        title: 'Mound the bed for sweet potato slips',        detail: '8–10" mounds keep soil loose and warm.',                             tags: ['planning'] }),
    ],
    planting: [
      T({ code: 'plant_slips',  title: 'Plant sweet potato slips',                    detail: 'Set slips so 2–3 leaves are above soil.',                           priority: 'high', urgencyBase: 75, tags: ['planting'] }),
    ],
    growing: [
      T({ code: 'water_sp',     title: 'Water sweet potatoes weekly',                 detail: 'Deep water grows large tubers.',                                     urgencyBase: 60, tags: ['watering'] }),
    ],
    harvest_ready: [
      T({ code: 'harvest',      title: 'Dig sweet potatoes before frost',             detail: 'Cure for 10 days at 85°F to sweeten.',                              priority: 'high', urgencyBase: 85, tags: ['harvest'] }),
    ],
  },
});

/** Alias normalization — accept `bean` / `beans` / `sweet potato` / 'sweet_potato'. */
function normalizeCropKey(raw) {
  const k = String(raw || '').toLowerCase().trim().replace(/\s+/g, '_');
  if (k === 'bean') return 'beans';
  if (k === 'sweetpotato') return 'sweet_potato';
  return k;
}

export function getCropTaskTemplates(cropKey, stage = 'growing') {
  const key = normalizeCropKey(cropKey);
  const bag = CROP_TASK_LIBRARY[key] || null;
  if (!bag) return [];
  return [...(bag[stage] || []), ...(bag.growing || []).filter(() => stage !== 'growing')];
}

/**
 * generateTasksForCropCycle({ crop, stage, weather, risk, behavior,
 *                             farmType, growingStyle })
 *
 * Pure function. Produces an ordered list of enriched tasks for one
 * cycle. Caller (task-plan or Today engine) is free to wrap them in
 * DB rows, assign IDs, etc.
 *
 * Each output task is:
 *   {
 *     code, title, detail, priority, priorityScore,
 *     timeEstimateMinutes, urgency, tags[],
 *     adjustedBy[]    // which channels moved this task: weather|behavior|risk
 *   }
 */
export function generateTasksForCropCycle({
  crop, stage = 'growing',
  weather = null,
  risk = null,
  behavior = null,
  farmType = null,
  growingStyle = null,
} = {}) {
  const templates = getCropTaskTemplates(normalizeCropKey(crop), stage);
  if (!templates.length) return [];

  // Seed each task with the shape adjustTasksForWeather expects.
  let tasks = templates.map((t) => ({
    code: t.code,
    title: t.title,
    detail: t.detail,
    priority: t.priority || 'medium',
    priorityScore: t.urgencyBase,
    timeEstimateMinutes: estimateMinutes(t),
    tags: [...(t.tags || [])],
    adjustedBy: [],
  }));

  // Weather adjustment — mark which tasks were moved by which channel
  // so the UI can render an "adjusted by rain" chip.
  if (weather) {
    const wr = getWeatherRisk(weather);
    const before = tasks.map((t) => t.priorityScore);
    tasks = adjustTasksForWeather(tasks, wr);
    tasks.forEach((t, i) => {
      if (t.priorityScore !== before[i]) t.adjustedBy = [...(t.adjustedBy || []), 'weather'];
    });
  }

  // Behavior adjustment — if the farmer has been skipping a lot, keep
  // non-high tasks visible so the feed doesn't collapse.
  if (behavior?.skipRate >= 0.5) {
    tasks = tasks.map((t) => t.priority === 'high'
      ? t
      : { ...t, priorityScore: Math.min(100, t.priorityScore + 5), adjustedBy: [...(t.adjustedBy || []), 'behavior'] });
  }

  // Risk adjustment — high base+overall risk bumps pest + mulch work
  if (risk?.level === 'high') {
    tasks = tasks.map((t) => {
      if ((t.tags || []).some((x) => ['pest', 'mulch', 'watering'].includes(x))) {
        return { ...t, priorityScore: Math.min(100, t.priorityScore + 8), adjustedBy: [...(t.adjustedBy || []), 'risk'] };
      }
      return t;
    });
  }

  // Farm-type nudge: backyard users get small-surface tasks boosted,
  // commercial users get scouting/harvest tasks boosted.
  if (farmType === 'backyard' || growingStyle === 'container' || growingStyle === 'raised_bed') {
    tasks = tasks.map((t) =>
      (t.tags || []).some((x) => ['watering', 'mulch', 'thinning'].includes(x))
        ? { ...t, priorityScore: Math.min(100, t.priorityScore + 3) }
        : t
    );
  }

  // Final sort: highest priorityScore first, high-priority as tiebreaker.
  tasks.sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
    const pa = a.priority === 'high' ? 2 : a.priority === 'medium' ? 1 : 0;
    const pb = b.priority === 'high' ? 2 : b.priority === 'medium' ? 1 : 0;
    return pb - pa;
  });

  return tasks.map((t) => ({
    ...t,
    urgency: t.priority === 'high' ? 'high' : t.priority === 'low' ? 'low' : 'medium',
  }));
}

/**
 * prioritizeTasks(tasks, ctx) — reorder + cap tasks that came from
 * somewhere else (stored DB rows). Doesn't regenerate; just re-scores.
 */
export function prioritizeTasks(tasks = [], { weather, behavior, risk } = {}) {
  let out = Array.isArray(tasks) ? tasks.slice() : [];
  if (weather) {
    const wr = getWeatherRisk(weather);
    out = adjustTasksForWeather(out, wr);
  }
  if (behavior?.skipRate >= 0.5) {
    out = out.map((t) => t.priority === 'high' ? t : {
      ...t, priorityScore: Math.min(100, (Number(t.priorityScore) || 50) + 5),
    });
  }
  if (risk?.level === 'high') {
    out = out.map((t) => /pest|water|mulch/i.test(String(t.title || ''))
      ? { ...t, priorityScore: Math.min(100, (Number(t.priorityScore) || 50) + 8) }
      : t);
  }
  out.sort((a, b) => (Number(b.priorityScore) || 0) - (Number(a.priorityScore) || 0));
  return out;
}

/**
 * buildTodayPayload(ctx) — convenience wrapper that emits exactly the
 * {primaryTask, secondaryTasks, riskAlerts, nextActionSummary} shape
 * the spec requires from the Today endpoint.
 */
export function buildTodayPayload({ crop, stage, weather, risk, behavior, farmType, growingStyle } = {}) {
  const tasks = generateTasksForCropCycle({ crop, stage, weather, risk, behavior, farmType, growingStyle });
  const primary = tasks[0] || null;
  const secondaries = tasks.slice(1, 3);
  const riskAlerts = (risk?.factors || []).slice(0, 3);
  const nextActionSummary = risk?.nextAction
    || (primary ? primary.title : 'No tasks for today.');
  return {
    primaryTask: primary ? shapeForUi(primary, 'primary') : null,
    secondaryTasks: secondaries.map((t) => shapeForUi(t, 'secondary')),
    riskAlerts,
    nextActionSummary,
    overallRisk: risk || null,
  };
}

// ─── helpers ───────────────────────────────────────────────
function estimateMinutes(t) {
  const title = String(t.title || '').toLowerCase();
  if (/scout|check/.test(title)) return 10;
  if (/plant|sow|transplant/.test(title)) return 30;
  if (/mulch|side-dress|feed/.test(title)) return 25;
  if (/weed/.test(title)) return 35;
  if (/stake|cage/.test(title)) return 20;
  if (/harvest|pick|dig/.test(title)) return 45;
  if (/thin/.test(title)) return 10;
  return t.priority === 'high' ? 30 : t.priority === 'low' ? 10 : 15;
}

function shapeForUi(t, kind) {
  return {
    id: t.id || null,
    code: t.code,
    title: t.title,
    why: t.detail,
    detail: t.detail,
    priority: t.priority,
    urgency: t.urgency,
    timeEstimateMinutes: t.timeEstimateMinutes,
    adjustedBy: t.adjustedBy || [],
    kind,
  };
}

export const _internal = { estimateMinutes };
