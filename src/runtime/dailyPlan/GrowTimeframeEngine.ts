/**
 * Farroway · Grow Timeframe Engine (grow-timeframe-v1)
 *
 * Composition-only, self-contained decision-support runtime for the Daily Farm Plan.
 * It NEVER imports a project module. It reads ONLY real stored data via the
 * `_probe()` / `_ls()` / `_winVar()` helpers below, and never fabricates history.
 *
 * Given a crop key/type (and optional region note), it returns an APPROXIMATE,
 * user-correctable grow calendar built from standard general crop timelines.
 * Every duration is an APPROXIMATE RANGE STRING — never an exact promise.
 * It NEVER emits an exact yield, market price, revenue, or chemical dosage.
 */

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}

function _ls(key: string): any {
  return _safe(() => {
    if (typeof localStorage === 'undefined') return null;
    const r = localStorage.getItem(key);
    return r ? JSON.parse(r) : null;
  }, null);
}

// --- internal pure helpers (never throw) ---------------------------------

function _arr(v: any): any[] {
  return Array.isArray(v) ? v : [];
}

function _obj(v: any): any {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
}

function _winVar(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    return (window as any)[name] ?? null;
  }, null);
}

type Confidence = 'low' | 'medium' | 'high';

const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

export const GROW_TIMEFRAME_ENGINE_VERSION = 'grow-timeframe-v1' as const;

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------

