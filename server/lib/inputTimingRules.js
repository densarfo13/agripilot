/**
 * Input & Fertilizer Timing Rules — crop-specific, stage-aware, weather-sensitive.
 *
 * Each rule defines:
 *   - which crops it applies to
 *   - which stages it fires in
 *   - input category (fertilizer, irrigation, soil, pest-control, planting-input, other)
 *   - base priority before weather adjustment
 *   - weather conditions that modify the recommendation
 *   - title, reason, action for farmer display
 *
 * Rules represent real agronomic guidance for tropical/sub-tropical smallholder farming.
 * They are rules-based heuristics — not ML. Easy to extend by adding more rules.
 *
 * RULE NOTE: These are practical, extension-grade recommendations.
 * Field-validated regional calibration would improve accuracy further.
 */

// ─── Types (JSDoc) ────────────────────────────────────────

/**
 * @typedef {'fertilizer'|'irrigation'|'soil'|'pest-control'|'planting-input'|'other'} InputCategory
 * @typedef {'low'|'medium'|'high'} InputPriority
 *
 * @typedef {Object} InputTimingRule
 * @property {string} id
 * @property {string[]} crops
 * @property {string[]} stages
 * @property {InputCategory} category
 * @property {InputPriority} basePriority
 * @property {string} title
 * @property {string} delayTitle        - alternate title when conditions say "delay"
 * @property {string} reason
 * @property {string} action
 * @property {string} delayAction       - alternate action when delay is advised
 * @property {string} dueLabel
 * @property {Function} [shouldDelay]   - (weather) => boolean
 * @property {Function} [shouldBoost]   - (weather) => boolean
 */

// ─── Priority helpers ─────────────────────────────────────

const PRIORITY_ORDER = ['low', 'medium', 'high'];

export function adjustPriority(base, delta) {
  const idx = PRIORITY_ORDER.indexOf(base);
  if (idx === -1) return base;
  const newIdx = Math.max(0, Math.min(PRIORITY_ORDER.length - 1, idx + delta));
  return PRIORITY_ORDER[newIdx];
}

export { PRIORITY_ORDER };

// ─── Weather helpers ──────────────────────────────────────

function hasHeavyRainRisk(w) { return w?.heavyRainRisk === true; }
function hasRainExpected(w) { return w?.rainExpected === true; }
function hasDrySpellRisk(w) { return w?.drySpellRisk === true; }
function hasHighHumidity(w) { return w?.humidityPct != null && w.humidityPct > 80; }

export { hasHeavyRainRisk, hasRainExpected, hasDrySpellRisk, hasHighHumidity };

// ─── Input timing rules ──────────────────────────────────

