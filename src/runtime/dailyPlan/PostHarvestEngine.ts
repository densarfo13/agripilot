/**
 * Farroway · Post-Harvest Engine (post-harvest-v1)
 *
 * Composition-only, self-contained decision-support runtime for the
 * Daily Farm Plan. It NEVER imports a project module. It reads ONLY real
 * stored data via the `_probe()` / `_ls()` / `_winVar()` helpers below,
 * and never fabricates counts, yields, or market prices.
 *
 * Given a crop key it returns honest, APPROXIMATE post-harvest guidance:
 * a harvest checklist, sorting/grading hints, optional drying/curing,
 * generic + safe storage advice, an approximate spoilage-risk label, and
 * selling-readiness notes. A small built-in catalog covers a few common
 * crops; everything else gets a GENERAL SAFE fallback.
 *
 * Honest agronomy: timeframes/stages are APPROXIMATE RANGES, clearly
 * marked, user-correctable, never a guarantee. No exact yield, no
 * tons/acre/bags/kg, no revenue, no market price. No chemical/storage
 * dosages — storage advice stays generic and safe.
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
type SpoilageRisk = 'low' | 'medium' | 'high' | 'unknown';

export const POST_HARVEST_ENGINE_VERSION = 'post-harvest-v1' as const;

const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

// --- localizable task / guidance text -----------------------------------
// Each emits a stable i18n key + a default English string so the UI can
// localize via t(key, default). Text stays short, simple, no scary words.

export interface PostHarvestStep {
  i18nKey: string;
  default: string;
}

export interface DryingCuring {
  required: true;
  i18nKey: string;
  default: string;
  approxTimeframe: string; // approximate range, user-correctable
  approximate: true;
}

export interface SellingReadiness {
  i18nKey: string;
  default: string;
  approximate: true;
}

export interface BuyerListingPrompt {
  i18nKey: string;
  default: string;
}

export interface PostHarvestGuidanceEnvelope {
  runtimeVersion: 'post-harvest-v1';
  cropKey: string;
  matched: boolean;
  harvestChecklist: string[];
  sortingGrading: PostHarvestStep;
  dryingCuring: DryingCuring | null;
  storageGuidance: PostHarvestStep;
  spoilageRisk: SpoilageRisk;
  sellingReadiness: SellingReadiness;
  buyerListingPrompt: BuyerListingPrompt | null;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

export interface PostHarvestHealthEnvelope {
  runtimeVersion: 'post-harvest-v1';
  initialized: true;
  harvestChecklistReady: boolean;
  storageGuidanceReady: boolean;
  noFakeMarketPrice: true;
  noUnsafeChemical: true;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

// --- small built-in catalog ----------------------------------------------
// Standard general crop-calendar knowledge only. Timeframes are APPROXIMATE
// ranges. No yields, no prices, no chemical dosages.

interface CatalogEntry {
  aliases: string[];
  spoilageRisk: SpoilageRisk;
  confidence: Confidence;
  harvestChecklist: string[];
  sortingGrading: PostHarvestStep;
  dryingCuring: DryingCuring | null;
  storageGuidance: PostHarvestStep;
  sellingReadiness: SellingReadiness;
  note: string;
}

const _CATALOG: CatalogEntry[] = [
  {
    aliases: ['cassava', 'manioc', 'yuca', 'tapioca'],
    spoilageRisk: 'high',
    confidence: 'medium',
    harvestChecklist: [
      'postHarvest.cassava.check.handleGently|Lift roots carefully so they do not bruise.',
      'postHarvest.cassava.check.processFast|Plan to process or use the roots quickly.',
      'postHarvest.cassava.check.removeDamaged|Set aside any cut or broken roots first.',
    ],
    sortingGrading: {
      i18nKey: 'postHarvest.cassava.sorting',
      default: 'Sort by size. Keep whole, firm roots apart from broken ones.',
    },
    dryingCuring: {
      required: true,
      i18nKey: 'postHarvest.cassava.drying',
      default: 'If making chips or flour, dry the pieces well before storing.',
      approxTimeframe: 'about 1-3 days (approximate, depends on weather)',
      approximate: true,
    },
    storageGuidance: {
      i18nKey: 'postHarvest.cassava.storage',
      default: 'Fresh roots spoil fast. Keep cool and shaded, or process soon.',
    },
    sellingReadiness: {
      i18nKey: 'postHarvest.cassava.selling',
      default: 'Sell or process fresh roots quickly while they are still firm.',
      approximate: true,
    },
    note: 'Cassava roots spoil within a few days; processing quickly reduces loss.',
  },
  {
    aliases: ['tomato', 'tomatoes'],
    spoilageRisk: 'high',
    confidence: 'medium',
    harvestChecklist: [
      'postHarvest.tomato.check.pickFirm|Pick firm, evenly coloured fruit.',
      'postHarvest.tomato.check.handleGently|Place fruit in the basket gently, do not drop.',
      'postHarvest.tomato.check.shade|Keep picked fruit out of direct sun.',
    ],
    sortingGrading: {
      i18nKey: 'postHarvest.tomato.sorting',
      default: 'Sort by size and colour. Set soft or split fruit aside to use first.',
    },
    dryingCuring: null,
    storageGuidance: {
      i18nKey: 'postHarvest.tomato.storage',
      default: 'Keep in a cool, airy, shaded place. Do not stack too deep.',
    },
    sellingReadiness: {
      i18nKey: 'postHarvest.tomato.selling',
      default: 'Best sold soon after picking while firm and fresh.',
      approximate: true,
    },
    note: 'Tomatoes bruise easily and do not keep long; cool storage slows spoilage.',
  },
  {
    aliases: [
      'maize', 'corn', 'grain', 'grains', 'wheat', 'rice', 'paddy',
      'sorghum', 'millet', 'barley', 'cereal',
    ],
    spoilageRisk: 'low',
    confidence: 'medium',
    harvestChecklist: [
      'postHarvest.grain.check.dryEnough|Harvest when the grain feels dry and hard.',
      'postHarvest.grain.check.thresh|Thresh and clean out chaff and stones.',
      'postHarvest.grain.check.spreadToDry|Spread grain to dry before storing.',
    ],
    sortingGrading: {
      i18nKey: 'postHarvest.grain.sorting',
      default: 'Clean the grain. Remove broken kernels, husks, and dirt.',
    },
    dryingCuring: {
      required: true,
      i18nKey: 'postHarvest.grain.drying',
      default: 'Dry the grain well before storing so it does not spoil or mould.',
      approxTimeframe: 'about 2-7 days of good drying (approximate, depends on weather)',
      approximate: true,
    },
    storageGuidance: {
      i18nKey: 'postHarvest.grain.storage',
      default: 'Store dry grain in clean, dry, sealed containers in a cool place.',
    },
    sellingReadiness: {
      i18nKey: 'postHarvest.grain.selling',
      default: 'Once fully dry and clean, grain keeps well and can be sold over time.',
      approximate: true,
    },
    note: 'Well-dried grain stores for a long time; moisture is the main spoilage risk.',
  },
];

function _normalizeKey(cropKey: string): string {
  return _safe(
    () => String(cropKey == null ? '' : cropKey).trim().toLowerCase(),
    '',
  );
}

function _lookup(cropKey: string): CatalogEntry | null {
  const key = _normalizeKey(cropKey);
  if (!key) return null;
  for (const entry of _CATALOG) {
    if (entry.aliases.indexOf(key) !== -1) return entry;
  }
  // soft contains match (e.g. "fresh tomato", "white maize")
  for (const entry of _CATALOG) {
    for (const a of entry.aliases) {
      if (key.indexOf(a) !== -1) return entry;
    }
  }
  return null;
}

// --- generic safe fallback steps -----------------------------------------

const _GENERIC_CHECKLIST: string[] = [
  'postHarvest.generic.check.handleGently|Handle the harvest gently so it does not bruise.',
  'postHarvest.generic.check.removeDamaged|Set aside damaged or rotten pieces.',
  'postHarvest.generic.check.keepCoolShade|Keep the harvest cool and out of the sun.',
  'postHarvest.generic.check.cleanContainers|Use clean, dry baskets or containers.',
];

const _GENERIC_SORTING: PostHarvestStep = {
  i18nKey: 'postHarvest.generic.sorting',
  default: 'Sort by size and quality. Use the best pieces first.',
};

const _GENERIC_STORAGE: PostHarvestStep = {
  i18nKey: 'postHarvest.generic.storage',
  default: 'Store in a clean, dry, cool, shaded place. Follow the recommended care steps.',
};

const _GENERIC_SELLING: SellingReadiness = {
  i18nKey: 'postHarvest.generic.selling',
  default: 'Sell while fresh and in good condition for the best result.',
  approximate: true,
};

const _BUYER_PROMPT: BuyerListingPrompt = {
  i18nKey: 'postHarvest.generic.buyerListing',
  default: 'Want to list this harvest for buyers? Add how much you have ready.',
};

function _freezeStep(s: PostHarvestStep): PostHarvestStep {
  return Object.freeze({ i18nKey: s.i18nKey, default: s.default });
}

function _freezeDrying(d: DryingCuring | null): DryingCuring | null {
  if (!d) return null;
  return Object.freeze({
    required: true as const,
    i18nKey: d.i18nKey,
    default: d.default,
    approxTimeframe: d.approxTimeframe,
    approximate: true as const,
  });
}

function _freezeSelling(s: SellingReadiness): SellingReadiness {
  return Object.freeze({
    i18nKey: s.i18nKey,
    default: s.default,
    approximate: true as const,
  });
}

function _frozenGuidanceFallback(cropKey: string): PostHarvestGuidanceEnvelope {
  return Object.freeze({
    runtimeVersion: POST_HARVEST_ENGINE_VERSION,
    cropKey: _normalizeKey(cropKey),
    matched: false,
    harvestChecklist: Object.freeze(_GENERIC_CHECKLIST.slice()) as unknown as string[],
    sortingGrading: _freezeStep(_GENERIC_SORTING),
    dryingCuring: null,
    storageGuidance: _freezeStep(_GENERIC_STORAGE),
    spoilageRisk: 'unknown' as SpoilageRisk,
    sellingReadiness: _freezeSelling(_GENERIC_SELLING),
    buyerListingPrompt: null,
    confidence: 'low' as Confidence,
    explanation:
      'General post-harvest steps shown. We do not have crop-specific notes for this crop yet, so these are safe, common-sense steps you can adjust.',
    limitations:
      'Timeframes are approximate general ranges, not exact, and you can correct them. ' +
      'No yield, price, or chemical amounts are given here. ' +
      GUIDANCE_TAIL,
  }) as PostHarvestGuidanceEnvelope;
}

/**
 * postHarvestGuidance — honest, approximate post-harvest guidance for a crop.
 * Never throws; returns a frozen envelope. Crop-specific where a built-in
 * catalog entry exists, otherwise a general safe fallback. No fake market
 * price, no chemical/storage dosages.
 */
