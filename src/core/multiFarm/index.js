/**
 * src/core/multiFarm/index.js — import surface for the
 * multi-farm + find-best-crop integration helpers.
 */

export {
  resolveFindBestCropRoute,
  hasMinimumFarmForRec,
  destinationToUrl,
} from './findBestCropRoute.js';

export {
  resolveProfileCompletionRoute,
  routeToUrl,
} from './profileCompletionRoute.js';

export {
  buildCropFitAnswersFromFarm,
  hasEnoughForRecommendations,
} from './farmToCropFitAnswers.js';

export {
  buildRecommendationContext,
  normalizeRecommendationResult,
  rankRecommendations,
} from './recommendationContext.js';

export {
  assertFindBestCropNotOnboarding,
  assertNewFarmNotOverwrite,
  assertEditFarmNotOnboarding,
  assertRecommendationsHaveFarmId,
  assertCurrentFarmIdSwitched,
  assertDownstreamRecomputed,
  assertFarmsHaveDistinctIdentities,
} from './multiFarmDevAssertions.js';