export const INPUT_TIMING_RULES = [

  // ═══ MAIZE ═══════════════════════════════════════════════

  {
    id: 'maize-landprep-inputs',
    crops: ['maize'],
    stages: ['land_preparation'],
    category: 'soil',
    basePriority: 'high',
    title: 'Prepare soil amendments for maize',
    delayTitle: 'Delay soil amendments — heavy rain risk',
    reason: 'Maize requires well-prepared soil with organic matter or lime incorporated before planting. Apply 2-4 weeks before planting for best results.',
    action: 'Apply compost, manure, or lime to the field. Mix into the top 15-20cm of soil. If soil test shows low pH (<5.5), apply agricultural lime at 1-2 tonnes per hectare.',
    delayAction: 'Heavy rain could wash away soil amendments. Wait for drier conditions before applying. Prepare materials so you are ready when weather improves.',
    dueLabel: 'This week',
    shouldDelay: (w) => hasHeavyRainRisk(w),
    shouldBoost: null,
  },
  {
    id: 'maize-planting-fertilizer',
    crops: ['maize'],
    stages: ['planting'],
    category: 'fertilizer',
    basePriority: 'high',
    title: 'Apply basal fertilizer at planting',
    delayTitle: 'Delay basal fertilizer — heavy rain risk',
    reason: 'Maize needs phosphorus and potassium at planting for strong root establishment. Apply DAP or NPK 15:15:15 in the planting furrow.',
    action: 'Place 1-2 teaspoons of DAP or NPK fertilizer 5cm below and beside each seed. Do not let fertilizer touch the seed directly — it can burn germination.',
    delayAction: 'Heavy rain will wash fertilizer away from the root zone. Wait 1-2 days for rain to pass, then apply basal fertilizer immediately after.',
    dueLabel: 'At planting',
    shouldDelay: (w) => hasHeavyRainRisk(w),
    shouldBoost: null,
  },
  {
    id: 'maize-vegetative-topdress',
    crops: ['maize'],
    stages: ['vegetative'],
    category: 'fertilizer',
    basePriority: 'high',
    title: 'Apply first top-dress fertilizer',
    delayTitle: 'Delay top-dress fertilizer — heavy rain risk',
    reason: 'Maize requires nitrogen top-dressing 4-6 weeks after planting during the vegetative growth phase. This is the most critical fertilizer application for yield.',
    action: 'Apply urea or CAN at 1 teaspoon per plant, 10cm from the stem. Lightly cover with soil. Best applied when soil is moist but not waterlogged.',
    delayAction: 'Heavy rain will cause nitrogen runoff and waste your fertilizer investment. Wait for the rain risk to drop, then apply within the next 2-3 days.',
    dueLabel: 'This week',
    shouldDelay: (w) => hasHeavyRainRisk(w),
    shouldBoost: (w) => hasDrySpellRisk(w),
  },
  {
    id: 'maize-flowering-micronutrient',
    crops: ['maize'],
    stages: ['flowering'],
    category: 'fertilizer',
    basePriority: 'medium',
    title: 'Consider foliar micronutrient application',
    delayTitle: 'Delay foliar spray — rain expected',
    reason: 'Zinc and boron deficiencies can reduce maize grain fill during flowering. Foliar spray is most effective at this stage.',
    action: 'If leaves show interveinal chlorosis (zinc deficiency), apply foliar zinc sulfate at 2g/L. Spray in early morning or late afternoon to avoid leaf burn.',
    delayAction: 'Rain will wash foliar spray off leaves before absorption. Wait for a dry window of at least 4 hours before spraying.',
    dueLabel: 'This week',
    shouldDelay: (w) => hasRainExpected(w),
    shouldBoost: null,
  },

  // ═══ RICE ════════════════════════════════════════════════

  {
    id: 'rice-planting-basal',
    crops: ['rice'],
    stages: ['planting'],
    category: 'fertilizer',
    basePriority: 'high',
    title: 'Apply basal fertilizer for rice',
    delayTitle: 'Delay basal application — check water level',
    reason: 'Rice needs phosphorus at transplanting for root establishment. Apply triple superphosphate (TSP) or NPK before transplanting seedlings.',
    action: 'Broadcast 2-3 bags per hectare of NPK 15:15:15 into the puddled field 1 day before transplanting. Ensure even distribution.',
    delayAction: 'If heavy rain is flooding the field beyond recommended levels, drain first. Excess water dilutes fertilizer and carries it out of the paddy.',
    dueLabel: 'Before transplanting',
    shouldDelay: (w) => hasHeavyRainRisk(w),
    shouldBoost: null,
  },
  {
    id: 'rice-tillering-nitrogen',
    crops: ['rice'],
    stages: ['vegetative'],
    category: 'fertilizer',
    basePriority: 'high',
    title: 'Apply nitrogen at tillering stage',
    delayTitle: 'Delay nitrogen — monitor water first',
    reason: 'Split nitrogen application at active tillering maximizes tiller count and yield. This is the most important top-dress for rice.',
    action: 'Apply urea at 1-1.5 bags per hectare. Maintain 3-5cm standing water in the paddy for 3 days after application to prevent nitrogen loss.',
    delayAction: 'Dry spell risk means the paddy may not retain enough water to prevent nitrogen volatilization. Check water level before applying — if below 2cm, irrigate first.',
    dueLabel: 'This week',
    shouldDelay: (w) => hasDrySpellRisk(w),
    shouldBoost: null,
  },
  {
    id: 'rice-water-management',
    crops: ['rice'],
    stages: ['vegetative', 'flowering', 'planting'],
    category: 'irrigation',
    basePriority: 'medium',
    title: 'Monitor paddy water level',
    delayTitle: 'Monitor paddy water level',
    reason: 'Consistent water depth (3-5cm) is critical for rice nutrient uptake and weed suppression. Too much or too little water reduces yield.',
    action: 'Check paddy water depth daily. Maintain 3-5cm during vegetative and flowering stages. Drain briefly before harvest to harden the field.',
    delayAction: 'Dry spell risk — prioritize water conservation. Check irrigation supply and reduce any unnecessary drainage.',
    dueLabel: 'Daily',
    shouldDelay: null,
    shouldBoost: (w) => hasDrySpellRisk(w),
  },

  // ═══ CASSAVA ═════════════════════════════════════════════

  {
    id: 'cassava-landprep-stem',
    crops: ['cassava'],
    stages: ['land_preparation', 'planning'],
    category: 'planting-input',
    basePriority: 'medium',
    title: 'Prepare stem cuttings and soil',
    delayTitle: 'Prepare stem cuttings and soil',
    reason: 'Cassava is planted from stem cuttings, not seeds. Good cuttings from healthy mother plants are the most important input for cassava success.',
    action: 'Select 25-30cm stem cuttings from healthy, 8-12 month old plants. Choose thick stems with 5-7 nodes. Store cuttings upright in shade until planting.',
    delayAction: 'Prepare stem cuttings and soil amendments. Store cuttings in shade. Wait for suitable planting conditions.',
    dueLabel: 'Before planting',
    shouldDelay: null,
    shouldBoost: null,
  },
  {
    id: 'cassava-early-weed-input',
    crops: ['cassava'],
    stages: ['germination', 'vegetative'],
    category: 'other',
    basePriority: 'high',
    title: 'Weed control and early fertilizer',
    delayTitle: 'Delay fertilizer — heavy rain risk',
    reason: 'Cassava is most vulnerable to weed competition in the first 3 months. Early weeding combined with light fertilizer application establishes strong growth.',
    action: 'Weed around each plant at 4 and 8 weeks after planting. Apply NPK 15:15:15 at 1 teaspoon per plant after first weeding, 10cm from the stem.',
    delayAction: 'Weed as planned, but delay fertilizer application until heavy rain risk passes to prevent nutrient washout.',
    dueLabel: 'This week',
    shouldDelay: (w) => hasHeavyRainRisk(w),
    shouldBoost: null,
  },

  // ═══ TOMATO ══════════════════════════════════════════════

  {
    id: 'tomato-transplant-support',
    crops: ['tomato'],
    stages: ['planting'],
    category: 'planting-input',
    basePriority: 'high',
    title: 'Prepare transplant support inputs',
    delayTitle: 'Prepare transplant support inputs',
    reason: 'Tomato transplants need immediate nutrient access and moisture for establishment. Prepare holes with compost and starter fertilizer.',
    action: 'Dig planting holes 15cm deep, 60cm apart. Mix a handful of compost and half a teaspoon of DAP into each hole. Water holes before transplanting. Transplant in evening to reduce stress.',
    delayAction: 'Prepare holes and inputs. Transplant in evening when conditions are cooler. Ensure moisture is available at the root zone.',
    dueLabel: 'At transplanting',
    shouldDelay: null,
    shouldBoost: null,
  },
  {
    id: 'tomato-flowering-nutrient',
    crops: ['tomato'],
    stages: ['flowering', 'fruiting'],
    category: 'fertilizer',
    basePriority: 'high',
    title: 'Apply flowering/fruiting fertilizer',
    delayTitle: 'Avoid foliar applications — high humidity risk',
    reason: 'Tomatoes need potassium and calcium during flowering and fruiting to prevent blossom end rot and improve fruit quality.',
    action: 'Apply potassium-rich fertilizer (NPK 0:0:50 or wood ash) around each plant. Side-dress 10cm from stem. Water after application.',
    delayAction: 'High humidity increases disease risk on wet foliage. Use granular side-dress instead of foliar spray. Inspect for disease pressure before any application.',
    dueLabel: 'This week',
    shouldDelay: (w) => hasHighHumidity(w),
    shouldBoost: null,
  },
  {
    id: 'tomato-disease-prevention-input',
    crops: ['tomato'],
    stages: ['vegetative', 'flowering', 'fruiting'],
    category: 'pest-control',
    basePriority: 'medium',
    title: 'Preventive fungicide timing',
    delayTitle: 'Delay fungicide spray — rain expected',
    reason: 'Tomatoes are highly susceptible to fungal diseases. Preventive copper-based fungicide applied before infection is more effective than reactive treatment.',
    action: 'Apply copper fungicide every 7-10 days during humid periods. Spray undersides of leaves thoroughly. Use early morning or late afternoon timing.',
    delayAction: 'Rain will wash off fungicide before it can protect leaves. Wait for a dry window of at least 6 hours after spraying.',
    dueLabel: 'This week',
    shouldDelay: (w) => hasRainExpected(w),
    shouldBoost: (w) => hasHighHumidity(w),
  },

  // ═══ COCOA ═══════════════════════════════════════════════

  {
    id: 'cocoa-soil-nutrition',
    crops: ['cocoa'],
    stages: ['vegetative', 'flowering'],
    category: 'fertilizer',
    basePriority: 'medium',
    title: 'Apply cocoa fertilizer',
    delayTitle: 'Delay fertilizer — heavy rain risk',
    reason: 'Cocoa trees benefit from balanced NPK fertilization twice per year — at the start and middle of the rainy season for optimal uptake.',
    action: 'Apply 200-300g of NPK 0:22:18 or cocoa-specific blend per tree in a ring 30cm from the trunk. Lightly cover with mulch.',
    delayAction: 'Heavy rain will leach fertilizer below the root zone. Wait for moderate conditions before applying. Prepare measured doses so you are ready.',
    dueLabel: 'This month',
    shouldDelay: (w) => hasHeavyRainRisk(w),
    shouldBoost: null,
  },
  {
    id: 'cocoa-sanitation-input',
    crops: ['cocoa'],
    stages: ['fruiting', 'flowering', 'vegetative'],
    category: 'pest-control',
    basePriority: 'medium',
    title: 'Sanitation and protective spray timing',
    delayTitle: 'Delay spray — rain expected',
    reason: 'Removing infected pods and applying protective fungicide during wet periods is the most effective way to control black pod disease in cocoa.',
    action: 'Remove all black/infected pods and bury away from trees. Apply copper fungicide to healthy pods every 3-4 weeks during peak rainy season.',
    delayAction: 'Rain will reduce spray effectiveness. Complete pod removal now, but wait for a dry window before spraying copper fungicide.',
    dueLabel: 'This week',
    shouldDelay: (w) => hasRainExpected(w),
    shouldBoost: (w) => hasHighHumidity(w),
  },
];

export default INPUT_TIMING_RULES;
