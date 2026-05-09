/**
 * trust — INTERNAL trust-signals engine (spec §7).
 *
 *   estimateTrustSignals(context) → TrustSignals
 *
 * RULES
 *   • Returns ONLY internal flags + a calm verification state.
 *   • Verification state is the ONLY thing the farmer-facing
 *     adapter is allowed to surface from this module.
 *   • internalRiskFlags + recommendedModerationAction stay
 *     server-side / admin-only.
 *
 * FORBIDDEN COPY (spec §7)
 *   "Low Trust", "Fraud score", "Suspicious", "Risky farmer".
 *   None of the strings produced here can contain those words —
 *   the adapter's last-resort filter (forbiddenWordingFilter)
 *   would strip them anyway, but we never emit them in the
 *   first place.
 */

import { TRUST_FLAG, VERIFICATION_STATE } from './intelligenceTypes.js';

/**
 * @param {import('./intelligenceTypes.js').IntelligenceContext} context
 * @returns {import('./intelligenceTypes.js').TrustSignals}
 */
export function estimateTrustSignals(context) {
  if (!context || typeof context !== 'object') {
    return _trust({
      verificationState: VERIFICATION_STATE.IN_PROGRESS,
      internalRiskFlags: [],
      recommendedModerationAction: 'await_more_data',
    });
  }

  const flags = [];

  // Duplicate listings — same crop + same week → flag.
  const listings = Array.isArray(context.produceListings) ? context.produceListings : [];
  if (listings.length >= 2) {
    const seen = new Map();
    for (const lst of listings) {
      if (!lst || typeof lst !== 'object') continue;
      const key = String((lst.crop || '') + '|' + (lst.weekIso || lst.week || ''));
      if (seen.has(key)) {
        flags.push(TRUST_FLAG.DUPLICATE_LISTING);
        break;
      }
      seen.set(key, true);
    }
  }

  // Impossible quantity — heuristic ceiling. A 1-acre farm
  // listing 100,000 kg of cassava in one week is a data-entry
  // bug or a bad-faith listing. Threshold is generous so a
  // legitimate large-farm listing isn't flagged.
  for (const lst of listings) {
    if (!lst || typeof lst !== 'object') continue;
    const qty = Number(lst.quantityKg ?? lst.quantity);
    if (Number.isFinite(qty) && qty > 50_000) {
      flags.push(TRUST_FLAG.IMPOSSIBLE_QUANTITY);
      break;
    }
  }

  // Repeated upload failures — surfaces as a moderation hint
  // when the user has tried + failed to upload a verification
  // photo many times in a short window.
  const uploadFailures = Number(context.uploadFailures);
  if (Number.isFinite(uploadFailures) && uploadFailures >= 5) {
    flags.push(TRUST_FLAG.REPEATED_UPLOAD_FAILURE);
  }

  // Inconsistent region — region in profile vs. recent IP /
  // weather location differ wildly (>500 km). The intelligence
  // layer can't compute distance without geocodes; we accept a
  // pre-computed `regionMismatch` flag from the caller.
  if (context.regionMismatch === true) {
    flags.push(TRUST_FLAG.INCONSISTENT_REGION);
  }

  // Suspicious buyer requests — bulk requests for many farmers
  // in a short window from the same buyer.
  const buyerInterest = Array.isArray(context.buyerInterest) ? context.buyerInterest : [];
  if (buyerInterest.length >= 20) {
    flags.push(TRUST_FLAG.SUSPICIOUS_BUYER_REQUEST);
  }

  // Missing verification — no verification artefacts at all.
  const hasVerification =
    !!(context.verification && (context.verification.idVerified || context.verification.kycComplete));
  if (!hasVerification) {
    flags.push(TRUST_FLAG.MISSING_VERIFICATION);
  }

  // Frequent listing edits — over-tweaking a listing can be
  // either uncertainty or a price-fishing pattern. Flag for
  // moderation review at 10+ edits in a 24h window.
  const recentEdits = Number(context.listingEditsLast24h);
  if (Number.isFinite(recentEdits) && recentEdits >= 10) {
    flags.push(TRUST_FLAG.FREQUENT_LISTING_EDITS);
  }

  // Verification-state ladder. The user-facing copy in the
  // adapter is calm + actionable regardless of which state we
  // return.
  let verificationState = VERIFICATION_STATE.IN_PROGRESS;
  if (hasVerification && flags.length === 0) {
    verificationState = VERIFICATION_STATE.COMPLETE;
  }
  if (hasVerification && context.verification && context.verification.enhanced) {
    verificationState = VERIFICATION_STATE.ENHANCED;
  }

  // Recommended moderation action — INTERNAL only. Never reaches
  // the farmer UI.
  let recommendedModerationAction = 'none';
  if (flags.includes(TRUST_FLAG.IMPOSSIBLE_QUANTITY)
   || flags.includes(TRUST_FLAG.SUSPICIOUS_BUYER_REQUEST)) {
    recommendedModerationAction = 'manual_review';
  } else if (flags.length >= 2) {
    recommendedModerationAction = 'soft_review';
  }

  return _trust({
    verificationState,
    internalRiskFlags: flags,
    recommendedModerationAction,
  });
}

function _trust(o) {
  return Object.freeze({
    verificationState:           String(o.verificationState),
    internalRiskFlags:           Object.freeze([...(o.internalRiskFlags || [])]),
    recommendedModerationAction: String(o.recommendedModerationAction || 'none'),
  });
}

/**
 * Map an internal verification state to calm farmer-facing copy.
 * The adapter calls this when it needs to render the only
 * trust-related affordance allowed in farmer UI: a positive
 * verification chip + an action that improves it.
 */
export function farmerVerificationCopy(verificationState) {
  switch (verificationState) {
    case VERIFICATION_STATE.COMPLETE:
      return {
        title:       'Verification complete',
        message:     'Your profile is verified. Buyers see this as trust.',
        actionLabel: '',
        actionRoute: '',
      };
    case VERIFICATION_STATE.ENHANCED:
      return {
        title:       'Enhanced verification',
        message:     'You’re fully verified. Thank you for keeping the marketplace safe.',
        actionLabel: '',
        actionRoute: '',
      };
    case VERIFICATION_STATE.IN_PROGRESS:
    default:
      return {
        title:       'Verification in progress',
        message:     'Complete your profile to improve buyer visibility.',
        actionLabel: 'Add a photo',
        actionRoute: '/my-farm',
      };
  }
}

const _module = { estimateTrustSignals, farmerVerificationCopy };
export default _module;
