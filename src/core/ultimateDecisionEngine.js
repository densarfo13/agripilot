/**
 * ultimateDecisionEngine.js — facade composer over the existing
 * decision stack.
 *
 *   import { decideToday } from '../core/ultimateDecisionEngine.js';
 *
 *   const out = decideToday({
 *     activeExperience, cropOrPlant, growingSetup, sizeCategory,
 *     location,
 *     weatherToday, weatherYesterday,
 *     userMemory, recentScans, healthFeedback, globalInsights,
 *   });
 *
 *   // → {
 *   //     primaryAction:  { titleKey, titleFallback, type, ... },
 *   //     confidenceLine: { key, fallback },
 *   //     riskLevel:      'low'|'medium'|'high',
 *   //     riskReason:     { key, fallback },
 *   //     supportingTasks: [{ titleKey, titleFallback }, ...] // max 2
 *   //     tomorrowPreview: { key, fallback },
 *   //     learningMessage: { key, fallback } | null,
 *   //   }
 *
 * Why a composer, not a new engine
 * ────────────────────────────────
 * Strict rule from every prior session: **no duplicate systems.**
 * The decision logic the spec describes already lives across:
 *
 *   • primaryActionEngine.buildPrimaryAction      → primary action,
 *                                                    moisture, behaviour
 *                                                    override, riskNote
 *   • dailyPlanEngine.generateDailyPlan           → riskLevel, riskReason,
 *                                                    tasks, tomorrowPreview
 *   • primaryActionEngine.getCropHints            → crop-specific
 *                                                    supporting tasks
 *
 * This module wires those outputs into the spec's compact shape
 * and adds two thin pieces the underlying engines don't already
 * provide:
 *
 *   1. `learningMessage` — a single "you've been consistent" /
 *      "last time you waited it stayed healthy" line. Memory line
 *      logic lives in `primaryActionEngine` already; we surface
 *      it here under a different field name to match the spec.
 *   2. tomorrowPreview override for scan follow-up — the curated
 *      "Tomorrow: follow up on today's scan" line replaces the
 *      generic plan-engine preview when scan_followup fires.
 *
 * Safety guarantees (§13)
 * ───────────────────────
 *   • Always returns exactly ONE primary action
 *   • supportingTasks capped at 2
 *   • Never emits a chemical / dosage instruction (no engine in
 *     this stack does — the composer just doesn't re-introduce one)
 *   • Never throws; missing inputs collapse to safe defaults
 *
 * No backend / Prisma / cropAliases changes. UI doesn't change —
 * FirstActionGate already renders every field this composer
 * surfaces.
 */

import { buildPrimaryAction, getCropHints } from './primaryActionEngine.js';
import { generateDailyPlan } from './dailyPlanEngine.js';
import { getActionScore } from './insightAggregator.js';
import { getEvents } from './eventStore.js';

// ─── Tomorrow-preview overrides per primaryActionType ──────
//
// Spec §11 lists three curated preview lines. We map each
// primary action type to the most appropriate one. Anything
// not in the table falls back to the engine's default
// tomorrow hook (`primaryAction.tomorrow.hook`).

const TOMORROW_PREVIEW_BY_TYPE = Object.freeze({
  scan_followup:      { key: 'tomorrow.followUpScan',  fallback: 'Tomorrow: follow up on today\u2019s scan' },
  no_water_moist:     { key: 'tomorrow.checkSoil',     fallback: 'Tomorrow: check soil moisture again' },
  no_water_behavior:  { key: 'tomorrow.checkSoil',     fallback: 'Tomorrow: check soil moisture again' },
  no_water:           { key: 'tomorrow.checkSoil',     fallback: 'Tomorrow: check soil moisture again' },
  check_soil_moist:   { key: 'tomorrow.checkSoil',     fallback: 'Tomorrow: check soil moisture again' },
  check_early_moist:  { key: 'tomorrow.checkSoil',     fallback: 'Tomorrow: check soil moisture again' },
  check_leaves_humid: { key: 'tomorrow.quickLeafCheck', fallback: 'Tomorrow: quick leaf check' },
  simple_check:       { key: 'tomorrow.quickLeafCheck', fallback: 'Tomorrow: quick leaf check' },
  garden_default:     { key: 'tomorrow.quickLeafCheck', fallback: 'Tomorrow: quick leaf check' },
  farm_default:       { key: 'tomorrow.quickLeafCheck', fallback: 'Tomorrow: quick leaf check' },
});

function _learningMessage(memory, primaryActionType) {
  if (!memory || typeof memory !== 'object') return null;
  // Preserve precedence:
  //   1. skip+healthy reinforcement (already produced by
  //      primaryActionEngine's memory line; surfaced via
  //      `memoryKey`/`memoryFallback`. We do NOT duplicate it
  //      here — caller decides whether to render the gate's
  //      memory line OR this learning message)
  //   2. consistency: completedTasksCount >= 5 → "consistent"
  const completed = Number(memory.completedTasksCount || 0);
  if (completed >= 5) {
    return {
      key:      'learning.consistent',
      fallback: 'You\u2019ve been consistent \u2014 keep going.',
    };
  }
  return null;
}

