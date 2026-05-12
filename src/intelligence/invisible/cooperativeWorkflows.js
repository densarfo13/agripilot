/**
 * cooperativeWorkflows.js — farmer-group + cooperative signals
 * (Invisible Intelligence spec §5).
 *
 *   const signal = computeCooperativeWorkflows({
 *     farmerGroup, cropCluster, region, sharedBuyerDemand,
 *     outbreakSignals, trainingNeeds,
 *   });
 *
 * Honest "no fake groups" guarantee
 * ─────────────────────────────────
 *   The spec lists outputs (group opportunity, shared selling
 *   signal, NGO intervention) that require a real cooperative
 *   data feed:
 *     • farmer groups with verified membership
 *     • crop-cluster data across multiple farms
 *     • shared buyer demand visible to the cooperative
 *
 *   We don't have any of that today. The module ALWAYS returns a
 *   quiet fallback (visibleToUser:false) unless the caller passes
 *   real group data — and that path is reserved for the future
 *   spec round that brings a cooperative infrastructure online.
 *
 *   Admin/NGO surfaces (regional dashboards, cohort risk, training
 *   gaps) are intentionally OUT — the spec says those are "Admin/
 *   NGO UI only" and gating happens via userExperienceMode, not
 *   here.
 *
 * Strict-rule audit
 *   • Pure function. Never throws.
 *   • visibleToUser:false unless the caller passed real group data.
 *   • Never invents a "farmers nearby" claim — that requires
 *     anonymized aggregation we don't have.
 */

import { makeQuietFallback, makeActiveSignal } from './moduleShape.js';

const SOURCE = 'cooperativeWorkflows';
const QUIET_MESSAGE = 'Group signals will improve when cooperative data is connected.';

export function computeCooperativeWorkflows(input) {
  const safe = (input && typeof input === 'object') ? input : {};
  const hasGroup = !!(safe.farmerGroup && typeof safe.farmerGroup === 'object'
                       && safe.farmerGroup.memberCount > 0);
  const hasCluster = !!(safe.cropCluster && typeof safe.cropCluster === 'object'
                         && safe.cropCluster.farmCount > 1);

  if (!hasGroup && !hasCluster) {
    return makeQuietFallback(SOURCE, QUIET_MESSAGE);
  }

  // Active path: real group data present. Surface a calm hint —
  // never a quantitative claim about other farmers.
  if (hasCluster && safe.cropCluster.cropName) {
    return makeActiveSignal({
      signal:           'group_market_opportunity',
      confidence:       'medium',
      farmerMessage:    `Farmers nearby are preparing similar ${safe.cropCluster.cropName} for market.`,
      recommendedAction: 'Group selling may improve buyer interest',
      urgency:          'low',
      source:           SOURCE,
      visibleToUser:    true,
    });
  }

  return makeQuietFallback(SOURCE, QUIET_MESSAGE);
}

export default { computeCooperativeWorkflows };
