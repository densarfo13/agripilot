/**
 * FastOnboardingFlow — the orchestrator. Renders whichever of
 * the five screens is current, persists state between transitions,
 * auto-creates the farm on crop selection, and hands off to Home
 * after the transition animation.
 *
 * Contract:
 *   • total flow < 60 seconds from first open to first task
 *   • no blocking on detection — skip is always possible
 *   • "existing farmer" route delegates to caller (`onExistingFarmer`)
 *   • Home handoff is a single `onFinish(farm)` callback
 */

import { useEffect, useState } from 'react';
import IntroScreen from './IntroScreen.jsx';
import SetupScreen from './SetupScreen.jsx';
import FarmerTypeScreen from './FarmerTypeScreen.jsx';
import FirstTimeEntryScreen from './FirstTimeEntryScreen.jsx';
import CropRecommendationScreen from './CropRecommendationScreen.jsx';
import TransitionScreen from './TransitionScreen.jsx';

import {
  FAST_STEPS,
  defaultFastState, loadFastState, saveFastState, patchFastState,
  getNextFastStep, resumeFastStep, routeForFarmerType,
  createFarmFromCrop,
} from '../../../utils/fastOnboarding/index.js';

export default function FastOnboardingFlow({
  t = null,
  initialLanguage = 'en',
  countries = [],
  detectFn = null,
  getRecommendations = null,
  getCropLabel = (c) => c,
  onFinish = null,            // (farm) ⇒ void  — called after transition
  onExistingFarmer = null,    // ()     ⇒ void  — route to v2 / home
  onLanguageChange = null,
}) {
  const [state, setState] = useState(() => {
    const persisted = loadFastState();
    if (persisted) {
      const resume = resumeFastStep(persisted);
      return { ...persisted, currentStep: resume || FAST_STEPS.TRANSITION };
    }
    return defaultFastState(initialLanguage);
  });

  // Auto-save every mutation (except initial hydration).
  useEffect(() => { saveFastState(state); }, [state]);

  const step = state.currentStep;

  function patch(p) {
    setState((prev) => patchFastState(prev, p));
  }

  function advance() {
    setState((prev) => {
      const next = getNextFastStep(prev);
      if (!next || next === prev.currentStep) return prev;
      return { ...prev, currentStep: next };
    });
  }

  // ─── Screen handlers ─────────────────────────────────
  function onIntroContinue() {
    patch({ hasSeenIntro: true });
    advance();
  }

  function onSetupContinue() { advance(); }

  function onFarmerTypeContinue() {
    const type = state.farmerType;
    if (type === 'existing' && typeof onExistingFarmer === 'function') {
      onExistingFarmer(state);
      return;
    }
    advance();
  }

  function onFirstTimeContinue() { advance(); }

  function onCropSelect(crop) {
    patch({ selectedCrop: crop });
  }

  function onCropContinue() {
    // Auto-create the farm NOW — before transition — so the
    // transition screen has something to prepare.
    setState((prev) => {
      if (prev.farm?.created) {
        return { ...prev, currentStep: FAST_STEPS.TRANSITION };
      }
      const farm = createFarmFromCrop(prev.selectedCrop, {
        userId: prev.userId || null,
        countryCode: prev.setup?.country || null,
        stateCode:   prev.setup?.stateCode || null,
        locationSource: prev.setup?.locationSource || null,
      });
      return { ...prev, farm, currentStep: FAST_STEPS.TRANSITION };
    });
  }

  function onTransitionComplete() {
    setState((prev) => {
      const next = { ...prev, completedAt: Date.now() };
      return next;
    });
    // Hand off to Home. We pass the farm so the caller can
    // render the first task immediately.
    if (typeof onFinish === 'function') {
      onFinish(state.farm || null);
    }
  }

  // ─── Rendering ────────────────────────────────────────
  switch (step) {
    case FAST_STEPS.INTRO:
      return <IntroScreen t={t} onContinue={onIntroContinue} />;

    case FAST_STEPS.SETUP:
      return (
        <SetupScreen
          state={state}
          t={t}
          countries={countries}
          detectFn={detectFn}
          onPatch={(p) => {
            patch(p);
            if (p.setup?.language && typeof onLanguageChange === 'function') {
              onLanguageChange(p.setup.language);
            }
          }}
          onContinue={onSetupContinue}
        />
      );

    case FAST_STEPS.FARMER_TYPE:
      return (
        <FarmerTypeScreen
          state={state}
          t={t}
          onPatch={patch}
          onContinue={onFarmerTypeContinue}
        />
      );

    case FAST_STEPS.FIRST_TIME_ENTRY:
      return (
        <FirstTimeEntryScreen
          t={t}
          onContinue={onFirstTimeContinue}
        />
      );

    case FAST_STEPS.RECOMMENDATION:
      return (
        <CropRecommendationScreen
          state={state}
          t={t}
          getRecommendations={getRecommendations}
          getCropLabel={getCropLabel}
          onSelect={onCropSelect}
          onContinue={onCropContinue}
          onChangeLocation={() => setState(
            (prev) => ({ ...prev, currentStep: FAST_STEPS.SETUP }),
          )}
        />
      );

    case FAST_STEPS.TRANSITION:
      return (
        <TransitionScreen
          t={t}
          onComplete={onTransitionComplete}
        />
      );

    default:
      // Safe fallback — if the state got wedged, return to intro.
      return <IntroScreen t={t} onContinue={onIntroContinue} />;
  }
}

export { routeForFarmerType };
