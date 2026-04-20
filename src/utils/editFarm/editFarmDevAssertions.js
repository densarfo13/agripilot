/**
 * editFarmDevAssertions.js — §10 warnings for the Edit Farm flow.
 *
 * All assertions are production-silent pure helpers.
 */

const TAG = '[farroway.editFarm]';

function isDev() {
  if (typeof window === 'undefined') return false;
  const env = (typeof process !== 'undefined' && process.env && process.env.NODE_ENV)
    || 'development';
  return env !== 'production';
}

function warn(reason, details = {}) {
  if (!isDev()) return;
  // eslint-disable-next-line no-console
  console.warn(TAG, reason, { ...details, at: new Date().toISOString() });
}

/**
 * §10: warn if an edit route renders an onboarding component.
 * Consumer passes the module path it's about to render.
 */
export function assertEditRouteNotOnboarding(modulePath) {
  if (!isDev()) return;
  if (typeof modulePath !== 'string' || !modulePath) return;
  const onboardingRx = /\/(onboarding|fastOnboarding)\//i;
  if (!onboardingRx.test(modulePath)) return;
  warn('edit route renders onboarding component', { modulePath });
}

/** §10: warn if a step indicator is shown inside the edit flow. */
export function assertNoStepIndicatorInEdit(hasStepIndicator) {
  if (!isDev()) return;
  if (!hasStepIndicator) return;
  warn('step indicator shown inside edit flow', {});
}

/**
 * §10: warn if a farm was RECREATED instead of updated. The
 * checker compares two farm ids — if they differ, the edit
 * path produced a new farm which is a regression.
 */
export function assertFarmWasUpdatedNotRecreated(originalId, returnedId) {
  if (!isDev()) return;
  if (!originalId || !returnedId) return;
  if (originalId === returnedId) return;
  warn('farm was recreated instead of updated', { originalId, returnedId });
}

/**
 * §10: warn if the edit action reset onboarding state. Detects
 * forbidden keys sneaking into the patch payload.
 */
export function assertEditPatchHasNoOnboardingState(patch) {
  if (!isDev()) return;
  if (!patch || typeof patch !== 'object') return;
  const forbidden = ['farmerType', 'onboardingCompleted', 'hasSeenIntro',
                     'createdVia', 'onboardingPath'];
  const leaked = forbidden.filter((k) => k in patch);
  if (leaked.length === 0) return;
  warn('onboarding state reset from edit action', { leaked });
}

export const _internal = { TAG };
