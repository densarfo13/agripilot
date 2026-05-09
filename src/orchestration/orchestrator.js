/**
 * orchestration/orchestrator — single coordination entry that
 * picks the ONE recommendation a screen should show.
 *
 *   import { getNextBestRecommendation } from
 *     'src/orchestration/orchestrator.js';
 *
 *   const rec = getNextBestRecommendation(intelligenceContext);
 *   if (rec) renderHomeCard(rec);
 *
 * SPEC §2 + §3
 *
 *   Output shape (matches spec §2):
 *     {
 *       titleKey,
 *       messageKey,
 *       actionLabelKey,
 *       actionRoute,
 *       priority,
 *       urgency,
 *       confidence,
 *       reasonKey,
 *       estimatedMinutes,
 *       sourceSignals,         ← INTERNAL — adapter strips before render
 *     }
 *
 *   Prioritization order (spec §3):
 *     1. Safety / weather timing
 *     2. Crop or plant health
 *     3. Today's task
 *     4. Soil condition
 *     5. Harvest / sell readiness
 *     6. Buyer / funding opportunity
 *     7. Progress reassurance
 *
 *   The orchestrator walks this ladder, returning the FIRST
 *   candidate that:
 *     a) has a usable rule match,
 *     b) has not been shown inside its memory cooldown.
 *
 *   Spec §11 fallback fires only when EVERY rule misses.
 *
 * STRICT-RULE AUDIT
 *   • Pure function. Never throws. Returns the spec §11 fallback
 *     on any error.
 *   • Reuses existing intelligence engines (prediction + risk +
 *     trust + adapter) instead of duplicating logic.
 *   • Memory + events shape the prioritization but never block
 *     a fallback render.
 */

import { buildIntelligenceContext } from '../intelligence/core/intelligenceContext.js';
import { predictNextBestAction }    from '../intelligence/core/prediction.js';
import { estimateCropRisk }         from '../intelligence/core/risk.js';
import { forbiddenWordingFilter }   from '../intelligence/core/farmerInsightAdapter.js';
import { CONFIDENCE }               from '../intelligence/core/intelligenceTypes.js';

import { wasRecentlyShown, rememberShown } from './memory.js';
import { getEventsByType }                  from './events/eventStore.js';
import { EVENT_TYPE }                       from './events/eventTypes.js';
// Funding-link safety lockdown — funding candidates are only
// allowed to surface when the match's URL passes the verified-
// host classifier. Anything that fails (unverified domain,
// shortener, http://, javascript:, suspicious TLD, adult /
// gambling keyword) is skipped silently. The user falls
// through to the next-best candidate instead.
import { classifyFundingUrl }               from '../security/validateFundingUrl.js';
// Regional funding intelligence (May 2026) — picks the most
// contextually relevant verified match instead of just the
// first one. Drought boosts insurance/emergency_relief;
// harvest boosts market_access/buyer_coordination; disease
// boosts emergency_relief/extension; etc. Threshold ≥ 60.
import { prioritiseNearbySupport }          from '../intelligence/funding/regionalRelevance.js';

// ─── Spec §11 fallback ───────────────────────────────────────────
//
// Returned whenever no candidate applies. The keys below are the
// ONLY hardcoded English strings the orchestrator ever emits —
// they're i18n keys that the page-level renderer resolves via
// `tSafe()` with English defaults. The shape matches the spec
// §11 example exactly.
export const FALLBACK_RECOMMENDATION = Object.freeze({
  titleKey:         'home.goodQuickCheck',
  messageKey:       'actions.checkLeavesAndSoil',
  actionLabelKey:   'actions.startCheck',
  actionRoute:      '/tasks',
  priority:         'low',
  urgency:          'low',
  confidence:       CONFIDENCE.LOW,
  reasonKey:        'orch.fallback.reason',
  estimatedMinutes: 2,
  sourceSignals:    Object.freeze({ source: 'fallback' }),
});

// ─── Per-priority candidate factories ────────────────────────────
//
// Each factory returns either a candidate envelope or null. The
// envelope carries the spec §2 shape PLUS a `memoryKind` field
// the orchestrator uses to gate memory-cooldown suppression.