export function postHarvestGuidance(
  cropKey: string,
  opts?: { sellEnabled?: boolean },
): PostHarvestGuidanceEnvelope {
  return _safe(
    () => {
      const sellEnabled = !!(opts && opts.sellEnabled === true);
      const entry = _lookup(cropKey);

      if (!entry) {
        const fb = _frozenGuidanceFallback(cropKey);
        if (!sellEnabled) return fb;
        // attach buyer prompt onto fallback
        return Object.freeze({
          ...fb,
          buyerListingPrompt: Object.freeze({
            i18nKey: _BUYER_PROMPT.i18nKey,
            default: _BUYER_PROMPT.default,
          }) as BuyerListingPrompt,
        }) as PostHarvestGuidanceEnvelope;
      }

      const checklist = Object.freeze(entry.harvestChecklist.slice()) as unknown as string[];

      const buyerListingPrompt = sellEnabled
        ? (Object.freeze({
            i18nKey: _BUYER_PROMPT.i18nKey,
            default: _BUYER_PROMPT.default,
          }) as BuyerListingPrompt)
        : null;

      return Object.freeze({
        runtimeVersion: POST_HARVEST_ENGINE_VERSION,
        cropKey: _normalizeKey(cropKey),
        matched: true,
        harvestChecklist: checklist,
        sortingGrading: _freezeStep(entry.sortingGrading),
        dryingCuring: _freezeDrying(entry.dryingCuring),
        storageGuidance: _freezeStep(entry.storageGuidance),
        spoilageRisk: entry.spoilageRisk,
        sellingReadiness: _freezeSelling(entry.sellingReadiness),
        buyerListingPrompt,
        confidence: entry.confidence,
        explanation:
          entry.note +
          ' These are standard general steps, not exact guarantees — adjust them to your crop and conditions.',
        limitations:
          'Timeframes are approximate general ranges, not exact, and you can correct them. ' +
          'No yield, price, or chemical amounts are given here. ' +
          GUIDANCE_TAIL,
      }) as PostHarvestGuidanceEnvelope;
    },
    _frozenGuidanceFallback(cropKey),
  );
}

