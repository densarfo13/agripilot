/**
 * Pest & Disease Risk Rules — crop-specific, stage-aware, weather-sensitive.
 *
 * Each rule defines:
 *   - which crops it applies to
 *   - which stages it fires in
 *   - weather conditions that raise/lower severity
 *   - base severity (before weather adjustment)
 *   - risk type (pest or disease)
 *   - title, reason, action for farmer display
 *
 * Rules are simple, deterministic, and easy to extend.
 * No ML — just agronomic heuristics derived from extension guidelines.
 *
 * RULE NOTE: These rules represent real, well-documented pest/disease risks
 * for tropical/sub-tropical smallholder farming. They are not fabricated.
 * However, field-validated regional calibration would improve accuracy.
 */

// ─── Types (JSDoc) ────────────────────────────────────────

/**
 * @typedef {'pest'|'disease'} RiskType
 * @typedef {'low'|'medium'|'high'} RiskSeverity
 *
 * @typedef {Object} RiskRule
 * @property {string} id                - unique rule identifier
 * @property {string[]} crops           - which crops (or ['*'] for all)
 * @property {string[]} stages          - which crop stages this fires in
 * @property {RiskType} type            - pest or disease
 * @property {RiskSeverity} baseSeverity - severity before weather adjustment
 * @property {string} title             - farmer-facing risk title
 * @property {string} reason            - why this risk matters
 * @property {string} action            - what the farmer should do
 * @property {Function} [weatherBoost]  - (weather) => boolean — if true, severity +1
 * @property {Function} [weatherReduce] - (weather) => boolean — if true, severity -1
 */

// ─── Severity helpers ─────────────────────────────────────

const SEVERITY_ORDER = ['low', 'medium', 'high'];

/**
 * Adjust severity up or down by 1 level.
 * @param {RiskSeverity} base
 * @param {number} delta - +1 to raise, -1 to lower
 * @returns {RiskSeverity}
 */
export function adjustSeverity(base, delta) {
  const idx = SEVERITY_ORDER.indexOf(base);
  if (idx === -1) return base;
  const newIdx = Math.max(0, Math.min(SEVERITY_ORDER.length - 1, idx + delta));
  return SEVERITY_ORDER[newIdx];
}

export { SEVERITY_ORDER };

// ─── Weather condition helpers ────────────────────────────

function isHighHumidity(weather) {
  return weather?.humidityPct != null && weather.humidityPct > 80;
}

function isRainy(weather) {
  return weather?.rainExpected === true || weather?.heavyRainRisk === true;
}

function isDrySpell(weather) {
  return weather?.drySpellRisk === true;
}

function isHot(weather) {
  return weather?.temperatureC != null && weather.temperatureC > 32;
}

function isWarm(weather) {
  return weather?.temperatureC != null && weather.temperatureC > 25;
}

export { isHighHumidity, isRainy, isDrySpell, isHot, isWarm };

// ─── Risk rules ───────────────────────────────────────────