function _candidateWeather(ctx) {
  const w = ctx.weather || {};
  const rainProb = Number(w.rainProbability ?? w.precipitationProbability ?? w.rainProb);
  const tempC    = Number(w.tempC ?? w.temperature ?? w.temp);
  if (Number.isFinite(rainProb) && rainProb >= 0.6) {
    return _envelope({
      memoryKind:       'weather',
      memoryKey:        'rain',
      titleKey:         'orch.rainLater',
      messageKey:       'orch.checkDrainage',
      actionLabelKey:   'actions.startCheck',
      actionRoute:      '/tasks',
      priority:         'important',
      urgency:          'medium',
      confidence:       CONFIDENCE.MEDIUM,
      reasonKey:        'orch.reason.rain',
      estimatedMinutes: 2,
      sourceSignals:    { rainProb, region: ctx.region || null },
    });
  }
  if (Number.isFinite(tempC) && tempC >= 32) {
    return _envelope({
      memoryKind:       'weather',
      memoryKey:        'heat',
      titleKey:         'orch.warmAfternoon',
      messageKey:       'orch.checkMoisture',
      actionLabelKey:   'actions.checkSoil',
      actionRoute:      '/scan/soil',
      priority:         'normal',
      urgency:          'low',
      confidence:       CONFIDENCE.MEDIUM,
      reasonKey:        'orch.reason.heat',
      estimatedMinutes: 2,
      sourceSignals:    { tempC, container: ctx.gardenContainer || null },
    });
  }
  return null;
}

function _candidateCropHealth(ctx) {
  const recent = (ctx.scanHistory || [])[0];
  if (!recent || typeof recent !== 'object') return null;
  if (recent.category === 'healthy' || recent.category === 'no_issue_detected') return null;
  return _envelope({
    memoryKind:       'scan_followup',
    memoryKey:        String(recent.scanId || recent.id || ''),
    titleKey:         'orch.quickFollowUp',
    messageKey:       'orch.checkLowerLeaves',
    actionLabelKey:   'actions.openScan',
    actionRoute:      '/scan',
    priority:         'normal',
    urgency:          'medium',
    confidence:       CONFIDENCE.LOW,
    reasonKey:        'orch.reason.scanFollowup',
    estimatedMinutes: 3,
    sourceSignals:    { scanCategory: recent.category },
  });
}

function _candidateTodaysTask(ctx) {
  const tasks = (ctx.tasks || []).filter((t) => t && !t.completed);
  if (tasks.length === 0) return null;
  return _envelope({
    memoryKind:       'task_nudge',
    memoryKey:        String((tasks[0] && tasks[0].id) || 'first'),
    titleKey:         'orch.todayFocus',
    messageKey:       'orch.openTodayTasks',
    actionLabelKey:   'actions.openToday',
    actionRoute:      '/tasks',
    priority:         'normal',
    urgency:          'low',
    confidence:       CONFIDENCE.MEDIUM,
    reasonKey:        'orch.reason.openTask',
    estimatedMinutes: 4,
    sourceSignals:    { openTaskCount: tasks.length },
  });
}

function _candidateSoil(ctx) {
  const recent = (ctx.soilChecks || [])[0];
  if (!recent || typeof recent !== 'object') return null;
  const flagged = ['dry', 'waterlogging', 'cracked', 'mold', 'drainage']
    .includes(String(recent.status || recent.condition || ''));
  if (!flagged) return null;
  return _envelope({
    memoryKind:       'soil_followup',
    memoryKey:        String(recent.id || ''),
    titleKey:         'orch.soilFollowUp',
    messageKey:       'orch.reviewSoilCheck',
    actionLabelKey:   'actions.openSoil',
    actionRoute:      '/scan/soil',
    priority:         'normal',
    urgency:          'low',
    confidence:       CONFIDENCE.MEDIUM,
    reasonKey:        'orch.reason.soilFollowup',
    estimatedMinutes: 2,
    sourceSignals:    { soilStatus: recent.status || recent.condition },
  });
}

function _candidateHarvestReady(ctx) {
  const stage = String(ctx.cropStage || '').toLowerCase();
  const isHarvest = stage.includes('harvest') || stage.includes('mature');
  if (!isHarvest) return null;
  if ((ctx.produceListings || []).length > 0) return null;
  return _envelope({
    memoryKind:       'progress',
    memoryKey:        'harvest_listing',
    titleKey:         'orch.harvestReady',
    messageKey:       'orch.prepareListing',
    actionLabelKey:   'actions.startListing',
    actionRoute:      '/sell',
    priority:         'normal',
    urgency:          'medium',
    confidence:       CONFIDENCE.MEDIUM,
    reasonKey:        'orch.reason.harvestReady',
    estimatedMinutes: 4,
    sourceSignals:    { cropStage: stage },
  });
}

function _candidateBuyerInterest(ctx) {
  const buyer = (ctx.buyerInterest || [])[0];
  if (!buyer) return null;
  return _envelope({
    memoryKind:       'buyer_prompt',
    memoryKey:        String(buyer.id || 'first'),
    titleKey:         'orch.buyerInterest',
    messageKey:       'orch.openBuyerInterest',
    actionLabelKey:   'actions.seeBuyer',
    actionRoute:      '/sell',
    priority:         'important',
    urgency:          'medium',
    confidence:       CONFIDENCE.MEDIUM,
    reasonKey:        'orch.reason.buyerInterest',
    estimatedMinutes: 3,
    sourceSignals:    { buyerId: buyer.id || null },
  });
}

