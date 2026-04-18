/**
 * onboardingImportedFarmers — post-import consent + activation hook.
 *
 * Spec §10: we DO NOT auto-message farmers on every import. A partner
 * must explicitly enable onboarding SMS. When enabled we send a short
 * localized invite; if not, the farmer stays `imported_pending_activation`
 * until they self-activate the app.
 *
 * Spec §13: if a crop is provided on import we can pre-assign region
 * and stage, so the first task is ready once the farmer activates.
 */
import { resolveRegionProfile } from '../../engine/regionProfiles.js';
import { getCropDefinition } from '../../engine/cropDefinitions.js';

/**
 * Derive the bootstrap state an imported farmer should wake up in.
 * Pure — no side effects.
 */
export function derivePostImportBootstrap(payload) {
  const hasCrop = !!payload.crop && !!getCropDefinition(payload.crop);
  const region = resolveRegionProfile(payload.country);
  return {
    needsCropSelection: !hasCrop,
    crop: hasCrop ? payload.crop : null,
    initialStage: hasCrop ? 'land_preparation' : null,
    regionId: region?.id || 'default',
    // First task is NOT eagerly generated here — the live weather +
    // timing engine runs when the farmer actually opens the app. We
    // just mark the record ready.
    readyForFirstTask: hasCrop,
  };
}

/**
 * Trigger onboarding for one newly-created farmer. Returns true if a
 * message was sent, false if skipped.
 *
 * @param {Object} args
 * @param {string} args.farmerId
 * @param {Object} args.payload         - full farmer payload
 * @param {Function} args.sendOnboarding - async (farmerId, payload, bootstrap) => any
 */
export async function triggerImportedFarmerOnboarding({ farmerId, payload, sendOnboarding }) {
  if (typeof sendOnboarding !== 'function') return false;
  const bootstrap = derivePostImportBootstrap(payload);
  await sendOnboarding(farmerId, payload, bootstrap);
  return true;
}

/**
 * Consent states the import layer recognises (spec §10).
 */
export const CONSENT_STATE = Object.freeze({
  PENDING_ACTIVATION: 'imported_pending_activation',
  ACTIVE: 'imported_active',
  OPTED_OUT: 'imported_opted_out',
});