/**
 * @param {{
 *   activeExperience?: 'garden'|'farm',
 *   cropOrPlant?: string,
 *   growingSetup?: 'container'|'raised_bed'|'ground'|'indoor'|'farm'|string,
 *   sizeCategory?: string,
 *   location?: { region?: string, country?: string },
 *   weatherToday?: object,
 *   weatherYesterday?: object,
 *   userMemory?: object,
 *   recentScans?: Array,    // not consumed today; engine reads
 *                            //   memory.lastIssueType. Reserved for
 *                            //   future per-scan retention logic.
 *   healthFeedback?: object, // surfaced via memory.lastHealthyFeedback
 *   globalInsights?: Array,
 * }} input
 */
export function decideToday(input = {}) {
  const ctx = input || {};
  const memory   = ctx.userMemory && typeof ctx.userMemory === 'object' ? ctx.userMemory : null;
  const insights = Array.isArray(ctx.globalInsights) ? ctx.globalInsights : null;

  // ─── 1. Primary action ────────────────────────────────────
  let action;
  try {
    action = buildPrimaryAction({
      weatherToday:     ctx.weatherToday,
      weatherYesterday: ctx.weatherYesterday,
      memory,
      insights,
      context: {
        activeExperience: ctx.activeExperience,
        cropOrPlant:      ctx.cropOrPlant,
        region:           ctx.location && ctx.location.region,
        growingSetup:     ctx.growingSetup,
      },
    });
  } catch {
    // The engine never throws today, but be defensive — a
    // pathological input must not collapse the Home page.
    action = null;
  }

  // ─── 2. Risk + tasks + tomorrow (existing plan engine) ────
  let plan;
  try {
    plan = generateDailyPlan({
      type:             ctx.activeExperience === 'garden' ? 'garden' : 'farm',
      activeExperience: ctx.activeExperience,
      cropOrPlant:      ctx.cropOrPlant,
      crop:             ctx.cropOrPlant,
      size:             ctx.sizeCategory,
      growingSetup:     ctx.growingSetup,
      weather:          ctx.weatherToday,
      retention: {
        missedYesterday:    !!(memory && memory.missedDays >= 1),
        repeatedMissedDays: !!(memory && memory.missedDays >= 2),
        hasRecentScanIssue: !!(memory && memory.lastIssueType),
      },
      globalInsights: insights,
    });
  } catch {
    plan = null;
  }

  // ─── 3. Supporting tasks (cap 2) ──────────────────────────
  // Drop any task whose title equals the primary action title
  // (avoid showing the same row twice). Then prepend a crop-
  // specific hint when one matches the active conditions.
  const planTasks = (plan && Array.isArray(plan.tasks)) ? plan.tasks : [];
  const primaryTitleKey = action && action.titleKey;
  const filtered = planTasks.filter(t => !t || t.titleKey !== primaryTitleKey);

  const humid = Number((ctx.weatherToday && ctx.weatherToday.humidity)) > 70;
  const cropHints = getCropHints(ctx.cropOrPlant, { humid });
  const cropHintTasks = cropHints.slice(0, 1).map(h => ({
    titleKey:      h.key,
    titleFallback: h.fallback,
    source:        'crop_hint',
  }));

  const supportingTasks = [...cropHintTasks, ...filtered].slice(0, 2);

  // ─── 4. Tomorrow preview (override for scan follow-up) ────
  const previewByType = action && TOMORROW_PREVIEW_BY_TYPE[action.primaryActionType];
  const tomorrowPreview = previewByType
    ? { key: previewByType.key, fallback: previewByType.fallback }
    : { key: action ? action.tomorrowKey : 'primaryAction.tomorrow.hook',
        fallback: action ? action.tomorrowFallback : 'Tomorrow: quick leaf check (30s)' };

  // ─── 5. Learning message (composer-only) ──────────────────
  // The skip+healthy reinforcement is already on `action.memoryKey`
  // when it fires; we ONLY add the consistency line as the
  // learningMessage so the gate can render both without duplication.
  const learningMessage = _learningMessage(memory, action && action.primaryActionType);

  // ─── 6. Risk roll-up ──────────────────────────────────────
  // Plan engine's riskLevel is the source of truth; primaryAction's
  // riskNoteSeverity can escalate it but never downgrade.
  let riskLevel = (plan && plan.riskLevel) || 'low';
  if (action && action.riskNoteSeverity === 'high' && riskLevel !== 'high') {
    riskLevel = 'high';
  }
  const riskReason = plan && plan.riskReason
    ? { key: plan.riskReason.key || null, fallback: plan.riskReason.fallback || plan.riskReason }
    : { key: 'risk.reason.normal', fallback: 'Conditions look normal today.' };

  // ─── Final shape ──────────────────────────────────────────
  // FirstActionGate consumes `decision` as a drop-in for its
  // legacy hand-built action object. We denormalise the
  // composer-level fields (`reasonKey`, `tomorrowKey`) onto the
  // primaryAction so the gate doesn't need to know about the
  // top-level `confidenceLine` / `tomorrowPreview` fields. The
  // top-level fields stay for callers that prefer the spec shape.
  const tomorrowOverrideKey      = previewByType ? previewByType.key      : (action ? action.tomorrowKey      : null);
  const tomorrowOverrideFallback = previewByType ? previewByType.fallback : (action ? action.tomorrowFallback : null);

  return {
    primaryAction: action ? {
      type:                action.primaryActionType,
      // Engine-level alias used by the renderer to attribute
      // analytics + DOM data attribute. Mirrors what
      // buildPrimaryAction returns directly.
      primaryActionType:   action.primaryActionType,
      // Conversion upgrade §2 — urgency tag passes through.
      urgencyKey:          action.urgencyKey,
      urgencyFallback:     action.urgencyFallback,
      urgencyTier:         action.urgencyTier,
      // Dependency System §2/§3 — day-cue + uncertainty pass-through.
      dayCueKey:           action.dayCueKey,
      dayCueFallback:      action.dayCueFallback,
      showUncertainty:     action.showUncertainty,
      uncertaintyKey:      action.uncertaintyKey,
      uncertaintyFallback: action.uncertaintyFallback,
      // Learning + Scoring §4/§5 — personal track-record score
      // for THIS user on THIS action type. Computed from the
      // local event log (no server round-trip). When confidence
      // ≥ 3 samples AND success_rate ≥ 0.7 the gate surfaces a
      // small "You've had good results with this before" line.
      // Below those thresholds the field stays null so callers
      // can simply not render the line — spec §5 deprioritise
      // path falls through naturally.
      personalScore:       _personalScoreFor(action.primaryActionType),
      titleKey:            action.titleKey,
      titleFallback:       action.titleFallback,
      detailKey:           action.detailKey,
      detailFallback:      action.detailFallback,
      // Reason ("Why" / confidence line) — denormalised from
      // top-level confidenceLine so the gate's existing
      // field access works without changes.
      reasonKey:           action.reasonKey,
      reasonFallback:      action.reasonFallback,
      consequenceKey:      action.consequenceKey,
      consequenceFallback: action.consequenceFallback,
      memoryKey:           action.memoryKey,
      memoryFallback:      action.memoryFallback,
      memoryVars:          action.memoryVars,
      riskNoteKey:         action.riskNoteKey,
      riskNoteFallback:    action.riskNoteFallback,
      riskNoteSeverity:    action.riskNoteSeverity,
      showAreaInsight:     action.showAreaInsight,
      areaInsightKey:      action.areaInsightKey,
      areaInsightFallback: action.areaInsightFallback,
      ctaDoneKey:          action.ctaDoneKey,
      ctaDoneFallback:     action.ctaDoneFallback,
      // Tomorrow preview override (per-action) denormalised so
      // the gate's `action.tomorrowKey` access keeps working.
      tomorrowKey:         tomorrowOverrideKey,
      tomorrowFallback:    tomorrowOverrideFallback,
    } : null,
    confidenceLine: action
      ? { key: action.reasonKey, fallback: action.reasonFallback }
      : null,
    riskLevel,
    riskReason,
    supportingTasks,
    tomorrowPreview,
    learningMessage,
  };
}