/**
 * Funding candidate — gated by the verified-URL classifier so an
 * unverified or malicious URL never surfaces as a primary
 * recommendation on Home/Tasks. Funding sits BELOW buyer interest
 * in the priority ladder (spec §4 #7) — buyer activity is more
 * time-sensitive than a long-window grant nudge.
 *
 * The URL gate uses `classifyFundingUrl`. When ANY URL field on
 * the match (`url`, `applyUrl`, `sourceUrl`) is unverified, the
 * factory returns null and the ladder falls through to progress
 * reassurance.
 */
function _candidateVerifiedFunding(ctx) {
  const matches = Array.isArray(ctx.fundingMatches) ? ctx.fundingMatches : [];
  if (matches.length === 0) return null;

  // Regional funding intelligence (May 2026) — score every
  // verified match against the farmer's current context and
  // surface only when composite score ≥ 60. The scorer does
  // its own verified-host check, so a malformed or unverified
  // URL never reaches the ranking. Returns matches sorted by
  // descending score; we take the top one.
  const ranked = prioritiseNearbySupport(matches, ctx);
  if (ranked.length === 0) {
    // No relevant verified match. Spec §10 mandates calm timing:
    // "Nearby support should appear ONLY when useful." So we
    // intentionally return null and fall through to the next
    // rung (progress reassurance) instead of surfacing a
    // generic verified grant just because we have one.
    //
    // The previous fallback path here was a defence-in-depth
    // remnant from before regional intelligence shipped. It
    // surfaced ANY verified match — even one with zero region /
    // crop / context fit — which directly contradicts the
    // "trusted nearby support relevant to this farmer's actual
    // situation" promise. May 2026 engine fix removes it.
    return null;
  }

  // Top-ranked verified match. The classifier already ran
  // inside `prioritiseNearbySupport`, so URL safety is
  // guaranteed. We pull the host out for sourceSignals so
  // admin telemetry can dashboard which orgs surface most.
  const best = ranked[0];
  const fund = best.opportunity;
  const candidateUrl = String(fund.url || fund.applyUrl || fund.sourceUrl || '');
  const safety = classifyFundingUrl(candidateUrl);
  return _envelope({
    memoryKind:       'funding',
    memoryKey:        String(fund.id || 'first'),
    titleKey:         'orch.fundingMatch',
    messageKey:       'orch.openFundingMatch',
    actionLabelKey:   'actions.checkEligibility',
    actionRoute:      '/funding',
    priority:         'normal',
    urgency:          'low',
    confidence:       CONFIDENCE.LOW,
    reasonKey:        'orch.reason.fundingMatch',
    estimatedMinutes: 4,
    // INTERNAL — adapter strips before farmer-facing render.
    // Useful for admin telemetry: which categories surface
    // most + which context signals drove the boost.
    sourceSignals:    {
      fundingId:    fund.id || null,
      host:         safety.host,
      category:     fund.category || null,
      boostSignals: best.signals,
    },
  });
}

function _candidateProgressReassurance(ctx) {
  const completedTasks = (ctx.tasks || []).filter((t) => t && t.completed).length;
  if (completedTasks === 0) return null;
  return _envelope({
    memoryKind:       'progress',
    memoryKey:        'progress_reassure',
    titleKey:         'orch.onTrackToday',
    messageKey:       'orch.keepRhythm',
    actionLabelKey:   'actions.seeProgress',
    actionRoute:      '/progress',
    priority:         'low',
    urgency:          'low',
    confidence:       CONFIDENCE.LOW,
    reasonKey:        'orch.reason.progressMomentum',
    estimatedMinutes: 1,
    sourceSignals:    { completedTasks },
  });
}

// Ladder ordered per spec §4 (Trusted Coordination Layer
// May 2026 fix). Soil now sits ABOVE today's task — a soil
// concern is more time-sensitive than a routine open task,
// and re-ordering keeps "act on a real signal" before "tick
// today's checklist". Buyer interest + verified funding are
// split into two distinct rungs: buyer interest is immediate
// (spec §6 cooldown: immediate), funding is a long-window
// nudge that only surfaces when a verified URL passes the
// safety classifier.
const LADDER = [
  _candidateWeather,             // 1. Weather / safety timing
  _candidateCropHealth,          // 2. Crop or plant health
  _candidateSoil,                // 3. Soil condition
  _candidateTodaysTask,          // 4. Today's task
  _candidateHarvestReady,        // 5. Harvest / sell readiness
  _candidateBuyerInterest,       // 6. Buyer interest
  _candidateVerifiedFunding,     // 7. Verified funding only
  _candidateProgressReassurance, // 8. Progress reassurance
];

