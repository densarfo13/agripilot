/**
 * src/data/plants/knowledge.js — Plant Knowledge Database ·
 * supplement layer. Adds growthStages, commonDiseases,
 * commonPests, and careGuide on top of the existing PLANT_DB
 * (which holds identity + companion / sun / water fields).
 *
 *   import { findPlantKnowledge, composePlantEntry,
 *            GROWTH_STAGE_TEMPLATES, PLANT_KNOWLEDGE_VERSION }
 *     from 'src/data/plants/knowledge';
 *
 *   composePlantEntry('rose')
 *     → { id, commonName, scientificName, category,
 *         images[], growthStages[], commonDiseases[],
 *         commonPests[], companionPlants[], pollinatorValue,
 *         careGuide }
 *
 * What this is
 * ────────────
 *   Knowledge join layer. Reads:
 *     • PLANT_DB                — identity + companion / sun
 *     • DISEASE_DB / PEST_DB    — cross-crop reference catalogs
 *     • PLANT_KNOWLEDGE map     — growth + care per plant id
 *     • GROWTH_STAGE_TEMPLATES  — fallback by category
 *   …and emits a frozen PlantEntry envelope.
 *
 *   The structure matches the spec exactly:
 *     { id, commonName, scientificName, category, images[],
 *       growthStages[], commonDiseases[], commonPests[],
 *       companionPlants[], pollinatorValue, careGuide }
 *
 * Strict-rule audit
 *   • Pure read-only over the underlying catalogs.
 *   • Never throws. SSR-safe.
 *   • All returned arrays/objects frozen.
 *   • No PII handled.
 */

import { findPlant, PLANT_DB } from './index.js';
import { DISEASE_DB } from '../diseases/index.js';
import { PEST_DB } from '../pests/index.js';

export const PLANT_KNOWLEDGE_VERSION = 'plant-knowledge-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _arr   = (v) => (Array.isArray(v) ? v : []);
const _str   = (v) => (typeof v === 'string' ? v : '');
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

/**
 * Category-default growth-stage templates. Each plant inherits
 * the template for its category unless it overrides via
 * PLANT_KNOWLEDGE[id].growthStages.
 */
export const GROWTH_STAGE_TEMPLATES = Object.freeze({
  flower: Object.freeze([
    { stage: 'seed',       durationDays:  7, description: 'Germination — keep soil moist and warm.' },
    { stage: 'seedling',   durationDays: 14, description: 'First true leaves emerge — protect from harsh sun.' },
    { stage: 'vegetative', durationDays: 30, description: 'Foliage expansion — feed bi-weekly with balanced fertiliser.' },
    { stage: 'budding',    durationDays: 14, description: 'Flower buds form — switch to bloom-booster fertiliser.' },
    { stage: 'flowering',  durationDays: 30, description: 'Peak bloom — deadhead spent flowers to extend the season.' },
    { stage: 'post-bloom', durationDays: 30, description: 'Cut back, mulch, and let the plant rebuild reserves.' },
  ]),
  vegetable: Object.freeze([
    { stage: 'seed',       durationDays:  7, description: 'Germination — sow at correct depth, keep soil 18-25 °C.' },
    { stage: 'seedling',   durationDays: 14, description: 'Cotyledons + first true leaves — thin to spacing.' },
    { stage: 'vegetative', durationDays: 30, description: 'Leaf and stem development — feed nitrogen-rich.' },
    { stage: 'flowering',  durationDays: 14, description: 'Pollination critical — encourage pollinators.' },
    { stage: 'fruiting',   durationDays: 30, description: 'Set and swell — switch to potassium-rich feed.' },
    { stage: 'harvest',    durationDays: 14, description: 'Pick at peak ripeness — harvest regularly to extend yield.' },
  ]),
  fruit: Object.freeze([
    { stage: 'juvenile',   durationDays: 365, description: 'Pre-bearing — focus on structural pruning and root health.' },
    { stage: 'vegetative', durationDays:  60, description: 'Spring flush — leaf-out and new growth.' },
    { stage: 'flowering',  durationDays:  21, description: 'Bloom — ensure pollinator access.' },
    { stage: 'fruiting',   durationDays:  90, description: 'Fruit set and development — irrigate consistently.' },
    { stage: 'harvest',    durationDays:  21, description: 'Pick at peak — store or process quickly.' },
    { stage: 'dormant',    durationDays: 120, description: 'Winter rest — prune deciduous trees while leafless.' },
  ]),
  herb: Object.freeze([
    { stage: 'seed',       durationDays:  7, description: 'Surface-sow most herbs — keep moist and warm.' },
    { stage: 'seedling',   durationDays: 14, description: 'Pinch tops when 4 true leaves appear to encourage branching.' },
    { stage: 'vegetative', durationDays: 30, description: 'Harvest leaves regularly — never more than 1/3 at a time.' },
    { stage: 'flowering',  durationDays: 14, description: 'Pinch flowers to keep flavour strong (basil, mint).' },
    { stage: 'harvest',    durationDays: 60, description: 'Continuous harvest — preserve excess via drying or freezing.' },
  ]),
  houseplant: Object.freeze([
    { stage: 'establishing', durationDays: 30, description: 'Acclimate to new home — avoid drafts and stress.' },
    { stage: 'vegetative',   durationDays: 90, description: 'Active growth — fertilise monthly during spring/summer.' },
    { stage: 'mature',       durationDays: 365, description: 'Steady state — repot every 1-2 years as roots fill the pot.' },
    { stage: 'rest',         durationDays: 90, description: 'Winter slowdown — reduce watering and skip fertiliser.' },
  ]),
  crop: Object.freeze([
    { stage: 'planting',     durationDays:  7, description: 'Sow seed at recommended depth and spacing for the region.' },
    { stage: 'germination',  durationDays:  7, description: 'Emergence — ensure consistent moisture and warmth.' },
    { stage: 'vegetative',   durationDays: 40, description: 'Tillering and leaf development — apply nitrogen top-dress.' },
    { stage: 'reproductive', durationDays: 30, description: 'Flowering and head/cob/pod formation — critical water phase.' },
    { stage: 'maturity',     durationDays: 30, description: 'Grain or pod fill — water stress now reduces yield drastically.' },
    { stage: 'harvest',      durationDays: 14, description: 'Harvest at correct moisture content; store dry.' },
  ]),
});

/**
 * Plant-specific knowledge supplement. Each entry overrides the
 * category template's growthStages where useful and provides a
 * care guide + cross-references into DISEASE_DB / PEST_DB.
 *
 * Image refs point into the Verified Plant Media System
 * (plants/<folder>/<slug>) — the resolver falls back when the
 * asset is not yet uploaded.
 */
