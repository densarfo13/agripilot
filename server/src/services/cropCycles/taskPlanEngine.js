/**
 * taskPlanEngine — pure functions that turn a crop + planting date
 * into a week-indexed task template.
 *
 * No DB, no I/O. The service layer (cropCycleService) persists these
 * into CycleTaskPlan rows when a farmer starts a cycle, and the
 * Today feed reads them back out on demand.
 *
 * Each task is `{ weekIndex, title, detail, priority, offsetDays }`.
 * `offsetDays` is the number of days from plantedDate to dueDate,
 * so date math stays honest across DST and timezones.
 */

/**
 * Baseline template — covers the majority of vegetable crops the
 * engine supports. Crop-specific templates (below) override this
 * when a plant's rhythm is meaningfully different.
 */
const DEFAULT_TEMPLATE = [
  { weekIndex: 0, title: 'Prep the bed this week',             detail: 'Loosen soil, mix in compost, and clear any debris before you plant.', priority: 'high',   offsetDays: -3 },
  { weekIndex: 0, title: 'Plant seeds today',                  detail: 'Follow the spacing on the packet and water the row in gently.',        priority: 'high',   offsetDays: 0 },
  { weekIndex: 1, title: 'Water rows today',                   detail: 'Keep the top inch of soil damp — not soggy.',                           priority: 'medium', offsetDays: 5 },
  { weekIndex: 2, title: 'Thin seedlings this week',           detail: 'Thin to the spacing on the packet so the strongest plants take over.',  priority: 'medium', offsetDays: 12 },
  { weekIndex: 3, title: 'Inspect leaves for pests today',     detail: 'Flip leaves and check stems — catch pests before damage spreads.',      priority: 'medium', offsetDays: 19 },
  { weekIndex: 4, title: 'Feed with balanced fertilizer',      detail: 'Side-dress with compost or a balanced feed; mulch to hold moisture.',   priority: 'medium', offsetDays: 26 },
  { weekIndex: 5, title: 'Stake tall plants this week',        detail: 'Add supports before plants lean — retrofitting later damages roots.',   priority: 'low',    offsetDays: 33 },
  { weekIndex: 6, title: 'Weed the rows this week',            detail: 'Catch weeds while they are small — they steal water and food.',        priority: 'low',    offsetDays: 40 },
  { weekIndex: 8, title: 'Prep for harvest this week',         detail: 'Line up tools, storage, and a helper before the crop is ready.',       priority: 'medium', offsetDays: 54 },
];