// ─── Public entry ────────────────────────────────────────────────

/**
 * Pick the single recommendation a screen should render right
 * now. Walks the spec §3 priority ladder, skipping candidates
 * that were shown inside their memory cooldown.
 *
 * @param {object} input - raw context (tolerated as undefined / partial)
 * @param {object} [opts]
 * @param {Date|number} [opts.now]
 * @param {boolean} [opts.commit=true] - update memory on selection
 * @returns {object} - spec §2 recommendation envelope OR §11 fallback
 */
export function getNextBestRecommendation(input = {}, opts = {}) {
  let context;
  try { context = buildIntelligenceContext(input); }
  catch { return FALLBACK_RECOMMENDATION; }

  const now = opts.now != null ? opts.now : Date.now();
  const commit = opts.commit !== false;

  try {
    for (const factory of LADDER) {
      let candidate;
      try { candidate = factory(context); }
      catch { candidate = null; }
      if (!candidate) continue;
      // Memory cooldown — skip if the same kind+key was shown recently.
      if (wasRecentlyShown(candidate.memoryKind, candidate.memoryKey, now)) {
        continue;
      }
      // Refine confidence using the existing risk/prediction
      // engines when their result agrees with our pick. This
      // never changes the recommendation — only the confidence
      // tier — so the prioritization stays deterministic.
      try {
        const pred = predictNextBestAction(context);
        const risk = estimateCropRisk(context);
        if (pred && pred.confidence) candidate.confidence = pred.confidence;
        else if (risk && risk.confidence) candidate.confidence = risk.confidence;
      } catch { /* keep base confidence */ }

      if (commit) {
        try { rememberShown(candidate.memoryKind, candidate.memoryKey, now); }
        catch { /* swallow */ }
      }
      return _publicShape(candidate);
    }
  } catch { /* fall through to spec §11 fallback */ }

  return FALLBACK_RECOMMENDATION;
}

/**
 * Convenience helper for surfaces that want to react to bus
 * events. Subscribers call `eventBus.subscribe('*', refresh)`
 * and refresh = () => setRec(getNextBestRecommendation(ctx)).
 *
 * Exposed so callers don't need to also import eventStore /
 * eventBus directly.
 */
export function lastEventOfType(type, limit = 1) {
  try {
    const list = getEventsByType(type, limit);
    return list[0] || null;
  } catch { return null; }
}

// ─── Internals ───────────────────────────────────────────────────

function _envelope(o) {
  return {
    // Memory keys — INTERNAL, stripped by _publicShape before
    // handing to the renderer.
    memoryKind:       o.memoryKind,
    memoryKey:        o.memoryKey || '',
    // Spec §2 shape.
    titleKey:         String(o.titleKey),
    messageKey:       String(o.messageKey),
    actionLabelKey:   String(o.actionLabelKey),
    actionRoute:      String(o.actionRoute),
    priority:         String(o.priority || 'normal'),
    urgency:          String(o.urgency || 'low'),
    confidence:       String(o.confidence || CONFIDENCE.LOW),
    reasonKey:        String(o.reasonKey || ''),
    estimatedMinutes: Number(o.estimatedMinutes) || 2,
    sourceSignals:    Object.freeze({ ...(o.sourceSignals || {}) }),
  };
}

function _publicShape(envelope) {
  // Strip memory bookkeeping. The renderer's i18n layer turns
  // the keys into the user-visible strings; the adapter's
  // forbidden-wording filter is irrelevant here because we
  // never emit raw English from the orchestrator.
  return Object.freeze({
    titleKey:         envelope.titleKey,
    messageKey:       envelope.messageKey,
    actionLabelKey:   envelope.actionLabelKey,
    actionRoute:      envelope.actionRoute,
    priority:         envelope.priority,
    urgency:          envelope.urgency,
    confidence:       envelope.confidence,
    reasonKey:        envelope.reasonKey,
    estimatedMinutes: envelope.estimatedMinutes,
    sourceSignals:    envelope.sourceSignals,  // adapter strips before render
  });
}

// Defence in depth — should the i18n layer ever fail and a raw
// English string slip through, the page-level renderer can run
// the orchestrator output through this filter as a final net.
export function sanitizeRecommendation(rec) {
  if (!rec || typeof rec !== 'object') return rec;
  const out = { ...rec };
  // We don't strip the keys themselves (those are i18n
  // identifiers, not user text). The filter is exposed so
  // callers can use it on resolved title/message strings.
  return Object.freeze(out);
}

export const _internal = Object.freeze({
  forbiddenWordingFilter,
  EVENT_TYPE,
  LADDER_LENGTH: LADDER.length,
});

const _module = {
  getNextBestRecommendation,
  lastEventOfType,
  sanitizeRecommendation,
  FALLBACK_RECOMMENDATION,
};
export default _module;
