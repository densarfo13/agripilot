/**
 * Harvest & Post-Harvest Rules — crop-specific, stage-aware, weather-sensitive.
 *
 * Each rule defines:
 *   - which crops it applies to
 *   - which stages it fires in (harvest, post_harvest, fruiting)
 *   - category: harvest-readiness or post-harvest
 *   - base priority before weather adjustment
 *   - weather conditions that modify the recommendation
 *   - title, reason, action for farmer display
 *
 * Rules represent real agronomic guidance for tropical/sub-tropical
 * smallholder farming. Rules-based heuristics, not ML.
 *
 * RULE NOTE: These are practical, extension-grade recommendations.
 * Field-validated regional calibration would improve accuracy further.
 */

// ─── Types (JSDoc) ────────────────────────────────────────

/**
 * @typedef {'harvest-readiness'|'post-harvest'} HarvestCategory
 * @typedef {'low'|'medium'|'high'} HarvestPriority
 *
 * @typedef {Object} HarvestRule
 * @property {string} id
 * @property {string[]} crops
 * @property {string[]} stages
 * @property {HarvestCategory} category
 * @property {HarvestPriority} basePriority
 * @property {string} title
 * @property {string} reason
 * @property {string} action
 * @property {string} dueLabel
 * @property {Function} [weatherBoost]  - (weather) => boolean — boosts priority +1
 * @property {Function} [weatherReduce] - (weather) => boolean — reduces priority -1
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
function isHot(w) { return w?.temperatureC != null && w.temperatureC > 32; }

export { hasHeavyRainRisk, hasRainExpected, hasDrySpellRisk, hasHighHumidity, isHot };

// ─── Harvest rules ────────────────────────────────────────

export const HARVEST_RULES = [

  // ═══ MAIZE ═══════════════════════════════════════════════

  {
    id: 'maize-harvest-labor',
    crops: ['maize'],
    stages: ['harvest', 'fruiting'],
    category: 'harvest-readiness',
    basePriority: 'high',
    title: 'Prepare harvest labor and tools',
    reason: 'Maize harvest is labor-intensive and time-sensitive. Delayed harvest increases grain loss from birds, rodents, and field deterioration.',
    action: 'Arrange harvest labor 1-2 weeks ahead. Sharpen cutlasses and prepare sacks. If using mechanical harvester, book it early to avoid waiting.',
    dueLabel: 'This week',
    weatherBoost: null,
    weatherReduce: null,
  },
  {
    id: 'maize-dryness-check',
    crops: ['maize'],
    stages: ['harvest', 'fruiting'],
    category: 'harvest-readiness',
    basePriority: 'high',
    title: 'Check grain dryness before harvest',
    reason: 'Maize should be harvested at 20-25% moisture, then dried to 13% for safe storage. Harvesting too wet leads to mold; too dry leads to shattering.',
    action: 'Test a few cobs: press a grain with your thumbnail. If it dents but does not crush, moisture is right (20-25%). If it shatters, it may be over-dry.',
    dueLabel: 'Before harvest',
    weatherBoost: (w) => hasRainExpected(w),
    weatherReduce: (w) => hasDrySpellRisk(w),
  },
  {
    id: 'maize-drying-storage',
    crops: ['maize'],
    stages: ['post_harvest', 'harvest'],
    category: 'post-harvest',
    basePriority: 'high',
    title: 'Dry and protect harvested grain',
    reason: 'Maize must reach 13% moisture for safe storage. Wet grain develops aflatoxin (a dangerous mold) within days. Post-harvest losses can reach 20-30%.',
    action: 'Spread grain on clean tarps or raised platforms in the sun. Turn grain 2-3 times daily. Target 3-5 days of drying. Store in airtight containers or hermetic bags.',
    dueLabel: 'Immediately',
    weatherBoost: (w) => hasHighHumidity(w) || hasRainExpected(w),
    weatherReduce: (w) => hasDrySpellRisk(w) && isHot(w),
  },

  // ═══ RICE ════════════════════════════════════════════════

  {
    id: 'rice-harvest-timing',
    crops: ['rice'],
    stages: ['harvest', 'fruiting'],
    category: 'harvest-readiness',
    basePriority: 'high',
    title: 'Plan rice harvest timing',
    reason: 'Rice should be harvested when 80-85% of grains are straw-colored and firm. Early harvest gives immature grain; late harvest causes shattering and bird loss.',
    action: 'Check panicles daily. When most grains are golden and hard, drain the paddy 7-10 days before harvest to firm the soil for cutting.',
    dueLabel: 'This week',
    weatherBoost: (w) => hasRainExpected(w),
    weatherReduce: null,
  },
  {
    id: 'rice-drying-storage',
    crops: ['rice'],
    stages: ['post_harvest', 'harvest'],
    category: 'post-harvest',
    basePriority: 'high',
    title: 'Dry and store rice properly',
    reason: 'Rice paddy must be dried to 14% moisture for safe storage. Delays in drying cause discoloration and reduce milling quality and price.',
    action: 'Thresh within 24 hours of cutting. Spread on clean concrete or tarp. Dry to 14% moisture (grain cracks when bitten). Store in cool, dry, ventilated space.',
    dueLabel: 'Immediately',
    weatherBoost: (w) => hasHighHumidity(w),
    weatherReduce: null,
  },

  // ═══ CASSAVA ═════════════════════════════════════════════

  {
    id: 'cassava-harvest-window',
    crops: ['cassava'],
    stages: ['harvest', 'fruiting'],
    category: 'harvest-readiness',
    basePriority: 'high',
    title: 'Schedule cassava harvest window',
    reason: 'Cassava roots deteriorate rapidly once dug up — they become unusable within 48-72 hours. Harvest timing must be coordinated with transport and processing.',
    action: 'Plan harvest for 1-2 days before processing or market day. Harvest only what you can process or sell within 24 hours. Leave remaining plants in ground.',
    dueLabel: 'Plan ahead',
    weatherBoost: (w) => isHot(w),
    weatherReduce: null,
  },
  {
    id: 'cassava-transport-processing',
    crops: ['cassava'],
    stages: ['post_harvest', 'harvest'],
    category: 'post-harvest',
    basePriority: 'high',
    title: 'Process or transport cassava immediately',
    reason: 'Cassava spoils within 48-72 hours of harvest. Every hour of delay reduces quality and value. Processing into gari, flour, or chips extends shelf life.',
    action: 'Peel and wash roots within hours of harvest. Begin grating, pressing, and drying for gari, or slice and sun-dry for chips. Do not leave unprocessed overnight.',
    dueLabel: 'Same day',
    weatherBoost: (w) => isHot(w),
    weatherReduce: null,
  },

  // ═══ TOMATO ══════════════════════════════════════════════

  {
    id: 'tomato-harvest-frequent',
    crops: ['tomato'],
    stages: ['harvest', 'fruiting'],
    category: 'harvest-readiness',
    basePriority: 'high',
    title: 'Harvest ripe tomatoes frequently',
    reason: 'Tomatoes ripen unevenly and overripe fruit attracts pests and rots quickly. Harvesting every 2-3 days maximizes quality and reduces field losses.',
    action: 'Pick tomatoes when they show full color (red/orange) but are still firm. Twist gently to remove with calyx attached. Harvest in cool morning hours.',
    dueLabel: 'Every 2-3 days',
    weatherBoost: (w) => isHot(w),
    weatherReduce: null,
  },
  {
    id: 'tomato-sort-spoilage',
    crops: ['tomato'],
    stages: ['post_harvest', 'harvest'],
    category: 'post-harvest',
    basePriority: 'high',
    title: 'Sort and reduce spoilage',
    reason: 'Tomatoes are extremely perishable. One damaged fruit can spoil a whole crate within hours. Sorting and careful handling can reduce losses by 30-50%.',
    action: 'Sort immediately after harvest: remove cracked, bruised, or overripe fruit. Pack in single layers in ventilated crates. Keep in shade — never in direct sun or sealed containers.',
    dueLabel: 'Same day',
    weatherBoost: (w) => isHot(w) || hasHighHumidity(w),
    weatherReduce: null,
  },

  // ═══ COCOA ═══════════════════════════════════════════════

  {
    id: 'cocoa-pod-harvest',
    crops: ['cocoa'],
    stages: ['harvest', 'fruiting'],
    category: 'harvest-readiness',
    basePriority: 'high',
    title: 'Harvest ripe cocoa pods',
    reason: 'Cocoa pods should be harvested when fully ripe (yellow/orange color). Over-ripe pods germinate inside and reduce bean quality.',
    action: 'Cut ripe pods with a sharp cutlass at the stalk — do not pull or twist (damages the flower cushion). Harvest every 2-3 weeks during peak season.',
    dueLabel: 'This week',
    weatherBoost: (w) => hasRainExpected(w),
    weatherReduce: null,
  },
  {
    id: 'cocoa-fermentation-drying',
    crops: ['cocoa'],
    stages: ['post_harvest', 'harvest'],
    category: 'post-harvest',
    basePriority: 'high',
    title: 'Start fermentation and drying workflow',
    reason: 'Proper fermentation (5-7 days) develops chocolate flavor and aroma. Skipping or rushing fermentation reduces bean quality and price by 30-50%.',
    action: 'Break pods and scoop beans into fermentation box or banana-leaf heap. Cover and ferment 5-7 days, turning on day 2 and day 4. Then sun-dry to 7% moisture (6-8 days).',
    dueLabel: 'Within 24 hours',
    weatherBoost: (w) => hasHighHumidity(w) || hasRainExpected(w),
    weatherReduce: (w) => hasDrySpellRisk(w) && isHot(w),
  },
];

export default HARVEST_RULES;
