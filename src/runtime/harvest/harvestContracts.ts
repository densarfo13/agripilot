/**
 * src/runtime/harvest/harvestContracts.ts — Frozen types,
 * status enums, supported plant lists, and storage keys for
 * the Harvest Readiness runtime suite.
 *
 * Strict-rule audit
 *   • Pure data declarations only.
 *   • Frozen everything that's exposed.
 *   • No PII handled here.
 *   • Never throws (pure declarations).
 */

export const HARVEST_RUNTIME_VERSION = 'harvest-readiness-v1';

/** Five canonical ripeness statuses — frozen. */
export const RIPENESS_STATUS = Object.freeze({
  NOT_READY:     'not_ready',
  ALMOST_READY:  'almost_ready',
  READY:         'ready',
  OVERRIPE:      'overripe',
  UNKNOWN:       'unknown',
} as const);

export type RipenessStatusValue =
  typeof RIPENESS_STATUS[keyof typeof RIPENESS_STATUS];

/** Bloom-stage analogue for flowers. */
export const BLOOM_STAGE = Object.freeze({
  BUDDING:     'budding',
  BLOOMING:    'blooming',
  PEAK_BLOOM:  'peak_bloom',
  PAST_BLOOM:  'past_bloom',
  UNKNOWN:     'unknown',
} as const);

export type BloomStageValue =
  typeof BLOOM_STAGE[keyof typeof BLOOM_STAGE];

/** Plant category — what the harvest engine treats. */
export const HARVEST_CATEGORY = Object.freeze({
  FRUIT:     'fruit',
  VEGETABLE: 'vegetable',
  CROP:      'crop',
  FLOWER:    'flower',
  UNKNOWN:   'unknown',
} as const);

export type HarvestCategoryValue =
  typeof HARVEST_CATEGORY[keyof typeof HARVEST_CATEGORY];

/**
 * First-launch supported plants. The runtime returns
 * `unknown` + `needsReview: true` for anything outside this list,
 * which the UI uses to suppress the harvest card. NEVER show the
 * card for unsupported plants — that's the cardinal rule.
 */
export const SUPPORTED_FRUITS = Object.freeze([
  'mango', 'banana', 'avocado', 'orange', 'lemon', 'lime',
  'pineapple', 'apple', 'strawberry', 'watermelon',
] as const);

export const SUPPORTED_VEGETABLES = Object.freeze([
  'tomato', 'pepper', 'cucumber', 'eggplant',
] as const);

export const SUPPORTED_CROPS = Object.freeze([
  'maize', 'rice', 'cassava', 'yam', 'soybean', 'groundnut',
] as const);

export const SUPPORTED_FLOWERS = Object.freeze([
  'rose', 'hibiscus', 'sunflower', 'marigold',
  // Wave-28 risk-fix #5 — broader gardener catalog. All four share
  // the same generic bloom-stage rule (bud → blooming → peak →
  // past) so they map cleanly into ruleFlower without per-plant
  // overrides.
  'orchid', 'lily', 'dahlia', 'daisy',
] as const);

/** Full set the runtime treats — single source of truth. */
export const SUPPORTED_PLANTS = Object.freeze([
  ...SUPPORTED_FRUITS,
  ...SUPPORTED_VEGETABLES,
  ...SUPPORTED_CROPS,
  ...SUPPORTED_FLOWERS,
] as const);

/** Plant id → harvest category lookup. */
export const PLANT_CATEGORY: Readonly<Record<string, HarvestCategoryValue>> =
  Object.freeze({
    // Fruits
    mango: 'fruit', banana: 'fruit', avocado: 'fruit',
    orange: 'fruit', lemon: 'fruit', lime: 'fruit',
    pineapple: 'fruit', apple: 'fruit', strawberry: 'fruit',
    watermelon: 'fruit',
    // Vegetables (treated as fruiting vegetables — same ripeness model)
    tomato: 'vegetable', pepper: 'vegetable',
    cucumber: 'vegetable', eggplant: 'vegetable',
    // Crops
    maize: 'crop', rice: 'crop', cassava: 'crop',
    yam: 'crop', soybean: 'crop', groundnut: 'crop',
    // Flowers
    rose: 'flower', hibiscus: 'flower',
    sunflower: 'flower', marigold: 'flower',
    // Wave-28 risk-fix #5 — broader gardener catalog
    orchid: 'flower', lily: 'flower',
    dahlia: 'flower', daisy: 'flower',
  });

