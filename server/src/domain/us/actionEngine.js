/**
 * actionEngine.js — generates a concrete action plan for a
 * recommended crop given the farmer's timing classification.
 *
 * Surfaces three outputs:
 *   doThisNow    — the single most important action for this moment
 *   nextAction   — what follows immediately after "now"
 *   actionSteps  — ordered step-by-step from prep to harvest
 *   weeklyGuide  — coarse week-by-week cadence (first 6 weeks)
 *
 * Per-crop templates capture the cadence that actually differs
 * (tomato vs. sweet potato vs. corn). A default template covers the
 * rest with generic but still-actionable text.
 */

const DEFAULT_STEPS = [
  { label: 'Prep the bed or container', detail: 'Loosen soil, mix in compost, and clear debris.' },
  { label: 'Plant seeds or seedlings',  detail: 'Follow the spacing on the seed packet; water in gently.' },
  { label: 'Water consistently',        detail: 'Keep the top inch of soil moist but not soggy.' },
  { label: 'Feed and mulch',            detail: 'Side-dress with compost or a balanced feed 3–4 weeks in.' },
  { label: 'Scout for pests weekly',    detail: 'Flip leaves and check stems; act early if you see damage.' },
  { label: 'Harvest at the right size', detail: 'Pick regularly to keep plants producing.' },
];

const DEFAULT_WEEKS = [
  'Plant and water in',
  'Check moisture daily; thin seedlings',
  'First round of scouting',
  'Feed / side-dress and mulch',
  'Stake, tie, or train where needed',
  'Keep scouting; water deeply',
];

/**
 * Per-crop templates. Keep these small and specific; fall through to
 * DEFAULT_* if there's nothing crop-specific to say.
 */
const CROP_PLANS = {
  tomato: {
    steps: [
      { label: 'Start seeds or buy transplants',  detail: 'Begin indoors 6 weeks before last frost or buy strong transplants.' },
      { label: 'Prep with compost',               detail: 'Work 2 inches of compost into the planting hole.' },
      { label: 'Plant deep',                      detail: 'Bury up to the first leaf set; this grows stronger roots.' },
      { label: 'Stake or cage from day one',      detail: 'Install supports immediately — adding them later snaps roots.' },
      { label: 'Water evenly at the base',        detail: 'Aim for 1 inch/week. Avoid wetting the leaves.' },
      { label: 'Prune and mulch',                 detail: 'Pinch suckers; mulch to hold moisture and stop blight.' },
      { label: 'Pick when colored but firm',      detail: 'Daily harvest keeps the plant producing.' },
    ],
    weeks: [
      'Plant deep and stake',
      'Mulch + consistent watering',
      'Pinch suckers; first feed',
      'Watch for wilting and spots',
      'First fruit set — ease off nitrogen',
      'Begin harvesting as fruit colors',
    ],
  },
  pepper: {
    steps: [
      { label: 'Transplant after frost', detail: 'Peppers love warm soil — wait for nights above 55°F.' },
      { label: 'Stake gently',           detail: 'Loose ties prevent broken branches when fruit loads.' },
      { label: 'Water deeply, slowly',   detail: 'Shallow watering weakens roots.' },
      { label: 'Pinch first flowers',    detail: 'Early pinching grows a bigger plant and more fruit later.' },
      { label: 'Feed at flowering',      detail: 'Switch to a lower-nitrogen feed once flowers appear.' },
      { label: 'Harvest regularly',      detail: 'Picking green boosts total yield; leave a few to ripen.' },
    ],
    weeks: DEFAULT_WEEKS,
  },
  lettuce: {
    steps: [
      { label: 'Sow thinly in cool soil', detail: 'Direct-sow 1/4 inch deep in loose, rich soil.' },
      { label: 'Thin to 8 inches',         detail: 'Eat the thinnings — they keep.' },
      { label: 'Water often but lightly',  detail: 'Lettuce roots are shallow; keep the top damp.' },
      { label: 'Shade in heat',            detail: 'Use shade cloth once days hit 80°F+ to delay bolting.' },
      { label: 'Harvest outer leaves',     detail: 'Cut-and-come-again keeps the plant producing for weeks.' },
    ],
    weeks: [
      'Sow and lightly cover',
      'Thin and keep moist',
      'First cutting of outer leaves',
      'Shade cloth if days warm up',
      'Succession-sow the next round',
      'Final harvest before bolting',
    ],
  },
  kale: {
    steps: [
      { label: 'Sow in cool conditions',   detail: 'Direct-sow 1/4 inch deep 4–6 weeks before last frost or in early fall.' },
      { label: 'Thin and mulch',           detail: 'Thin to 12 inches and mulch to hold moisture.' },
      { label: 'Water evenly',             detail: 'Kale bolts if it dries out; 1 inch/week is plenty.' },
      { label: 'Pick outer leaves',        detail: 'Harvest from the bottom up; the crown keeps producing.' },
      { label: 'Frost actually helps',     detail: 'Flavor sweetens after a light frost.' },
    ],
    weeks: DEFAULT_WEEKS,
  },
  okra: {
    steps: [
      { label: 'Wait for warm soil',   detail: 'Sow only when soil hits 65°F+ — cold soil kills seedlings.' },
      { label: 'Direct-seed 1 inch',   detail: 'Thin to 12 inches apart in a sunny row.' },
      { label: 'Mulch heavily',        detail: 'Mulch keeps weeds down and moisture in.' },
      { label: 'Harvest every 2 days', detail: 'Pods go woody if left past 3 inches — pick small and often.' },
      { label: 'Feed mid-season',      detail: 'A balanced feed 4 weeks in keeps production going.' },
    ],
    weeks: DEFAULT_WEEKS,
  },
  sweet_potato: {
    steps: [
      { label: 'Plant slips, not seeds',   detail: 'Sweet potatoes grow from rooted slips, not seeds.' },
      { label: 'Mound the bed',            detail: 'Plant in 8–10-inch mounds for loose, warm soil.' },
      { label: 'Water the first 2 weeks',  detail: 'Once vines spread they handle dry spells well.' },
      { label: 'Keep vines in-bounds',     detail: 'Don\'t flip vines — it breaks secondary roots.' },
      { label: 'Harvest before frost',     detail: 'Dig carefully; cure in a warm, dry spot for 10 days.' },
    ],
    weeks: DEFAULT_WEEKS,
  },
  corn: {
    steps: [
      { label: 'Prep a big block, not a row', detail: 'Corn is wind-pollinated — plant at least 4x4 for proper ear fill.' },
      { label: 'Sow in warm soil',            detail: 'Seeds rot in cold ground; wait until soil is 60°F+.' },
      { label: 'Side-dress at knee-high',     detail: 'A nitrogen feed once plants hit ~18 inches doubles yield.' },
      { label: 'Keep weeds out early',        detail: 'Corn hates competition in the first 6 weeks.' },
      { label: 'Harvest at milky stage',      detail: 'Poke a kernel — clear juice means wait; milky means pick.' },
    ],
    weeks: DEFAULT_WEEKS,
  },
  strawberry: {
    steps: [
      { label: 'Plant at the right depth',  detail: 'The crown must sit right at the soil line — not buried, not exposed.' },
      { label: 'Pinch first-year flowers',  detail: 'Removing flowers the first year triples yield later.' },
      { label: 'Mulch with straw',          detail: 'Straw keeps fruit clean and holds moisture.' },
      { label: 'Net against birds',         detail: 'Cover plants once fruit starts coloring.' },
      { label: 'Renovate after harvest',    detail: 'Trim leaves and thin runners in late summer.' },
    ],
    weeks: DEFAULT_WEEKS,
  },
  cotton: {
    steps: [
      { label: 'Prep deep, warm soil',   detail: 'Cotton needs soil at 65°F+ and well-drained beds.' },
      { label: 'Plant in rows',          detail: 'Rows 30–40 inches apart give room for cultivation.' },
      { label: 'Scout for pests weekly', detail: 'Thrips, bollworm, and stink bug are the main threats.' },
      { label: 'Irrigate at flower set', detail: 'Water stress at flowering drops yield the most.' },
      { label: 'Defoliate before pick',  detail: 'For hand-pick blocks, strip leaves before harvest.' },
    ],
    weeks: DEFAULT_WEEKS,
  },
  sorghum: {
    steps: [
      { label: 'Plant in warm soil',      detail: 'Sorghum hates cold — wait for 60°F+ soil.' },
      { label: 'Seed shallow',            detail: '1 inch deep in a firm bed gives best emergence.' },
      { label: 'Control early weeds',     detail: 'First 4 weeks are critical; sorghum outruns weeds after.' },
      { label: 'Scout for aphids',        detail: 'Sugarcane aphid is the biggest yield thief.' },
      { label: 'Harvest at hard dough',   detail: 'Grain should shatter when pressed hard.' },
    ],
    weeks: DEFAULT_WEEKS,
  },
};

