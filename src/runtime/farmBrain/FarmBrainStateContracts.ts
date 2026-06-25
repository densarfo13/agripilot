/**
 * FarmBrainStateContracts.ts — FARM_BRAIN_STATE_V1.
 *
 * The single canonical state every screen reads (RULE 2) and every event
 * updates (RULE 1). It COMPOSES the engines that already exist
 * (FarmBrainRuntimeV2, FarmHealth, CropStage, IntelligenceFabric, daily
 * intelligence) — it does not invent new ML.
 *
 * Honesty contract (RULE 3 + RULE 14 + the standing no-fabrication rule):
 *   • Every metric carries a `status` + `confidence`, never a bare number.
 *   • We NEVER show the data-shortfall message. Instead, an honest waiting
 *     state: 'waiting_for_first_scan', 'estimated', 'low_confidence',
 *     'unknown_until_scan'.
 *   • Fields with no live data source (yield $, market price, funding
 *     deadlines, buyer data) return 'no_live_feed' — an honest estimate or
 *     "connect a feed", NEVER a fabricated specific number.
 *   • Farmer-facing wording is "Recommended / Detected / Likely / Estimated"
 *     — never "AI / model / neural network".
 */
export const FARM_BRAIN_STATE_VERSION = 'farm-brain-state-v1';

/** RULE 1 — the events that update FarmBrain. */
export type FarmEventType =
  | 'scan' | 'weather_update' | 'task_completed' | 'new_planting'
  | 'fertilizer' | 'irrigation' | 'harvest' | 'pest_detection'
  | 'disease_detection' | 'market_update';

export const FARM_EVENT_TYPES: ReadonlyArray<FarmEventType> = Object.freeze([
  'scan', 'weather_update', 'task_completed', 'new_planting', 'fertilizer',
  'irrigation', 'harvest', 'pest_detection', 'disease_detection', 'market_update',
]);

export interface FarmEvent {
  type: FarmEventType;
  at: number;            // ms epoch (caller-stamped)
  payload?: any;         // scan result, weather, task, etc.
}

/** Honest status for any metric — always an actionable waiting state. */
export type MetricStatus =
  | 'ok'                    // computed from real signals
  | 'estimated'            // derived from crop/region defaults, low certainty
  | 'low_confidence'       // computed but uncertain
  | 'waiting_for_first_scan'
  | 'unknown_until_scan'
  | 'no_live_feed';        // honest: no data source connected (never faked)

export interface Metric<T = number | null> {
  value: T;                // null when unknown — NEVER a fabricated default
  status: MetricStatus;
  confidence: number;      // 0..100
  label: string;           // farmer-facing, invisible-intelligence wording
  nextAction: string | null; // RULE 3 — always a next action
}

/** RULE 6 — every recommendation carries the full rationale. */
export interface Recommendation {
  id: string;
  action: string;          // "Spray onion today"
  reason: string;          // "Early signs of thrips."
  confidence: number;      // 0..100
  urgency: 'low' | 'medium' | 'high';
  timeRequiredMin: number | null;
  expectedBenefit: string; // "Prevents yield loss."
  // FarmBrain X §4 — fuller rationale. Optional + honest: cost/risk are
  // qualitative bands (no fabricated currency), nextReviewDate is null until
  // a real cadence is known.
  cost?: 'none' | 'low' | 'medium' | 'high' | null;
  risk?: 'low' | 'medium' | 'high' | null;
  nextReviewDate?: string | null;   // ISO date, or null when not scheduled
}

export type HealthBand = 'excellent' | 'good' | 'watch' | 'needs_attention' | 'critical' | 'unknown';

/** RULE 1 — everything an event recalculates. The single source of truth. */
export interface FarmBrainState {
  version: string;
  updatedAt: number | null;
  lastEvent: FarmEventType | null;
  hasFirstScan: boolean;

  farmHealth: Metric & { band: HealthBand; trend: 'up' | 'down' | 'flat' | 'unknown' };
  diseaseRisk: Metric;
  pestRisk: Metric;
  waterStress: Metric;
  nutritionStatus: Metric;
  growthStage: Metric<string | null>;
  harvestPrediction: Metric<string | null>; // estimated date
  yieldPrediction: Metric;                   // estimated, no live feed → honest
  marketReadiness: Metric;
  fundingEligibility: Metric;
  buyerReadiness: Metric;
  confidence: number;                        // FarmBrain overall confidence 0..100

  todaysTasks: ReadonlyArray<Recommendation>;
  tomorrowsTasks: ReadonlyArray<Recommendation>;
  recommendations: ReadonlyArray<Recommendation>;
  timeline: ReadonlyArray<Readonly<{ at: number; kind: string; label: string }>>;
}

/** Build an honest metric — the only way metrics are created. */
export function metric(
  value: number | string | null,
  status: MetricStatus,
  confidence: number,
  label: string,
  nextAction: string | null = null,
): Metric<any> {
  return Object.freeze({
    value: value as any,
    status,
    confidence: Math.max(0, Math.min(100, Math.round(confidence || 0))),
    label,
    nextAction,
  });
}

export function recommendation(r: Partial<Recommendation>): Recommendation {
  const band = (v: any, set: string[]): any => (set.includes(v) ? v : null);
  return Object.freeze({
    id: String(r.id || ''),
    action: String(r.action || ''),
    reason: String(r.reason || ''),
    confidence: Math.max(0, Math.min(100, Math.round(r.confidence || 0))),
    urgency: (r.urgency === 'high' || r.urgency === 'low') ? r.urgency : 'medium',
    timeRequiredMin: typeof r.timeRequiredMin === 'number' ? r.timeRequiredMin : null,
    expectedBenefit: String(r.expectedBenefit || ''),
    // §4 — honest bands only; null when unknown (never a fabricated figure).
    cost: band(r.cost, ['none', 'low', 'medium', 'high']),
    risk: band(r.risk, ['low', 'medium', 'high']),
    nextReviewDate: typeof r.nextReviewDate === 'string' ? r.nextReviewDate : null,
  });
}

/** The empty state — honest waiting state, never a data-shortfall message. */
export function emptyFarmBrainState(): FarmBrainState {
  const waiting = (label: string): Metric => metric(null, 'waiting_for_first_scan', 0, label, 'Scan a plant to begin.');
  return Object.freeze({
    version: FARM_BRAIN_STATE_VERSION,
    updatedAt: null,
    lastEvent: null,
    hasFirstScan: false,
    farmHealth: Object.freeze({ ...waiting('Waiting for first scan'), band: 'unknown' as HealthBand, trend: 'unknown' as const }),
    diseaseRisk: waiting('Unknown until scan'),
    pestRisk: waiting('Unknown until scan'),
    waterStress: waiting('Estimated after first check'),
    nutritionStatus: waiting('Unknown until scan'),
    growthStage: metric(null, 'estimated', 0, 'Estimated stage', 'Add your crop and planting date.'),
    harvestPrediction: metric(null, 'estimated', 0, 'Estimated harvest', 'Add planting date for an estimate.'),
    yieldPrediction: metric(null, 'estimated', 0, 'Estimated yield', 'Scan and log progress to refine.'),
    marketReadiness: metric(null, 'no_live_feed', 0, 'Connect market prices', null),
    fundingEligibility: metric(null, 'no_live_feed', 0, 'No live funding feed', null),
    buyerReadiness: metric(null, 'no_live_feed', 0, 'No buyer feed connected', null),
    confidence: 0,
    todaysTasks: Object.freeze([]),
    tomorrowsTasks: Object.freeze([]),
    recommendations: Object.freeze([]),
    timeline: Object.freeze([]),
  });
}