export const PLANT_KNOWLEDGE = Object.freeze({
  // ─── Flowers ────────────────────────────────────────────────
  rose: {
    commonDiseases: ['black-spot', 'powdery-mildew', 'rust', 'downy-mildew'],
    commonPests:    ['aphids', 'thrips', 'spider-mites', 'beetles'],
    images:         ['plants/flowers/rose'],
    careGuide: {
      water:       'Deep watering 2-3× per week at soil level. Avoid wetting leaves.',
      sun:         'Full sun — at least 6 hours of direct light daily.',
      soil:        'Loamy, well-draining, slightly acidic pH 6.0-6.5.',
      fertilizer:  'Balanced 10-10-10 monthly through growing season; stop 6 weeks before frost.',
      pruning:     'Hard prune in early spring before new growth; deadhead through summer.',
      temperature: '15-24 °C ideal. Mulch base for winter protection in zones 5-6.',
      notes:       'Apply preventative fungicide spray every 2 weeks during humid weather.',
    },
  },
  lavender: {
    commonDiseases: ['root-rot', 'leaf-spot'],
    commonPests:    ['whitefly', 'spider-mites'],
    images:         ['plants/flowers/lavender'],
    careGuide: {
      water:       'Drought-tolerant — water deeply but infrequently. Never let roots sit wet.',
      sun:         'Full sun. Heat-loving Mediterranean native.',
      soil:        'Sandy or gravelly with excellent drainage; pH 6.5-7.5.',
      fertilizer:  'Minimal — over-fertilising reduces fragrance. Light compost top-dress in spring.',
      pruning:     'Light prune after flowering; avoid cutting into woody base.',
      temperature: 'Hardy to -15 °C once established. Heat-tolerant to 35 °C.',
      notes:       'Excellent companion for roses; repels aphids and mosquitoes.',
    },
  },
  hibiscus: {
    commonDiseases: ['leaf-spot', 'powdery-mildew', 'sooty-mold'],
    commonPests:    ['aphids', 'whitefly', 'mealybugs', 'spider-mites'],
    images:         ['plants/flowers/hibiscus'],
    careGuide: {
      water:       'Consistent moisture, never soggy. Wilting signals immediate watering.',
      sun:         'Full sun for blooms; light afternoon shade in hottest climates.',
      soil:        'Rich, well-draining, neutral to slightly acidic.',
      fertilizer:  'High-potassium bloom feed every 2 weeks in growing season.',
      pruning:     'Light shape pruning in spring; remove crossing branches.',
      temperature: 'Tropical species above 10 °C. Hardy hibiscus zones 4-9.',
      notes:       'Buds drop if stressed — keep watering and feeding consistent.',
    },
  },
  sunflower: {
    commonDiseases: ['powdery-mildew', 'rust', 'leaf-spot'],
    commonPests:    ['aphids', 'beetles', 'armyworm'],
    images:         ['plants/flowers/sunflower'],
    careGuide: {
      water:       'Deep weekly watering; mature plants are quite drought-tolerant.',
      sun:         'Full sun. Heads follow the sun (heliotropism) when young.',
      soil:        'Tolerates most soils; prefers well-draining loam pH 6.0-7.5.',
      fertilizer:  'Balanced fertiliser at planting; high-phosphorus when budding.',
      pruning:     'No pruning — stake tall varieties to prevent wind damage.',
      temperature: '20-30 °C ideal. Frost-sensitive — plant after last frost.',
      notes:       'Excellent trap crop for aphids away from vegetables.',
    },
  },
  marigold: {
    commonDiseases: ['powdery-mildew', 'leaf-spot'],
    commonPests:    ['spider-mites', 'thrips', 'aphids'],
    images:         ['plants/flowers/marigold'],
    careGuide: {
      water:       'Moderate — let soil dry slightly between waterings.',
      sun:         'Full sun — 6+ hours daily for best bloom.',
      soil:        'Average garden soil; not picky about fertility.',
      fertilizer:  'Light feed monthly; over-feeding reduces blooming.',
      pruning:     'Deadhead spent blooms to encourage continuous flowering.',
      temperature: '15-30 °C. Annual in most climates; reseeds in mild zones.',
      notes:       'Companion planting champion — deters nematodes and many insects.',
    },
  },
  tulip: {
    commonDiseases: ['tulip-fire', 'rust', 'root-rot'],
    commonPests:    ['aphids', 'thrips'],
    images:         ['plants/flowers/tulip'],
    careGuide: {
      water:       'Moist during growth and bloom; let dry after foliage dies back.',
      sun:         'Full sun during bloom; tolerates dappled shade after.',
      soil:        'Well-draining sandy loam; pH 6.0-7.0.',
      fertilizer:  'Bulb fertiliser at planting and again when shoots emerge.',
      pruning:     'Remove spent flowers; let foliage yellow naturally to feed the bulb.',
      temperature: 'Requires 12-14 weeks of cold dormancy below 10 °C. Hardy zones 3-8.',
      notes:       'Treat as annuals in warm climates — chill bulbs in the fridge before planting.',
    },
  },
  orchid: {
    commonDiseases: ['root-rot', 'leaf-spot', 'black-spot'],
    commonPests:    ['mealybugs', 'scale', 'spider-mites', 'thrips'],
    images:         ['plants/flowers/orchid'],
    careGuide: {
      water:       'Soak medium thoroughly, let drain completely; once a week typically.',
      sun:         'Bright indirect light. East- or shaded-south windows.',
      soil:        'Special orchid bark mix — never standard potting soil.',
      fertilizer:  'Weak orchid fertiliser ("weakly weekly") during growth.',
      pruning:     'Cut spent flower spike above a node for potential rebloom.',
      temperature: '18-27 °C day, 13-18 °C night. The day-night swing triggers blooming.',
      notes:       'Aerial roots are normal — do not bury them in the bark mix.',
    },
  },
  daisy: {
    commonDiseases: ['powdery-mildew', 'leaf-spot', 'rust'],
    commonPests:    ['aphids', 'thrips', 'spider-mites'],
    images:         ['plants/flowers/daisy'],
    careGuide: {
      water:       'Even moisture; tolerates short dry spells once established.',
      sun:         'Full sun to light shade.',
      soil:        'Average well-draining; tolerates poor soils.',
      fertilizer:  'Light feed monthly; over-feeding reduces flowering.',
      pruning:     'Deadhead regularly; cut back after main flush to encourage rebloom.',
      temperature: 'Hardy zones 4-9. Tolerates 0-30 °C range.',
      notes:       'Divide clumps every 2-3 years to keep them vigorous.',
    },
  },
  hydrangea: {
    commonDiseases: ['powdery-mildew', 'leaf-spot', 'anthracnose'],
    commonPests:    ['aphids', 'spider-mites', 'scale'],
    images:         ['plants/flowers/hydrangea'],
    careGuide: {
      water:       'Consistent deep moisture; wilts dramatically when thirsty.',
      sun:         'Morning sun + afternoon shade. Full shade in hot climates.',
      soil:        'Rich, organic, evenly moist. Bloom color responds to pH (acidic = blue, alkaline = pink).',
      fertilizer:  'Light spring feed; avoid high nitrogen which reduces flowers.',
      pruning:     'Depends on species — read the label before cutting.',
      temperature: 'Hardy zones 3-9 depending on cultivar.',
      notes:       'Mulch heavily to retain moisture and protect shallow roots.',
    },
  },
  petunia: {
    commonDiseases: ['root-rot', 'powdery-mildew'],
    commonPests:    ['aphids', 'thrips', 'whitefly'],
    images:         ['plants/flowers/petunia'],
    careGuide: {
      water:       'Even moisture; container petunias may need daily watering in heat.',
      sun:         'Full sun for best bloom.',
      soil:        'Light, well-draining potting mix.',
      fertilizer:  'Liquid feed every 2 weeks; petunias are heavy feeders.',
      pruning:     'Pinch growing tips early; cut back leggy stems midsummer.',
      temperature: '15-29 °C ideal. Stops blooming above 32 °C.',
      notes:       'Deadhead daily for continuous flowering.',
    },
  },
  begonia: {
    commonDiseases: ['powdery-mildew', 'leaf-spot', 'root-rot'],
    commonPests:    ['mealybugs', 'whitefly', 'thrips'],
    images:         ['plants/flowers/begonia'],
    careGuide: {
      water:       'Keep moist but not soggy. Water at soil level.',
      sun:         'Bright indirect light or dappled shade. Direct sun scorches.',
      soil:        'Light, well-draining, slightly acidic potting mix.',
      fertilizer:  'Diluted liquid fertiliser every 2 weeks during growth.',
      pruning:     'Pinch back leggy growth to encourage branching.',
      temperature: '18-24 °C. Bring tender types indoors below 10 °C.',
      notes:       'Tuberous types go dormant — reduce watering when foliage yellows in autumn.',
    },
  },
  dahlia: {
    commonDiseases: ['powdery-mildew', 'wilt', 'leaf-spot'],
    commonPests:    ['aphids', 'thrips', 'spider-mites', 'beetles'],
    images:         ['plants/flowers/dahlia'],
    careGuide: {
      water:       'Deep watering 2× per week once tubers sprout. Avoid wet foliage.',
      sun:         'Full sun — 6+ hours daily.',
      soil:        'Rich, well-draining, neutral pH.',
      fertilizer:  'Low-nitrogen, high-phosphorus formula every 3-4 weeks.',
      pruning:     'Pinch growing tips at 30 cm; disbud side buds for show-size blooms.',
      temperature: '15-25 °C ideal. Lift tubers and store frost-free below zone 8.',
      notes:       'Stake early — dahlias are top-heavy when in bloom.',
    },
  },
  chrysanthemum: {
    commonDiseases: ['leaf-spot', 'powdery-mildew', 'rust'],
    commonPests:    ['aphids', 'thrips', 'spider-mites'],
    images:         ['plants/flowers/chrysanthemum'],
    careGuide: {
      water:       'Consistent moisture; mulch to even out soil moisture swings.',
      sun:         'Full sun for compact growth and abundant blooms.',
      soil:        'Rich, well-draining, slightly acidic.',
      fertilizer:  'Balanced fertiliser monthly until buds form, then stop.',
      pruning:     'Pinch tips every 2 weeks until midsummer for bushy plants.',
      temperature: '13-21 °C ideal. Hardy zones 5-9.',
      notes:       'Short-day plants — bloom triggered by long autumn nights.',
    },
  },
  jasmine: {
    commonDiseases: ['leaf-spot', 'rust', 'early-blight'],
    commonPests:    ['aphids', 'mealybugs', 'whitefly', 'scale'],
    images:         ['plants/flowers/jasmine'],
    careGuide: {
      water:       'Keep evenly moist during growth; reduce in winter rest period.',
      sun:         'Full sun to part shade; 4-6 hours direct light minimum.',
      soil:        'Rich, well-draining, slightly acidic.',
      fertilizer:  'High-phosphorus bloom feed every 2-3 weeks in spring/summer.',
      pruning:     'Light prune after flowering to shape and remove old wood.',
      temperature: '15-25 °C. Most are tender below -3 °C.',
      notes:       'Train on a trellis or arbor; fragrance peaks at night.',
    },
  },
  bougainvillea: {
    commonDiseases: ['leaf-spot', 'early-blight'],
    commonPests:    ['aphids', 'mealybugs', 'scale', 'thrips'],
    images:         ['plants/flowers/bougainvillea'],
    careGuide: {
      water:       'Drought-stress triggers blooming — water deeply, then let dry out.',
      sun:         'Full sun, 6+ hours direct. More sun = more bracts.',
      soil:        'Well-draining, slightly acidic. Tolerates poor soil.',
      fertilizer:  'Low-nitrogen, high-phosphorus formula monthly.',
      pruning:     'Hard prune after each bloom flush to encourage repeat flowering.',
      temperature: 'Tropical — protect below 5 °C. Container culture in cold zones.',
      notes:       'Handle gently — sharp thorns and brittle roots.',
    },
  },
  zinnia: {
    commonDiseases: ['powdery-mildew', 'leaf-spot', 'early-blight'],
    commonPests:    ['aphids', 'spider-mites', 'beetles'],
    images:         ['plants/flowers/zinnia'],
    careGuide: {
      water:       'Water at soil level to prevent foliar disease.',
      sun:         'Full sun — heat-loving annuals.',
      soil:        'Rich, well-draining; tolerates average garden soil.',
      fertilizer:  'Light feed monthly; over-feeding reduces blooms.',
      pruning:     'Pinch growing tips early; deadhead spent blooms.',
      temperature: '20-30 °C ideal. Plant after last frost.',
      notes:       'Excellent cut flower; pollinator magnet for butterflies.',
    },
  },
  geranium: {
    commonDiseases: ['leaf-spot', 'early-blight', 'rust'],
    commonPests:    ['aphids', 'whitefly', 'spider-mites'],
    images:         ['plants/flowers/geranium'],
    careGuide: {
      water:       'Let top 2 cm dry between waterings. Avoid wetting leaves.',
      sun:         'Full sun to part shade.',
      soil:        'Well-draining potting mix; tolerates average soil.',
      fertilizer:  'Liquid feed every 2 weeks during growing season.',
      pruning:     'Deadhead spent flower clusters; pinch leggy stems.',
      temperature: '15-24 °C. Bring indoors below 7 °C; treat as houseplant in winter.',
      notes:       'True hardy geraniums (Geranium spp.) are perennial; "geraniums" sold at garden centres are usually Pelargonium.',
    },
  },
  peony: {
    commonDiseases: ['powdery-mildew', 'leaf-spot', 'early-blight', 'root-rot'],
    commonPests:    ['aphids', 'thrips'],
    images:         ['plants/flowers/peony'],
    careGuide: {
      water:       'Deep weekly watering during growth and bloom.',
      sun:         'Full sun for best bloom; tolerates light afternoon shade.',
      soil:        'Rich, well-draining loam; pH 6.5-7.0.',
      fertilizer:  'Bone meal in spring; balanced feed after flowering.',
      pruning:     'Cut herbaceous types to the ground in autumn; tree peonies need no annual pruning.',
      temperature: 'Hardy zones 3-8. Requires winter chill to bloom.',
      notes:       'Plant tubers shallowly (2-5 cm deep) — buried too deep = no blooms.',
    },
  },
  camellia: {
    commonDiseases: ['leaf-spot', 'root-rot', 'anthracnose'],
    commonPests:    ['aphids', 'scale', 'spider-mites'],
    images:         ['plants/flowers/camellia'],
    careGuide: {
      water:       'Consistent moisture; never let dry completely.',
      sun:         'Dappled shade or morning sun + afternoon shade.',
      soil:        'Acidic (pH 5.5-6.5), well-draining, rich in organic matter.',
      fertilizer:  'Acid-loving plant fertiliser after flowering and again in summer.',
      pruning:     'Light prune after blooming; remove dead or crossed branches.',
      temperature: 'Hardy zones 7-9. Protect buds from late frosts.',
      notes:       'Bud drop is usually water-stress related — mulch heavily.',
    },
  },
  azalea: {
    commonDiseases: ['root-rot', 'leaf-spot', 'powdery-mildew'],
    commonPests:    ['spider-mites', 'whitefly', 'thrips'],
    images:         ['plants/flowers/azalea'],
    careGuide: {
      water:       'Consistent moisture; shallow roots dry quickly.',
      sun:         'Dappled or filtered shade. Direct afternoon sun scorches.',
      soil:        'Highly acidic (pH 4.5-6.0), well-draining, peat-rich.',
      fertilizer:  'Acid-loving formula in spring after flowering.',
      pruning:     'Light shape pruning right after blooming.',
      temperature: 'Hardy zones 5-9 depending on cultivar.',
      notes:       'All parts toxic if ingested — keep away from livestock and pets.',
    },
  },

  // ─── Vegetables ─────────────────────────────────────────────
  tomato: {
    commonDiseases: ['early-blight', 'late-blight', 'leaf-spot', 'wilt', 'powdery-mildew', 'fusarium-wilt', 'mosaic-virus'],
    commonPests:    ['aphids', 'whitefly', 'spider-mites', 'thrips', 'armyworm', 'beetles', 'caterpillars', 'root-knot-nematodes'],
    images:         ['plants/vegetables/tomato'],
    careGuide: {
      water:       'Deep watering 2-3× per week; consistent moisture prevents blossom-end rot.',
      sun:         'Full sun — 6-8 hours direct light.',
      soil:        'Rich, well-draining, pH 6.0-6.8. Add compost generously.',
      fertilizer:  'Balanced at planting; switch to higher phosphorus and potassium when flowering.',
      pruning:     'Pinch suckers on indeterminate varieties; stake or cage.',
      temperature: '21-29 °C optimum. Fruit set drops above 32 °C or below 13 °C.',
      notes:       'Mulch to even out soil moisture and prevent splash-borne disease.',
    },
  },
  pepper: {
    commonDiseases: ['early-blight', 'leaf-spot', 'wilt', 'mosaic-virus'],
    commonPests:    ['aphids', 'whitefly', 'spider-mites', 'thrips', 'caterpillars', 'root-knot-nematodes'],
    images:         ['plants/vegetables/pepper'],
    careGuide: {
      water:       'Even moisture; deep watering 1-2× per week.',
      sun:         'Full sun — 6+ hours direct light.',
      soil:        'Rich, well-draining, pH 6.2-7.0.',
      fertilizer:  'Light nitrogen at planting; phosphorus and potassium when fruiting.',
      pruning:     'No pruning needed; stake bell pepper varieties.',
      temperature: '21-29 °C. Cold-sensitive — plant after frost danger.',
      notes:       'Hot peppers thrive in heat; bell peppers prefer slightly cooler nights.',
    },
  },
  cucumber: {
    commonDiseases: ['powdery-mildew', 'early-blight', 'wilt', 'leaf-spot', 'downy-mildew', 'mosaic-virus'],
    commonPests:    ['aphids', 'whitefly', 'spider-mites', 'beetles', 'root-knot-nematodes'],
    images:         ['plants/vegetables/cucumber'],
    careGuide: {
      water:       'Deep daily watering during fruit set; cucumbers are 95 % water.',
      sun:         'Full sun.',
      soil:        'Rich, well-draining; pH 6.0-7.0.',
      fertilizer:  'Heavy feeder — balanced fertiliser every 2 weeks.',
      pruning:     'Trellis vining types; pinch tips at 1.5 m to encourage side shoots.',
      temperature: '21-29 °C. Frost-tender.',
      notes:       'Pick young and often to keep plants producing.',
    },
  },
  lettuce: {
    commonDiseases: ['leaf-spot', 'wilt', 'powdery-mildew', 'downy-mildew'],
    commonPests:    ['aphids', 'thrips', 'whitefly', 'snails-and-slugs', 'leaf-miners'],
    images:         ['plants/vegetables/lettuce'],
    careGuide: {
      water:       'Light, frequent watering; shallow roots dry quickly.',
      sun:         'Full sun in cool weather; afternoon shade in warm climates.',
      soil:        'Rich, loose, evenly moist; pH 6.0-7.0.',
      fertilizer:  'Light nitrogen every 2 weeks; lettuce grows fast.',
      pruning:     'Harvest outer leaves on loose-leaf types; cut head types whole.',
      temperature: '13-21 °C ideal. Bolts (flowers + turns bitter) above 24 °C.',
      notes:       'Successional sow every 2 weeks for continuous harvest.',
    },
  },
  spinach: {
    commonDiseases: ['leaf-spot', 'wilt', 'rust', 'downy-mildew'],
    commonPests:    ['aphids', 'thrips', 'beetles', 'leaf-miners'],
    images:         ['plants/vegetables/spinach'],
    careGuide: {
      water:       'Even moisture; mulch to keep soil cool.',
      sun:         'Full sun in spring/autumn; light shade in summer.',
      soil:        'Rich, neutral to slightly alkaline (pH 6.5-7.5).',
      fertilizer:  'Nitrogen-rich feed; spinach needs steady N for leaf growth.',
      pruning:     'Harvest outer leaves continuously or cut whole plants young.',
      temperature: '7-21 °C. Bolts above 24 °C — switch to heat-tolerant varieties in summer.',
      notes:       'Bolt-resistant Asian varieties (e.g. Malabar, New Zealand) extend the season.',
    },
  },
  cabbage: {
    commonDiseases: ['early-blight', 'wilt', 'leaf-spot', 'root-rot', 'clubroot', 'downy-mildew'],
    commonPests:    ['aphids', 'thrips', 'beetles', 'armyworm', 'caterpillars', 'snails-and-slugs'],
    images:         ['plants/vegetables/cabbage'],
    careGuide: {
      water:       'Deep, consistent watering — uneven moisture causes head splitting.',
      sun:         'Full sun.',
      soil:        'Rich, firm, well-draining; pH 6.5-7.5.',
      fertilizer:  'High nitrogen at planting and mid-season.',
      pruning:     'Remove yellow lower leaves; otherwise no pruning.',
      temperature: '13-18 °C ideal. Tolerates light frost.',
      notes:       'Twist mature heads sideways to break feeder roots and prevent splitting before harvest.',
    },
  },
  onion: {
    commonDiseases: ['early-blight', 'wilt', 'leaf-spot', 'rust'],
    commonPests:    ['thrips', 'aphids'],
    images:         ['plants/vegetables/onion'],
    careGuide: {
      water:       'Even moisture during bulb formation; cut back as tops fall.',
      sun:         'Full sun.',
      soil:        'Loose, well-draining, pH 6.0-7.0.',
      fertilizer:  'Nitrogen-rich feed during leaf growth; stop when bulbing begins.',
      pruning:     'None.',
      temperature: '13-25 °C. Day-length sensitive — choose short/long-day variety for your latitude.',
      notes:       'Stop watering when tops fall over to cure bulbs for storage.',
    },
  },
  carrot: {
    commonDiseases: ['leaf-spot', 'early-blight', 'root-rot'],
    commonPests:    ['aphids', 'thrips', 'beetles', 'root-knot-nematodes'],
    images:         ['plants/vegetables/carrot'],
    careGuide: {
      water:       'Even moisture; uneven watering causes cracking and forking.',
      sun:         'Full sun to light shade.',
      soil:        'Deep, loose, stone-free, pH 6.0-6.8.',
      fertilizer:  'Low-nitrogen, higher phosphorus and potassium.',
      pruning:     'Thin seedlings to 5 cm apart for full-size roots.',
      temperature: '16-24 °C. Sweetens with autumn cold.',
      notes:       'Cover shoulders with soil to prevent green tops on carrots.',
    },
  },
  kale: {
    commonDiseases: ['leaf-spot', 'early-blight', 'powdery-mildew', 'clubroot'],
    commonPests:    ['aphids', 'thrips', 'whitefly', 'beetles', 'armyworm', 'caterpillars'],
    images:         ['plants/vegetables/kale'],
    careGuide: {
      water:       'Even moisture; mulch heavily.',
      sun:         'Full sun in cool weather; afternoon shade in heat.',
      soil:        'Rich, well-draining, pH 6.0-7.5.',
      fertilizer:  'Nitrogen-rich monthly during growth.',
      pruning:     'Harvest outer leaves continuously; never strip a plant bare.',
      temperature: 'Cold-hardy to -10 °C. Sweetens with frost.',
      notes:       'Cover with row cover to deter cabbage moth without spraying.',
    },
  },
  broccoli: {
    commonDiseases: ['leaf-spot', 'early-blight', 'wilt', 'root-rot', 'clubroot'],
    commonPests:    ['aphids', 'beetles', 'armyworm', 'whitefly', 'caterpillars'],
    images:         ['plants/vegetables/broccoli'],
    careGuide: {
      water:       'Deep, consistent watering — heads need steady moisture.',
      sun:         'Full sun.',
      soil:        'Rich, firm, well-draining, pH 6.5-7.5.',
      fertilizer:  'Heavy feeder — nitrogen at planting, then balanced when heads form.',
      pruning:     'Cut main head 15 cm below the head to encourage side shoots.',
      temperature: '13-20 °C ideal. Bolts above 24 °C.',
      notes:       'Harvest before yellow flowers appear for tightest heads.',
    },
  },

  // ─── Fruits ─────────────────────────────────────────────────
  mango: {
    commonDiseases: ['anthracnose', 'powdery-mildew', 'leaf-spot'],
    commonPests:    ['thrips', 'mealybugs', 'scale', 'aphids', 'fruit-flies'],
    images:         ['plants/fruits/mango'],
    careGuide: {
      water:       'Deep watering during flowering and fruit development; reduce in dormancy.',
      sun:         'Full sun.',
      soil:        'Deep, well-draining loam; pH 5.5-7.5.',
      fertilizer:  'Balanced fertiliser 3-4× per year; avoid high N near bloom.',
      pruning:     'Prune after harvest to maintain shape and open canopy.',
      temperature: 'Tropical — protect below 10 °C. Hardy zones 10-11.',
      notes:       'Bears alternate years naturally; thinning fruit improves consistency.',
    },
  },
  apple: {
    commonDiseases: ['leaf-spot', 'rust', 'powdery-mildew', 'anthracnose', 'fire-blight'],
    commonPests:    ['aphids', 'scale', 'spider-mites', 'beetles'],
    images:         ['plants/fruits/apple'],
    careGuide: {
      water:       'Weekly deep watering for young trees; mature trees often rainfall-only.',
      sun:         'Full sun.',
      soil:        'Well-draining loam, pH 6.0-7.0.',
      fertilizer:  'Light balanced fertiliser in early spring.',
      pruning:     'Annual dormant prune to maintain open vase shape.',
      temperature: 'Hardy zones 3-8 depending on cultivar. Needs winter chill hours.',
      notes:       'Cross-pollinate — plant at least two compatible varieties.',
    },
  },
  banana: {
    commonDiseases: ['leaf-spot', 'wilt', 'anthracnose', 'fusarium-wilt'],
    commonPests:    ['aphids', 'thrips', 'mealybugs'],
    images:         ['plants/fruits/banana'],
    careGuide: {
      water:       'Heavy watering 2-3× per week; bananas are thirsty.',
      sun:         'Full sun.',
      soil:        'Rich, deep, well-draining, pH 5.5-7.0.',
      fertilizer:  'Heavy feeder — high-potassium fertiliser monthly.',
      pruning:     'Remove old leaves and spent fruiting stems.',
      temperature: 'Tropical — protect below 10 °C.',
      notes:       'Plants die after fruiting; daughter "suckers" continue the patch.',
    },
  },
  orange: {
    commonDiseases: ['anthracnose', 'leaf-spot', 'root-rot', 'sooty-mold'],
    commonPests:    ['aphids', 'scale', 'mealybugs', 'whitefly', 'thrips', 'fruit-flies'],
    images:         ['plants/fruits/orange'],
    careGuide: {
      water:       'Deep watering every 7-10 days; less in winter.',
      sun:         'Full sun.',
      soil:        'Well-draining, pH 6.0-7.0.',
      fertilizer:  'Citrus-specific fertiliser 3× per year.',
      pruning:     'Light shape pruning; remove crossing branches and water shoots.',
      temperature: 'Hardy zones 9-11. Frost protection below -2 °C.',
      notes:       'Trees are self-fertile but pollinators boost yield.',
    },
  },
  lemon: {
    commonDiseases: ['anthracnose', 'leaf-spot', 'root-rot', 'sooty-mold'],
    commonPests:    ['aphids', 'scale', 'mealybugs', 'spider-mites', 'fruit-flies'],
    images:         ['plants/fruits/lemon'],
    careGuide: {
      water:       'Deep watering when top 2-3 cm of soil is dry.',
      sun:         'Full sun.',
      soil:        'Well-draining, slightly acidic (pH 5.5-6.5).',
      fertilizer:  'Citrus formula every 6 weeks during active growth.',
      pruning:     'Light shape pruning; thin interior for airflow.',
      temperature: 'Hardy zones 9-11. Hardier than orange — tolerates brief -4 °C.',
      notes:       'Excellent container culture in cold climates; move indoors below 4 °C.',
    },
  },
  lime: {
    commonDiseases: ['anthracnose', 'leaf-spot', 'sooty-mold'],
    commonPests:    ['aphids', 'scale', 'mealybugs', 'whitefly', 'fruit-flies'],
    images:         ['plants/fruits/lime'],
    careGuide: {
      water:       'Even moisture; deep weekly watering.',
      sun:         'Full sun.',
      soil:        'Well-draining loam, pH 6.0-7.0.',
      fertilizer:  'Citrus formula every 6 weeks during active growth.',
      pruning:     'Light shape pruning to keep open form.',
      temperature: 'Tropical — protect below 5 °C.',
      notes:       'Key lime is more cold-sensitive than Persian lime.',
    },
  },
  avocado: {
    commonDiseases: ['root-rot', 'anthracnose', 'leaf-spot'],
    commonPests:    ['thrips', 'spider-mites', 'mealybugs'],
    images:         ['plants/fruits/avocado'],
    careGuide: {
      water:       'Deep watering; allow surface to dry between irrigations.',
      sun:         'Full sun.',
      soil:        'Well-draining (root rot risk), pH 6.0-7.0.',
      fertilizer:  'Light balanced feed every 2 months during growth.',
      pruning:     'Light shape pruning; remove low branches as tree matures.',
      temperature: 'Subtropical — protect below 0 °C. Hardy zones 9-11.',
      notes:       'Self-pollinating but yields improve dramatically with two varieties (A + B types).',
    },
  },
  strawberry: {
    commonDiseases: ['leaf-spot', 'powdery-mildew', 'root-rot', 'early-blight'],
    commonPests:    ['aphids', 'thrips', 'spider-mites', 'snails-and-slugs'],
    images:         ['plants/fruits/strawberry'],
    careGuide: {
      water:       'Even moisture; mulch with straw to keep berries clean.',
      sun:         'Full sun.',
      soil:        'Rich, well-draining, slightly acidic (pH 5.5-6.5).',
      fertilizer:  'Light balanced feed at planting and after each harvest.',
      pruning:     'Remove runners on June-bearers; trim damaged leaves.',
      temperature: 'Hardy zones 4-9 depending on variety.',
      notes:       'Pinch first-year flowers to build strong plants for year-2 harvest.',
    },
  },
  blueberry: {
    commonDiseases: ['leaf-spot', 'anthracnose', 'root-rot'],
    commonPests:    ['aphids', 'thrips', 'scale'],
    images:         ['plants/fruits/blueberry'],
    careGuide: {
      water:       'Even moisture; shallow roots dry quickly.',
      sun:         'Full sun.',
      soil:        'Highly acidic (pH 4.5-5.5) — peat-amended.',
      fertilizer:  'Acid-loving plant formula (ammonium sulphate) twice in spring.',
      pruning:     'Annual dormant prune to remove old canes and crossing branches.',
      temperature: 'Hardy zones 3-9 depending on cultivar.',
      notes:       'Plant at least 2 cultivars for cross-pollination and bigger berries.',
    },
  },
  pineapple: {
    commonDiseases: ['root-rot', 'leaf-spot', 'wilt'],
    commonPests:    ['mealybugs', 'scale', 'thrips'],
    images:         ['plants/fruits/pineapple'],
    careGuide: {
      water:       'Light watering — pineapples are drought-tolerant.',
      sun:         'Full sun.',
      soil:        'Well-draining sandy loam, pH 4.5-6.5.',
      fertilizer:  'Light foliar feed every 2 months; pineapples absorb nutrients through leaves.',
      pruning:     'Remove old basal leaves; harvest top crown to regrow new plants.',
      temperature: 'Tropical — protect below 7 °C.',
      notes:       'Takes 18-24 months from crown to harvest; one plant fruits once.',
    },
  },

  // ─── Herbs ──────────────────────────────────────────────────
  basil: {
    commonDiseases: ['leaf-spot', 'early-blight', 'wilt', 'downy-mildew', 'fusarium-wilt'],
    commonPests:    ['aphids', 'thrips', 'spider-mites'],
    images:         ['plants/herbs/basil'],
    careGuide: {
      water:       'Even moisture; water at soil level to avoid foliar disease.',
      sun:         'Full sun, 6+ hours.',
      soil:        'Rich, well-draining, pH 6.0-7.0.',
      fertilizer:  'Light feed every 3-4 weeks.',
      pruning:     'Pinch flower tips constantly to keep leaves tender.',
      temperature: '18-29 °C. Frost-tender annual.',
      notes:       'Pinching above leaf-pairs encourages dense bushy growth.',
    },
  },
  mint: {
    commonDiseases: ['rust', 'powdery-mildew', 'leaf-spot'],
    commonPests:    ['aphids', 'spider-mites', 'whitefly'],
    images:         ['plants/herbs/mint'],
    careGuide: {
      water:       'Even moisture; mint likes consistently damp soil.',
      sun:         'Part shade to full sun.',
      soil:        'Rich, moist; pH 6.0-7.0.',
      fertilizer:  'Light feed in spring; over-feeding reduces flavour.',
      pruning:     'Cut back hard mid-season to encourage fresh growth.',
      temperature: 'Hardy zones 3-11 depending on species.',
      notes:       'Plant in containers — mint runners spread aggressively.',
    },
  },
  rosemary: {
    commonDiseases: ['root-rot', 'powdery-mildew', 'leaf-spot'],
    commonPests:    ['aphids', 'whitefly', 'spider-mites'],
    images:         ['plants/herbs/rosemary'],
    careGuide: {
      water:       'Drought-tolerant; let dry between waterings.',
      sun:         'Full sun.',
      soil:        'Sandy or rocky, fast-draining, pH 6.0-7.0.',
      fertilizer:  'Minimal — light compost in spring.',
      pruning:     'Light prune to shape after flowering; avoid cutting old wood.',
      temperature: 'Hardy zones 7-10. Bring tender forms indoors in cold winters.',
      notes:       'Mediterranean native — over-watering is the #1 killer.',
    },
  },
  thyme: {
    commonDiseases: ['root-rot', 'early-blight'],
    commonPests:    ['aphids', 'spider-mites'],
    images:         ['plants/herbs/thyme'],
    careGuide: {
      water:       'Drought-tolerant; deep but infrequent watering.',
      sun:         'Full sun.',
      soil:        'Light, sandy, well-draining, pH 6.0-8.0.',
      fertilizer:  'Minimal — light compost in spring.',
      pruning:     'Light shear after flowering to keep compact.',
      temperature: 'Hardy zones 5-9.',
      notes:       'Replace plants every 3-4 years as they become woody.',
    },
  },
  sage: {
    commonDiseases: ['powdery-mildew', 'root-rot', 'leaf-spot'],
    commonPests:    ['spider-mites', 'whitefly', 'thrips'],
    images:         ['plants/herbs/sage'],
    careGuide: {
      water:       'Drought-tolerant; water deeply, let dry.',
      sun:         'Full sun.',
      soil:        'Sandy or loamy, fast-draining, pH 6.0-7.0.',
      fertilizer:  'Minimal — compost in spring.',
      pruning:     'Hard prune in early spring to remove old woody growth.',
      temperature: 'Hardy zones 4-10.',
      notes:       'Best flavour from young leaves; renew plants every 4-5 years.',
    },
  },
  oregano: {
    commonDiseases: ['root-rot', 'leaf-spot'],
    commonPests:    ['aphids', 'spider-mites', 'thrips'],
    images:         ['plants/herbs/oregano'],
    careGuide: {
      water:       'Drought-tolerant once established.',
      sun:         'Full sun.',
      soil:        'Light, well-draining, pH 6.5-7.5.',
      fertilizer:  'Minimal — over-feeding reduces flavour.',
      pruning:     'Light shear to maintain compact shape; cut back hard mid-season.',
      temperature: 'Hardy zones 4-10.',
      notes:       'Flavour intensifies just before flowering — best harvest window.',
    },
  },
  parsley: {
    commonDiseases: ['leaf-spot', 'early-blight'],
    commonPests:    ['aphids', 'thrips'],
    images:         ['plants/herbs/parsley'],
    careGuide: {
      water:       'Even moisture.',
      sun:         'Full sun to part shade.',
      soil:        'Rich, well-draining, pH 6.0-7.0.',
      fertilizer:  'Light balanced feed monthly.',
      pruning:     'Harvest outer stems continuously.',
      temperature: 'Hardy zones 4-9. Biennial — bolts in year 2.',
      notes:       'Flat-leaf has stronger flavour; curly is best as garnish.',
    },
  },
  cilantro: {
    commonDiseases: ['leaf-spot', 'powdery-mildew'],
    commonPests:    ['aphids', 'whitefly'],
    images:         ['plants/herbs/cilantro'],
    careGuide: {
      water:       'Even moisture; mulch to keep soil cool.',
      sun:         'Full sun in cool weather; afternoon shade in heat.',
      soil:        'Rich, well-draining, pH 6.2-6.8.',
      fertilizer:  'Light feed monthly.',
      pruning:     'Harvest outer leaves; pinch flowers to delay bolting.',
      temperature: '15-21 °C ideal. Bolts above 24 °C.',
      notes:       'Sow every 2-3 weeks for continuous harvest; harvest seed as coriander.',
    },
  },

  // ─── Houseplants ────────────────────────────────────────────
  monstera: {
    commonDiseases: ['root-rot', 'leaf-spot'],
    commonPests:    ['spider-mites', 'mealybugs', 'scale', 'thrips'],
    images:         ['plants/houseplants/monstera'],
    careGuide: {
      water:       'Water when top 3-5 cm of soil is dry; reduce in winter.',
      sun:         'Bright indirect light.',
      soil:        'Chunky aroid mix — bark + perlite + coco coir.',
      fertilizer:  'Balanced fertiliser monthly in spring/summer.',
      pruning:     'Trim aerial roots only if necessary; train upward on moss pole.',
      temperature: '18-27 °C. Below 10 °C causes leaf damage.',
      notes:       'Fenestrations (leaf holes) appear in mature leaves with adequate light.',
    },
  },
  'snake-plant': {
    commonDiseases: ['root-rot'],
    commonPests:    ['mealybugs', 'spider-mites'],
    images:         ['plants/houseplants/snake-plant'],
    careGuide: {
      water:       'Drought-tolerant — water every 2-4 weeks; less in winter.',
      sun:         'Low to bright indirect light. Tolerates almost anything.',
      soil:        'Cactus or succulent mix.',
      fertilizer:  'Light feed quarterly during growth.',
      pruning:     'Trim damaged leaves at the base.',
      temperature: '15-27 °C. Tolerant of household range.',
      notes:       'Nearly indestructible — over-watering is the only common death cause.',
    },
  },
  pothos: {
    commonDiseases: ['root-rot', 'leaf-spot'],
    commonPests:    ['mealybugs', 'scale', 'spider-mites'],
    images:         ['plants/houseplants/pothos'],
    careGuide: {
      water:       'Water when top 2-3 cm of soil is dry.',
      sun:         'Low to bright indirect light.',
      soil:        'Standard houseplant potting mix.',
      fertilizer:  'Light balanced feed monthly in growth season.',
      pruning:     'Trim leggy vines back to encourage bushy growth; propagate cuttings in water.',
      temperature: '18-29 °C.',
      notes:       'Excellent beginner houseplant — variegation increases with light.',
    },
  },
  'peace-lily': {
    commonDiseases: ['root-rot', 'leaf-spot'],
    commonPests:    ['mealybugs', 'spider-mites', 'aphids'],
    images:         ['plants/houseplants/peace-lily'],
    careGuide: {
      water:       'Keep evenly moist; wilts dramatically when thirsty but recovers quickly.',
      sun:         'Low to medium indirect light.',
      soil:        'Standard houseplant potting mix.',
      fertilizer:  'Light feed every 6 weeks during growth.',
      pruning:     'Remove spent flower stalks at the base.',
      temperature: '18-27 °C.',
      notes:       'White spathes are not true flowers — the spike in the middle is.',
    },
  },
  'zz-plant': {
    commonDiseases: ['root-rot'],
    commonPests:    ['mealybugs', 'spider-mites', 'scale'],
    images:         ['plants/houseplants/zz-plant'],
    careGuide: {
      water:       'Drought-tolerant — water every 2-3 weeks; less in winter.',
      sun:         'Low to bright indirect light.',
      soil:        'Well-draining houseplant mix.',
      fertilizer:  'Light feed quarterly.',
      pruning:     'Trim damaged or yellowing stems at the base.',
      temperature: '18-27 °C.',
      notes:       'Stores water in rhizomes — under-watering is preferable to over-watering.',
    },
  },
  'rubber-plant': {
    commonDiseases: ['root-rot', 'leaf-spot'],
    commonPests:    ['mealybugs', 'scale', 'spider-mites', 'thrips'],
    images:         ['plants/houseplants/rubber-plant'],
    careGuide: {
      water:       'Water when top 3-5 cm of soil is dry; reduce in winter.',
      sun:         'Bright indirect light. Tolerates some morning sun.',
      soil:        'Well-draining standard houseplant mix.',
      fertilizer:  'Light balanced feed monthly in growth season.',
      pruning:     'Pinch growing tip to encourage branching; sap can irritate skin.',
      temperature: '16-24 °C.',
      notes:       'Wipe leaves clean monthly to maximise light absorption.',
    },
  },
  'spider-plant': {
    commonDiseases: ['root-rot', 'leaf-spot'],
    commonPests:    ['aphids', 'spider-mites', 'whitefly'],
    images:         ['plants/houseplants/spider-plant'],
    careGuide: {
      water:       'Water when top 2 cm of soil is dry; spider plants are forgiving.',
      sun:         'Bright indirect light.',
      soil:        'Standard houseplant potting mix.',
      fertilizer:  'Light feed monthly in growth season.',
      pruning:     'Remove brown leaf tips; propagate baby spiderettes in water or soil.',
      temperature: '13-27 °C.',
      notes:       'Brown tips often indicate fluoride/chlorine in tap water — try filtered.',
    },
  },
  'fiddle-leaf-fig': {
    commonDiseases: ['root-rot', 'leaf-spot', 'anthracnose'],
    commonPests:    ['mealybugs', 'spider-mites', 'scale'],
    images:         ['plants/houseplants/fiddle-leaf-fig'],
    careGuide: {
      water:       'Water when top 3-5 cm of soil is dry; consistency is everything.',
      sun:         'Bright indirect light. Direct morning sun OK.',
      soil:        'Well-draining houseplant mix; add perlite generously.',
      fertilizer:  'Balanced fertiliser monthly in spring/summer.',
      pruning:     'Notch above a leaf to encourage branching; sap irritates skin.',
      temperature: '18-24 °C. Hates draughts and sudden temperature changes.',
      notes:       'Pick a spot and stick to it — fiddle-leafs hate being moved.',
    },
  },

  // ─── Crops ──────────────────────────────────────────────────
  maize: {
    commonDiseases: ['leaf-spot', 'rust', 'early-blight', 'wilt'],
    commonPests:    ['armyworm', 'aphids', 'beetles', 'thrips', 'grasshoppers', 'weevils'],
    images:         ['plants/crops/maize'],
    careGuide: {
      water:       '25 mm per week minimum; critical during tasselling and silking.',
      sun:         'Full sun.',
      soil:        'Well-draining, rich in organic matter, pH 5.8-6.8.',
      fertilizer:  'Heavy nitrogen feeder — apply at planting + side-dress at knee-height.',
      pruning:     'None — let suckers grow if conditions are favourable.',
      temperature: '21-30 °C ideal. Frost-sensitive.',
      notes:       'Plant in blocks of 4+ rows (not single rows) for proper wind pollination.',
    },
  },
  rice: {
    commonDiseases: ['early-blight', 'leaf-spot', 'wilt'],
    commonPests:    ['armyworm', 'aphids', 'thrips', 'weevils'],
    images:         ['plants/crops/rice'],
    careGuide: {
      water:       'Paddy varieties need 5-10 cm flooded water; upland rice rainfall-fed.',
      sun:         'Full sun.',
      soil:        'Clay or heavy loam for paddy; lighter for upland.',
      fertilizer:  'Nitrogen at tillering and panicle initiation.',
      pruning:     'None.',
      temperature: '20-35 °C ideal. Cold-sensitive at flowering.',
      notes:       'Drain field 1-2 weeks before harvest for easier cutting.',
    },
  },
  cassava: {
    commonDiseases: ['early-blight', 'leaf-spot', 'wilt', 'anthracnose'],
    commonPests:    ['whitefly', 'mealybugs', 'spider-mites'],
    images:         ['plants/crops/cassava'],
    careGuide: {
      water:       'Drought-tolerant once established; deep watering during stem cuttings establishment.',
      sun:         'Full sun.',
      soil:        'Sandy loam; tolerates poor soils.',
      fertilizer:  'Light NPK at planting and again at 3 months.',
      pruning:     'Remove lower leaves to reduce disease pressure.',
      temperature: 'Tropical — 25-35 °C. Frost-sensitive.',
      notes:       '10-12 month crop; bitter varieties contain cyanogens — process before eating.',
    },
  },
  soybean: {
    commonDiseases: ['early-blight', 'leaf-spot', 'rust', 'wilt'],
    commonPests:    ['aphids', 'armyworm', 'thrips', 'beetles', 'caterpillars'],
    images:         ['plants/crops/soybean'],
    careGuide: {
      water:       '25 mm per week; critical during pod-fill.',
      sun:         'Full sun.',
      soil:        'Well-draining loam, pH 6.0-7.0.',
      fertilizer:  'Minimal nitrogen (legume fixes its own); phosphorus and potassium important.',
      pruning:     'None.',
      temperature: '20-30 °C ideal.',
      notes:       'Inoculate seeds with Rhizobium for best nitrogen fixation.',
    },
  },
  wheat: {
    commonDiseases: ['rust', 'leaf-spot', 'early-blight', 'powdery-mildew'],
    commonPests:    ['aphids', 'armyworm', 'thrips', 'weevils'],
    images:         ['plants/crops/wheat'],
    careGuide: {
      water:       '25 mm per week; critical during heading and grain-fill.',
      sun:         'Full sun.',
      soil:        'Loamy, well-draining, pH 6.0-7.5.',
      fertilizer:  'Nitrogen split — 1/3 at planting, 1/3 at tillering, 1/3 at heading.',
      pruning:     'None.',
      temperature: '15-24 °C ideal. Cold-tolerant in winter wheat varieties.',
      notes:       'Winter wheat needs vernalisation (cold exposure) to flower.',
    },
  },
  sorghum: {
    commonDiseases: ['leaf-spot', 'rust', 'anthracnose'],
    commonPests:    ['armyworm', 'aphids', 'thrips', 'grasshoppers'],
    images:         ['plants/crops/sorghum'],
    careGuide: {
      water:       'Drought-tolerant; deep but infrequent watering.',
      sun:         'Full sun.',
      soil:        'Tolerates a wide range, pH 5.5-8.5.',
      fertilizer:  'Moderate nitrogen — over-feeding causes lodging.',
      pruning:     'None.',
      temperature: '24-32 °C ideal. Heat-tolerant.',
      notes:       'Excellent crop for marginal lands and dryland farming.',
    },
  },
  groundnut: {
    commonDiseases: ['leaf-spot', 'rust', 'wilt'],
    commonPests:    ['aphids', 'thrips', 'armyworm', 'leaf-miners'],
    images:         ['plants/crops/groundnut'],
    careGuide: {
      water:       'Even moisture during flowering and pod fill.',
      sun:         'Full sun.',
      soil:        'Sandy loam, pH 5.8-6.5.',
      fertilizer:  'Calcium critical at pegging; minimal nitrogen (legume).',
      pruning:     'None.',
      temperature: '21-30 °C ideal.',
      notes:       'Pegs grow down into soil to form pods — keep soil loose around base.',
    },
  },
  millet: {
    commonDiseases: ['leaf-spot', 'rust', 'wilt'],
    commonPests:    ['armyworm', 'aphids', 'thrips', 'grasshoppers'],
    images:         ['plants/crops/millet'],
    careGuide: {
      water:       'Drought-tolerant; minimal supplemental water.',
      sun:         'Full sun.',
      soil:        'Sandy or loamy, pH 5.5-7.5.',
      fertilizer:  'Light NPK; over-feeding causes lodging.',
      pruning:     'None.',
      temperature: '27-35 °C ideal. Heat- and drought-tolerant.',
      notes:       'Pearl millet is the most drought-hardy cereal — staple in semi-arid regions.',
    },
  },
  cotton: {
    commonDiseases: ['leaf-spot', 'early-blight', 'wilt', 'anthracnose'],
    commonPests:    ['aphids', 'whitefly', 'thrips', 'armyworm'],
    images:         ['plants/crops/cotton'],
    careGuide: {
      water:       '25 mm per week during boll formation.',
      sun:         'Full sun.',
      soil:        'Deep, well-draining, pH 5.8-8.0.',
      fertilizer:  'Nitrogen + phosphorus + potassium balanced through season.',
      pruning:     'Topping at 8-12 nodes can boost yield in some systems.',
      temperature: '21-30 °C ideal.',
      notes:       'Long growing season (150-180 days) — start early indoors in marginal climates.',
    },
  },
  sugarcane: {
    commonDiseases: ['leaf-spot', 'rust', 'wilt'],
    commonPests:    ['armyworm', 'aphids', 'thrips', 'scale'],
    images:         ['plants/crops/sugarcane'],
    careGuide: {
      water:       'Heavy water requirement — 1500-2500 mm per growing season.',
      sun:         'Full sun.',
      soil:        'Deep, well-draining, fertile loam.',
      fertilizer:  'Heavy nitrogen + potassium feeder.',
      pruning:     'Strip dead leaves to reduce pest harbour.',
      temperature: '22-30 °C ideal. Frost-sensitive.',
      notes:       'Plant cuttings ("setts") in autumn; harvest 10-18 months later.',
    },
  },
  // ─── Wave-32 Knowledge Expansion — Priority 1 African crops ───
  yam: {
    commonDiseases: ['anthracnose', 'leaf-spot', 'root-rot'],
    commonPests:    ['weevils', 'mealybugs', 'termites'],
    images:         ['plants/crops/yam'],
    careGuide: {
      water:       '1500-2000 mm rainfall; mulch heavily to retain moisture.',
      sun:         'Full sun.',
      soil:        'Deep, well-drained loam; mounds or ridges essential.',
      fertilizer:  'Compost or aged manure at planting; light NPK at 8 weeks.',
      pruning:     'Train vines on stakes — improves yields and reduces disease.',
      temperature: '25-30 °C ideal. Frost-sensitive.',
      notes:       '8-12 month crop; vine yellowing signals harvest readiness.',
    },
  },
  plantain: {
    commonDiseases: ['black-sigatoka', 'banana-bunchy-top', 'banana-xanthomonas-wilt', 'anthracnose'],
    commonPests:    ['banana-weevil', 'aphids', 'thrips', 'nematodes'],
    images:         ['plants/crops/plantain'],
    careGuide: {
      water:       '1200-1500 mm rainfall; supplement during dry spells.',
      sun:         'Filtered light to full sun.',
      soil:        'Deep, well-drained loam with high organic matter.',
      fertilizer:  'Heavy K and N feeder — apply NPK 17-17-17 monthly.',
      pruning:     'Remove old leaves and excess suckers; keep 1 follower per mat.',
      temperature: 'Tropical — 25-30 °C. Frost-killed.',
      notes:       '9-12 months to harvest; cook before eating (unlike dessert banana).',
    },
  },
  cocoa: {
    commonDiseases: ['cocoa-black-pod', 'cocoa-swollen-shoot', 'anthracnose'],
    commonPests:    ['mealybugs', 'aphids', 'thrips', 'scale'],
    images:         ['plants/crops/cocoa'],
    careGuide: {
      water:       '1500-2000 mm well-distributed rainfall.',
      sun:         'Partial shade essential — 30-50% shade from canopy trees.',
      soil:        'Deep, well-drained, rich in organic matter.',
      fertilizer:  'NPK 12-12-17 + Mg at flowering and pod set.',
      pruning:     'Annual structural pruning; remove chupons and basal suckers.',
      temperature: '21-32 °C; frost-killed below 10 °C.',
      notes:       '3-5 years to first harvest; pod sanitation weekly is critical.',
    },
  },
  cowpea: {
    commonDiseases: ['leaf-spot', 'anthracnose', 'mosaic-virus', 'bacterial-wilt'],
    commonPests:    ['pod-borer-maruca', 'aphids', 'thrips', 'storage-beetles'],
    images:         ['plants/crops/cowpea'],
    careGuide: {
      water:       '300-500 mm; drought-tolerant but needs water at flowering.',
      sun:         'Full sun.',
      soil:        'Sandy loam; tolerates poor soils — nitrogen-fixing.',
      fertilizer:  'Minimal nitrogen; phosphorus at planting.',
      pruning:     'None.',
      temperature: '20-35 °C ideal.',
      notes:       '60-90 day crop; can dual-purpose for grain + fodder.',
    },
  },
  okra: {
    commonDiseases: ['leaf-spot', 'powdery-mildew', 'wilt', 'mosaic-virus'],
    commonPests:    ['aphids', 'whitefly', 'bollworm', 'thrips'],
    images:         ['plants/vegetables/okra'],
    careGuide: {
      water:       '25 mm per week; consistent moisture for pod set.',
      sun:         'Full sun.',
      soil:        'Well-drained loam, pH 6.0-7.0.',
      fertilizer:  'Balanced NPK at planting; side-dress N at first flower.',
      pruning:     'Pinch growing tips to encourage branching after first harvest.',
      temperature: '25-35 °C ideal. Frost-sensitive.',
      notes:       'Harvest pods at 5-8 cm; older pods become fibrous.',
    },
  },
  // ─── Wave-32 — additional tropical / staple crops ─────────────
  millet_pearl: {
    commonDiseases: ['leaf-spot', 'rust', 'downy-mildew'],
    commonPests:    ['stem-borer', 'aphids', 'grasshoppers'],
    images:         ['plants/crops/millet-pearl'],
    careGuide: {
      water:       'Drought-hardy — 250-400 mm sufficient.',
      sun:         'Full sun.',
      soil:        'Sandy, well-drained; tolerates infertile soils.',
      fertilizer:  'Low — high N delays maturity.',
      pruning:     'None.',
      temperature: '30-35 °C ideal; the most heat-tolerant cereal.',
      notes:       '70-90 day crop; staple of the Sahel.',
    },
  },
  millet_finger: {
    commonDiseases: ['leaf-spot', 'rust', 'anthracnose'],
    commonPests:    ['aphids', 'stem-borer', 'birds-pest'],
    images:         ['plants/crops/millet-finger'],
    careGuide: {
      water:       '500-1000 mm well-distributed rainfall.',
      sun:         'Full sun.',
      soil:        'Loamy, slightly acidic; tolerates marginal soils.',
      fertilizer:  'Moderate N at tillering.',
      pruning:     'None.',
      temperature: '20-30 °C ideal.',
      notes:       '100-150 day crop; high calcium and iron content.',
    },
  },
  sweet_potato: {
    commonDiseases: ['leaf-spot', 'root-rot', 'mosaic-virus'],
    commonPests:    ['weevils', 'aphids', 'whitefly', 'caterpillars'],
    images:         ['plants/crops/sweet-potato'],
    careGuide: {
      water:       '500-750 mm; reduce water 2 weeks before harvest.',
      sun:         'Full sun.',
      soil:        'Sandy loam, slightly acidic; ridges or mounds essential.',
      fertilizer:  'Low N (promotes vines over tubers); K at storage-root formation.',
      pruning:     'None.',
      temperature: '24-26 °C ideal.',
      notes:       '90-150 day crop; orange-fleshed varieties carry vitamin A.',
    },
  },
  coffee_arabica: {
    commonDiseases: ['coffee-leaf-rust', 'anthracnose', 'leaf-spot'],
    commonPests:    ['coffee-berry-borer', 'leafhoppers', 'thrips', 'scale'],
    images:         ['plants/crops/coffee-arabica'],
    careGuide: {
      water:       '1500-2000 mm well-distributed; mulch heavily.',
      sun:         'Partial shade — 30-50% from canopy trees.',
      soil:        'Deep, well-drained, slightly acidic (pH 5.5-6.5).',
      fertilizer:  'NPK 17-17-17 + Mg quarterly; foliar Zn during berry development.',
      pruning:     'Annual selective pruning; remove suckers regularly.',
      temperature: '15-24 °C ideal; cold-sensitive at flowering.',
      notes:       '3-4 years to first harvest; selective hand-picking at correct ripeness.',
    },
  },
  coffee_robusta: {
    commonDiseases: ['coffee-leaf-rust', 'anthracnose'],
    commonPests:    ['coffee-berry-borer', 'mealybugs', 'thrips'],
    images:         ['plants/crops/coffee-robusta'],
    careGuide: {
      water:       '1500-2500 mm; more drought-tolerant than arabica.',
      sun:         'Full sun to partial shade.',
      soil:        'Deep, fertile, well-drained.',
      fertilizer:  'NPK quarterly; heavier N than arabica.',
      pruning:     'Multi-stem (3-5 stems) management.',
      temperature: '24-30 °C ideal.',
      notes:       'Higher caffeine, lower acidity than arabica; pulping-station processing common.',
    },
  },
  teff: {
    commonDiseases: ['rust', 'leaf-spot'],
    commonPests:    ['aphids', 'stem-borer'],
    images:         ['plants/crops/teff'],
    careGuide: {
      water:       '450-650 mm; drought-tolerant.',
      sun:         'Full sun.',
      soil:        'Tolerates heavy waterlogged soils — unusual for cereals.',
      fertilizer:  'Light N at tillering.',
      pruning:     'None.',
      temperature: '15-27 °C ideal.',
      notes:       '90-120 day crop; gluten-free, staple of Ethiopia.',
    },
  },
  pigeon_pea: {
    commonDiseases: ['fusarium-wilt', 'leaf-spot'],
    commonPests:    ['pod-borer-maruca', 'aphids', 'thrips'],
    images:         ['plants/crops/pigeon-pea'],
    careGuide: {
      water:       'Drought-tolerant — 400-1000 mm; deep roots reach subsoil water.',
      sun:         'Full sun.',
      soil:        'Wide tolerance; nitrogen-fixing.',
      fertilizer:  'Low N; phosphorus at planting.',
      pruning:     'Ratoon after first harvest for 2nd-year yields.',
      temperature: '20-30 °C ideal.',
      notes:       '150-180 day crop; perennial in tropics, annual elsewhere.',
    },
  },
  bambara_groundnut: {
    commonDiseases: ['leaf-spot', 'root-rot'],
    commonPests:    ['aphids', 'thrips'],
    images:         ['plants/crops/bambara-groundnut'],
    careGuide: {
      water:       'Drought-tolerant; 600-900 mm sufficient.',
      sun:         'Full sun.',
      soil:        'Sandy, well-drained.',
      fertilizer:  'Minimal — legume fixes its own N.',
      pruning:     'None.',
      temperature: '20-28 °C ideal.',
      notes:       '120-150 day crop; nutritionally dense, gaining commercial interest.',
    },
  },
  yardlong_bean: {
    commonDiseases: ['leaf-spot', 'powdery-mildew'],
    commonPests:    ['aphids', 'pod-borer-maruca', 'thrips'],
    images:         ['plants/vegetables/yardlong-bean'],
    careGuide: {
      water:       '25-40 mm per week; consistent moisture.',
      sun:         'Full sun.',
      soil:        'Well-drained loam; nitrogen-fixing.',
      fertilizer:  'Low N; phosphorus at planting.',
      pruning:     'Train on poles or trellis; harvest pods young.',
      temperature: '25-30 °C ideal.',
      notes:       '60-80 day crop; harvest pods at 30-50 cm before seeds bulge.',
    },
  },
  amaranth: {
    commonDiseases: ['leaf-spot', 'damping-off'],
    commonPests:    ['aphids', 'leaf-miners', 'caterpillars'],
    images:         ['plants/vegetables/amaranth'],
    careGuide: {
      water:       'Moderate; drought-tolerant once established.',
      sun:         'Full sun.',
      soil:        'Wide tolerance; well-drained.',
      fertilizer:  'Light N at thinning.',
      pruning:     'Successive harvesting of leaves prolongs production.',
      temperature: '25-30 °C ideal.',
      notes:       '30-45 days for leaf crop; 90-120 days for grain.',
    },
  },
  taro: {
    commonDiseases: ['leaf-blight', 'root-rot'],
    commonPests:    ['aphids', 'thrips', 'mites'],
    images:         ['plants/crops/taro'],
    careGuide: {
      water:       'High — needs constantly moist or flooded conditions.',
      sun:         'Partial shade tolerated.',
      soil:        'Heavy clay or loam with high organic matter.',
      fertilizer:  'NPK with extra K during corm development.',
      pruning:     'Remove old leaves to reduce disease pressure.',
      temperature: '21-27 °C ideal.',
      notes:       '6-9 month crop; cook thoroughly (raw corms contain irritant calcium oxalate).',
    },
  },
  ginger: {
    commonDiseases: ['bacterial-wilt', 'root-rot', 'leaf-spot'],
    commonPests:    ['thrips', 'mealybugs', 'mites'],
    images:         ['plants/herbs/ginger'],
    careGuide: {
      water:       'Consistent moisture; well-drained — never waterlogged.',
      sun:         'Partial shade ideal.',
      soil:        'Sandy loam rich in organic matter.',
      fertilizer:  'NPK monthly during active growth.',
      pruning:     'None.',
      temperature: '22-32 °C ideal.',
      notes:       '8-10 month crop; rhizomes ready when leaves yellow and die back.',
    },
  },
  turmeric: {
    commonDiseases: ['leaf-spot', 'root-rot'],
    commonPests:    ['thrips', 'scale', 'mites'],
    images:         ['plants/herbs/turmeric'],
    careGuide: {
      water:       'Consistent moisture; mulch heavily.',
      sun:         'Partial shade ideal.',
      soil:        'Rich, well-drained loam.',
      fertilizer:  'High organic matter; light NPK monthly.',
      pruning:     'None.',
      temperature: '20-30 °C ideal.',
      notes:       '7-10 month crop; rhizomes harvested when leaves brown.',
    },
  },
  garlic: {
    commonDiseases: ['rust', 'white-rot', 'fusarium-basal-rot'],
    commonPests:    ['thrips', 'nematodes', 'mites'],
    images:         ['plants/herbs/garlic'],
    careGuide: {
      water:       '25 mm per week; reduce 2 weeks before harvest.',
      sun:         'Full sun.',
      soil:        'Loose, well-drained loam; pH 6.0-7.0.',
      fertilizer:  'Moderate N early; reduce as bulbs form.',
      pruning:     'Remove flower scapes (hardneck varieties) to redirect energy.',
      temperature: 'Cool start (5-15 °C), warm finish (20-25 °C).',
      notes:       '6-9 month crop; harvest when 3-5 lower leaves yellow.',
    },
  },
  shallot: {
    commonDiseases: ['downy-mildew', 'white-rot'],
    commonPests:    ['thrips', 'mites', 'leaf-miners'],
    images:         ['plants/vegetables/shallot'],
    careGuide: {
      water:       '20-25 mm per week.',
      sun:         'Full sun.',
      soil:        'Sandy loam; pH 6.0-7.0.',
      fertilizer:  'Moderate N; bulb-formation K.',
      pruning:     'None.',
      temperature: '15-25 °C ideal.',
      notes:       '90-120 day crop; harvest when tops fall over.',
    },
  },
  chili_pepper: {
    commonDiseases: ['leaf-spot', 'bacterial-wilt', 'mosaic-virus', 'anthracnose'],
    commonPests:    ['thrips', 'aphids', 'whitefly', 'fruit-flies'],
    images:         ['plants/vegetables/chili-pepper'],
    careGuide: {
      water:       '25 mm per week; consistent moisture.',
      sun:         'Full sun.',
      soil:        'Well-drained loam, pH 6.0-7.0.',
      fertilizer:  'Balanced NPK; side-dress at flowering.',
      pruning:     'Pinch first flowers to encourage branching.',
      temperature: '21-32 °C ideal.',
      notes:       '70-100 day crop; harvest green or fully colored.',
    },
  },
  papaya: {
    commonDiseases: ['anthracnose', 'powdery-mildew', 'root-rot'],
    commonPests:    ['aphids', 'whitefly', 'fruit-flies', 'mites'],
    images:         ['plants/fruits/papaya'],
    careGuide: {
      water:       '40-100 mm per month; well-drained.',
      sun:         'Full sun.',
      soil:        'Well-drained sandy loam; cannot tolerate waterlogging.',
      fertilizer:  'NPK monthly; heavy K during fruiting.',
      pruning:     'Remove damaged leaves; do not top.',
      temperature: '22-26 °C ideal; frost-killed.',
      notes:       '8-12 months to first fruit; productive for 3-5 years.',
    },
  },
  guava: {
    commonDiseases: ['anthracnose', 'rust', 'leaf-spot'],
    commonPests:    ['fruit-flies', 'mealybugs', 'scale'],
    images:         ['plants/fruits/guava'],
    careGuide: {
      water:       'Drought-tolerant once established; 1000-1500 mm.',
      sun:         'Full sun.',
      soil:        'Wide tolerance; well-drained best.',
      fertilizer:  'NPK 3-4 times per year during productive cycle.',
      pruning:     'Annual structural pruning; remove crossing branches.',
      temperature: '20-30 °C ideal; tolerates light frost.',
      notes:       '2-4 years to first significant crop.',
    },
  },
  passion_fruit: {
    commonDiseases: ['woodiness-virus', 'anthracnose', 'wilt'],
    commonPests:    ['aphids', 'thrips', 'mites'],
    images:         ['plants/fruits/passion-fruit'],
    careGuide: {
      water:       'Consistent moisture; mulch heavily.',
      sun:         'Full sun.',
      soil:        'Well-drained, slightly acidic; rich in organic matter.',
      fertilizer:  'NPK monthly during growth and fruiting.',
      pruning:     'Annual hard pruning after main harvest; train on trellis.',
      temperature: '18-26 °C ideal.',
      notes:       '12-18 months to first fruit; productive for 3-5 years.',
    },
  },
});

