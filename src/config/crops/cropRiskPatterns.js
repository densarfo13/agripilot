/**
 * cropRiskPatterns.js — crop-specific risk hints consumed by the
 * risk engine (src/lib/risk/riskEngine.js).
 *
 * Shape:
 *   CROP_RISK_PATTERNS[canonicalKey] = [
 *     {
 *       type:     'pest' | 'disease' | 'weather' | 'nutrient',
 *       severity: 'low' | 'medium' | 'high',
 *       trigger:  {                    // optional — engine matches on this
 *         climate?: 'tropical' | 'arid' | 'temperate',
 *         season?:  'wet' | 'dry' | 'winter' | 'summer' | 'spring' | 'fall',
 *         stage?:   string,            // canonical lifecycle stage key
 *       },
 *       messageKey: string,            // i18n key (plain-English fallback in `message`)
 *       message:    string,
 *       why:        string,            // one-sentence rationale for the "Why?" bubble
 *     },
 *     …
 *   ]
 *
 * These are HINTS, not diagnoses — the engine may upgrade severity
 * based on observed issues or downgrade based on confidence, and the
 * UI always frames them as "watch for", "risk of", not "you have".
 *
 * Keep entries terse and explanatory — farmers read them on a phone.
 */

const freeze = Object.freeze;
const f = (p) => freeze(p.map(freeze));