export const RISK_RULES = [
  // ═══ MAIZE ═══════════════════════════════════════════════

  {
    id: 'maize-fall-armyworm',
    crops: ['maize'],
    stages: ['vegetative', 'flowering', 'germination', 'planting'],
    type: 'pest',
    baseSeverity: 'medium',
    title: 'Fall armyworm risk',
    reason: 'Fall armyworm larvae feed on maize leaves and ears, causing severe yield loss if not caught early. Most active in warm, dry-to-moderate conditions.',
    action: 'Scout maize fields every 3 days. Check leaf whorls for frass (sawdust-like droppings) and ragged feeding holes. Remove and crush larvae by hand if found early.',
    weatherBoost: (w) => isDrySpell(w) || (isWarm(w) && !isRainy(w)),
    weatherReduce: (w) => isRainy(w) && isHighHumidity(w),
  },
  {
    id: 'maize-leaf-blight',
    crops: ['maize'],
    stages: ['vegetative', 'flowering', 'fruiting'],
    type: 'disease',
    baseSeverity: 'low',
    title: 'Leaf blight / leaf disease watch',
    reason: 'Northern and southern leaf blight spread rapidly in warm, humid conditions. Lesions reduce photosynthesis and grain fill.',
    action: 'Inspect lower leaves for long, oval, grayish-green lesions. Remove heavily infected leaves. Avoid overhead irrigation if possible.',
    weatherBoost: (w) => isHighHumidity(w) && isWarm(w),
    weatherReduce: (w) => isDrySpell(w),
  },

  // ═══ TOMATO ══════════════════════════════════════════════

  {
    id: 'tomato-fungal-disease',
    crops: ['tomato'],
    stages: ['vegetative', 'flowering', 'fruiting'],
    type: 'disease',
    baseSeverity: 'medium',
    title: 'Fungal disease risk',
    reason: 'Late blight and early blight thrive in humid, rainy conditions. Can destroy an entire tomato crop within days if untreated.',
    action: 'Check leaves for dark spots with yellow halos (early blight) or water-soaked lesions (late blight). Remove infected parts. Apply copper-based fungicide if available.',
    weatherBoost: (w) => isHighHumidity(w) || isRainy(w),
    weatherReduce: (w) => isDrySpell(w) && isHot(w),
  },
  {
    id: 'tomato-leaf-miner',
    crops: ['tomato'],
    stages: ['vegetative', 'flowering', 'fruiting'],
    type: 'pest',
    baseSeverity: 'low',
    title: 'Leaf miner / pest watch',
    reason: 'Tuta absoluta (tomato leaf miner) creates winding tunnels in leaves. Larvae feed inside leaves, reducing plant vigor and fruit quality.',
    action: 'Look for white, winding trails on leaf surfaces. Remove and destroy affected leaves. Use yellow sticky traps to monitor adult moths.',
    weatherBoost: (w) => isWarm(w) && !isRainy(w),
    weatherReduce: (w) => isRainy(w),
  },

  // ═══ RICE ════════════════════════════════════════════════

  {
    id: 'rice-blast',
    crops: ['rice'],
    stages: ['vegetative', 'flowering', 'germination'],
    type: 'disease',
    baseSeverity: 'medium',
    title: 'Blast disease watch',
    reason: 'Rice blast (Magnaporthe oryzae) is the most destructive rice disease worldwide. Spreads rapidly in warm, humid conditions with cool nights.',
    action: 'Check leaves for diamond-shaped lesions with gray centers and dark borders. Avoid excessive nitrogen fertilizer. Ensure good field drainage.',
    weatherBoost: (w) => isHighHumidity(w) && isWarm(w),
    weatherReduce: (w) => isDrySpell(w),
  },
  {
    id: 'rice-stem-borer',
    crops: ['rice'],
    stages: ['vegetative', 'flowering', 'fruiting'],
    type: 'pest',
    baseSeverity: 'low',
    title: 'Stem borer watch',
    reason: 'Yellow and striped stem borers tunnel into rice stems, causing "deadhearts" (wilted tillers) and "whiteheads" (empty panicles).',
    action: 'Check for wilted tillers or white, empty panicles. Pull up suspect tillers to look for larvae inside stems. Remove crop stubble after harvest to break the cycle.',
    weatherBoost: (w) => isWarm(w),
    weatherReduce: null,
  },

  // ═══ CASSAVA ═════════════════════════════════════════════

  {
    id: 'cassava-mosaic',
    crops: ['cassava'],
    stages: ['vegetative', 'germination', 'planting', 'flowering'],
    type: 'disease',
    baseSeverity: 'medium',
    title: 'Cassava mosaic disease watch',
    reason: 'Cassava mosaic virus (CMV) causes yellow-green mottling and leaf distortion. Spread by whiteflies and infected cuttings. Can reduce yields by 20-80%.',
    action: 'Check for yellow mosaic patterns on young leaves. Uproot and destroy severely infected plants. Use disease-free cuttings for next planting.',
    weatherBoost: (w) => isWarm(w) && isDrySpell(w),
    weatherReduce: (w) => isRainy(w),
  },
  {
    id: 'cassava-mealybug',
    crops: ['cassava'],
    stages: ['vegetative', 'flowering', 'fruiting'],
    type: 'pest',
    baseSeverity: 'low',
    title: 'Mealybug watch',
    reason: 'Cassava mealybugs (Phenacoccus manihoti) cluster on growing tips and cause leaf curling, stunting, and "bunchy top." Populations explode in dry conditions.',
    action: 'Look for white, waxy clusters on stems and leaf undersides. Prune heavily infested tips. Encourage natural enemies (parasitoid wasps).',
    weatherBoost: (w) => isDrySpell(w) && isHot(w),
    weatherReduce: (w) => isRainy(w),
  },

  // ═══ COCOA ═══════════════════════════════════════════════

  {
    id: 'cocoa-black-pod',
    crops: ['cocoa'],
    stages: ['fruiting', 'flowering', 'vegetative'],
    type: 'disease',
    baseSeverity: 'medium',
    title: 'Black pod disease watch',
    reason: 'Black pod (Phytophthora) is the most damaging cocoa disease. Causes pods to rot and turn black. Thrives in wet, humid, shaded conditions.',
    action: 'Remove and bury infected pods away from trees. Prune canopy to improve air circulation. Apply copper fungicide during peak rainy periods.',
    weatherBoost: (w) => isRainy(w) && isHighHumidity(w),
    weatherReduce: (w) => isDrySpell(w),
  },
  {
    id: 'cocoa-capsid',
    crops: ['cocoa'],
    stages: ['vegetative', 'flowering', 'fruiting'],
    type: 'pest',
    baseSeverity: 'low',
    title: 'Capsid / mirid pest watch',
    reason: 'Capsid bugs (mirids) pierce cocoa shoots and pods, causing lesion-like damage and dieback. They are most active in dry season.',
    action: 'Check new shoots and pods for small, dark feeding lesions. Apply approved insecticide during dry season if population is high. Maintain shade to deter capsids.',
    weatherBoost: (w) => isDrySpell(w),
    weatherReduce: (w) => isRainy(w) && isHighHumidity(w),
  },
];

export default RISK_RULES;