/** Crop-specific templates. Keep these short and only where cadence differs. */
const CROP_TEMPLATES = {
  tomato: [
    { weekIndex: 0, title: 'Prep a sunny bed for tomatoes',       detail: 'Work 2 inches of compost in — tomatoes need full sun and loose soil.',    priority: 'high',   offsetDays: -3 },
    { weekIndex: 0, title: 'Plant tomato transplants deep',       detail: 'Bury to the first leaf set so the stem grows extra roots.',              priority: 'high',   offsetDays: 0 },
    { weekIndex: 1, title: 'Stake tomatoes this week',            detail: 'Add supports immediately — retrofitting them later breaks roots.',        priority: 'high',   offsetDays: 3 },
    { weekIndex: 2, title: 'Mulch tomato beds this week',         detail: 'Mulch holds moisture and keeps soil from splashing blight on leaves.',    priority: 'medium', offsetDays: 10 },
    { weekIndex: 3, title: 'Water tomatoes deeply today',         detail: 'Aim for 1 inch a week at the base. Keep the leaves dry.',                priority: 'medium', offsetDays: 17 },
    { weekIndex: 4, title: 'Pinch tomato suckers this week',      detail: 'Remove side shoots so energy goes to fruit, not extra stems.',           priority: 'medium', offsetDays: 24 },
    { weekIndex: 6, title: 'Inspect tomato leaves for blight',    detail: 'Spotted or curling leaves spread fast — catch them early.',              priority: 'medium', offsetDays: 40 },
    { weekIndex: 8, title: 'Ease nitrogen on tomatoes',           detail: 'Switch to a lower-nitrogen feed once the first fruit sets.',             priority: 'low',    offsetDays: 54 },
    { weekIndex: 10, title: 'Harvest tomatoes today',             detail: 'Pick when fruit is colored but still firm. Daily picking keeps production up.', priority: 'high', offsetDays: 70 },
  ],
  pepper: [
    { weekIndex: 0, title: 'Wait for warm soil before planting peppers', detail: 'Peppers hate cold soil — wait until nights are above 55°F.',             priority: 'high',   offsetDays: -2 },
    { weekIndex: 0, title: 'Transplant peppers today',                   detail: 'Drop a handful of compost in the hole for a strong start.',                priority: 'high',   offsetDays: 0 },
    { weekIndex: 1, title: 'Stake peppers this week',                    detail: 'Loose ties stop branches from breaking once fruit loads on.',              priority: 'medium', offsetDays: 5 },
    { weekIndex: 2, title: 'Pinch first pepper flowers',                 detail: 'Pinching early flowers grows a bigger plant and more fruit later.',        priority: 'medium', offsetDays: 12 },
    { weekIndex: 4, title: 'Feed peppers at flowering',                  detail: 'Switch to a lower-nitrogen feed when flowers appear.',                     priority: 'medium', offsetDays: 26 },
    { weekIndex: 6, title: 'Harvest peppers today',                      detail: 'Picking green boosts total yield; leave a few on to ripen.',               priority: 'high',   offsetDays: 40 },
    { weekIndex: 10, title: 'Water peppers through hot spells',          detail: 'Hot or dry weather drops flowers — keep water steady.',                    priority: 'medium', offsetDays: 70 },
  ],
  okra: [
    { weekIndex: 0, title: 'Wait for 65°F+ soil before sowing okra', detail: 'Cold soil rots okra seed — hold off until the soil is warm.',            priority: 'high',   offsetDays: -2 },
    { weekIndex: 0, title: 'Sow okra seeds this week',               detail: 'Direct-seed 1 inch deep in a sunny row; thin to 12 inches apart.',      priority: 'high',   offsetDays: 0 },
    { weekIndex: 2, title: 'Mulch okra rows this week',              detail: 'Heavy mulch keeps weeds down and moisture in.',                         priority: 'medium', offsetDays: 12 },
    { weekIndex: 4, title: 'Feed okra with a balanced fertilizer',   detail: 'A side-dress at 4 weeks keeps pods coming through the season.',        priority: 'medium', offsetDays: 28 },
    { weekIndex: 7, title: 'Harvest okra every 2 days',              detail: 'Pick pods at 2–3 inches — bigger pods go woody fast.',                  priority: 'high',   offsetDays: 50 },
  ],
  sweet_potato: [
    { weekIndex: 0, title: 'Mound beds for sweet potatoes',          detail: 'Build 8–10 inch mounds so the soil stays loose and warm.',              priority: 'high',   offsetDays: -3 },
    { weekIndex: 0, title: 'Plant sweet potato slips today',         detail: 'Use rooted slips, not seeds. Water them in gently.',                    priority: 'high',   offsetDays: 0 },
    { weekIndex: 2, title: 'Water sweet potatoes deeply this week',  detail: 'Water steady for the first two weeks; after that they handle dry spells.',priority: 'medium', offsetDays: 10 },
    { weekIndex: 6, title: 'Leave sweet potato vines alone',         detail: 'Don\'t flip vines — it breaks the secondary roots that grow tubers.',    priority: 'low',    offsetDays: 42 },
    { weekIndex: 14, title: 'Harvest sweet potatoes before frost',   detail: 'Dig carefully, cure in a warm dry spot for 10 days, then store.',       priority: 'high',   offsetDays: 98 },
  ],
  lettuce: [
    { weekIndex: 0, title: 'Sow lettuce in cool soil today',         detail: 'Direct-sow 1/4 inch deep in loose, rich soil.',                         priority: 'high',   offsetDays: 0 },
    { weekIndex: 1, title: 'Thin lettuce to 8 inches apart',         detail: 'Eat the thinnings — they keep well.',                                   priority: 'medium', offsetDays: 7 },
    { weekIndex: 2, title: 'Water lettuce often but lightly',        detail: 'Shallow roots need the top inch kept damp, not saturated.',             priority: 'medium', offsetDays: 14 },
    { weekIndex: 3, title: 'Shade lettuce in hot weather',           detail: 'Use shade cloth once days hit 80°F to delay bolting.',                  priority: 'medium', offsetDays: 21 },
    { weekIndex: 4, title: 'Harvest lettuce outer leaves',           detail: 'Cut-and-come-again extends the harvest by weeks.',                      priority: 'high',   offsetDays: 28 },
  ],
  corn: [
    { weekIndex: 0, title: 'Plant corn in a block, not a row',        detail: 'Corn is wind-pollinated — plant at least 4 rows of 4 for proper ear fill.',priority: 'high',   offsetDays: 0 },
    { weekIndex: 0, title: 'Sow corn into warm soil only',            detail: 'Seeds rot in cold ground; wait for soil at 60°F or above.',             priority: 'high',   offsetDays: 0 },
    { weekIndex: 3, title: 'Weed corn rows this week',                detail: 'Corn hates competition for the first six weeks.',                       priority: 'medium', offsetDays: 20 },
    { weekIndex: 5, title: 'Feed corn with nitrogen at knee-high',    detail: 'Side-dress with nitrogen once plants hit 18 inches — it nearly doubles yield.', priority: 'high', offsetDays: 35 },
    { weekIndex: 10, title: 'Check corn silks for ripeness',          detail: 'Brown silks mean ready. Test kernels for milky juice.',                 priority: 'medium', offsetDays: 70 },
  ],
  strawberry: [
    { weekIndex: 0, title: 'Plant strawberries at crown depth',      detail: 'The crown must sit right at soil line — not buried, not exposed.',      priority: 'high',   offsetDays: 0 },
    { weekIndex: 2, title: 'Mulch strawberries with straw',          detail: 'Straw keeps fruit clean and holds moisture in the root zone.',          priority: 'medium', offsetDays: 14 },
    { weekIndex: 3, title: 'Pinch first-year strawberry flowers',    detail: 'Removing flowers the first year triples future yield.',                 priority: 'medium', offsetDays: 21 },
    { weekIndex: 6, title: 'Net strawberries against birds',         detail: 'Cover plants as fruit starts coloring — birds find them fast.',         priority: 'medium', offsetDays: 42 },
    { weekIndex: 12, title: 'Renovate strawberry bed after harvest', detail: 'Trim leaves and thin runners to set up next year\'s crop.',              priority: 'low',    offsetDays: 84 },
  ],
  cotton: [
    { weekIndex: 0, title: 'Prep cotton beds deeply',                detail: 'Cotton needs soil at 65°F and well-drained beds before you plant.',     priority: 'high',   offsetDays: -5 },
    { weekIndex: 0, title: 'Plant cotton in 30–40 inch rows',        detail: 'Rows need clearance for cultivation and spraying.',                     priority: 'high',   offsetDays: 0 },
    { weekIndex: 4, title: 'Scout cotton weekly for pests',          detail: 'Thrips, bollworm, and stink bug do the most damage.',                   priority: 'medium', offsetDays: 28 },
    { weekIndex: 8, title: 'Irrigate cotton at flower set',          detail: 'Water stress at flowering drops yield the most.',                       priority: 'high',   offsetDays: 56 },
    { weekIndex: 18, title: 'Defoliate cotton before pick',          detail: 'Strip leaves before harvest for clean bolls.',                          priority: 'medium', offsetDays: 126 },
  ],
  sorghum: [
    { weekIndex: 0, title: 'Wait for 60°F+ soil before sowing sorghum', detail: 'Sorghum hates cold soil — hold off until it warms up.',               priority: 'high',   offsetDays: -2 },
    { weekIndex: 0, title: 'Sow sorghum shallow',                        detail: 'Seed 1 inch deep into a firm bed for the best emergence.',           priority: 'high',   offsetDays: 0 },
    { weekIndex: 3, title: 'Weed sorghum rows aggressively',             detail: 'The first four weeks are critical — sorghum outruns weeds after.',   priority: 'high',   offsetDays: 20 },
    { weekIndex: 6, title: 'Scout sorghum for sugarcane aphid',          detail: 'Sugarcane aphid is the biggest yield thief in most regions.',        priority: 'medium', offsetDays: 40 },
    { weekIndex: 14, title: 'Harvest sorghum at hard dough',             detail: 'Grain should shatter when pressed hard between your fingers.',       priority: 'high',   offsetDays: 98 },
  ],
  peanut: [
    { weekIndex: 0, title: 'Till the peanut bed deeply',                 detail: 'Peanuts peg into loose soil — till at least 6 inches before planting.', priority: 'high',   offsetDays: -4 },
    { weekIndex: 0, title: 'Plant peanuts in warm soil',                 detail: 'Seed at 1.5 inches once soil hits 65°F+.',                              priority: 'high',   offsetDays: 0 },
    { weekIndex: 3, title: 'Weed peanut rows this week',                 detail: 'The first four weeks are the critical weed-free window.',              priority: 'high',   offsetDays: 20 },
    { weekIndex: 6, title: 'Inspect peanut leaves for leaf spot',        detail: 'Catch leaf-spot lesions on lower leaves early.',                       priority: 'medium', offsetDays: 42 },
    { weekIndex: 9, title: 'Water peanuts during pegging',               detail: 'Water stress at pegging is the biggest yield killer.',                  priority: 'high',   offsetDays: 63 },
    { weekIndex: 18, title: 'Harvest peanuts this week',                 detail: 'Lift, cure, and pick when the shell veins darken.',                    priority: 'high',   offsetDays: 126 },
  ],
};

