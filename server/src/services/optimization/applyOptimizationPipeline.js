/**
 * applyOptimizationPipeline.js — the single end-to-end runner
 * that enforces the production-safe order in code (not docs):
 *
 *   1. HARD AGRONOMIC GUARDRAILS          (caller supplies locks)
 *   2. SUPPORT-TIER / MODE RESTRICTIONS   (caller supplies)
 *   3. BASE RECOMMENDATION/TASK LOGIC      (caller's engine output)
 *   4. OPTIMIZATION ADJUSTMENTS            (this module)
 *        a. extract signals (windowed + decayed)
 *        b. split into personal + regional scopes
 *        c. check eligibility per family per scope
 *        d. gate negative deltas behind combined-evidence check
 *        e. compute bounded deltas
 *        f. enforce mode isolation
 *        g. strip listing deltas in backyard mode
 *        h. build explanation + write to audit store
 *   5. FINAL CONFIDENCE WORDING            (conservative when low-signal)
 *
 * Consumers call this ONCE per runtime decision — no need to
 * understand the internals.
 */

import {
  extractOptimizationSignals,
} from './signalExtractors.js';
import {
  computeAdjustments, computeAdjustmentForContext, zeroAdjustment,
} from './optimizationEngine.js';
import {
  applyRecommendationOptimization,
  applyConfidenceOptimization,
  applyTaskUrgencyOptimization,
  applyListingQualityOptimization,
} from './applyOptimization.js';
import {
  createEligibilityConfig,
  getOptimizationEligibility,
  isLowSignalContext,
  SCOPES,
} from './optimizationEligibility.js';
import {
  filterSignalsByWindow, getWeightedCounts,
  DEFAULT_HALF_LIFE_DAYS, DEFAULT_WINDOW_DAYS,
} from './recencyWeighting.js';
import {
  splitSignalsByScope, mergeOptimizationLayers,
  regionalKeyFromPersonal, parseScopeFromKey,
} from './personalVsRegional.js';
import {
  getNegativeAdjustmentEligibility,
  applyNegativeEligibilityToDelta,
} from './negativeSignalInterpreter.js';
import {
  enforceModeIsolation,
  stripListingDeltasForBackyard,
  validateModeAwareOptimization,
} from './modeIsolation.js';
import {
  buildOptimizationExplanation,
} from './optimizationExplanation.js';
import {
  getConfidenceAwareWording,
} from './confidenceAwareWording.js';
import {
  buildRecommendationContextKey,
} from './contextKey.js';

/**
 * applyOptimizationPipeline — the canonical entry point.
 *
 * @param {object} ctx
 * @param {Event[]} ctx.events
 * @param {string}  [ctx.userId]
 * @param {'backyard'|'farm'} [ctx.mode]
 * @param {string}  [ctx.country]
 * @param {string}  [ctx.state]
 * @param {object}  [ctx.locks]                — from guardrails stage
 * @param {object}  [ctx.baseRecommendationScores]
 * @param {object}  [ctx.baseConfidence]       — { level, score }
 * @param {object}  [ctx.primaryTask]          — the task engine output
 * @param {object}  [ctx.primaryListing]
 * @param {object}  [ctx.auditStore]           — optional, for logging
 * @param {object}  [ctx.config]               — threshold overrides
 * @param {number}  [ctx.now]
 * @param {number}  [ctx.windowDays]
 * @param {number}  [ctx.halfLifeDays]
 */
