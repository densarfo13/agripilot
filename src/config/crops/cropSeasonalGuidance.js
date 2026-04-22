/**
 * cropSeasonalGuidance.js — lightweight per-crop planting hints.
 *
 * This is advisory, not a prescription — the point is to give the
 * farmer a plain-English cue at onboarding ("cassava likes early
 * rains") without pretending to be a weather forecast.
 *
 * Shape:
 *   CROP_SEASONAL_GUIDANCE[canonicalKey] = {
 *     plantingWindow: string,  // short advisory sentence
 *     avoidWindow?:   string,  // when NOT to plant (optional)
 *     harvestCue?:    string,  // when to expect harvest (optional)
 *     regions?: {              // optional per-country overrides (ISO-2)
 *       [countryCode]: { plantingWindow, avoidWindow?, harvestCue? }
 *     },
 *   }
 *
 * Deliberately coarse. The weather/calendar engines can layer
 * precision on top; this module gives a safe default worth showing
 * even when we know nothing about the region.
 */

const freeze = Object.freeze;

export const CROP_SEASONAL_GUIDANCE = freeze({
  cassava: freeze({
    plantingWindow: 'Best planted at the start of the rainy season so cuttings establish in moist soil.',
    avoidWindow: 'Avoid planting into prolonged dry weather — cuttings desiccate before rooting.',
    harvestCue: 'Most varieties mature 9–12 months after planting.',
  }),
  maize: freeze({
    plantingWindow: 'Plant at the onset of steady rains; maize needs consistent moisture through tasseling.',
    avoidWindow: 'Avoid sowing into dry soil — patchy germination is the main cause of weak stands.',
    harvestCue: 'Harvest when husks dry back and kernels dent (usually 90–120 days).',
  }),
  rice: freeze({
    plantingWindow: 'Transplant into flooded paddies at the start of the wet season; keep bunds sealed.',
    avoidWindow: 'Avoid transplanting during heavy storms that flatten seedlings.',
    harvestCue: 'Grain ready when ~80% of panicles have turned golden.',
  }),
  tomato: freeze({
    plantingWindow: 'Transplant after the last frost (temperate) or early in the dry season (tropical).',
    avoidWindow: 'Avoid wet-season planting where late blight pressure is high.',
    harvestCue: 'First red fruit typically 60–75 days after transplant.',
  }),
  onion: freeze({
    plantingWindow: 'Prefers cool start; plant so bulbing coincides with dry weather.',
    avoidWindow: 'Avoid heavy rain at bulbing — causes splits and neck rot.',
    harvestCue: 'Lift when 50–70% of tops fall over naturally.',
  }),
  okra: freeze({
    plantingWindow: 'Plant once soil is reliably warm; germinates fast in warm wet soil.',
    avoidWindow: 'Avoid cool wet soils — seeds rot before emerging.',
    harvestCue: 'Pick pods every 2–3 days once plants start fruiting.',
  }),
  pepper: freeze({
    plantingWindow: 'Transplant after rains stabilise; peppers love warm days and steady moisture.',
    avoidWindow: 'Avoid waterlogged beds — peppers resent wet feet.',
    harvestCue: 'Green peppers 60–70 days after transplant; ripe colour adds 2–3 weeks.',
  }),
  potato: freeze({
    plantingWindow: 'Plant when soil is cool but not frozen; earlier is usually better.',
    avoidWindow: 'Avoid hot planting windows — tuber set fails above ~28 °C soil.',
    harvestCue: 'Harvest 2–3 weeks after tops die back to cure the skins.',
  }),
  banana: freeze({
    plantingWindow: 'Plant at the start of rains so suckers establish before dry weather.',
    avoidWindow: 'Avoid planting into heavy wind-prone areas without stakes.',
    harvestCue: 'Bunches ready ~9–12 months after planting; fill rounds out to cylindrical.',
  }),
  plantain: freeze({
    plantingWindow: 'Plant at the start of rains — same rhythm as banana.',
    avoidWindow: 'Avoid exposed sites; heavy fruit bunches topple in wind.',
    harvestCue: 'Ready when fingers plump and ridges smooth out (10–14 months).',
  }),
  cocoa: freeze({
    plantingWindow: 'Plant young trees under shade at the start of the rainy season.',
    avoidWindow: 'Avoid planting in full sun — young cocoa needs 50% shade.',
    harvestCue: 'Pods ready ~5–6 months after flowering; first crop usually at year 3–5.',
  }),
  mango: freeze({
    plantingWindow: 'Plant grafts at the start of rains so roots establish before dry season.',
    avoidWindow: 'Avoid waterlogged sites — mango hates wet feet.',
    harvestCue: 'Flowering to harvest typically 100–150 days; pick firm mature green for transport.',
  }),
  yam: freeze({
    plantingWindow: 'Plant setts in ridges or mounds at the start of rains.',
    avoidWindow: 'Avoid flooded low spots; yam tubers rot in saturated soil.',
    harvestCue: 'Lift 8–11 months after planting, once the vine starts to yellow.',
  }),
  'sweet-potato': freeze({
    plantingWindow: 'Plant vine cuttings when soils are warm and moist.',
    avoidWindow: 'Avoid cold snaps — sweet potato is a warm-weather crop.',
    harvestCue: 'Dig 90–120 days after planting, once roots fill out.',
  }),
  groundnut: freeze({
    plantingWindow: 'Plant when soil is warm and well-drained at the start of rains.',
    avoidWindow: 'Avoid heavy clay soils that stay wet — pegs rot before pod fill.',
    harvestCue: 'Ready when most inner pod shells show dark veins (90–120 days).',
  }),
});

/**
 * getCropSeasonalGuidance(canonicalKey, countryCode?)
 *   Returns the regional override if present, else the global entry,
 *   else null. UI should render the `plantingWindow` string as the
 *   main advisory and only show `avoidWindow`/`harvestCue` if the
 *   crop card has room.
 */
export function getCropSeasonalGuidance(canonicalKey, countryCode = null) {
  if (!canonicalKey) return null;
  const base = CROP_SEASONAL_GUIDANCE[canonicalKey];
  if (!base) return null;
  const cc = countryCode ? String(countryCode).toUpperCase() : null;
  if (cc && base.regions && base.regions[cc]) {
    // Merge override onto base so partial regional overrides work.
    return Object.freeze({ ...base, ...base.regions[cc] });
  }
  return base;
}