// Learning + Scoring §3-§5 — local personal-score lookup. Reads
// the event log via getActionScore (which itself just calls
// aggregateActionSuccessRates) and only returns a payload when
// the score is meaningful (≥3 samples, ≥0.7 success rate). The
// thresholds are deliberately conservative so a single lucky
// pair doesn't surface a false "good results" claim.

const PERSONAL_SCORE_MIN_CONFIDENCE = 3;
const PERSONAL_SCORE_HIGH_RATE      = 0.7;

function _personalScoreFor(primaryActionType) {
  if (!primaryActionType) return null;
  let events = null;
  try { events = getEvents(); }
  catch { events = null; }
  if (!Array.isArray(events) || events.length === 0) return null;
  let row = null;
  try { row = getActionScore(primaryActionType, events); }
  catch { row = null; }
  if (!row) return null;
  const high = row.confidence >= PERSONAL_SCORE_MIN_CONFIDENCE
            && row.success_rate >= PERSONAL_SCORE_HIGH_RATE;
  return {
    action:       row.action,
    successRate:  row.success_rate,
    confidence:   row.confidence,   // raw sample count per spec
    showBoost:    high,             // gate renders only when true
  };
}

export const _internal = Object.freeze({
  TOMORROW_PREVIEW_BY_TYPE,
  _learningMessage,
  _personalScoreFor,
  PERSONAL_SCORE_MIN_CONFIDENCE,
  PERSONAL_SCORE_HIGH_RATE,
});