export function applyOptimizationPipeline(ctx = {}) {
  const now         = Number.isFinite(ctx.now) ? ctx.now : Date.now();
  const windowDays  = ctx.windowDays  ?? DEFAULT_WINDOW_DAYS;
  const halfLife    = ctx.halfLifeDays ?? DEFAULT_HALF_LIFE_DAYS;
  const config      = createEligibilityConfig(ctx.config?.eligibility);
  const mode        = ctx.mode || null;
  const userId      = ctx.userId || null;
  const country     = ctx.country || null;
  const auditStore  = ctx.auditStore || null;
  const locks       = ctx.locks || {};

  // ─── 4a + 4b. extract + split scopes ─────────────────
  const windowedEvents = filterSignalsByWindow(ctx.events || [],
    { windowDays, now });
  const { regional: regionalExtraction, personalByUser } =
    splitSignalsByScope(windowedEvents, { now });

  const personalExtraction = userId && personalByUser[userId]
    ? personalByUser[userId]
    : { byContext: {}, totalEvents: 0, familyTotals: {}, scope: SCOPES.PERSONAL };

  // ─── 4c + 4d + 4e. compute with eligibility + neg gating ─
  const regionalAdjustments = computeScopedAdjustments(
    regionalExtraction, SCOPES.REGIONAL, { config, now, halfLife }
  );
  const personalAdjustments = computeScopedAdjustments(
    personalExtraction, SCOPES.PERSONAL, { config, now, halfLife }
  );

  // ─── 4f + 4g. mode isolation + listing gate ──────────
  const regionalScoped = enforceModeIsolation(regionalAdjustments, { mode });
  const personalScoped = enforceModeIsolation(personalAdjustments, { mode });
  for (const [k, a] of Object.entries(regionalScoped.byContext)) {
    regionalScoped.byContext[k] = stripListingDeltasForBackyard(a, mode);
  }
  for (const [k, a] of Object.entries(personalScoped.byContext)) {
    personalScoped.byContext[k] = stripListingDeltasForBackyard(a, mode);
  }

  // Merge so a personal adjustment can layer its (bounded)
  // influence on top of the regional baseline for the same user.
  const merged = mergeOptimizationLayers(regionalScoped, personalScoped);

  // ─── 4h. explanations + audit ──────────────────────
  const explanations = [];
  for (const [key, adj] of Object.entries(merged.byContext)) {
    const bucket = pickBucket(regionalExtraction, personalExtraction, key);
    const record = buildOptimizationExplanation(adj, bucket, { now });
    explanations.push(record);
    if (auditStore && typeof auditStore.append === 'function') {
      auditStore.append(record);
    }
  }

  // ─── 3 + 4 runtime application ───────────────────────
  // Find the primary recommendation context for this caller
  // (crop comes from each base score key).
  const baseScores = ctx.baseRecommendationScores || {};
  const recommendationOpts = { country, mode, locks };
  const finalScores = applyRecommendationOptimization(
    baseScores, merged, recommendationOpts,
  );

  // Confidence: use the regional adjustment for the primary
  // crop — personal signals don't move the wording tier.
  let finalConfidence = ctx.baseConfidence || null;
  let confidenceAdj = null;
  if (finalConfidence && ctx.primaryCrop) {
    const confKey = buildRecommendationContextKey({
      crop: ctx.primaryCrop, country, mode,
    });
    confidenceAdj = regionalScoped.byContext[confKey]
                 || regionalAdjustments.byContext[confKey]
                 || zeroAdjustment(confKey);
    finalConfidence = applyConfidenceOptimization(finalConfidence, confidenceAdj);
  }

  // Task urgency — personal takes precedence here.
  let finalTask = ctx.primaryTask || null;
  if (finalTask) {
    // Task adjustments aren't crop-keyed, they're mode-keyed.
    const taskKey = `|||${String(mode || '').toLowerCase()}|`;
    const taskAdj = (personalScoped.byContext[`u:${userId}|${taskKey}`]
                  || regionalScoped.byContext[taskKey]
                  || zeroAdjustment(taskKey));
    finalTask = applyTaskUrgencyOptimization(finalTask, taskAdj);
  }

  // Listing quality — farm-only, regional.
  let finalListing = ctx.primaryListing || null;
  if (finalListing) {
    const listingKey = `|${String(country || '').toLowerCase()}|${String(ctx.state || '').toLowerCase()}||`;
    const listingAdj = regionalScoped.byContext[listingKey]
                     || zeroAdjustment(listingKey);
    finalListing = applyListingQualityOptimization(finalListing, listingAdj,
      { baseFloor: ctx.baseListingFloor ?? 0.6 });
  }

  // ─── 5. final confidence wording pick ────────────────
  // Use the regional eligibility to decide whether we're in
  // "Best crops" territory or need to downgrade to "Suggested".
  const primaryKey = ctx.primaryCrop
    ? buildRecommendationContextKey({ crop: ctx.primaryCrop, country, mode })
    : null;
  const eligibilityForPrimary = primaryKey
    ? getOptimizationEligibility(
        regionalExtraction.byContext?.[primaryKey] || { counts: {} },
        SCOPES.REGIONAL, config,
      )
    : null;
  const wording = getConfidenceAwareWording({
    eligibility: eligibilityForPrimary,
    confidenceLevel: finalConfidence?.level,
    supportTier: ctx.supportTier,
  });

  return Object.freeze({
    // Final decisions
    finalRecommendationScores: finalScores,
    finalConfidence,
    finalTask,
    finalListing,
    wording,

    // Internal payload — the audit/debug layer reads these.
    adjustments:         merged,
    regionalAdjustments,
    personalAdjustments,
    extraction: {
      regional: regionalExtraction,
      personal: personalExtraction,
      windowedCount: windowedEvents.length,
    },
    eligibility: eligibilityForPrimary,
    explanations,
    modeCoverage: {
      regionalDropped: regionalScoped.dropped,
      personalDropped: personalScoped.dropped,
    },
    contextKey: primaryKey,
    generatedAt: now,
  });
}