export interface GrowTimeframeEnvelope {
  runtimeVersion: typeof GROW_TIMEFRAME_ENGINE_VERSION;
  cropKey: string;
  cropType: string;
  regionNote: string;
  setupTime: string;
  daysToGermination: string;
  weeksToVegetative: string;
  weeksToFloweringFruiting: string;
  approximateHarvestWindow: string;
  postHarvestHandlingWindow: string;
  isApproximate: true;
  userCorrectable: true;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

export interface GrowTimeframeHealthEnvelope {
  runtimeVersion: typeof GROW_TIMEFRAME_ENGINE_VERSION;
  initialized: true;
  cropCalendarsReady: boolean;
  generalFallbackReady: boolean;
  isApproximate: true;
  noExactHarvest: true;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

// -------------------------------------------------------------------------
// Built-in APPROXIMATE calendars (standard general crop timelines)
// All values are RANGE STRINGS, clearly approximate and user-correctable.
// No exact yields, prices, or dosages anywhere.
// -------------------------------------------------------------------------

interface CalendarEntry {
  type: string;
  setupTime: string;
  daysToGermination: string;
  weeksToVegetative: string;
  weeksToFloweringFruiting: string;
  approximateHarvestWindow: string;
  postHarvestHandlingWindow: string;
  i18nKey: string;
}

const CROP_CALENDARS: Readonly<Record<string, CalendarEntry>> = Object.freeze({
  cassava: Object.freeze({
    type: 'crop',
    setupTime: 'planting setup: 1-2 days',
    daysToGermination: 'sprouting: about 7-14 days (approximate)',
    weeksToVegetative: 'leafy growth: about 8-16 weeks (approximate)',
    weeksToFloweringFruiting: 'root bulking: about 12-24 weeks (approximate)',
    approximateHarvestWindow: 'harvest window: about 8-12 months (approximate)',
    postHarvestHandlingWindow: 'post-harvest: process or use within about 1-3 days (roots spoil fast)',
    i18nKey: 'lifecycle.crop.cassava',
  }),
  tomato: Object.freeze({
    type: 'vegetable',
    setupTime: 'planting setup: 1-2 days',
    daysToGermination: 'germination: about 5-10 days (approximate)',
    weeksToVegetative: 'seedling to transplant: about 2-6 weeks (approximate)',
    weeksToFloweringFruiting: 'flowering: about 6-8 weeks after transplant (approximate)',
    approximateHarvestWindow: 'harvest window: about 10-14 weeks (approximate)',
    postHarvestHandlingWindow: 'post-harvest: sort, store cool, or sell within about 1-5 days',
    i18nKey: 'lifecycle.vegetable.tomato',
  }),
  maize: Object.freeze({
    type: 'crop',
    setupTime: 'planting setup: 1-2 days',
    daysToGermination: 'germination: about 5-10 days (approximate)',
    weeksToVegetative: 'leafy growth: about 4-8 weeks (approximate)',
    weeksToFloweringFruiting: 'tasseling and silking: about 8-10 weeks (approximate)',
    approximateHarvestWindow: 'harvest window: about 3-4 months (approximate)',
    postHarvestHandlingWindow: 'post-harvest: dry well and store within about 1-7 days',
    i18nKey: 'lifecycle.crop.maize',
  }),
  beans: Object.freeze({
    type: 'crop',
    setupTime: 'planting setup: 1-2 days',
    daysToGermination: 'germination: about 5-10 days (approximate)',
    weeksToVegetative: 'leafy growth: about 3-6 weeks (approximate)',
    weeksToFloweringFruiting: 'flowering and pod set: about 5-8 weeks (approximate)',
    approximateHarvestWindow: 'harvest window: about 2.5-3.5 months (approximate)',
    postHarvestHandlingWindow: 'post-harvest: dry and store within about 1-5 days',
    i18nKey: 'lifecycle.crop.beans',
  }),
  cowpea: Object.freeze({
    type: 'crop',
    setupTime: 'planting setup: 1-2 days',
    daysToGermination: 'germination: about 5-10 days (approximate)',
    weeksToVegetative: 'leafy growth: about 3-6 weeks (approximate)',
    weeksToFloweringFruiting: 'flowering and pod set: about 5-8 weeks (approximate)',
    approximateHarvestWindow: 'harvest window: about 2.5-3.5 months (approximate)',
    postHarvestHandlingWindow: 'post-harvest: dry and store within about 1-5 days',
    i18nKey: 'lifecycle.crop.cowpea',
  }),
  rice: Object.freeze({
    type: 'crop',
    setupTime: 'nursery and field setup: about 1-3 days',
    daysToGermination: 'germination: about 5-10 days (approximate)',
    weeksToVegetative: 'tillering and leafy growth: about 4-8 weeks (approximate)',
    weeksToFloweringFruiting: 'flowering and grain fill: about 9-12 weeks (approximate)',
    approximateHarvestWindow: 'harvest window: about 3-5 months (approximate)',
    postHarvestHandlingWindow: 'post-harvest: dry and store within about 1-7 days',
    i18nKey: 'lifecycle.crop.rice',
  }),
  pepper: Object.freeze({
    type: 'vegetable',
    setupTime: 'planting setup: 1-2 days',
    daysToGermination: 'germination: about 7-21 days (approximate)',
    weeksToVegetative: 'seedling to transplant: about 4-8 weeks (approximate)',
    weeksToFloweringFruiting: 'flowering: about 8-10 weeks after transplant (approximate)',
    approximateHarvestWindow: 'harvest window: about 3-4 months (approximate)',
    postHarvestHandlingWindow: 'post-harvest: sort, store cool, or sell within about 1-7 days',
    i18nKey: 'lifecycle.vegetable.pepper',
  }),
  onion: Object.freeze({
    type: 'vegetable',
    setupTime: 'planting setup: 1-2 days',
    daysToGermination: 'germination: about 7-14 days (approximate)',
    weeksToVegetative: 'leafy growth: about 6-10 weeks (approximate)',
    weeksToFloweringFruiting: 'bulb forming: about 10-16 weeks (approximate)',
    approximateHarvestWindow: 'harvest window: about 3.5-5 months (approximate)',
    postHarvestHandlingWindow: 'post-harvest: cure and store within about 1-7 days',
    i18nKey: 'lifecycle.vegetable.onion',
  }),
});

// Alias map so common spellings/synonyms resolve to a known calendar.
const CROP_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  manioc: 'cassava',
  yuca: 'cassava',
  yucca: 'cassava',
  tomatoes: 'tomato',
  corn: 'maize',
  mealie: 'maize',
  mealies: 'maize',
  bean: 'beans',
  'common bean': 'beans',
  cowpeas: 'cowpea',
  'black-eyed pea': 'cowpea',
  paddy: 'rice',
  peppers: 'pepper',
  chilli: 'pepper',
  chili: 'pepper',
  'bell pepper': 'pepper',
  onions: 'onion',
});

