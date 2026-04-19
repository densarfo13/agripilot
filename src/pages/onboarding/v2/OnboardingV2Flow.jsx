/**
 * OnboardingV2Flow — the orchestrator. Lives at a single route
 * (e.g. /onboarding or /setup) and renders whatever step the
 * useOnboardingState hook says is current.
 *
 * Dependency-injected: callers pass in the real detectFn,
 * countries list, recommendation resolver, crop label helper,
 * plan/task resolvers. This keeps the onboarding self-contained
 * while still being production-real.
 *
 * Usage:
 *   <OnboardingV2Flow
 *     t={t}
 *     onLanguageChange={(l) => setLanguage(l)}
 *     detectFn={detectBrowserGeo}
 *     countries={countries}
 *     statesForCountry={statesForCountry}
 *     getRecommendations={loadRecommendations}
 *     getCropLabel={getCropDisplayName}
 *     getImmediateTask={loadTodayTask}
 *     getPlanPreview={loadPlanPreview}
 *     onFinish={(route) => navigate(route)}
 *   />
 */

import useOnboardingState from '../../../hooks/useOnboardingState.js';
import { ONBOARDING_STEPS } from '../../../utils/onboardingV2/stepIds.js';
import { buildPostOnboardingRoute } from '../../../utils/onboardingV2/getNextOnboardingStep.js';

import WelcomePage         from './WelcomePage.jsx';
import LocationStepV2      from './LocationStepV2.jsx';
import GrowingTypeStep     from './GrowingTypeStep.jsx';
import ExperienceStepV2    from './ExperienceStepV2.jsx';
import SizeDetailsStep     from './SizeDetailsStep.jsx';
import RecommendationsStepV2 from './RecommendationsStepV2.jsx';
import CropConfirmStep     from './CropConfirmStep.jsx';
import FirstValueStep      from './FirstValueStep.jsx';

export default function OnboardingV2Flow({
  t = null,
  initialLanguage = 'en',
  onLanguageChange = null,
  detectFn = null,
  countries = [],
  statesForCountry = () => [],
  getRecommendations = null,
  getCropLabel = (c) => c,
  getPlantingStatus = null,
  getReasons = null,
  getImmediateTask = null,
  getPlanPreview = null,
  onFinish = null,
}) {
  const { state, step, mode, patch, next, back } = useOnboardingState({
    initialLanguage,
  });

  const commonProps = { state, patch, t, onBack: back, onNext: next };

  switch (step) {
    case ONBOARDING_STEPS.WELCOME:
      return (
        <WelcomePage
          state={state}
          t={t}
          onNext={next}
          onChangeLanguage={(l) => {
            patch({ language: l });
            if (typeof onLanguageChange === 'function') onLanguageChange(l);
          }}
        />
      );

    case ONBOARDING_STEPS.LOCATION:
      return (
        <LocationStepV2
          {...commonProps}
          detectFn={detectFn}
          countries={countries}
          statesForCountry={statesForCountry}
        />
      );

    case ONBOARDING_STEPS.GROWING_TYPE:
      return <GrowingTypeStep {...commonProps} />;

    case ONBOARDING_STEPS.EXPERIENCE:
      return <ExperienceStepV2 {...commonProps} />;

    case ONBOARDING_STEPS.SIZE_DETAILS:
      return <SizeDetailsStep {...commonProps} mode={mode} />;

    case ONBOARDING_STEPS.RECOMMENDATIONS:
      return (
        <RecommendationsStepV2
          {...commonProps}
          mode={mode}
          getRecommendations={getRecommendations}
          getCropLabel={getCropLabel}
        />
      );

    case ONBOARDING_STEPS.CROP_CONFIRM:
      return (
        <CropConfirmStep
          {...commonProps}
          getCropLabel={getCropLabel}
          getPlantingStatus={getPlantingStatus}
          getReasons={getReasons}
        />
      );

    case ONBOARDING_STEPS.FIRST_VALUE:
      return (
        <FirstValueStep
          state={state}
          t={t}
          onBack={back}
          getImmediateTask={getImmediateTask}
          getPlanPreview={getPlanPreview}
          onFinish={(route, content) => {
            // Let callers override by passing their own routing fn,
            // but default to the helper so missing `onFinish` props
            // don't dead-end the user.
            const resolved = buildPostOnboardingRoute(state, {
              immediateTask: content?.immediateTask || null,
            });
            if (typeof onFinish === 'function') {
              onFinish(route || resolved.route, content);
            } else if (typeof window !== 'undefined') {
              window.location.assign(route || resolved.route);
            }
          }}
        />
      );

    default:
      // If state got wedged, force a return to the start screen.
      return <WelcomePage state={state} t={t} onNext={next} />;
  }
}
