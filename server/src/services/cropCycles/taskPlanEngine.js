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
  { weekIndex: 0, title: 'Prep the bed or container',   detail: 'Loosen soil, mix in compost, clear debris.', priority: 'high',   offsetDays: -3 },
  { weekIndex: 0, title: 'Plant seeds or seedlings',    detail: 'Follow spacing from the seed packet. Water in gently.', priority: 'high', offsetDays: 0 },
  { weekIndex: 1, title: 'Check moisture daily',        detail: 'Keep the top inch of soil moist, not soggy.', priority: 'medium', offsetDays: 5 },
  { weekIndex: 2, title: 'Thin seedlings if crowded',   detail: 'Thin to the spacing on the packet to avoid weak plants.', priority: 'medium', offsetDays: 12 },
  { weekIndex: 3, title: 'First pest scouting pass',    detail: 'Check leaf undersides and stems for damage.', priority: 'medium', offsetDays: 19 },
  { weekIndex: 4, title: 'Feed and mulch',              detail: 'Side-dress with compost or balanced feed; mulch to hold moisture.', priority: 'medium', offsetDays: 26 },
  { weekIndex: 5, title: 'Stake, tie, or train where needed', detail: 'Support tall plants before they lean.', priority: 'low', offsetDays: 33 },
  { weekIndex: 6, title: 'Weekly weed pass',            detail: 'Catch weeds small — they\'re harder to pull later.', priority: 'low', offsetDays: 40 },
  { weekIndex: 8, title: 'Harvest prep',                detail: 'Plan tools, storage, and who will help.', priority: 'medium', offsetDays: 54 },
];