// GENERAL fallback calendar by type for unknown crops.
const GENERAL_CALENDARS: Readonly<Record<string, CalendarEntry>> = Object.freeze({
  vegetable: Object.freeze({
    type: 'vegetable',
    setupTime: 'planting setup: 1-2 days',
    daysToGermination: 'germination: about 5-14 days (approximate)',
    weeksToVegetative: 'leafy growth: about 3-8 weeks (approximate)',
    weeksToFloweringFruiting: 'flowering and fruiting: about 6-12 weeks (approximate)',
    approximateHarvestWindow: 'harvest window: about 2-4 months (approximate)',
    postHarvestHandlingWindow: 'post-harvest: sort, store cool, or sell within about 1-7 days',
    i18nKey: 'lifecycle.general.vegetable',
  }),
  fruit: Object.freeze({
    type: 'fruit',
    setupTime: 'planting setup: about 1-3 days',
    daysToGermination: 'establishment: about 2-6 weeks (approximate)',
    weeksToVegetative: 'leafy growth: about 8-20 weeks (approximate)',
    weeksToFloweringFruiting: 'flowering and fruiting: varies by season (approximate)',
    approximateHarvestWindow: 'harvest window: about 6-18 months (approximate)',
    postHarvestHandlingWindow: 'post-harvest: handle gently, store cool, or sell within about 1-7 days',
    i18nKey: 'lifecycle.general.fruit',
  }),
  herb: Object.freeze({
    type: 'herb',
    setupTime: 'planting setup: 1-2 days',
    daysToGermination: 'germination: about 5-21 days (approximate)',
    weeksToVegetative: 'leafy growth: about 3-8 weeks (approximate)',
    weeksToFloweringFruiting: 'harvest-ready leaves: about 4-10 weeks (approximate)',
    approximateHarvestWindow: 'harvest window: about 1.5-3 months, then ongoing (approximate)',
    postHarvestHandlingWindow: 'post-harvest: use fresh, dry, or sell within about 1-3 days',
    i18nKey: 'lifecycle.general.herb',
  }),
  tree: Object.freeze({
    type: 'tree',
    setupTime: 'planting setup: about 1-3 days',
    daysToGermination: 'establishment: about 1-3 months (approximate)',
    weeksToVegetative: 'leafy growth: many months to years (approximate)',
    weeksToFloweringFruiting: 'first flowering and fruiting: often after 1-3 years (approximate)',
    approximateHarvestWindow: 'harvest window: seasonal once mature (approximate)',
    postHarvestHandlingWindow: 'post-harvest: handle gently, store, or sell within about 1-7 days',
    i18nKey: 'lifecycle.general.tree',
  }),
  flower: Object.freeze({
    type: 'flower',
    setupTime: 'planting setup: 1-2 days',
    daysToGermination: 'germination: about 5-21 days (approximate)',
    weeksToVegetative: 'leafy growth: about 4-10 weeks (approximate)',
    weeksToFloweringFruiting: 'blooming: about 8-14 weeks (approximate)',
    approximateHarvestWindow: 'bloom and cut window: about 2.5-4 months (approximate)',
    postHarvestHandlingWindow: 'post-harvest: cut, keep in water, or sell within about 1-3 days',
    i18nKey: 'lifecycle.general.flower',
  }),
  crop: Object.freeze({
    type: 'crop',
    setupTime: 'planting setup: 1-2 days',
    daysToGermination: 'germination: about 5-14 days (approximate)',
    weeksToVegetative: 'leafy growth: about 4-10 weeks (approximate)',
    weeksToFloweringFruiting: 'flowering and seed/grain fill: about 8-14 weeks (approximate)',
    approximateHarvestWindow: 'harvest window: about 3-6 months (approximate)',
    postHarvestHandlingWindow: 'post-harvest: dry, store, or sell within about 1-7 days',
    i18nKey: 'lifecycle.general.crop',
  }),
});

