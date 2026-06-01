/**
 * src/runtime/scan/scanDetectionContracts.ts — canonical Scan detection
 * contract (types + category vocabularies + confidence policy + artifact
 * idempotency keys). Pure data + pure helpers; no imports, never throws.
 *
 * The canonical detection envelope is honest + explainable:
 *   • every detection carries a confidence + limitations;
 *   • unknown is a first-class value (never invented);
 *   • below-threshold detections set needsReview = true;
 *   • rawProviderRef may point at stored raw data internally but is NEVER
 *     surfaced to the grower UI;
 *   • the words "guaranteed" / "confirmed" / "100%" are forbidden in
 *     grower-facing output (gate-enforced).
 */

export const SCAN_DETECTION_CONTRACT_VERSION = 'scan-detection-contract-v1';

/* ── §1 confidence policy ────────────────────────────────────── */
export const CONFIDENCE_THRESHOLDS = Object.freeze({
  HIGH: 0.75,   // >= 0.75  → high confidence
  REVIEW: 0.45, // 0.45–0.74 → needsReview; < 0.45 → unknown + needsReview
});

export type ConfidenceTier = 'high' | 'needs_review' | 'unknown';

/** Map a 0–1 score to an honest tier + needsReview flag. */
export function confidenceTier(score: unknown): { tier: ConfidenceTier; needsReview: boolean; score: number | null } {
  const n = (typeof score === 'number' && isFinite(score)) ? score : null;
  if (n === null) return { tier: 'unknown', needsReview: true, score: null };
  const s = n > 1 ? n / 100 : n; // tolerate 0–100 inputs
  if (s >= CONFIDENCE_THRESHOLDS.HIGH) return { tier: 'high', needsReview: false, score: s };
  if (s >= CONFIDENCE_THRESHOLDS.REVIEW) return { tier: 'needs_review', needsReview: true, score: s };
  return { tier: 'unknown', needsReview: true, score: s };
}

/** Grower-facing confidence label — safe wording only. */
export function confidenceLabel(tier: ConfidenceTier): string {
  if (tier === 'high') return 'Likely';
  if (tier === 'needs_review') return 'Possible — needs review';
  return 'Not enough information yet';
}

/* ── §3 detection category vocabularies ──────────────────────── */
export const PLANT_TYPES = Object.freeze([
  'crop', 'flower', 'vegetable', 'fruit', 'herb', 'tree', 'weed', 'unknown',
] as const);

export const HEALTH_STATUSES = Object.freeze([
  'healthy', 'watch', 'needs_attention', 'critical', 'unknown',
] as const);

export const SEVERITIES = Object.freeze([
  'low', 'medium', 'high', 'critical', 'unknown',
] as const);

export const GROWTH_STAGES = Object.freeze([
  'seedling', 'vegetative', 'flowering', 'fruiting', 'maturity',
  'harvest_ready', 'unknown',
] as const);

export const HARVEST_STATUSES = Object.freeze([
  'not_ready', 'almost_ready', 'ready', 'overripe', 'unknown',
] as const);

export const DISEASE_KEYS = Object.freeze([
  'leaf_spot', 'early_blight', 'late_blight', 'rust', 'powdery_mildew',
  'downy_mildew', 'cassava_mosaic_disease', 'cassava_brown_streak_disease',
  'maize_lethal_necrosis', 'bacterial_wilt', 'root_rot', 'anthracnose',
  'black_sigatoka', 'mosaic_virus',
] as const);

export const PEST_KEYS = Object.freeze([
  'aphids', 'fall_armyworm', 'whiteflies', 'thrips', 'spider_mites',
  'stem_borers', 'fruit_flies', 'mealybugs', 'weevils', 'tuta_absoluta',
  'cutworms', 'termites', 'locusts',
] as const);

export const NUTRIENT_KEYS = Object.freeze([
  'nitrogen_deficiency', 'phosphorus_deficiency', 'potassium_deficiency',
  'calcium_deficiency', 'magnesium_deficiency', 'iron_deficiency',
  'zinc_deficiency', 'sulfur_deficiency', 'boron_deficiency',
] as const);

/* ── §5 grower-facing wording policy ─────────────────────────── */
export const SAFE_WORDS = Object.freeze(['Likely', 'Possible', 'Needs review', 'Not enough information yet']);
export const BANNED_WORDS = Object.freeze(['guaranteed', 'confirmed', '100%']);
export const DETECTION_DISCLAIMER = 'Decision support, not a guarantee.';

/* ── §9 artifact idempotency key builders ────────────────────── */
const _slug = (v: unknown): string =>
  String(v == null ? '' : v).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export const scanArtifactKeys = Object.freeze({
  start:    (imageHash: unknown) => `scan:start:${_slug(imageHash)}`,
  complete: (scanId: unknown)    => `scan:complete:${_slug(scanId)}`,
  failed:   (scanId: unknown)    => `scan:failed:${_slug(scanId)}`,
  taskFromScan: (scanId: unknown, taskType: unknown) =>
    `task:from-scan:${_slug(scanId)}:${_slug(taskType)}`,
});

/** The canonical artifact events emitted by the scan pipeline (§9). */
export const SCAN_ARTIFACT_EVENTS = Object.freeze([
  'ScanStarted', 'ScanCompleted', 'ScanFailed', 'DiagnosisCreated',
  'RecommendationCreated', 'TaskCreatedFromScan', 'PlantCreatedFromScan',
  'FollowUpScanRequested', 'OutcomeFollowUpRequested',
]);

/** Type guard helpers (never throw). */
export const isPlantType   = (v: unknown): boolean => (PLANT_TYPES as readonly string[]).includes(String(v));
export const isHealthStatus = (v: unknown): boolean => (HEALTH_STATUSES as readonly string[]).includes(String(v));
export const isGrowthStage  = (v: unknown): boolean => (GROWTH_STAGES as readonly string[]).includes(String(v));
export const isHarvestStatus = (v: unknown): boolean => (HARVEST_STATUSES as readonly string[]).includes(String(v));