/** Crop-specific templates. Keep these short and only where cadence differs. */
const CROP_TEMPLATES = {
  tomato: [
    { weekIndex: 0, title: 'Prep a sunny bed',          detail: 'Work 2 inches of compost in; tomatoes need full sun and loose soil.', priority: 'high', offsetDays: -3 },
    { weekIndex: 0, title: 'Plant transplants deep',    detail: 'Bury up to the first leaf set to grow stronger roots.', priority: 'high', offsetDays: 0 },
    { weekIndex: 1, title: 'Install stakes or cages',   detail: 'Support now — adding it later damages roots.', priority: 'high', offsetDays: 3 },
    { weekIndex: 2, title: 'Mulch heavily',             detail: 'Mulch holds moisture and slows blight splash.', priority: 'medium', offsetDays: 10 },
    { weekIndex: 3, title: 'Water deeply at the base',  detail: 'About 1 inch/week. Keep leaves dry.', priority: 'medium', offsetDays: 17 },
    { weekIndex: 4, title: 'Pinch suckers weekly',      detail: 'Remove side shoots to channel energy to fruit.', priority: 'medium', offsetDays: 24 },
    { weekIndex: 6, title: 'Scout for blight or hornworm', detail: 'Early catch keeps the plant healthy.', priority: 'medium', offsetDays: 40 },
    { weekIndex: 8, title: 'Ease off nitrogen',         detail: 'Switch to a feed lower in nitrogen once fruit sets.', priority: 'low', offsetDays: 54 },
    { weekIndex: 10, title: 'Begin harvest',            detail: 'Pick when fruit is colored but still firm.', priority: 'high', offsetDays: 70 },
  ],
  pepper: [
    { weekIndex: 0, title: 'Wait for warm soil',        detail: 'Peppers hate cold soil — wait for 60°F+.', priority: 'high', offsetDays: -2 },
    { weekIndex: 0, title: 'Transplant with compost',   detail: 'Well-rotted compost in the hole gives a strong start.', priority: 'high', offsetDays: 0 },
    { weekIndex: 1, title: 'Stake gently',              detail: 'Loose ties prevent broken branches when fruit loads.', priority: 'medium', offsetDays: 5 },
    { weekIndex: 2, title: 'Pinch first flowers',       detail: 'Early pinching grows a bigger plant and more fruit later.', priority: 'medium', offsetDays: 12 },
    { weekIndex: 4, title: 'Feed at flowering',         detail: 'Switch to a lower-nitrogen feed when flowers appear.', priority: 'medium', offsetDays: 26 },
    { weekIndex: 6, title: 'Harvest regularly',         detail: 'Picking green boosts total yield; leave a few to ripen.', priority: 'high', offsetDays: 40 },
    { weekIndex: 10, title: 'Watch for blossom drop',   detail: 'Hot or dry spells can drop flowers — keep water steady.', priority: 'medium', offsetDays: 70 },
  ],
  okra: [
    { weekIndex: 0, title: 'Wait for 65°F+ soil',       detail: 'Cold soil rots okra seeds — wait for real warmth.', priority: 'high', offsetDays: -2 },
    { weekIndex: 0, title: 'Direct-seed 1 inch deep',   detail: 'Thin to 12 inches apart in a sunny row.', priority: 'high', offsetDays: 0 },
    { weekIndex: 2, title: 'Mulch heavily',             detail: 'Mulch keeps weeds down and moisture in.', priority: 'medium', offsetDays: 12 },
    { weekIndex: 4, title: 'Side-dress with a feed',    detail: 'A balanced feed at 4 weeks keeps pods coming.', priority: 'medium', offsetDays: 28 },
    { weekIndex: 7, title: 'Harvest every 2 days',      detail: 'Pods go woody past 3 inches — pick small and often.', priority: 'high', offsetDays: 50 },
  ],
  sweet_potato: [
    { weekIndex: 0, title: 'Mound the bed',             detail: 'Plant into 8–10-inch mounds for loose, warm soil.', priority: 'high', offsetDays: -3 },
    { weekIndex: 0, title: 'Plant slips, not seeds',    detail: 'Sweet potatoes grow from rooted slips.', priority: 'high', offsetDays: 0 },
    { weekIndex: 2, title: 'Water steady first 2 weeks', detail: 'After that, they handle dry spells well.', priority: 'medium', offsetDays: 10 },
    { weekIndex: 6, title: 'Keep vines in-bounds',      detail: 'Don\'t flip vines — it breaks secondary roots.', priority: 'low', offsetDays: 42 },
    { weekIndex: 14, title: 'Harvest before frost',     detail: 'Dig carefully; cure in a warm dry spot for 10 days.', priority: 'high', offsetDays: 98 },
  ],
  lettuce: [
    { weekIndex: 0, title: 'Sow thinly in cool soil',   detail: 'Direct-sow 1/4 inch deep in loose, rich soil.', priority: 'high', offsetDays: 0 },
    { weekIndex: 1, title: 'Thin to 8 inches',          detail: 'Eat the thinnings.', priority: 'medium', offsetDays: 7 },
    { weekIndex: 2, title: 'Water often but lightly',   detail: 'Lettuce has shallow roots; keep the top damp.', priority: 'medium', offsetDays: 14 },
    { weekIndex: 3, title: 'Shade in heat',             detail: 'Above 80°F, use shade cloth to delay bolting.', priority: 'medium', offsetDays: 21 },
    { weekIndex: 4, title: 'Cut outer leaves',          detail: 'Cut-and-come-again extends the harvest.', priority: 'high', offsetDays: 28 },
  ],
  corn: [
    { weekIndex: 0, title: 'Plant a block, not a row',  detail: 'Corn is wind-pollinated — at least 4x4 plants.', priority: 'high', offsetDays: 0 },
    { weekIndex: 0, title: 'Sow into warm soil only',   detail: 'Seeds rot in cold ground; wait for 60°F+.', priority: 'high', offsetDays: 0 },
    { weekIndex: 3, title: 'Weed weekly',               detail: 'Corn hates competition in the first 6 weeks.', priority: 'medium', offsetDays: 20 },
    { weekIndex: 5, title: 'Side-dress at knee-high',   detail: 'Nitrogen at 18 inches doubles yield.', priority: 'high', offsetDays: 35 },
    { weekIndex: 10, title: 'Watch silks for ripeness', detail: 'Brown silks = ready. Check by kernel milk test.', priority: 'medium', offsetDays: 70 },
  ],
  strawberry: [
    { weekIndex: 0, title: 'Plant at crown depth',      detail: 'Crown must sit right at soil line — not buried, not exposed.', priority: 'high', offsetDays: 0 },
    { weekIndex: 2, title: 'Mulch with straw',          detail: 'Straw keeps fruit clean and holds moisture.', priority: 'medium', offsetDays: 14 },
    { weekIndex: 3, title: 'Pinch first-year flowers',  detail: 'Removing flowers the first year triples future yield.', priority: 'medium', offsetDays: 21 },
    { weekIndex: 6, title: 'Net against birds',         detail: 'Cover as fruit starts coloring.', priority: 'medium', offsetDays: 42 },
    { weekIndex: 12, title: 'Renovate after harvest',   detail: 'Trim leaves, thin runners for next year.', priority: 'low', offsetDays: 84 },
  ],
  cotton: [
    { weekIndex: 0, title: 'Deep prep + warm soil',     detail: 'Soil at 65°F+ and well drained.', priority: 'high', offsetDays: -5 },
    { weekIndex: 0, title: 'Plant in 30–40" rows',      detail: 'Rows need clearance for cultivation.', priority: 'high', offsetDays: 0 },
    { weekIndex: 4, title: 'Scout for thrips / bollworm', detail: 'Weekly scouting; act early.', priority: 'medium', offsetDays: 28 },
    { weekIndex: 8, title: 'Irrigate at flower set',    detail: 'Water stress at flowering drops yield the most.', priority: 'high', offsetDays: 56 },
    { weekIndex: 18, title: 'Defoliate before pick',    detail: 'Strip leaves before harvest for clean bolls.', priority: 'medium', offsetDays: 126 },
  ],
  sorghum: [
    { weekIndex: 0, title: 'Wait for 60°F+ soil',       detail: 'Sorghum hates cold — warm soil only.', priority: 'high', offsetDays: -2 },
    { weekIndex: 0, title: 'Seed shallow',              detail: '1 inch deep in a firm seedbed.', priority: 'high', offsetDays: 0 },
    { weekIndex: 3, title: 'Weed aggressively',         detail: 'First 4 weeks are critical; sorghum outruns weeds after.', priority: 'high', offsetDays: 20 },
    { weekIndex: 6, title: 'Scout for sugarcane aphid', detail: 'Biggest yield thief in most regions.', priority: 'medium', offsetDays: 40 },
    { weekIndex: 14, title: 'Harvest at hard dough',    detail: 'Grain should shatter when pressed hard.', priority: 'high', offsetDays: 98 },
  ],
  peanut: [
    { weekIndex: 0, title: 'Deep-till the bed',         detail: 'Peanuts peg into loose soil; till 6 inches deep.', priority: 'high', offsetDays: -4 },
    { weekIndex: 0, title: 'Plant in warm soil',        detail: 'Seed at 1.5 inches once soil hits 65°F+.', priority: 'high', offsetDays: 0 },
    { weekIndex: 3, title: 'Control early weeds',       detail: 'First 4 weeks are the critical weed-free window.', priority: 'high', offsetDays: 20 },
    { weekIndex: 6, title: 'Scout for leaf spot',       detail: 'Catch early leaf-spot lesions on lower leaves.', priority: 'medium', offsetDays: 42 },
    { weekIndex: 9, title: 'Maintain steady water',     detail: 'Water stress at pegging cuts yield most.', priority: 'high', offsetDays: 63 },
    { weekIndex: 18, title: 'Plan the dig',             detail: 'Lift, cure, and pick when shell veins darken.', priority: 'high', offsetDays: 126 },
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