/** Look up the template for a crop; fall back to the default. */
export function templateFor(cropKey) {
  return CROP_TEMPLATES[cropKey] || DEFAULT_TEMPLATE;
}

/**
 * Expand a template into concrete tasks with real dueDate values
 * relative to `plantedDate`. Tasks with offsetDays < 0 get clamped
 * to plantedDate itself so the farmer doesn't see tasks with a past
 * due date at cycle creation.
 */
export function generateWeeklyTasks({ cropKey, plantedDate }) {
  const base = new Date(plantedDate instanceof Date ? plantedDate : new Date(plantedDate));
  if (Number.isNaN(base.getTime())) return [];
  const tmpl = templateFor(cropKey);
  return tmpl.map((t) => {
    const offset = Number.isFinite(t.offsetDays) ? t.offsetDays : t.weekIndex * 7;
    const due = new Date(base.getTime());
    due.setDate(due.getDate() + Math.max(0, offset));
    return {
      weekIndex: t.weekIndex,
      title: t.title,
      detail: t.detail || null,
      priority: t.priority || 'medium',
      dueDate: due,
    };
  });
}

/**
 * Stats helper — returns { total, completed, overdue, dueSoon }.
 * Skipped tasks don't count toward overdue or dueSoon; they just
 * exist in the total so progress percentages stay meaningful.
 */
export function summarizeTasks(tasks, now = new Date()) {
  const nowMs = now.getTime();
  const soonMs = nowMs + 3 * 86_400_000;
  let completed = 0, overdue = 0, dueSoon = 0;
  for (const t of tasks) {
    if (t.status === 'completed') { completed += 1; continue; }
    if (t.status === 'skipped') continue;
    if (t.dueDate && new Date(t.dueDate).getTime() < nowMs) { overdue += 1; continue; }
    if (t.dueDate && new Date(t.dueDate).getTime() <= soonMs) dueSoon += 1;
  }
  const total = tasks.length;
  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { total, completed, overdue, dueSoon, progressPercent };
}