/**
 * postHarvestHealth — runtime self-check envelope. Never throws; frozen.
 */
export function postHarvestHealth(): PostHarvestHealthEnvelope {
  return _safe(
    () => {
      // Confirm the engine can actually produce its core outputs.
      const probe = postHarvestGuidance('generic-self-check', { sellEnabled: false });
      const harvestChecklistReady = _arr(probe.harvestChecklist).length > 0;
      const storageGuidanceReady =
        !!_obj(probe.storageGuidance) && typeof probe.storageGuidance.default === 'string';

      return Object.freeze({
        runtimeVersion: POST_HARVEST_ENGINE_VERSION,
        initialized: true as const,
        harvestChecklistReady,
        storageGuidanceReady,
        noFakeMarketPrice: true as const,
        noUnsafeChemical: true as const,
        confidence: 'medium' as Confidence,
        explanation:
          'Post-harvest engine is loaded and can produce harvest, sorting, and storage guidance. Crop-specific notes exist for a few common crops; others get general safe steps.',
        limitations:
          'Guidance is general and approximate, not exact, and contains no yield, price, or chemical amounts. ' +
          GUIDANCE_TAIL,
      }) as PostHarvestHealthEnvelope;
    },
    Object.freeze({
      runtimeVersion: POST_HARVEST_ENGINE_VERSION,
      initialized: true as const,
      harvestChecklistReady: false,
      storageGuidanceReady: false,
      noFakeMarketPrice: true as const,
      noUnsafeChemical: true as const,
      confidence: 'low' as Confidence,
      explanation: 'Post-harvest engine fell back to its safe default.',
      limitations:
        'Guidance is general and approximate, not exact, and contains no yield, price, or chemical amounts. ' +
        GUIDANCE_TAIL,
    }) as PostHarvestHealthEnvelope,
  );
}

export function installPostHarvestHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__postHarvestHealth !== 'function') {
      w.__postHarvestHealth = function () {
        const out = postHarvestHealth();
        try {
          const dev =
            typeof import.meta !== 'undefined' &&
            (import.meta as any).env &&
            (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true)
            console.log('[Farroway · Post-Harvest]', out);
        } catch {}
        return out;
      };
    }
    return true;
  }, false);
}