/**
 * Pure read — return the knowledge supplement for a plant id, or
 * null when none registered. Falls back through category template
 * for growthStages when an entry exists but does not override.
 */
export function findPlantKnowledge(id) {
  return _safe(() => {
    const slug = _str(id).toLowerCase();
    if (!slug) return null;
    const entry = PLANT_KNOWLEDGE[slug];
    if (!entry) return null;
    return Object.freeze({
      id:              slug,
      growthStages:    Object.freeze(_arr(entry.growthStages)),
      commonDiseases:  Object.freeze(_arr(entry.commonDiseases)),
      commonPests:     Object.freeze(_arr(entry.commonPests)),
      careGuide:       Object.freeze({ ...(entry.careGuide || {}) }),
      images:          Object.freeze(_arr(entry.images)),
    });
  }, null);
}

/**
 * Compose the full PlantEntry envelope from the spec:
 *   { id, commonName, scientificName, category,
 *     images[], growthStages[], commonDiseases[],
 *     commonPests[], companionPlants[], pollinatorValue,
 *     careGuide }
 *
 * Pulls identity from PLANT_DB, knowledge supplement from
 * PLANT_KNOWLEDGE, and falls back to category-default growth
 * stages from GROWTH_STAGE_TEMPLATES when an entry has no
 * override.
 */
