/**
 * FarmBrainStateEngine.ts — FARM_BRAIN_STATE_V1.
 *
 * The pure reducer: (prevState, event, signals) → next FarmBrainState.
 * It COMPOSES signals that already exist (the scan's attached FarmBrainV2
 * envelope, farm health score, crop stage, daily intelligence) into the one
 * canonical state. It invents nothing:
 *   • Real signal present  → status 'ok' / 'low_confidence' with its value.
 *   • Crop/region default   → status 'estimated' (honest, low confidence).
 *   • No signal yet         → 'waiting_for_first_scan' / 'unknown_until_scan'.
 *   • No live data source    → 'no_live_feed' (yield $, market, funding, buyers).
 *
 * Never throws (a bad signal must not break the farm's home screen). Never
 * uses Date.now() — callers stamp `event.at`, which we treat as "now".
 */
import {
  FarmBrainState, FarmEvent, FarmEventType, HealthBand, Metric, Recommendation,
  emptyFarmBrainState, metric, recommendation, FARM_BRAIN_STATE_VERSION,
} from './FarmBrainStateContracts';

/** Signals the store gathers and hands to the reducer. All optional. */
export interface FarmBrainSignals {
  /** The FarmBrainV2 envelope already attached to a scan result. */
  farmBrain?: {
    riskScore?: number | null;
    confidenceScore?: number | null;
    diseaseLikelihood?: number | null;
    pestLikelihood?: number | null;
    growthStage?: string | null;
    nextAction?: string | null;
    followUpTask?: { title?: string; reason?: string; timeRequiredMin?: number } | null;
  } | null;
  /** Farm health score 0..100 from FarmHealthScoreEngine, when available. */
  farmHealthScore?: number | null;
  /** Nutrition / water proxies, when a scan or sensor produced them. */
  nutritionScore?: number | null;
  waterStressScore?: number | null;
  /** Crop + planting context for honest stage/harvest estimates. */
  cropName?: string | null;
  daysToHarvestEstimate?: number | null; // from crop defaults, honest estimate
  /** Today's / tomorrow's tasks already computed by the daily engine. */
  todaysTasks?: Array<Partial<Recommendation>>;
  tomorrowsTasks?: Array<Partial<Recommendation>>;
  /** A timeline entry to append for this event, if any. */
  timelineEntry?: { kind: string; label: string } | null;
}