/** Storage key — owned by HarvestReadinessRuntime persistence. */
export const HARVEST_STORAGE_KEY = 'farroway.harvest.history';
export const HARVEST_HISTORY_CAP = 200;

/** Idempotency-key builders — surface for offline-safe replay. */
export const idemEvaluate = (scanId: string): string =>
  `harvest:evaluate:${scanId}`;
export const idemTask = (scanId: string, status: string): string =>
  `harvest:task:${scanId}:${status}`;
export const idemArtifact = (scanId: string): string =>
  `artifact:harvest:${scanId}`;

/** Public visual-signals envelope. */
export interface HarvestVisualSignals {
  color?:        string;
  size?:         string;
  texture?:      string;
  defects?:      ReadonlyArray<string>;
  diseaseSigns?: ReadonlyArray<string>;
  pestSigns?:    ReadonlyArray<string>;
}

/** Recommended-task envelope (passed to TaskRuntime — never written by the harvest engine). */
export interface HarvestRecommendedTask {
  id:         string;
  title:      string;
  reason:     string;
  urgency:    'low' | 'medium' | 'high';
  actionType: 'harvest' | 'inspect' | 'monitor' | 'follow_up_scan';
}

/** Result envelope per spec §2. */
export interface HarvestReadinessResult {
  plantId?:                  string;
  scanId:                    string;
  plantName:                 string;
  category:                  HarvestCategoryValue;
  ripenessStatus:            RipenessStatusValue;
  bloomStage?:               BloomStageValue;
  harvestReadinessScore:     number; // 0-100
  estimatedHarvestWindow?:   string;
  confidence:                number; // 0-100
  visualSignals:             HarvestVisualSignals;
  recommendationTitle:       string;
  recommendationBody:        string;
  recommendedTasks:          ReadonlyArray<HarvestRecommendedTask>;
  needsReview:               boolean;
  idempotencyKey:            string;
  timestamp:                 string;
}

/** Plant-context input shape — composed by ScanPage caller. */
export interface PlantContext {
  plantId?:       string;
  plantName?:     string;
  lifecycleStage?: string;
  region?:        string;
  season?:        string;
  recentScanCategory?: string;
}

/** Diagnostic envelope. */
export interface HarvestReadinessHealth {
  runtimeVersion:           string;
  initialized:              boolean;
  ripenessEngineReady:      boolean;
  harvestStageEngineReady:  boolean;
  scanIntegrated:           boolean;
  taskIntegrated:           boolean;
  timelineIntegrated:       boolean;
  artifactIntegrated:       boolean;
  offlineSafe:              boolean;
  supportedPlants:          number;
  harvestReadinessReady:    boolean;
  ripenessDetectionReady:   boolean;
}

/**
 * Banned wording — the runtime's recommendation strings MUST NOT
 * contain any of these substrings (case-insensitive). The CI gate
 * check-harvest-readiness-ownership.mjs enforces this statically.
 */
export const BANNED_WORDING = Object.freeze([
  'guaranteed ripe',
  'confirmed harvest date',
  'definitely safe to eat',
  'guaranteed',
  'definitely',
] as const);

/** Safe verbs to prefer in recommendation copy. */
export const SAFE_VERBS = Object.freeze([
  'likely ready',
  'appears almost ready',
  'expected harvest window',
  'monitor again',
  'check again',
  'appears',
] as const);
