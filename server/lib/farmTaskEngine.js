/**
 * Farm Task Engine — rules-based task generation.
 *
 * Generates deterministic daily/weekly tasks per farm based on:
 *   - crop type
 *   - crop stage
 *   - farmer type (new = guided wording, experienced = operational wording)
 *
 * Extended with seasonal timing to adjust task relevance based on
 * planting windows and active season calendar.
 *
 * Extended with weather context to adjust tasks based on current
 * conditions, rainfall forecast, and risk flags.
 *
 * Extended with pest/disease risk integration — high/medium risks
 * generate inspection tasks automatically.
 *
 * Extended with input/fertilizer timing — high-priority input
 * recommendations generate actionable tasks.
 *
 * Extended with harvest/post-harvest workflow — high-priority harvest
 * recommendations generate actionable tasks.
 *
 * Supported crops: maize, rice, cassava, tomato, cocoa
 * Supported stages: planning, land_preparation, planting, germination,
 *   vegetative, flowering, fruiting, harvest, post_harvest
 */

// ─── Types (JSDoc for IDE support) ─────────────────────────
/**
 * @typedef {'new'|'experienced'} FarmerType
 * @typedef {'planning'|'land_preparation'|'planting'|'germination'|'vegetative'|'flowering'|'fruiting'|'harvest'|'post_harvest'} CropStage
 * @typedef {'high'|'medium'|'low'} TaskPriority
 * @typedef {'pending'|'completed'|'skipped'} TaskStatus
 *
 * @typedef {Object} FarmTask
 * @property {string} id
 * @property {string} farmId
 * @property {string} title
 * @property {string} description
 * @property {TaskPriority} priority
 * @property {string} reason
 * @property {string} dueLabel
 * @property {string} crop
 * @property {CropStage} stage
 * @property {TaskStatus} status
 * @property {string} createdAt
 *
 * @typedef {Object} SeasonalContext
 * @property {number} currentMonth
 * @property {boolean|null} inPlantingWindow
 * @property {boolean|null} inSeason
 * @property {boolean} hasSeasonalData
 * @property {string|null} seasonLabel
 *
 * @typedef {Object} WeatherContext
 * @property {number|null} temperatureC
 * @property {number|null} humidityPct
 * @property {number|null} rainForecastMm
 * @property {boolean|null} rainExpected
 * @property {boolean|null} heavyRainRisk
 * @property {boolean|null} drySpellRisk
 * @property {string|null} condition
 * @property {boolean} hasWeatherData
 *
 * @typedef {Object} RuleContext
 * @property {string} farmId
 * @property {string} crop
 * @property {CropStage} stage
 * @property {FarmerType} farmerType
 * @property {SeasonalContext} [seasonal]
 * @property {WeatherContext} [weather]
 * @property {import('./pestRiskEngine.js').FarmRisk[]} [risks]
 * @property {import('./inputTimingEngine.js').FarmInputRecommendation[]} [inputRecs]
 * @property {import('./harvestEngine.js').FarmHarvestRecommendation[]} [harvestRecs]
 * @property {boolean} [hasRecentHarvestRecord] - true if farm has a harvest record in last 30 days
 * @property {boolean} [hasCostRecords] - true if farm has any cost records
 * @property {boolean} [hasRevenueData] - true if farm has harvest records with price data
 * @property {import('./farmBenchmarking.js').BenchmarkInsights} [benchmarkInsights] - detected benchmark signals
 *
 * @typedef {Object} TaskRule
 * @property {string} id
 * @property {string[]} crops       - which crops this rule applies to, or ['*'] for all
 * @property {CropStage[]} stages   - which stages this rule fires in
 * @property {TaskPriority} priority
 * @property {string} dueLabel
 * @property {{ new: string, experienced: string }} title
 * @property {{ new: string, experienced: string }} description
 * @property {string} reason
 * @property {string} [region]      - 'global' (default), 'west_africa', 'east_africa', 'tropical', 'arid'
 */

/** Region aliases: map country names to region tags */
const COUNTRY_REGION_MAP = {
  ghana: 'west_africa', nigeria: 'west_africa', 'ivory coast': 'west_africa',
  'cote d\'ivoire': 'west_africa', senegal: 'west_africa', mali: 'west_africa',
  'burkina faso': 'west_africa', togo: 'west_africa', benin: 'west_africa',
  'sierra leone': 'west_africa', liberia: 'west_africa', gambia: 'west_africa',
  kenya: 'east_africa', tanzania: 'east_africa', uganda: 'east_africa',
  rwanda: 'east_africa', ethiopia: 'east_africa', mozambique: 'east_africa',
};

/**
 * Resolve a country/location string to a region tag.
 * @param {string} [country]
 * @param {string} [location]
 * @returns {string} region tag, defaults to 'global'
 */
export function resolveRegion(country, location) {
  const norm = (country || '').toLowerCase().trim();
  return COUNTRY_REGION_MAP[norm] || 'global';
}

/** All valid crop stages */
export const CROP_STAGES = [
  'planning',
  'land_preparation',
  'planting',
  'germination',
  'vegetative',
  'flowering',
  'fruiting',
  'harvest',
  'post_harvest',
];

/** All supported crops */
export const SUPPORTED_CROPS = ['maize', 'rice', 'cassava', 'tomato', 'cocoa'];

// ═══════════════════════════════════════════════════════════
//  TASK RULES — organized by stage, then crop specificity
// ═══════════════════════════════════════════════════════════

