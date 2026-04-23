/**
 * cropHarvestProfiles.js — per-crop harvest assumptions.
 *
 * Shape:
 *   HARVEST_PROFILES[canonicalKey] = {
 *     expectedHarvestWindowDays,   // how long the harvest typically runs
 *     suggestedUnits,              // UI unit chips, ordered: primary first
 *     perishability,               // 'high' | 'medium' | 'low'
 *     storageDaysAtAmbient,        // rough shelf life with no cold storage
 *     postHarvestTip,              // one-line framing tip for the UI
 *   }
 *
 * Consumed by the harvest readiness system + yield estimate UI so
 * the suggested units / freshness framing are crop-appropriate.
 * Crops without an explicit row fall back to GENERIC_HARVEST_PROFILE.
 *
 * Adding a new crop
 *   1. Pick conservative values — err on the short side for
 *      window/shelf life; farmers plan around the worst case.
 *   2. Lead suggestedUnits with what buyers actually quote in —
 *      "bags" before "kg" for maize/rice, "crates" before "kg"
 *      for tomato, "bunches" for banana.
 */

const f = Object.freeze;

export const GENERIC_HARVEST_PROFILE = f({
  expectedHarvestWindowDays: 14,
  suggestedUnits:            f(['kg', 'bags']),
  perishability:             'medium',
  storageDaysAtAmbient:      7,
  postHarvestTip:            'Dry or cool produce quickly after harvest to keep quality.',
});