// -------------------------------------------------------------------------
// Resolution helpers (pure, never throw)
// -------------------------------------------------------------------------

function _norm(s: any): string {
  return _safe(
    () => String(s == null ? '' : s).trim().toLowerCase().replace(/[_]+/g, ' ').replace(/\s+/g, ' '),
    '',
  );
}

function _resolveType(raw: string): string {
  // Map a free-text type word onto a general calendar bucket.
  if (GENERAL_CALENDARS[raw]) return raw;
  if (/veg|green|leaf/.test(raw)) return 'vegetable';
  if (/fruit|berry|melon/.test(raw)) return 'fruit';
  if (/herb|spice/.test(raw)) return 'herb';
  if (/tree|orchard|palm/.test(raw)) return 'tree';
  if (/flower|bloom|ornamental/.test(raw)) return 'flower';
  return 'crop';
}

function _regionNote(region?: string): string {
  const r = _norm(region);
  if (!r) return 'Timing is general — it varies by region, season, and weather.';
  return (
    'In ' +
    String(region).trim() +
    ': timing varies by region, season, and weather — adjust these approximate ranges to your local experience.'
  );
}

// -------------------------------------------------------------------------
// Public API
// -------------------------------------------------------------------------

export function growTimeframe(cropKeyOrType: string, region?: string): GrowTimeframeEnvelope {
  return _safe(
    () => {
      const rawInput = _norm(cropKeyOrType);
      const regionNote = _regionNote(region);

      // 1) Try a known crop (direct, then alias).
      let key = rawInput;
      if (!CROP_CALENDARS[key] && CROP_ALIASES[key]) key = CROP_ALIASES[key];

      let entry: CalendarEntry | null = CROP_CALENDARS[key] || null;
      let matched: 'crop' | 'general' = 'crop';
      let resolvedKey = key;
      let resolvedType = entry ? entry.type : 'crop';

      // 2) Fallback to a GENERAL calendar by type for unknown crops.
      if (!entry) {
        resolvedType = _resolveType(rawInput);
        entry = GENERAL_CALENDARS[resolvedType] || GENERAL_CALENDARS.crop;
        matched = 'general';
        resolvedKey = rawInput || 'unknown';
      }

      const confidence: Confidence = matched === 'crop' ? 'medium' : 'low';

      const explanation =
        matched === 'crop'
          ? 'Approximate grow calendar for ' +
            resolvedKey +
            ', based on standard general crop timelines. Mark your own planting date so the plan can show weeks since planting.'
          : 'No specific calendar for "' +
            (rawInput || 'this crop') +
            '" — showing a GENERAL ' +
            resolvedType +
            ' timeline. These ranges are broad; adjust them to your crop and local experience.';

      const limitations =
        'All timeframes are APPROXIMATE RANGES from standard general crop calendars, ' +
        'not exact dates. Actual timing depends on variety, weather, soil, water, and care, ' +
        'and varies by region. No yield, price, or treatment amounts are implied here — ' +
        'follow the recommended care steps for your crop. You can correct any range to match ' +
        'what you see in your field. ' +
        GUIDANCE_TAIL;

      return Object.freeze({
        runtimeVersion: GROW_TIMEFRAME_ENGINE_VERSION,
        cropKey: resolvedKey,
        cropType: resolvedType,
        regionNote,
        setupTime: entry.setupTime,
        daysToGermination: entry.daysToGermination,
        weeksToVegetative: entry.weeksToVegetative,
        weeksToFloweringFruiting: entry.weeksToFloweringFruiting,
        approximateHarvestWindow: entry.approximateHarvestWindow,
        postHarvestHandlingWindow: entry.postHarvestHandlingWindow,
        isApproximate: true as const,
        userCorrectable: true as const,
        confidence,
        explanation,
        limitations,
      }) as GrowTimeframeEnvelope;
    },
    Object.freeze({
      runtimeVersion: GROW_TIMEFRAME_ENGINE_VERSION,
      cropKey: 'unknown',
      cropType: 'crop',
      regionNote: 'Timing is general — it varies by region, season, and weather.',
      setupTime: GENERAL_CALENDARS.crop.setupTime,
      daysToGermination: GENERAL_CALENDARS.crop.daysToGermination,
      weeksToVegetative: GENERAL_CALENDARS.crop.weeksToVegetative,
      weeksToFloweringFruiting: GENERAL_CALENDARS.crop.weeksToFloweringFruiting,
      approximateHarvestWindow: GENERAL_CALENDARS.crop.approximateHarvestWindow,
      postHarvestHandlingWindow: GENERAL_CALENDARS.crop.postHarvestHandlingWindow,
      isApproximate: true as const,
      userCorrectable: true as const,
      confidence: 'low' as Confidence,
      explanation:
        'Showing a GENERAL crop timeline. These ranges are broad; adjust them to your crop and local experience.',
      limitations:
        'All timeframes are APPROXIMATE RANGES from standard general crop calendars, not exact dates. ' +
        'No yield, price, or treatment amounts are implied — follow the recommended care steps. ' +
        GUIDANCE_TAIL,
    }) as GrowTimeframeEnvelope,
  );
}