/** @type {TaskRule[]} */
const TASK_RULES = [

  // ─── PLANNING ────────────────────────────────────────────
  {
    id: 'plan-select-seed',
    crops: ['*'],
    stages: ['planning'],
    priority: 'high',
    dueLabel: 'This week',
    title: {
      new: 'Choose your seed variety',
      experienced: 'Confirm seed variety',
    },
    description: {
      new: 'Pick a seed type that grows well in your area. Ask a local agro-dealer or extension officer for advice.',
      experienced: 'Verify seed variety selection matches this season\'s target yield and local conditions.',
    },
    reason: 'Using the right seed variety is the single biggest factor in a good harvest.',
  },
  {
    id: 'plan-budget',
    crops: ['*'],
    stages: ['planning'],
    priority: 'medium',
    dueLabel: 'This week',
    title: {
      new: 'Plan your farm budget',
      experienced: 'Review input costs',
    },
    description: {
      new: 'Write down what you will spend on seeds, fertilizer, and labor. This helps you stay on track.',
      experienced: 'Review projected input costs for seeds, fertilizer, pesticides, and labor against expected revenue.',
    },
    reason: 'Planning costs early prevents cash shortages during critical growth stages.',
  },
  {
    id: 'plan-soil-test',
    crops: ['maize', 'rice', 'tomato'],
    stages: ['planning'],
    priority: 'medium',
    dueLabel: 'Before planting',
    title: {
      new: 'Check your soil health',
      experienced: 'Assess soil nutrient status',
    },
    description: {
      new: 'Dig a small hole and look at the soil color and texture. Dark, crumbly soil is good. Ask for a soil test if possible.',
      experienced: 'Evaluate soil pH, organic matter, and NPK levels. Adjust fertilizer plan accordingly.',
    },
    reason: 'Soil health determines how well your crop absorbs nutrients and water.',
  },

  // ─── LAND PREPARATION ───────────────────────────────────
  {
    id: 'landprep-clear',
    crops: ['*'],
    stages: ['land_preparation'],
    priority: 'high',
    dueLabel: 'Today',
    title: {
      new: 'Clear your field',
      experienced: 'Complete field clearing',
    },
    description: {
      new: 'Remove old crop stalks, weeds, and debris from the field. This gives your new crop space to grow.',
      experienced: 'Clear previous crop residue and weeds. Dispose or incorporate based on soil management plan.',
    },
    reason: 'Uncleared fields harbor pests and compete with your new crop for nutrients.',
  },
  {
    id: 'landprep-till-maize',
    crops: ['maize'],
    stages: ['land_preparation'],
    priority: 'high',
    dueLabel: 'This week',
    title: {
      new: 'Prepare rows for maize',
      experienced: 'Till and mark rows',
    },
    description: {
      new: 'Dig or plough your field into rows about 75cm apart. Maize needs good spacing to grow tall.',
      experienced: 'Till to 15-20cm depth. Mark rows at 75cm spacing with 25cm intra-row spacing.',
    },
    reason: 'Proper row spacing prevents overcrowding and improves air circulation for maize.',
  },
  {
    id: 'landprep-mound-cassava',
    crops: ['cassava'],
    stages: ['land_preparation'],
    priority: 'high',
    dueLabel: 'This week',
    title: {
      new: 'Build mounds for cassava',
      experienced: 'Prepare ridges or mounds',
    },
    description: {
      new: 'Make raised mounds about 30cm high. Cassava roots grow better in loose, raised soil.',
      experienced: 'Form ridges or mounds at 1m spacing, 30cm height. Ensure good drainage.',
    },
    reason: 'Cassava tubers need loose, well-drained soil to develop properly.',
  },
  {
    id: 'landprep-beds-tomato',
    crops: ['tomato'],
    stages: ['land_preparation'],
    priority: 'high',
    dueLabel: 'This week',
    title: {
      new: 'Make raised beds for tomatoes',
      experienced: 'Prepare raised beds',
    },
    description: {
      new: 'Build raised beds about 15-20cm high and 1m wide. Tomatoes need well-drained soil.',
      experienced: 'Form raised beds 15-20cm high, 1m wide. Add compost and ensure drainage channels.',
    },
    reason: 'Raised beds prevent waterlogging which causes root rot in tomatoes.',
  },
  {
    id: 'landprep-level-rice',
    crops: ['rice'],
    stages: ['land_preparation'],
    priority: 'high',
    dueLabel: 'This week',
    title: {
      new: 'Level your rice field',
      experienced: 'Level and bund field',
    },
    description: {
      new: 'Make your field flat and even. Rice needs water to spread evenly across the whole field.',
      experienced: 'Level field to within 3cm variation. Construct or repair bunds for water management.',
    },
    reason: 'An uneven field causes unequal water distribution which leads to patchy rice growth.',
  },
  {
    id: 'landprep-shade-cocoa',
    crops: ['cocoa'],
    stages: ['land_preparation'],
    priority: 'high',
    dueLabel: 'This week',
    title: {
      new: 'Set up shade for cocoa',
      experienced: 'Establish shade canopy',
    },
    description: {
      new: 'Plant or keep shade trees in your cocoa field. Young cocoa needs about 50% shade to grow well.',
      experienced: 'Establish temporary shade at 50-60% canopy cover. Plan permanent shade tree placement.',
    },
    reason: 'Cocoa is an understory crop and burns in direct sunlight without adequate shade.',
  },

  // ─── PLANTING ───────────────────────────────────────────
  {
    id: 'plant-seeds',
    crops: ['maize', 'rice'],
    stages: ['planting'],
    priority: 'high',
    dueLabel: 'Today',
    title: {
      new: 'Plant your seeds now',
      experienced: 'Execute planting',
    },
    description: {
      new: 'Plant seeds at the right depth (about 5cm for maize, 2cm for rice). Water immediately after planting.',
      experienced: 'Plant at recommended depth and density. Ensure seed-soil contact and initial moisture.',
    },
    reason: 'Correct planting depth and timing maximize germination rates.',
  },
  {
    id: 'plant-cassava-cuttings',
    crops: ['cassava'],
    stages: ['planting'],
    priority: 'high',
    dueLabel: 'Today',
    title: {
      new: 'Plant cassava cuttings',
      experienced: 'Plant stem cuttings',
    },
    description: {
      new: 'Cut healthy stems into 25-30cm pieces. Push them into the mound at an angle, leaving 2-3 buds above soil.',
      experienced: 'Plant 25-30cm cuttings at 45-degree angle, 1m spacing. Use disease-free planting material.',
    },
    reason: 'Healthy cuttings with proper angle placement ensure faster sprouting and root development.',
  },
  {
    id: 'plant-tomato-transplant',
    crops: ['tomato'],
    stages: ['planting'],
    priority: 'high',
    dueLabel: 'Today',
    title: {
      new: 'Transplant tomato seedlings',
      experienced: 'Transplant seedlings',
    },
    description: {
      new: 'Move your seedlings from the nursery to the main field. Plant them in the evening to reduce stress.',
      experienced: 'Transplant hardened-off seedlings at 60cm spacing. Water immediately. Transplant in late afternoon.',
    },
    reason: 'Transplanting in cool hours reduces transplant shock and improves survival rate.',
  },
  {
    id: 'plant-cocoa-seedlings',
    crops: ['cocoa'],
    stages: ['planting'],
    priority: 'high',
    dueLabel: 'Today',
    title: {
      new: 'Plant cocoa seedlings',
      experienced: 'Establish cocoa seedlings',
    },
    description: {
      new: 'Dig holes 40cm deep and wide. Place your cocoa seedling gently and fill with topsoil. Water well.',
      experienced: 'Plant at 3m x 3m spacing, 40cm hole depth. Ensure collar is at soil level. Mulch around base.',
    },
    reason: 'Proper spacing and planting depth establish the foundation for productive cocoa trees.',
  },
  {
    id: 'plant-first-water',
    crops: ['*'],
    stages: ['planting'],
    priority: 'high',
    dueLabel: 'Today',
    title: {
      new: 'Water your newly planted crop',
      experienced: 'Ensure post-planting moisture',
    },
    description: {
      new: 'Give your field a good watering right after planting. Seeds and seedlings need moisture to start growing.',
      experienced: 'Apply initial irrigation or confirm adequate soil moisture post-planting.',
    },
    reason: 'Inadequate moisture in the first 48 hours is the leading cause of poor germination.',
  },

  // ─── GERMINATION ────────────────────────────────────────
  {
    id: 'germ-check-emergence',
    crops: ['maize', 'rice'],
    stages: ['germination'],
    priority: 'high',
    dueLabel: 'Today',
    title: {
      new: 'Check if seeds are sprouting',
      experienced: 'Inspect emergence rate',
    },
    description: {
      new: 'Walk through your field and count how many seedlings have come up. If less than half, you may need to replant.',
      experienced: 'Assess germination percentage. Target >80% emergence. Plan gap-filling if below 70%.',
    },
    reason: 'Early detection of poor germination allows timely replanting before the window closes.',
  },
  {
    id: 'germ-check-cassava',
    crops: ['cassava'],
    stages: ['germination'],
    priority: 'high',
    dueLabel: 'This week',
    title: {
      new: 'Check cassava sprouting',
      experienced: 'Assess cutting establishment',
    },
    description: {
      new: 'Look for green shoots coming from your cassava cuttings. Dead ones can be replaced with fresh cuttings.',
      experienced: 'Evaluate sprouting rate. Replace failed cuttings within 2-3 weeks of planting.',
    },
    reason: 'Cassava takes longer to establish and early replacement prevents empty patches.',
  },
  {
    id: 'germ-moisture',
    crops: ['*'],
    stages: ['germination'],
    priority: 'medium',
    dueLabel: 'Every 2 days',
    title: {
      new: 'Keep soil moist for sprouting',
      experienced: 'Monitor germination moisture',
    },
    description: {
      new: 'Check the soil every 2 days. If the top 5cm feels dry, water lightly. Don\'t flood the field.',
      experienced: 'Maintain consistent soil moisture at germination depth. Avoid waterlogging.',
    },
    reason: 'Uneven moisture during germination causes patchy stands and reduces yield potential.',
  },

  // ─── VEGETATIVE ─────────────────────────────────────────
  {
    id: 'veg-weed',
    crops: ['*'],
    stages: ['vegetative'],
    priority: 'high',
    dueLabel: 'This week',
    title: {
      new: 'Remove weeds from your field',
      experienced: 'First weeding',
    },
    description: {
      new: 'Pull out or hoe weeds between your crop rows. Weeds steal water and food from your plants.',
      experienced: 'Execute first weeding pass. Focus on inter-row spaces. Consider pre-emergent herbicide if heavy pressure.',
    },
    reason: 'Weeds in the first 3-4 weeks reduce yields by up to 50% through competition for light and nutrients.',
  },
  {
    id: 'veg-fertilize-maize',
    crops: ['maize'],
    stages: ['vegetative'],
    priority: 'high',
    dueLabel: 'This week',
    title: {
      new: 'Apply first fertilizer to maize',
      experienced: 'Apply nitrogen side-dress',
    },
    description: {
      new: 'Apply fertilizer (NPK or urea) near the base of each plant, about 5cm away. Don\'t let it touch the leaves.',
      experienced: 'Side-dress with urea or CAN at 4-6 weeks after planting. Band-apply 5cm from stem base.',
    },
    reason: 'Maize has the highest nitrogen demand during the vegetative stage for stalk and leaf development.',
  },
  {
    id: 'veg-fertilize-rice',
    crops: ['rice'],
    stages: ['vegetative'],
    priority: 'high',
    dueLabel: 'This week',
    title: {
      new: 'Feed your rice crop',
      experienced: 'Apply split nitrogen',
    },
    description: {
      new: 'Spread fertilizer evenly across the rice field when plants are knee-high. Keep water level low when applying.',
      experienced: 'Apply first split nitrogen at tillering. Reduce standing water before application for uptake.',
    },
    reason: 'Split nitrogen application during tillering maximizes rice tiller production.',
  },
  {
    id: 'veg-pest-check',
    crops: ['*'],
    stages: ['vegetative'],
    priority: 'medium',
    dueLabel: 'Every 3 days',
    title: {
      new: 'Look for pests on your plants',
      experienced: 'Scout for pest damage',
    },
    description: {
      new: 'Walk through the field and check leaf undersides for insects or holes. Report any unusual damage.',
      experienced: 'Scout for pest damage on 10% random sample. Note pest type, damage level, and location.',
    },
    reason: 'Early pest detection prevents small problems from becoming crop-threatening infestations.',
  },
  {
    id: 'veg-prune-cocoa',
    crops: ['cocoa'],
    stages: ['vegetative'],
    priority: 'medium',
    dueLabel: 'This week',
    title: {
      new: 'Trim extra branches on cocoa',
      experienced: 'Formation pruning',
    },
    description: {
      new: 'Cut off low branches and suckers growing from the base. Keep 3-5 main branches per tree.',
      experienced: 'Execute formation pruning. Maintain 3-5 main fan branches. Remove basal suckers and water shoots.',
    },
    reason: 'Proper pruning improves air circulation and directs energy to productive branches.',
  },

  // ─── FLOWERING ──────────────────────────────────────────
  {
    id: 'flower-water',
    crops: ['*'],
    stages: ['flowering'],
    priority: 'high',
    dueLabel: 'Today',
    title: {
      new: 'Make sure plants have enough water',
      experienced: 'Ensure adequate moisture',
    },
    description: {
      new: 'Flowering is when your crop needs the most water. Check soil moisture and irrigate if dry.',
      experienced: 'Maintain optimal soil moisture. Flowering is the most water-sensitive stage. Avoid any drought stress.',
    },
    reason: 'Water stress during flowering directly reduces the number of grains, fruits, or pods formed.',
  },
  {
    id: 'flower-pest-tomato',
    crops: ['tomato'],
    stages: ['flowering'],
    priority: 'high',
    dueLabel: 'Every 2 days',
    title: {
      new: 'Check tomato flowers for pests',
      experienced: 'Monitor flower-stage pests',
    },
    description: {
      new: 'Look for tiny insects on flowers and curling leaves. Thrips and whiteflies attack during flowering.',
      experienced: 'Scout for thrips, whitefly, and blossom end rot. Apply targeted intervention if threshold exceeded.',
    },
    reason: 'Pest damage during flowering directly reduces fruit set and overall tomato yield.',
  },
  {
    id: 'flower-pollination-cocoa',
    crops: ['cocoa'],
    stages: ['flowering'],
    priority: 'medium',
    dueLabel: 'This week',
    title: {
      new: 'Protect cocoa flower insects',
      experienced: 'Maintain pollinator habitat',
    },
    description: {
      new: 'Don\'t spray chemicals during flowering. Tiny midges pollinate cocoa flowers and chemicals kill them.',
      experienced: 'Maintain leaf litter for Forcipomyia midge habitat. Avoid insecticide during peak flowering.',
    },
    reason: 'Cocoa relies on midges for pollination and chemical spraying destroys pollinator populations.',
  },
  {
    id: 'flower-second-fert',
    crops: ['maize', 'rice'],
    stages: ['flowering'],
    priority: 'medium',
    dueLabel: 'This week',
    title: {
      new: 'Apply second fertilizer',
      experienced: 'Second top-dress application',
    },
    description: {
      new: 'Apply the second round of fertilizer now. This helps your crop fill its grains or ears.',
      experienced: 'Apply second nitrogen split at flowering/booting for grain fill. Potassium if deficiency noted.',
    },
    reason: 'Adequate nutrition at flowering ensures proper grain or ear development.',
  },

  // ─── FRUITING ───────────────────────────────────────────
  {
    id: 'fruit-monitor',
    crops: ['tomato', 'cocoa'],
    stages: ['fruiting'],
    priority: 'high',
    dueLabel: 'Every 2 days',
    title: {
      new: 'Watch your fruits growing',
      experienced: 'Monitor fruit development',
    },
    description: {
      new: 'Check fruits for size, color, and any damage or rot. Remove damaged fruits to protect healthy ones.',
      experienced: 'Assess fruit load, size progression, and pest/disease incidence. Thin if overloaded.',
    },
    reason: 'Removing damaged fruits prevents disease spread and redirects nutrients to healthy fruit.',
  },
  {
    id: 'fruit-support-tomato',
    crops: ['tomato'],
    stages: ['fruiting'],
    priority: 'high',
    dueLabel: 'This week',
    title: {
      new: 'Stake your tomato plants',
      experienced: 'Install plant support',
    },
    description: {
      new: 'Tie tomato plants to stakes or trellises. Heavy fruits can break branches and touch the ground.',
      experienced: 'Stake or trellis plants bearing fruit. Ensure proper support to prevent breakage and soil contact.',
    },
    reason: 'Fruits touching the ground rot quickly and attract pests, reducing marketable yield.',
  },
  {
    id: 'fruit-grain-fill',
    crops: ['maize', 'rice'],
    stages: ['fruiting'],
    priority: 'medium',
    dueLabel: 'This week',
    title: {
      new: 'Check grain development',
      experienced: 'Assess grain fill',
    },
    description: {
      new: 'Gently peel back a maize husk or check rice panicles. Grains should be plump and filling well.',
      experienced: 'Sample grain fill progress. Monitor for moisture stress or pest damage during critical fill period.',
    },
    reason: 'Grain fill is the final yield-determining stage and any stress now directly reduces harvest weight.',
  },
  {
    id: 'fruit-cassava-tuber',
    crops: ['cassava'],
    stages: ['fruiting'],
    priority: 'medium',
    dueLabel: 'This week',
    title: {
      new: 'Check cassava root growth',
      experienced: 'Assess tuber development',
    },
    description: {
      new: 'Carefully dig around one plant to peek at root size. Healthy roots should be thickening.',
      experienced: 'Sample tuber development at 8-10 months. Assess starch content and size for harvest timing.',
    },
    reason: 'Knowing tuber size helps plan the right harvest time for maximum starch content and weight.',
  },

  // ─── HARVEST ────────────────────────────────────────────
  {
    id: 'harvest-readiness',
    crops: ['*'],
    stages: ['harvest'],
    priority: 'high',
    dueLabel: 'Today',
    title: {
      new: 'Check if crop is ready to harvest',
      experienced: 'Confirm harvest maturity',
    },
    description: {
      new: 'Look for signs your crop is mature: dry leaves for maize, golden color for rice, firm red for tomato.',
      experienced: 'Verify maturity indicators. Check moisture content if possible. Plan harvest logistics.',
    },
    reason: 'Harvesting too early reduces yield; too late increases losses to pests, weather, and shattering.',
  },
  {
    id: 'harvest-tools',
    crops: ['*'],
    stages: ['harvest'],
    priority: 'high',
    dueLabel: 'Before harvest',
    title: {
      new: 'Get your harvest tools ready',
      experienced: 'Prepare harvest equipment',
    },
    description: {
      new: 'Clean and sharpen your tools. Get bags, baskets, and transport ready. Arrange helpers if needed.',
      experienced: 'Service equipment, prepare storage containers, arrange labor and transport.',
    },
    reason: 'Delayed harvest due to unpreparedness leads to field losses from over-ripening and weather.',
  },
  {
    id: 'harvest-storage',
    crops: ['maize', 'rice', 'cassava'],
    stages: ['harvest'],
    priority: 'medium',
    dueLabel: 'This week',
    title: {
      new: 'Prepare your storage area',
      experienced: 'Ready storage facility',
    },
    description: {
      new: 'Clean your storage room or crib. Make sure it is dry and protected from rats. Use a raised platform.',
      experienced: 'Clean and fumigate storage. Ensure adequate ventilation and pest barriers. Check moisture targets.',
    },
    reason: 'Poor storage causes 20-30% post-harvest losses across Africa each year.',
  },

  // ─── POST HARVEST ───────────────────────────────────────
  {
    id: 'post-dry',
    crops: ['maize', 'rice', 'cocoa'],
    stages: ['post_harvest'],
    priority: 'high',
    dueLabel: 'Today',
    title: {
      new: 'Dry your crop properly',
      experienced: 'Execute post-harvest drying',
    },
    description: {
      new: 'Spread your crop on a clean surface in the sun. Turn it regularly. It must be dry before storing.',
      experienced: 'Dry to target moisture: maize 13%, rice 14%, cocoa 7%. Use tarpaulins or drying platforms.',
    },
    reason: 'Excess moisture causes mold and aflatoxin contamination which makes your crop unsafe and unsellable.',
  },
  {
    id: 'post-sort',
    crops: ['*'],
    stages: ['post_harvest'],
    priority: 'medium',
    dueLabel: 'This week',
    title: {
      new: 'Sort and clean your harvest',
      experienced: 'Grade and sort harvest',
    },
    description: {
      new: 'Remove damaged, moldy, or discolored pieces. Good sorting means a better price at market.',
      experienced: 'Grade by size and quality. Remove damaged and contaminated product. Separate grades for pricing.',
    },
    reason: 'Sorted and graded produce fetches 15-30% higher prices at market.',
  },
  {
    id: 'post-market',
    crops: ['*'],
    stages: ['post_harvest'],
    priority: 'medium',
    dueLabel: 'This week',
    title: {
      new: 'Plan when to sell your crop',
      experienced: 'Evaluate market timing',
    },
    description: {
      new: 'Check prices at your local market. Sometimes waiting a few weeks after harvest gets a better price.',
      experienced: 'Compare current market prices with 2-4 week projections. Decide on immediate sale vs. storage hold.',
    },
    reason: 'Prices are typically lowest at harvest time when everyone is selling simultaneously.',
  },
  {
    id: 'post-process-cocoa',
    crops: ['cocoa'],
    stages: ['post_harvest'],
    priority: 'high',
    dueLabel: 'Today',
    title: {
      new: 'Ferment cocoa beans',
      experienced: 'Begin fermentation process',
    },
    description: {
      new: 'Pile fresh cocoa beans in a heap covered with banana leaves. Turn every 2 days for 5-7 days total.',
      experienced: 'Ferment in boxes or heaps for 5-7 days. Turn every 48 hours. Monitor temperature for proper fermentation.',
    },
    reason: 'Proper fermentation develops chocolate flavor and commands premium prices from buyers.',
  },
  {
    id: 'post-process-cassava',
    crops: ['cassava'],
    stages: ['post_harvest'],
    priority: 'high',
    dueLabel: 'Today',
    title: {
      new: 'Process cassava quickly',
      experienced: 'Begin post-harvest processing',
    },
    description: {
      new: 'Peel and process cassava within 24 hours of harvest. It spoils very fast once dug up.',
      experienced: 'Process within 24 hours. Peel, wash, and begin drying/grating for gari, flour, or starch extraction.',
    },
    reason: 'Cassava roots deteriorate rapidly after harvest and become unusable within 48-72 hours.',
  },

  // ─── REGION-SPECIFIC RULES ─────────────────────────────
  {
    id: 'region-wa-fire-prep',
    crops: ['maize', 'rice'],
    stages: ['land_preparation'],
    region: 'west_africa',
    priority: 'medium',
    dueLabel: 'Before planting',
    title: {
      new: 'Create fire breaks around your field',
      experienced: 'Establish fire breaks',
    },
    description: {
      new: 'Clear a 3-meter strip around your field to stop bush fires from reaching your farm during dry season.',
      experienced: 'Clear 3m fire breaks on all boundaries. Critical during Harmattan and pre-season burns.',
    },
    reason: 'Bush fires during the dry season destroy prepared fields and young crops across West Africa.',
  },
  {
    id: 'region-wa-harmattan-care',
    crops: ['tomato'],
    stages: ['vegetative', 'flowering'],
    region: 'west_africa',
    priority: 'high',
    dueLabel: 'This week',
    title: {
      new: 'Protect tomatoes from dry Harmattan wind',
      experienced: 'Implement Harmattan mitigation',
    },
    description: {
      new: 'Water more often and use mulch to keep soil moist. The dry dusty wind dries out tomato plants fast.',
      experienced: 'Increase irrigation frequency, apply mulch for moisture retention. Consider windbreaks if exposed.',
    },
    reason: 'Harmattan winds cause rapid moisture loss and flower drop in tomatoes across West Africa.',
  },
  {
    id: 'region-ea-terrace',
    crops: ['maize', 'rice'],
    stages: ['land_preparation'],
    region: 'east_africa',
    priority: 'medium',
    dueLabel: 'Before planting',
    title: {
      new: 'Build terraces on sloped land',
      experienced: 'Implement soil conservation terraces',
    },
    description: {
      new: 'If your field is on a slope, dig channels across the hill to slow rainwater and prevent soil washing away.',
      experienced: 'Construct contour terraces on slopes >5%. Install waterways for runoff management.',
    },
    reason: 'Highland rains in East Africa cause severe soil erosion on unprotected slopes.',
  },
  {
    id: 'region-ea-altitude-timing',
    crops: ['maize'],
    stages: ['planning'],
    region: 'east_africa',
    priority: 'medium',
    dueLabel: 'This week',
    title: {
      new: 'Choose a maize variety for your altitude',
      experienced: 'Select altitude-appropriate variety',
    },
    description: {
      new: 'Highland areas need cold-tolerant maize that takes longer to mature. Lowland areas use faster varieties.',
      experienced: 'Select variety matching elevation: highland (>1500m) needs 140+ day varieties, lowland uses 90-120 day.',
    },
    reason: 'Wrong variety for your altitude leads to poor yields or crop failure due to temperature mismatch.',
  },
];

