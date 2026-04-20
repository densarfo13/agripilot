/**
 * multiFarmDevAssertions.js — §13 development-only warnings
 * for the multi-farm + find-best-crop integration.
 *
 * All assertions are pure, silent in production, and log
 * console.warn with a stable tag when the rule is broken.
 */

const TAG = '[farroway.multiFarm]';

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

/** §13: Find My Best Crop routed to onboarding for an existing user. */
export function assertFindBestCropNotOnboarding(isExistingUser, destinationPath) {
  if (!isDev()) return;
  if (!isExistingUser) return;
  if (typeof destinationPath !== 'string') return;
  if (!/\/onboarding\//.test(destinationPath)) return;
  warn('Find My Best Crop routed to onboarding for existing user', { destinationPath });
}

/** §13: Add New Farm overwrote the current farm instead of creating a second. */
export function assertNewFarmNotOverwrite(prevCurrentFarmId, farmsBefore, farmsAfter) {
  if (!isDev()) return;
  if (!Array.isArray(farmsBefore) || !Array.isArray(farmsAfter)) return;
  // After a successful create, there should be ONE MORE farm.
  if (farmsAfter.length <= farmsBefore.length) {
    warn('Add New Farm overwriting current farm', {
      before: farmsBefore.length, after: farmsAfter.length, prevCurrentFarmId,
    });
  }
}

/** §13: Edit Farm routed to onboarding. */
export function assertEditFarmNotOnboarding(destinationPath) {
  if (!isDev()) return;
  if (typeof destinationPath !== 'string') return;
  if (!/\/onboarding\//.test(destinationPath)) return;
  warn('Edit Farm routed to onboarding', { destinationPath });
}

/** §13: recommendations called without farmId for existing user flow. */
export function assertRecommendationsHaveFarmId(isExistingUser, farmId) {
  if (!isDev()) return;
  if (!isExistingUser) return;
  if (farmId) return;
  warn('recommendations called without farmId for existing user flow', {});
}

/** §13: currentFarmId not updated after switch. */
export function assertCurrentFarmIdSwitched(expectedId, actualId) {
  if (!isDev()) return;
  if (!expectedId) return;
  if (expectedId === actualId) return;
  warn('currentFarmId not updated after switch', { expected: expectedId, actual: actualId });
}

/**
 * §13: downstream recompute not triggered after farm create/edit/switch.
 * Consumer passes a small object describing what it intended
 * to refresh vs. what actually ran.
 */
export function assertDownstreamRecomputed(action, didRefresh) {
  if (!isDev()) return;
  if (!action) return;
  if (didRefresh) return;
  warn('downstream recompute not triggered after farm action', { action });
}

/**
 * §13: multiple farms sharing the same mutable state object.
 * Consumer passes the current farms array; we check for
 * duplicate object references (which would mean edits to one
 * accidentally hit another).
 */
export function assertFarmsHaveDistinctIdentities(farms) {
  if (!isDev()) return;
  if (!Array.isArray(farms) || farms.length < 2) return;
  const seen = new WeakSet();
  const dupes = [];
  for (const f of farms) {
    if (!f || typeof f !== 'object') continue;
    if (seen.has(f)) dupes.push(f.id || '(unknown)');
    else seen.add(f);
  }
  if (dupes.length > 0) {
    warn('multiple farms sharing same mutable state object', { dupes });
  }
}

export const _internal = { TAG };