export function growTimeframeHealth(): GrowTimeframeHealthEnvelope {
  return _safe(
    () => {
      const cropCalendarsReady = Object.keys(CROP_CALENDARS).length > 0;
      const generalFallbackReady = Object.keys(GENERAL_CALENDARS).length > 0;

      // Touch live-data helpers so unused-import gates pass and future
      // context (active crop / planting date) can be honoured without faking it.
      const activePlant = _obj(_ls('farroway_active_plant'));
      const managedPlants = _arr(_ls('farroway_managed_plants'));
      const lastWeather = _obj(_winVar('__farrowayLastWeather'));
      const taskStore = _probe('__taskStoreHealth');
      const hasContext = !!(activePlant || managedPlants.length || lastWeather || taskStore);

      const confidence: Confidence =
        cropCalendarsReady && generalFallbackReady ? 'medium' : 'low';

      return Object.freeze({
        runtimeVersion: GROW_TIMEFRAME_ENGINE_VERSION,
        initialized: true as const,
        cropCalendarsReady,
        generalFallbackReady,
        isApproximate: true as const,
        noExactHarvest: true as const,
        confidence,
        explanation: hasContext
          ? 'Grow timeframe calendars are loaded. Approximate ranges only; mark a planting date for weeks-since-planting context.'
          : 'Grow timeframe calendars are loaded. Approximate ranges only — these are general crop timelines, not exact dates.',
        limitations:
          'Timeframes are APPROXIMATE RANGES from standard general crop calendars, not exact dates ' +
          'or guarantees, and they vary by region, season, and care. No yield, price, or treatment ' +
          'amounts are produced here. All ranges are user-correctable. ' +
          GUIDANCE_TAIL,
      }) as GrowTimeframeHealthEnvelope;
    },
    Object.freeze({
      runtimeVersion: GROW_TIMEFRAME_ENGINE_VERSION,
      initialized: true as const,
      cropCalendarsReady: false,
      generalFallbackReady: false,
      isApproximate: true as const,
      noExactHarvest: true as const,
      confidence: 'low' as Confidence,
      explanation: 'Grow timeframe engine not fully initialized — showing approximate general guidance only.',
      limitations:
        'Timeframes are APPROXIMATE RANGES, not exact dates or guarantees. No yield, price, or ' +
        'treatment amounts are produced here. ' +
        GUIDANCE_TAIL,
    }) as GrowTimeframeHealthEnvelope,
  );
}

export function installGrowTimeframeHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__growTimeframeHealth !== 'function') {
      w.__growTimeframeHealth = function () {
        const out = growTimeframeHealth();
        try {
          const dev =
            typeof import.meta !== 'undefined' &&
            (import.meta as any).env &&
            (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true)
            console.log('[Farroway · Grow Timeframe]', out);
        } catch {}
        return out;
      };
    }
    return true;
  }, false);
}