// ═══════════════════════════════════════════════════════════
//  TASK GENERATION
// ═══════════════════════════════════════════════════════════

/**
 * Generate tasks for a farm based on rules.
 *
 * @param {RuleContext} context
 * @returns {FarmTask[]}
 */
export function generateTasksForFarm(context) {
  const { farmId, crop, stage, farmerType, country, location, seasonal, weather, risks, inputRecs, harvestRecs, hasRecentHarvestRecord, hasCostRecords, hasRevenueData, benchmarkInsights } = context;
  const normalizedCrop = (crop || '').toLowerCase().trim();
  const normalizedStage = (stage || '').toLowerCase().trim();
  const type = farmerType === 'experienced' ? 'experienced' : 'new';
  const now = new Date().toISOString();
  const farmRegion = resolveRegion(country, location);

  // Filter rules that match this crop + stage + region
  const matching = TASK_RULES.filter((rule) => {
    const stageMatch = rule.stages.includes(normalizedStage);
    if (!stageMatch) return false;
    const cropMatch = rule.crops.includes('*') || rule.crops.includes(normalizedCrop);
    if (!cropMatch) return false;
    // Region filter: rules with no region or region='global' match everyone;
    // rules with a specific region only match that region
    const ruleRegion = rule.region || 'global';
    if (ruleRegion !== 'global' && ruleRegion !== farmRegion) return false;
    return true;
  });

  // Build base tasks
  const tasks = matching.map((rule) => ({
    id: `${rule.id}-${farmId}`,
    farmId,
    title: rule.title[type],
    description: rule.description[type],
    priority: rule.priority,
    reason: rule.reason,
    dueLabel: rule.dueLabel,
    crop: normalizedCrop,
    stage: normalizedStage,
    status: 'pending',
    createdAt: now,
  }));

  // ─── Seasonal adjustment ─────────────────────────────
  // If seasonal data is available, add context-aware annotations
  if (seasonal && seasonal.hasSeasonalData) {
    // If outside planting window and in planting/planning stage, adjust priority
    if (seasonal.inPlantingWindow === false &&
        (normalizedStage === 'planning' || normalizedStage === 'planting')) {
      for (const task of tasks) {
        task.seasonalNote = 'Outside planting window — prepare for next season';
        // Downgrade urgency for planting tasks outside window
        if (task.priority === 'high') task.priority = 'medium';
      }
    }

    // If inside planting window and in planning stage, boost urgency
    if (seasonal.inPlantingWindow === true && normalizedStage === 'planning') {
      for (const task of tasks) {
        task.seasonalNote = 'Planting window is open — act soon';
        if (task.priority === 'low') task.priority = 'medium';
      }
    }

    // If outside active season entirely
    if (seasonal.inSeason === false) {
      for (const task of tasks) {
        if (!task.seasonalNote) {
          task.seasonalNote = 'Off-season — focus on preparation';
        }
      }
    }
  }

  // ─── Weather adjustment ──────────────────────────────
  // If weather data is available, add weather-aware annotations and priority shifts
  if (weather && weather.hasWeatherData) {
    for (const task of tasks) {
      // Rain expected soon → delay irrigation tasks
      if (weather.rainExpected === true && task.id.includes('water')) {
        task.weatherNote = 'Rain expected soon — delay irrigation to save water';
        if (task.priority === 'high') task.priority = 'medium';
      }

      // Heavy rain risk → warn against fertilizer application
      if (weather.heavyRainRisk === true && task.id.includes('fertil')) {
        task.weatherNote = 'Heavy rain risk — delay fertilizer to prevent washout';
        if (task.priority === 'high') task.priority = 'medium';
      }

      // Dry spell risk → prioritize irrigation and moisture retention
      if (weather.drySpellRisk === true) {
        if (task.id.includes('water') || task.id.includes('moisture')) {
          task.weatherNote = 'Dry spell risk — prioritize irrigation and moisture retention';
          if (task.priority === 'low') task.priority = 'high';
          if (task.priority === 'medium') task.priority = 'high';
        }
      }

      // High humidity during vulnerable stages → raise pest/disease watch
      if (weather.humidityPct != null && weather.humidityPct > 80) {
        const vulnerableStages = ['vegetative', 'flowering', 'fruiting'];
        if (vulnerableStages.includes(normalizedStage) && task.id.includes('pest')) {
          task.weatherNote = 'High humidity — increased disease and pest risk';
          if (task.priority === 'low') task.priority = 'high';
          if (task.priority === 'medium') task.priority = 'high';
        }
      }
    }
  }

  // ─── Pest/disease risk tasks ─────────────────────────
  // If risks are provided, inject inspection tasks for medium/high severity
  if (risks && risks.length > 0) {
    for (const risk of risks) {
      if (risk.severity === 'high' || risk.severity === 'medium') {
        const cropLabel = (risk.crop || '').charAt(0).toUpperCase() + (risk.crop || '').slice(1);
        const riskTitle = risk.type === 'pest'
          ? `Inspect ${cropLabel} for ${risk.title.replace(' risk', '').replace(' watch', '')}`
          : `Check ${cropLabel} for ${risk.title.replace(' risk', '').replace(' watch', '')} signs`;

        tasks.push({
          id: `risk-task-${risk.id}`,
          farmId,
          title: riskTitle,
          description: risk.action,
          priority: risk.severity === 'high' ? 'high' : 'medium',
          reason: risk.reason,
          dueLabel: risk.severity === 'high' ? 'Today' : 'This week',
          crop: normalizedCrop,
          stage: normalizedStage,
          status: 'pending',
          createdAt: now,
          riskNote: `${risk.type === 'pest' ? 'Pest' : 'Disease'} risk: ${risk.title}`,
        });
      }
    }
  }

  // ─── Input/fertilizer timing tasks ───────────────────
  // If input recommendations are provided, inject high-priority ones as tasks
  if (inputRecs && inputRecs.length > 0) {
    for (const rec of inputRecs) {
      if (rec.priority === 'high') {
        tasks.push({
          id: `input-task-${rec.id}`,
          farmId,
          title: rec.title,
          description: rec.action,
          priority: 'high',
          reason: rec.reason,
          dueLabel: rec.dueLabel,
          crop: normalizedCrop,
          stage: normalizedStage,
          status: 'pending',
          createdAt: now,
          inputNote: rec.isDelayed
            ? `Delayed: ${rec.category} timing adjusted for weather`
            : `Input timing: ${rec.category}`,
        });
      }
    }
  }

  // ─── Harvest/post-harvest tasks ──────────────────────
  // If harvest recommendations are provided, inject high-priority ones as tasks
  if (harvestRecs && harvestRecs.length > 0) {
    for (const rec of harvestRecs) {
      if (rec.priority === 'high') {
        tasks.push({
          id: `harvest-task-${rec.id}`,
          farmId,
          title: rec.title,
          description: rec.action,
          priority: 'high',
          reason: rec.reason,
          dueLabel: rec.dueLabel,
          crop: normalizedCrop,
          stage: normalizedStage,
          status: 'pending',
          createdAt: now,
          harvestNote: rec.category === 'post-harvest'
            ? 'Post-harvest: act quickly to reduce losses'
            : 'Harvest readiness: prepare now',
        });
      }
    }
  }

  // ─── Yield logging prompts ─────────────────────────────
  // When stage is harvest or post_harvest and no recent record exists, prompt farmer to log
  if ((normalizedStage === 'harvest' || normalizedStage === 'post_harvest') && !hasRecentHarvestRecord) {
    tasks.push({
      id: `yield-log-prompt-${farmId}`,
      farmId,
      title: 'Log your harvest yield',
      description: 'Record how much you harvested, sold, stored, and lost. This helps track your farm performance over time.',
      priority: 'medium',
      reason: 'Recording your yield helps you plan better next season and see your progress.',
      dueLabel: 'When ready',
      crop: normalizedCrop,
      stage: normalizedStage,
      status: 'pending',
      createdAt: now,
      harvestNote: 'Tap to record your harvest results',
    });
  }

  // ─── Reduce harvest-readiness tasks when a record exists ─
  // If the farmer already logged a harvest record, demote harvest-readiness tasks
  if (hasRecentHarvestRecord) {
    for (const task of tasks) {
      if (task.id && task.id.startsWith('harvest-task-') && task.harvestNote && task.harvestNote.includes('Harvest readiness')) {
        task.priority = 'low';
        task.harvestNote = 'Harvest recorded — review if needed';
      }
    }
  }

  // ─── Economics prompts ─────────────────────────────────
  // Prompt to start logging costs if none exist
  if (!hasCostRecords) {
    tasks.push({
      id: `cost-log-prompt-${farmId}`,
      farmId,
      title: 'Start logging farm costs to track profitability',
      description: 'Record seeds, fertilizer, labor, and other expenses. This helps you see if your farm is profitable.',
      priority: 'low',
      reason: 'Tracking costs helps you understand your farm as a business.',
      dueLabel: 'When ready',
      crop: normalizedCrop,
      stage: normalizedStage,
      status: 'pending',
      createdAt: now,
      economicsNote: 'Track expenses to see profitability',
    });
  }

  // Prompt to add selling price if harvest exists but no revenue data
  if (hasRecentHarvestRecord && !hasRevenueData) {
    tasks.push({
      id: `revenue-prompt-${farmId}`,
      farmId,
      title: 'Add selling price to estimate revenue',
      description: 'You logged a harvest but no selling price. Add the price per unit to see your estimated revenue.',
      priority: 'low',
      reason: 'Revenue data completes your farm economics picture.',
      dueLabel: 'When ready',
      crop: normalizedCrop,
      stage: normalizedStage,
      status: 'pending',
      createdAt: now,
      economicsNote: 'Add price data to see revenue',
    });
  }

  // ─── Benchmark-driven insights ─────────────────────────
  if (benchmarkInsights) {
    if (benchmarkInsights.noComparisonData) {
      tasks.push({
        id: `benchmark-data-prompt-${farmId}`,
        farmId,
        title: 'Keep logging harvest and costs to unlock performance comparison',
        description: 'Once you have data from two seasons, you can see how your farm is improving over time.',
        priority: 'low',
        reason: 'Season-over-season comparison needs data from at least two periods.',
        dueLabel: 'Ongoing',
        crop: normalizedCrop,
        stage: normalizedStage,
        status: 'pending',
        createdAt: now,
        benchmarkNote: 'Build history for performance tracking',
      });
    }

    if (benchmarkInsights.profitDropped) {
      tasks.push({
        id: `benchmark-profit-review-${farmId}`,
        farmId,
        title: 'Review input costs and selling prices',
        description: 'Your estimated profit dropped compared to the previous period. Review what changed in costs and selling prices.',
        priority: 'medium',
        reason: 'Profit declined significantly — understanding why helps you improve next season.',
        dueLabel: 'This week',
        crop: normalizedCrop,
        stage: normalizedStage,
        status: 'pending',
        createdAt: now,
        benchmarkNote: 'Profit dropped — review costs and prices',
      });
    }

    if (benchmarkInsights.yieldDropped) {
      tasks.push({
        id: `benchmark-yield-review-${farmId}`,
        farmId,
        title: 'Review crop stage, timing, and losses from last cycle',
        description: 'Your harvest yield dropped compared to the previous period. Review planting timing, pest issues, and post-harvest losses.',
        priority: 'medium',
        reason: 'Lower yield means less to sell — finding the cause helps you recover.',
        dueLabel: 'This week',
        crop: normalizedCrop,
        stage: normalizedStage,
        status: 'pending',
        createdAt: now,
        benchmarkNote: 'Yield dropped — review timing and losses',
      });
    }

    if (benchmarkInsights.costsIncreased) {
      tasks.push({
        id: `benchmark-cost-review-${farmId}`,
        farmId,
        title: 'Review fertilizer timing and costs',
        description: 'Your farm costs increased significantly. Check which categories grew and whether the spending improved yield.',
        priority: 'low',
        reason: 'Higher costs eat into profit — make sure the spending is worth it.',
        dueLabel: 'When ready',
        crop: normalizedCrop,
        stage: normalizedStage,
        status: 'pending',
        createdAt: now,
        benchmarkNote: 'Costs increased — review spending',
      });
    }
  }

  return tasks;
}

/**
 * Get the list of all registered rules (for testing/admin).
 * @returns {TaskRule[]}
 */
export function getAllRules() {
  return TASK_RULES;
}

export default { generateTasksForFarm, getAllRules, resolveRegion, CROP_STAGES, SUPPORTED_CROPS };