/**
 * Pick the step-by-step plan for a crop. Falls through to
 * DEFAULT_STEPS when the crop doesn't have a specialized plan.
 */
function planFor(cropKey) {
  return CROP_PLANS[cropKey] || { steps: DEFAULT_STEPS, weeks: DEFAULT_WEEKS };
}

/**
 * Map timing → "do this now" message. Short, imperative, farmer-facing.
 */
function doThisNow({ timing, cropName, firstStepLabel }) {
  switch (timing?.recommendation) {
    case 'plant_now':
      return `Plant your ${cropName.toLowerCase()} this week`;
    case 'plant_soon':
      return `Prep soil and gather ${cropName.toLowerCase()} seeds now`;
    case 'wait':
      return 'Plan your layout and order seeds — planting window is later';
    case 'too_late':
      return 'Planting window has closed — try the next season';
    default:
      return firstStepLabel || 'Prep soil and plan your planting';
  }
}

/**
 * Map timing → "next action" message.
 */
function nextActionFor({ timing, steps }) {
  if (timing?.recommendation === 'plant_now') return steps[1]?.label || null;
  if (timing?.recommendation === 'plant_soon') return steps[0]?.label || null;
  if (timing?.recommendation === 'wait') return 'Start seeds indoors if applicable';
  if (timing?.recommendation === 'too_late') return 'Plan for the next season';
  return steps[0]?.label || null;
}

/**
 * @param {Object} args
 * @param {string}  args.cropKey
 * @param {string}  args.cropName
 * @param {Object}  args.timing          — output of timeEngine.evaluateTiming
 */
export function buildActionPlan({ cropKey, cropName, timing }) {
  const plan = planFor(cropKey);
  return {
    doThisNow: doThisNow({ timing, cropName, firstStepLabel: plan.steps[0]?.label }),
    nextAction: nextActionFor({ timing, steps: plan.steps }),
    actionSteps: plan.steps,
    weeklyGuide: plan.weeks,
  };
}