export function composePlantEntry(id) {
  return _safe(() => {
    const slug = _str(id).toLowerCase();
    if (!slug) return null;
    const base      = findPlant(slug);
    const knowledge = findPlantKnowledge(slug);
    if (!base && !knowledge) return null;

    const category = _str((base && base.type) || (knowledge && knowledge.category));
    const stages   = (knowledge && knowledge.growthStages
                       && knowledge.growthStages.length > 0)
      ? knowledge.growthStages
      : (GROWTH_STAGE_TEMPLATES[category] || Object.freeze([]));

    return Object.freeze({
      id:              slug,
      commonName:      _str((base && (base.commonName || base.name))),
      scientificName:  _str(base && base.scientificName),
      category,
      images:          Object.freeze(_arr(knowledge && knowledge.images)),
      growthStages:    stages,
      commonDiseases:  Object.freeze(_arr(knowledge && knowledge.commonDiseases)),
      commonPests:     Object.freeze(_arr(knowledge && knowledge.commonPests)),
      companionPlants: Object.freeze(_arr(base && base.companionPlants)),
      pollinatorValue: _num(base && base.pollinatorValue),
      careGuide:       (knowledge && knowledge.careGuide) || Object.freeze({}),
    });
  }, null);
}

export const PLANT_KNOWLEDGE_STATS = Object.freeze({
  total:             Object.keys(PLANT_KNOWLEDGE).length,
  templateCategories: Object.keys(GROWTH_STAGE_TEMPLATES).length,
  diseaseCatalog:    DISEASE_DB.length,
  pestCatalog:       PEST_DB.length,
  // Plants in the catalog that DO have a knowledge entry vs DO NOT.
  catalogCoverage: (() => {
    let withK = 0, without = 0;
    for (const p of PLANT_DB) {
      if (!p || !p.id) continue;
      if (PLANT_KNOWLEDGE[p.id]) withK++;
      else without++;
    }
    return Object.freeze({ withKnowledge: withK, missing: without });
  })(),
});