const HARVEST_PROFILES = f({
  // ─── Staples + grains ───────────────────────────────────────
  maize: f({
    expectedHarvestWindowDays: 14,
    suggestedUnits:            f(['bags', 'kg', 'cobs']),
    perishability:             'low',
    storageDaysAtAmbient:      180,
    postHarvestTip:            'Dry grain to 13% moisture before bagging — wet grain moulds within a week.',
  }),
  rice: f({
    expectedHarvestWindowDays: 10,
    suggestedUnits:            f(['bags', 'kg']),
    perishability:             'low',
    storageDaysAtAmbient:      240,
    postHarvestTip:            'Thresh within 24h of cutting; dry paddy on tarps, not bare soil.',
  }),
  wheat: f({
    expectedHarvestWindowDays: 10,
    suggestedUnits:            f(['bags', 'kg']),
    perishability:             'low',
    storageDaysAtAmbient:      240,
    postHarvestTip:            'Cut when heads rattle; dry fast before the next rain.',
  }),
  sorghum: f({
    expectedHarvestWindowDays: 14,
    suggestedUnits:            f(['bags', 'kg']),
    perishability:             'low',
    storageDaysAtAmbient:      180,
    postHarvestTip:            'Bird damage spikes near maturity — harvest panicles as soon as seed hardens.',
  }),
  millet: f({
    expectedHarvestWindowDays: 14,
    suggestedUnits:            f(['bags', 'kg']),
    perishability:             'low',
    storageDaysAtAmbient:      180,
    postHarvestTip:            'Cut heads, sun-dry on mats, then thresh when fully dry.',
  }),

  // ─── Roots + tubers ─────────────────────────────────────────
  cassava: f({
    expectedHarvestWindowDays: 30,   // can stay in ground for weeks
    suggestedUnits:            f(['kg', 'bags', 'tubers']),
    perishability:             'high',
    storageDaysAtAmbient:      2,
    postHarvestTip:            'Process or sell within 48 hours — raw roots turn blue-black fast.',
  }),
  yam: f({
    expectedHarvestWindowDays: 30,
    suggestedUnits:            f(['kg', 'tubers', 'bags']),
    perishability:             'medium',
    storageDaysAtAmbient:      60,
    postHarvestTip:            'Cure tubers in shade for a few days before storing — skins toughen and keep pests out.',
  }),
  potato: f({
    expectedHarvestWindowDays: 14,
    suggestedUnits:            f(['bags', 'kg']),
    perishability:             'medium',
    storageDaysAtAmbient:      30,
    postHarvestTip:            'Cure for a week in the dark, then store cool and dry.',
  }),
  'sweet-potato': f({
    expectedHarvestWindowDays: 14,
    suggestedUnits:            f(['kg', 'bags']),
    perishability:             'medium',
    storageDaysAtAmbient:      30,
    postHarvestTip:            'Handle gently — bruises rot quickly; cure in shade for a week.',
  }),

  // ─── Legumes ────────────────────────────────────────────────
  beans: f({
    expectedHarvestWindowDays: 7,
    suggestedUnits:            f(['kg', 'bags']),
    perishability:             'low',
    storageDaysAtAmbient:      180,
    postHarvestTip:            'Dry pods thoroughly before threshing; store airtight to keep weevils out.',
  }),
  soybean: f({
    expectedHarvestWindowDays: 10,
    suggestedUnits:            f(['bags', 'kg']),
    perishability:             'low',
    storageDaysAtAmbient:      180,
    postHarvestTip:            'Cut when leaves drop and pods rattle — late harvest shatters yield.',
  }),
  groundnut: f({
    expectedHarvestWindowDays: 10,
    suggestedUnits:            f(['bags', 'kg']),
    perishability:             'low',
    storageDaysAtAmbient:      180,
    postHarvestTip:            'Lift on a dry day, hang in shade to cure — damp nuts mould and go toxic.',
  }),
  cowpea: f({
    expectedHarvestWindowDays: 14,
    suggestedUnits:            f(['kg', 'bags']),
    perishability:             'low',
    storageDaysAtAmbient:      180,
    postHarvestTip:            'Pick pods in batches as they dry — green pods hold too much water.',
  }),

  // ─── Vegetables ─────────────────────────────────────────────
  tomato: f({
    expectedHarvestWindowDays: 28,    // picked in waves
    suggestedUnits:            f(['crates', 'kg', 'baskets']),
    perishability:             'high',
    storageDaysAtAmbient:      4,
    postHarvestTip:            'Pick at the pink-red stage for transport; fully-red fruit bruises in bags.',
  }),
  onion: f({
    expectedHarvestWindowDays: 10,
    suggestedUnits:            f(['bags', 'kg', 'nets']),
    perishability:             'medium',
    storageDaysAtAmbient:      60,
    postHarvestTip:            'Cure in shade until the necks seal, then store somewhere airy.',
  }),
  pepper: f({
    expectedHarvestWindowDays: 28,
    suggestedUnits:            f(['kg', 'crates', 'baskets']),
    perishability:             'high',
    storageDaysAtAmbient:      5,
    postHarvestTip:            'Pick with a snip of stem to slow moisture loss.',
  }),
  okra: f({
    expectedHarvestWindowDays: 28,
    suggestedUnits:            f(['kg', 'baskets']),
    perishability:             'high',
    storageDaysAtAmbient:      3,
    postHarvestTip:            'Pick every 2 days — over-mature pods go fibrous and buyers reject them.',
  }),
  cabbage: f({
    expectedHarvestWindowDays: 14,
    suggestedUnits:            f(['heads', 'kg', 'crates']),
    perishability:             'medium',
    storageDaysAtAmbient:      14,
    postHarvestTip:            'Cut tight heads with a few outer leaves for transport protection.',
  }),
  carrot: f({
    expectedHarvestWindowDays: 14,
    suggestedUnits:            f(['bunches', 'kg']),
    perishability:             'medium',
    storageDaysAtAmbient:      21,
    postHarvestTip:            'Top the greens quickly — leaves pull moisture from the roots.',
  }),
  cucumber: f({
    expectedHarvestWindowDays: 21,
    suggestedUnits:            f(['crates', 'kg']),
    perishability:             'high',
    storageDaysAtAmbient:      4,
    postHarvestTip:            'Harvest daily at mid-size — over-mature fruit seeds up and loses flavour.',
  }),
  eggplant: f({
    expectedHarvestWindowDays: 21,
    suggestedUnits:            f(['kg', 'crates']),
    perishability:             'medium',
    storageDaysAtAmbient:      7,
    postHarvestTip:            'Cut with scissors — pulling damages the plant and the fruit.',
  }),
  spinach: f({
    expectedHarvestWindowDays: 14,
    suggestedUnits:            f(['bunches', 'kg']),
    perishability:             'high',
    storageDaysAtAmbient:      2,
    postHarvestTip:            'Pick in cool morning hours and get to market the same day.',
  }),
  lettuce: f({
    expectedHarvestWindowDays: 14,
    suggestedUnits:            f(['heads', 'crates']),
    perishability:             'high',
    storageDaysAtAmbient:      3,
    postHarvestTip:            'Harvest in the cool of morning — heat wilts heads fast.',
  }),
  watermelon: f({
    expectedHarvestWindowDays: 14,
    suggestedUnits:            f(['fruits', 'kg']),
    perishability:             'medium',
    storageDaysAtAmbient:      14,
    postHarvestTip:            'Tap test: a ripe fruit sounds hollow. Cut stems, don\u2019t pull.',
  }),
  garlic: f({
    expectedHarvestWindowDays: 10,
    suggestedUnits:            f(['bulbs', 'kg']),
    perishability:             'low',
    storageDaysAtAmbient:      120,
    postHarvestTip:            'Cure in shade for 2 weeks until skins are dry and papery.',
  }),
  ginger: f({
    expectedHarvestWindowDays: 21,
    suggestedUnits:            f(['kg']),
    perishability:             'medium',
    storageDaysAtAmbient:      21,
    postHarvestTip:            'Brush off soil — washing shortens shelf life.',
  }),

  // ─── Fruit / tree ───────────────────────────────────────────
  banana: f({
    expectedHarvestWindowDays: 7,
    suggestedUnits:            f(['bunches', 'kg']),
    perishability:             'high',
    storageDaysAtAmbient:      5,
    postHarvestTip:            'Cut when fruit is plump but still green — ripens best off the plant.',
  }),
  plantain: f({
    expectedHarvestWindowDays: 7,
    suggestedUnits:            f(['bunches', 'kg', 'fingers']),
    perishability:             'high',
    storageDaysAtAmbient:      7,
    postHarvestTip:            'Harvest while green for market; yellowing bunches travel poorly.',
  }),
  mango: f({
    expectedHarvestWindowDays: 21,
    suggestedUnits:            f(['kg', 'crates', 'fruits']),
    perishability:             'high',
    storageDaysAtAmbient:      6,
    postHarvestTip:            'Pick at mature-green — tree-ripe fruit bruises in transit.',
  }),
  orange: f({
    expectedHarvestWindowDays: 21,
    suggestedUnits:            f(['kg', 'crates', 'fruits']),
    perishability:             'medium',
    storageDaysAtAmbient:      14,
    postHarvestTip:            'Clip stems short; torn skins rot first.',
  }),
  pineapple: f({
    expectedHarvestWindowDays: 14,
    suggestedUnits:            f(['fruits', 'crates']),
    perishability:             'medium',
    storageDaysAtAmbient:      7,
    postHarvestTip:            'Cut when the base yellows — pineapples don\u2019t ripen further off the plant.',
  }),
  avocado: f({
    expectedHarvestWindowDays: 21,
    suggestedUnits:            f(['kg', 'fruits', 'crates']),
    perishability:             'medium',
    storageDaysAtAmbient:      7,
    postHarvestTip:            'Pick firm — avocados ripen after harvest, never on the tree.',
  }),

  // ─── Cash / tree crops ──────────────────────────────────────
  cocoa: f({
    expectedHarvestWindowDays: 60,
    suggestedUnits:            f(['bags', 'kg', 'pods']),
    perishability:             'medium',
    storageDaysAtAmbient:      30,
    postHarvestTip:            'Ferment 5–7 days and dry slowly — flavour is made at fermentation.',
  }),
  coffee: f({
    expectedHarvestWindowDays: 45,
    suggestedUnits:            f(['bags', 'kg']),
    perishability:             'medium',
    storageDaysAtAmbient:      30,
    postHarvestTip:            'Pick only ripe red cherries; mixed batches drop the grade.',
  }),
  cotton: f({
    expectedHarvestWindowDays: 30,
    suggestedUnits:            f(['bags', 'kg', 'bales']),
    perishability:             'low',
    storageDaysAtAmbient:      365,
    postHarvestTip:            'Pick when bolls are fully open and dry; wet lint discolours.',
  }),
  sugarcane: f({
    expectedHarvestWindowDays: 60,
    suggestedUnits:            f(['tons', 'bundles']),
    perishability:             'high',
    storageDaysAtAmbient:      2,
    postHarvestTip:            'Crush within 48h — sucrose drops fast once cut.',
  }),
  'oil-palm': f({
    expectedHarvestWindowDays: 365,    // year-round
    suggestedUnits:            f(['bunches', 'kg']),
    perishability:             'high',
    storageDaysAtAmbient:      2,
    postHarvestTip:            'Process fresh bunches within 48h — free fatty acids climb rapidly.',
  }),
});

/**
 * getCropHarvestProfile(canonicalKey) — returns the frozen profile or
 * GENERIC_HARVEST_PROFILE if the crop has no explicit entry. Never
 * returns null, so callers can destructure safely.
 */
export function getCropHarvestProfile(canonicalKey) {
  if (!canonicalKey) return GENERIC_HARVEST_PROFILE;
  return HARVEST_PROFILES[canonicalKey] || GENERIC_HARVEST_PROFILE;
}

/**
 * hasCropHarvestProfile — true when the crop has a tuned profile (vs
 * the generic fallback). Useful for surfacing "rough estimate" copy.
 */
export function hasCropHarvestProfile(canonicalKey) {
  return Boolean(canonicalKey && HARVEST_PROFILES[canonicalKey]);
}

export const _internal = Object.freeze({ HARVEST_PROFILES });