// ─── internals ────────────────────────────────────────────

/**
 * computeScopedAdjustments — for one extraction (regional OR
 * personal), compute adjustments with per-scope eligibility
 * gating and combined-negative-evidence gating. Never mutates.
 */
function computeScopedAdjustments(extraction, scope, opts = {}) {
  const config = opts.config || createEligibilityConfig();
  const halfLifeDays = opts.halfLife ?? DEFAULT_HALF_LIFE_DAYS;
  const now = opts.now ?? Date.now();

  const input = extraction?.byContext || {};
  const adjustments = {};
  const totals = { contexts: 0, adjusted: 0, skippedBelowThreshold: 0 };

  for (const [contextKey, bucket] of Object.entries(input)) {
    totals.contexts += 1;

    // Use recency-weighted counts as the effective signal strength.
    const weightedCounts = getWeightedCounts(bucket.samples || [],
      { halfLifeDays, now });
    const effectiveBucket = {
      ...bucket,
      counts: weightedCounts,
      rawCounts: bucket.counts,
    };

    const eligibility = getOptimizationEligibility(
      { counts: bucket.counts || {} }, scope, config,
    );

    // Run the raw engine first — it clamps + bounds automatically.
    const raw = computeAdjustmentForContext(contextKey, effectiveBucket);

    // Negative-signal gate: only allow a negative delta if the
    // combined-evidence interpreter agrees it's strong enough.
    const negGate = getNegativeAdjustmentEligibility(bucket.counts || {}, {});
    const recommendationDelta = applyNegativeEligibilityToDelta(
      raw.recommendationDelta, negGate,
    );
    const confidenceDelta = applyNegativeEligibilityToDelta(
      raw.confidenceDelta, negGate,
    );
    const urgencyDelta = applyNegativeEligibilityToDelta(
      raw.urgencyDelta, negGate,
    );

    // Threshold gate — each family only fires if its scope
    // threshold was cleared. Anything else collapses to 0.
    const gated = {
      contextKey,
      scope,
      recommendationDelta: eligibility.recommendation ? recommendationDelta : 0,
      confidenceDelta:     eligibility.harvest        ? confidenceDelta     : 0,
      urgencyDelta:        eligibility.task           ? urgencyDelta        : 0,
      listingQualityDelta: eligibility.listing        ? raw.listingQualityDelta : 0,
      meetsThreshold:      eligibility,
      reasons: [
        ...(raw.reasons || []),
        ...(negGate.patternIds || []).map((p) => `neg:${p}`),
      ],
      counts: bucket.counts || {},
      weightedCounts,
      negativeEvidence: {
        strength: negGate.strength,
        patterns: negGate.patternIds,
        multiplier: negGate.multiplier,
      },
    };
    adjustments[contextKey] = gated;
    if (isActive(gated)) totals.adjusted += 1;
    else                 totals.skippedBelowThreshold += 1;
  }

  return { byContext: adjustments, totals, scope };
}

function pickBucket(regional, personal, key) {
  const scope = parseScopeFromKey(key);
  if (scope === 'personal') {
    return personal?.byContext?.[key] || { counts: {} };
  }
  return regional?.byContext?.[key] || { counts: {} };
}

function isActive(a) {
  return (a.recommendationDelta !== 0)
      || (a.confidenceDelta !== 0)
      || (a.urgencyDelta !== 0)
      || (a.listingQualityDelta !== 0);
}

export const _internal = {
  computeScopedAdjustments, pickBucket, isActive,
};