function num(v: any): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
function clamp100(n: number | null): number | null {
  if (n == null) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Risk → health band. Honest 'unknown' when we truly have no signal. */
export function bandFromScore(score: number | null): HealthBand {
  if (score == null) return 'unknown';
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'watch';
  if (score >= 30) return 'needs_attention';
  return 'critical';
}

function riskMetric(likelihood: number | null, kind: string): Metric {
  if (likelihood == null) {
    return metric(null, 'unknown_until_scan', 0, 'Unknown until scan',
      'Scan a leaf to check ' + kind + '.');
  }
  const v = clamp100(likelihood)!;
  const status = v >= 60 ? 'ok' : 'low_confidence';
  const next = v >= 60 ? 'Review the recommended treatment.' : 'Keep monitoring.';
  return metric(v, status, v >= 60 ? 80 : 55, 'Detected ' + kind + ' risk', next);
}

function recsFrom(list: Array<Partial<Recommendation>> | undefined): ReadonlyArray<Recommendation> {
  if (!Array.isArray(list)) return Object.freeze([]);
  return Object.freeze(list.slice(0, 12).map((r, i) =>
    recommendation({ id: r.id || ('rec-' + i), ...r })));
}

/**
 * The reducer. Pure, total, never throws. Produces a frozen next state.
 */
export function reduceFarmBrainState(
  prev: FarmBrainState | null | undefined,
  event: FarmEvent,
  signals: FarmBrainSignals = {},
): FarmBrainState {
  try {
    const base = prev && prev.version === FARM_BRAIN_STATE_VERSION ? prev : emptyFarmBrainState();
    const at = num(event && event.at) || base.updatedAt || 0;
    const type: FarmEventType = (event && event.type) || 'scan';
    const fb = signals.farmBrain || null;
    const hasFirstScan = base.hasFirstScan || type === 'scan';

    // ── Farm health (RULE 7): prefer explicit score, else derive from risk. ──
    let healthScore = clamp100(num(signals.farmHealthScore));
    if (healthScore == null && fb && num(fb.riskScore) != null) {
      healthScore = clamp100(100 - num(fb.riskScore)!); // risk → health
    }
    const band = bandFromScore(healthScore);
    const trend: 'up' | 'down' | 'flat' | 'unknown' =
      healthScore == null || base.farmHealth.value == null ? 'unknown'
        : healthScore > (base.farmHealth.value as number) ? 'up'
          : healthScore < (base.farmHealth.value as number) ? 'down' : 'flat';
    const farmHealth = Object.freeze({
      ...(healthScore == null
        ? metric(null, hasFirstScan ? 'low_confidence' : 'waiting_for_first_scan', 0,
          hasFirstScan ? 'Building your score' : 'Waiting for first scan',
          hasFirstScan ? 'Log today’s tasks to refine.' : 'Scan a plant to begin.')
        : metric(healthScore, 'ok', clamp100(num(fb && fb.confidenceScore)) ?? 70,
          'Farm health', null)),
      band, trend,
    });

    // ── Risks (RULE 1). ──
    const diseaseRisk = riskMetric(clamp100(num(fb && fb.diseaseLikelihood)), 'disease');
    const pestRisk = riskMetric(clamp100(num(fb && fb.pestLikelihood)), 'pest');
    const waterScore = clamp100(num(signals.waterStressScore));
    const waterStress = waterScore == null
      ? metric(null, 'estimated', 30, 'Estimated water need', 'Check soil moisture.')
      : metric(waterScore, waterScore >= 60 ? 'ok' : 'low_confidence', 65, 'Water stress',
        waterScore >= 60 ? 'Irrigate soon.' : 'Moisture looks adequate.');
    const nutriScore = clamp100(num(signals.nutritionScore));
    const nutritionStatus = nutriScore == null
      ? metric(null, hasFirstScan ? 'low_confidence' : 'unknown_until_scan', 0,
        hasFirstScan ? 'Building nutrition view' : 'Unknown until scan',
        'Scan leaves for nutrition signs.')
      : metric(nutriScore, 'ok', 60, 'Nutrition status', null);

    // ── Growth stage + harvest (RULE 8 — honest estimate, never fabricated $). ──
    const stageVal = (fb && typeof fb.growthStage === 'string' && fb.growthStage) || null;
    const growthStage = stageVal
      ? metric(stageVal, 'ok', 70, 'Detected stage', null)
      : metric(null, 'estimated', 25, 'Estimated stage', 'Add planting date for an estimate.');
    const d2h = num(signals.daysToHarvestEstimate);
    const harvestPrediction = d2h != null
      ? metric('~' + Math.max(0, Math.round(d2h)) + ' days', 'estimated', 40,
        'Estimated harvest', 'Refines as you scan.')
      : metric(null, 'estimated', 0, 'Estimated harvest', 'Add planting date for an estimate.');

    // ── Yield / market / funding / buyers — NO live feed → honest, never faked. ──
    const yieldPrediction = metric(null, 'estimated', 0, 'Estimated yield',
      'Log harvests to build a yield history.');
    const marketReadiness = metric(null, 'no_live_feed', 0, 'No live market feed',
      'Market prices are not connected yet.');
    const fundingEligibility = metric(null, 'no_live_feed', 0, 'No live funding feed',
      'Funding programs are not connected yet.');
    const buyerReadiness = metric(null, 'no_live_feed', 0, 'No buyer feed',
      'Buyer requests are not connected yet.');

    // ── Overall confidence: FarmBrain confidence, else derived from health. ──
    const confidence = clamp100(num(fb && fb.confidenceScore))
      ?? (healthScore == null ? 0 : Math.max(20, Math.min(70, Math.round(healthScore * 0.6))));

    // ── Tasks (RULE 1) + a default next-action recommendation (RULE 3/6). ──
    let todays = recsFrom(signals.todaysTasks);
    if (todays.length === 0 && fb && fb.nextAction) {
      todays = Object.freeze([recommendation({
        id: 'next-action',
        action: String(fb.nextAction),
        reason: (fb.followUpTask && fb.followUpTask.reason) || 'Recommended from your last scan.',
        confidence: confidence || 60,
        urgency: diseaseRisk.value != null && (diseaseRisk.value as number) >= 60 ? 'high' : 'medium',
        timeRequiredMin: (fb.followUpTask && fb.followUpTask.timeRequiredMin) || null,
        expectedBenefit: 'Keeps your crop on track.',
      })]);
    }
    if (todays.length === 0) {
      // RULE 3 — ALWAYS a next action, even with zero data.
      todays = Object.freeze([recommendation({
        id: 'first-scan', action: 'Scan your first plant',
        reason: 'A scan unlocks health, disease and task guidance.',
        confidence: 100, urgency: 'medium', timeRequiredMin: 2,
        expectedBenefit: 'Starts your farm plan.',
      })]);
    }
    const tomorrows = recsFrom(signals.tomorrowsTasks);
    const recommendations = Object.freeze([...todays, ...tomorrows].slice(0, 12));

    // ── Timeline (RULE 11) — append this event honestly. ──
    const tl = signals.timelineEntry;
    const timeline = tl && tl.kind
      ? Object.freeze([...base.timeline, Object.freeze({ at, kind: tl.kind, label: tl.label || tl.kind })].slice(-100))
      : base.timeline;

    return Object.freeze({
      version: FARM_BRAIN_STATE_VERSION,
      updatedAt: at,
      lastEvent: type,
      hasFirstScan,
      farmHealth, diseaseRisk, pestRisk, waterStress, nutritionStatus,
      growthStage, harvestPrediction, yieldPrediction,
      marketReadiness, fundingEligibility, buyerReadiness,
      confidence: confidence || 0,
      todaysTasks: todays, tomorrowsTasks: tomorrows, recommendations, timeline,
    });
  } catch {
    // Total: any failure returns the previous (or empty) state, never throws.
    return (prev && prev.version === FARM_BRAIN_STATE_VERSION) ? prev : emptyFarmBrainState();
  }
}
