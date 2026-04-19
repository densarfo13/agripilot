/**
 * responseApplicationService.js — turns ActionabilityPlan
 * objects into concrete product responses that a surface can
 * actually render. This is the adapter between "something's
 * wrong" and "here's the UI change".
 *
 * Each applier returns a bounded response object:
 *
 *   OnboardingResponse:
 *     { wordingOverride, manualShortcut, extraHints[], catchUpTask? }
 *
 *   RecommendationResponse:
 *     { wordingOverride, confidenceOverride, reasonCards[], fallbackMode }
 *
 *   TodayResponse:
 *     { primaryTaskOverride, addedTasks[], urgencyEscalation, wordingOverride }
 *
 *   ListingResponse:
 *     { freshnessBadgeTier, completenessPrompt, highlightFields[] }
 *
 * Responses are ADDITIVE — callers merge them with their
 * existing UI state. Nothing here writes directly to the DOM or
 * mutates caller state.
 */

const EMPTY = Object.freeze({});

/**
 * applyRecoveryActionToOnboarding — consume an onboarding
 * ActionabilityPlan. Accepts null (returns empty response).
 */
export function applyRecoveryActionToOnboarding(plan) {
  if (!plan || plan.appliesTo !== 'onboarding') return { ...EMPTY };
  const out = { reasonTags: [plan.actionKey] };

  if (plan.actionType === 'ui_recovery' && plan.actionKey === 'show_manual_location_shortcut') {
    out.manualShortcut = { visible: true, prominence: plan.priority };
  }
  if (plan.actionType === 'wording_change' && plan.actionKey === 'soften_location_copy') {
    out.wordingOverride = { location: { tier: plan.payload?.tier || 'low' } };
  }
  return out;
}

/**
 * applyRecoveryActionToRecommendations — consume a recommendation
 * ActionabilityPlan.
 */
export function applyRecoveryActionToRecommendations(plan) {
  if (!plan || plan.appliesTo !== 'recommendation') return { ...EMPTY };
  const out = { reasonTags: [plan.actionKey] };

  if (plan.actionType === 'confidence_downgrade') {
    out.confidenceOverride = { targetTier: plan.payload?.targetTier || 'medium' };
  }
  if (plan.actionType === 'explanation_card') {
    out.reasonCards = [{ key: 'why_these_crops', prominence: plan.priority }];
  }
  if (plan.actionType === 'ui_recovery' && plan.actionKey === 'offer_manual_crop_search') {
    out.fallbackMode = 'manual_crop_search';
  }
  return out;
}

/**
 * applyRecoveryActionToToday — consume a Today ActionabilityPlan.
 */
export function applyRecoveryActionToToday(plan) {
  if (!plan || plan.appliesTo !== 'today') return { ...EMPTY };
  const out = { reasonTags: [plan.actionKey] };

  if (plan.actionType === 'catch_up_task') {
    out.addedTasks = [{
      kind: 'catch_up',
      escalation: plan.payload?.escalation || 'soft',
      priority: plan.priority,
    }];
  }
  if (plan.actionType === 'wording_change' && plan.actionKey === 'simplify_task_wording') {
    out.wordingOverride = { task: { tier: plan.payload?.tier || 'low' } };
  }
  if (plan.actionType === 'ui_recovery' && plan.actionKey === 'escalate_urgency_after_repeat') {
    out.urgencyEscalation = 'high';
  }
  return out;
}

/**
 * applyRecoveryActionToListings — consume a listing
 * ActionabilityPlan.
 */
export function applyRecoveryActionToListings(plan) {
  if (!plan || plan.appliesTo !== 'listing') return { ...EMPTY };
  const out = { reasonTags: [plan.actionKey] };

  if (plan.actionType === 'listing_nudge') {
    out.completenessPrompt = {
      fields: plan.payload?.fields || [],
      prominence: plan.priority,
    };
    out.highlightFields = plan.payload?.fields || [];
  }
  if (plan.actionType === 'wording_change' && plan.actionKey === 'mark_listing_as_aging') {
    out.freshnessBadgeTier = plan.payload?.tier || 'low';
  }
  return out;
}

/**
 * applyRecoveryPlan — dispatch helper. Takes the full object
 * returned by buildActionabilityPlan() and returns a map of
 * per-surface responses.
 *
 *   {
 *     onboarding:      <OnboardingResponse>,
 *     recommendation:  <RecommendationResponse>,
 *     today:           <TodayResponse>,
 *     listing:         <ListingResponse>,
 *   }
 */
export function applyRecoveryPlan(fullPlan) {
  const surfaces = fullPlan?.surfaces || {};
  return {
    onboarding:     applyRecoveryActionToOnboarding(surfaces.onboarding),
    recommendation: applyRecoveryActionToRecommendations(surfaces.recommendation),
    today:          applyRecoveryActionToToday(surfaces.today),
    listing:        applyRecoveryActionToListings(surfaces.listing),
    meta: {
      hasAnyAction:    !!fullPlan?.hasAnyAction,
      highestPriority: fullPlan?.highestPriority ?? null,
      contextKey:      fullPlan?.contextKey ?? null,
    },
  };
}

export const _internal = { EMPTY };