export const CROP_RISK_PATTERNS = freeze({
  // ─── Cassava ─────────────────────────────────────────────────
  cassava: f([
    { type: 'pest', severity: 'high',
      trigger: { climate: 'tropical', season: 'wet' },
      messageKey: 'risk.cassava.whitefly_mosaic',
      message: 'Watch for whitefly and cassava mosaic virus.',
      why: 'Wet tropical seasons favour whitefly reproduction, which spreads mosaic virus fast.' },
    { type: 'disease', severity: 'high',
      trigger: { stage: 'bulking' },
      messageKey: 'risk.cassava.root_rot',
      message: 'Root rot risk — keep fields well drained.',
      why: 'Waterlogging during bulking suffocates tubers and invites rot organisms.' },
    { type: 'nutrient', severity: 'medium',
      trigger: { stage: 'vegetative' },
      messageKey: 'risk.cassava.leaf_yellowing',
      message: 'Leaf yellowing may signal nutrient stress.',
      why: 'Cassava is heavy on potassium; pale leaves early can mean K or N shortage.' },
  ]),

  // ─── Maize ───────────────────────────────────────────────────
  maize: f([
    { type: 'weather', severity: 'high',
      trigger: { stage: 'tasseling' },
      messageKey: 'risk.maize.drought_tasseling',
      message: 'Drought stress at tasseling hits yield hardest.',
      why: 'Pollen viability collapses under water stress — a single dry week at tasseling can cut yield 30–50%.' },
    { type: 'pest', severity: 'high',
      trigger: { climate: 'tropical' },
      messageKey: 'risk.maize.fall_armyworm',
      message: 'Scout for fall armyworm damage on leaves and whorl.',
      why: 'FAW is a dominant maize pest across tropical Africa; damage compounds fast if missed.' },
    { type: 'weather', severity: 'medium',
      trigger: { stage: 'grain_fill' },
      messageKey: 'risk.maize.heat_grainfill',
      message: 'Heat stress during grain fill reduces kernel weight.',
      why: 'Sustained temperatures above ~35 °C shorten the grain-filling window.' },
  ]),

  // ─── Rice ────────────────────────────────────────────────────
  rice: f([
    { type: 'disease', severity: 'high',
      trigger: { climate: 'tropical', season: 'wet' },
      messageKey: 'risk.rice.blast',
      message: 'Rice blast risk — monitor for grey-green leaf lesions.',
      why: 'High humidity + warm nights create the exact window blast spores need to germinate.' },
    { type: 'pest', severity: 'medium',
      trigger: { stage: 'flowering' },
      messageKey: 'risk.rice.stem_borer',
      message: 'Check for stem borer — look for dead hearts in tillers.',
      why: 'Borer damage at flowering causes "white heads" — empty panicles with no grain.' },
    { type: 'weather', severity: 'medium',
      trigger: { season: 'dry' },
      messageKey: 'risk.rice.water_stress',
      message: 'Water stress — keep paddy bunds sealed and refilled.',
      why: 'Rice is a thirsty crop; even short dry spells at tillering cut grain count.' },
  ]),

  // ─── Tomato ──────────────────────────────────────────────────
  tomato: f([
    { type: 'disease', severity: 'high',
      trigger: { climate: 'tropical', season: 'wet' },
      messageKey: 'risk.tomato.late_blight',
      message: 'Late blight risk — avoid overhead watering if possible.',
      why: 'Wet foliage + humid nights is the classic blight trigger window.' },
    { type: 'pest', severity: 'medium',
      trigger: { stage: 'fruiting' },
      messageKey: 'risk.tomato.fruitworm',
      message: 'Watch fruits for worm entry holes.',
      why: 'Fruitworms drill into ripening fruit and ruin the market grade in days.' },
    { type: 'nutrient', severity: 'medium',
      trigger: { stage: 'flowering' },
      messageKey: 'risk.tomato.blossom_end_rot',
      message: 'Uneven watering can cause blossom-end rot.',
      why: 'Calcium uptake needs steady moisture — dry/wet swings starve developing fruit tips.' },
  ]),

  // ─── Onion ───────────────────────────────────────────────────
  onion: f([
    { type: 'disease', severity: 'high',
      trigger: { season: 'wet' },
      messageKey: 'risk.onion.purple_blotch',
      message: 'Purple blotch risk in humid conditions.',
      why: 'Onion leaves stay wet easily in row crops — fungal pressure builds fast in wet weather.' },
    { type: 'weather', severity: 'medium',
      trigger: { stage: 'bulking' },
      messageKey: 'risk.onion.wet_bulking',
      message: 'Avoid heavy watering as bulbs mature.',
      why: 'Late watering splits bulbs and invites neck rot at storage.' },
  ]),

  // ─── Okra ────────────────────────────────────────────────────
  okra: f([
    { type: 'pest', severity: 'medium',
      trigger: { climate: 'tropical' },
      messageKey: 'risk.okra.shoot_fruit_borer',
      message: 'Scout for shoot and fruit borer.',
      why: 'Borers are okra’s top tropical pest — they tunnel into tender shoots and pods.' },
    { type: 'disease', severity: 'medium',
      trigger: { season: 'wet' },
      messageKey: 'risk.okra.yellow_vein',
      message: 'Yellow vein mosaic — spread by whitefly.',
      why: 'Whitefly loves humid weather and this virus has no cure once infected.' },
  ]),

  // ─── Pepper ──────────────────────────────────────────────────
  pepper: f([
    { type: 'disease', severity: 'high',
      trigger: { climate: 'tropical', season: 'wet' },
      messageKey: 'risk.pepper.anthracnose',
      message: 'Anthracnose — dark sunken spots on fruit.',
      why: 'Warm humid weather drives anthracnose on ripening peppers.' },
    { type: 'pest', severity: 'medium',
      trigger: { stage: 'fruiting' },
      messageKey: 'risk.pepper.thrips',
      message: 'Check leaves for thrips damage.',
      why: 'Thrips scar fruit and spread viruses — damage ramps up at fruiting.' },
  ]),

  // ─── Potato ──────────────────────────────────────────────────
  potato: f([
    { type: 'disease', severity: 'high',
      trigger: { climate: 'temperate', season: 'summer' },
      messageKey: 'risk.potato.late_blight',
      message: 'Late blight watch — inspect leaves weekly.',
      why: 'Cool nights + warm days + leaf wetness is late blight’s textbook window.' },
    { type: 'pest', severity: 'medium',
      trigger: { stage: 'vegetative' },
      messageKey: 'risk.potato.aphids',
      message: 'Monitor aphids on new growth.',
      why: 'Aphids spread virus Y and rolled-leaf virus, both of which crash yields.' },
  ]),

  // ─── Banana ──────────────────────────────────────────────────
  banana: f([
    { type: 'disease', severity: 'high',
      trigger: { climate: 'tropical', season: 'wet' },
      messageKey: 'risk.banana.black_sigatoka',
      message: 'Black Sigatoka — remove dead leaves weekly.',
      why: 'Spores live on decaying leaves; sanitation is half the battle in wet season.' },
    { type: 'pest', severity: 'medium',
      trigger: { stage: 'maturation' },
      messageKey: 'risk.banana.weevil',
      message: 'Check pseudostems for banana weevil holes.',
      why: 'Weevils tunnel the stem base and topple fruiting plants.' },
  ]),

  // ─── Plantain (same pathology as banana) ─────────────────────
  plantain: f([
    { type: 'disease', severity: 'high',
      trigger: { climate: 'tropical', season: 'wet' },
      messageKey: 'risk.plantain.black_sigatoka',
      message: 'Black Sigatoka — sanitise the field weekly.',
      why: 'Plantain shares banana’s foliar disease pressure in humid heat.' },
    { type: 'weather', severity: 'medium',
      trigger: { stage: 'maturation' },
      messageKey: 'risk.plantain.wind',
      message: 'Fruiting plants tip over in wind — stake them.',
      why: 'A mature bunch is heavy and shallow-rooted plantains topple easily.' },
  ]),

  // ─── Cocoa ───────────────────────────────────────────────────
  cocoa: f([
    { type: 'disease', severity: 'high',
      trigger: { season: 'wet' },
      messageKey: 'risk.cocoa.black_pod',
      message: 'Black pod rot — remove diseased pods weekly.',
      why: 'Phytophthora spreads pod-to-pod in humid conditions; leaving one rots many.' },
    { type: 'pest', severity: 'medium',
      trigger: { stage: 'fruiting' },
      messageKey: 'risk.cocoa.mirids',
      message: 'Scout for capsid (mirid) damage on pods and shoots.',
      why: 'Mirids feed on young pods and shoots and open doors for secondary rot.' },
  ]),

  // ─── Mango ───────────────────────────────────────────────────
  mango: f([
    { type: 'disease', severity: 'medium',
      trigger: { stage: 'flowering' },
      messageKey: 'risk.mango.powdery_mildew',
      message: 'Powdery mildew on flower panicles reduces fruit set.',
      why: 'Mildew attacks open flowers; a bad year at flowering can halve the crop.' },
    { type: 'pest', severity: 'medium',
      trigger: { stage: 'fruiting' },
      messageKey: 'risk.mango.fruit_fly',
      message: 'Fruit fly — bag or trap around ripening fruit.',
      why: 'Fruit flies lay eggs inside nearly-ripe fruit and make it unsellable overnight.' },
  ]),

  // ─── Generic fallback set — used when a crop has no bespoke
  // patterns. Keeps the engine honest for unknown crops.
  _generic: f([
    { type: 'weather', severity: 'medium',
      trigger: { season: 'dry' },
      messageKey: 'risk.generic.dry_stress',
      message: 'Dry conditions — plan irrigation windows.',
      why: 'Most crops slow growth within a week of dry weather if unirrigated.' },
    { type: 'disease', severity: 'medium',
      trigger: { season: 'wet' },
      messageKey: 'risk.generic.wet_disease',
      message: 'Wet weather raises foliar disease pressure.',
      why: 'Fungal and bacterial leaf diseases all gain when foliage stays wet.' },
  ]),
});

/**
 * getCropRiskPatterns(canonicalKey)
 *   Returns the frozen array of risk patterns for this crop, or the
 *   generic fallback if no crop-specific patterns are registered.
 *   Never returns null — always safe to iterate.
 */
export function getCropRiskPatterns(canonicalKey) {
  if (!canonicalKey) return CROP_RISK_PATTERNS._generic;
  return CROP_RISK_PATTERNS[canonicalKey] || CROP_RISK_PATTERNS._generic;
}

/**
 * matchCropRiskPatterns({ canonicalKey, climate, season, stage })
 *   Returns only the patterns whose `trigger` matches the supplied
 *   context. Unspecified trigger fields are treated as wildcards.
 *   Used by the risk engine to short-list hints for a specific
 *   farm/day.
 */
export function matchCropRiskPatterns({ canonicalKey, climate, season, stage } = {}) {
  const pool = getCropRiskPatterns(canonicalKey);
  return pool.filter((p) => {
    const t = p.trigger || {};
    if (t.climate && t.climate !== climate) return false;
    if (t.season  && t.season  !== season)  return false;
    if (t.stage   && t.stage   !== stage)   return false;
    return true;
  });
}
