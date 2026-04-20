/**
 * FastOnboardingRoute — the route-level wrapper that bridges
 * FastOnboardingFlow into the existing V2 profile system.
 *
 * Responsibilities:
 *   • supplies language, country list, translator, recommender
 *   • handles onLanguageChange by delegating to AppPrefs
 *   • handles onExistingFarmer by navigating to the v2 farmer-type page
 *   • on onFinish(farm), saves a minimal profile to the server
 *     (so ProfileGuard clears) and navigates straight to /dashboard
 *
 * This is the ONLY place the fast flow's frozen farm object is
 * translated into the legacy profile shape. Farm size is defaulted
 * to a small acre value so ProfileGuard passes — progressive
 * onboarding later refines it.
 */

import { useCallback, useMemo } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import FastOnboardingFlow from './FastOnboardingFlow.jsx';
import { useTranslation } from '../../../i18n/index.js';
import { useAppPrefs } from '../../../context/AppPrefsContext.jsx';
import { useProfile } from '../../../context/ProfileContext.jsx';
import { useAuth } from '../../../context/AuthContext.jsx';
import {
  isFirstTimeFarmer,
  warnFirstTimeRoutingRegression,
  FIRST_TIME_WARN,
} from '../../../utils/fastOnboarding/index.js';
import { productionDetectFn } from '../../../lib/location/productionDetectFn.js';
import { recommendCropsForScreen } from '../../../lib/recommendations/cropRecommendationEngine.js';

// ─── Minimal country list resolved once per render ──────────
// Shape: [{ code, name }]. Sourced from i18n-iso-countries which
// is already a dependency used by the legacy ProfileSetup.
import isoCountries from 'i18n-iso-countries';
import isoEn from 'i18n-iso-countries/langs/en.json';
isoCountries.registerLocale(isoEn);

function buildCountryList() {
  try {
    const map = isoCountries.getNames('en', { select: 'official' });
    return Object.entries(map)
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

// ─── Minimum profile payload derived from fast-flow state ───
// We save JUST enough to satisfy isProfileComplete so the guard
// clears. Progressive onboarding refines everything else later.
function buildMinimumProfile({ farm, fastState, authUser }) {
  const setup = (fastState && fastState.setup) || {};
  const crop  = (farm && farm.crop) || fastState?.selectedCrop || 'MAIZE';
  const fallbackName =
    (authUser && (authUser.displayName || authUser.name)) ||
    (authUser && authUser.email && String(authUser.email).split('@')[0]) ||
    'Farmer';

  return {
    farmerName:     fallbackName,
    farmName:       'My Farm',
    country:        setup.country || '',
    location:       setup.city || setup.stateCode || setup.country || '',
    // Placeholder size so isProfileComplete clears; progressive
    // onboarding prompts for the real acreage later.
    size:           1,
    sizeUnit:       'ACRE',
    cropType:       String(crop).toUpperCase(),
    sizeDefaulted:  true,
    onboardingPath: 'fast',
  };
}

/**
 * defaultRecommender — v1 rule-based recommender wired to the
 * shared engine in src/lib/recommendations/cropRecommendationEngine.js.
 *
 * Reads the live onboarding state (country, state, farmerType) and
 * returns 3–5 crops with confidence + planting window + note fields
 * that CropRecommendationScreen knows how to render. When the
 * country is unsupported, the engine returns a general global list
 * and flags `isGeneral: true` so the UI can clarify that the picks
 * are generic.
 *
 * Kept synchronous-async so the existing getRecommendations contract
 * (Promise<crops>) is preserved — no behaviour change for the screen.
 */
async function defaultRecommender(state) {
  const setup = (state && state.setup) || {};
  return recommendCropsForScreen({
    country:    setup.country || null,
    state:      setup.stateCode || null,
    farmerType: (state && state.farmerType) || null,
    limit:      5,
  });
}

// Location detection is delegated to the shared helper at
// src/lib/location/productionDetectFn.js so every onboarding flow
// (fast, v2, future) hits the exact same pipeline:
//   getBrowserCoords → reverseGeocode (provider chain) → round +
//   cache. See that file for cache TTL + privacy rounding details.

export default function FastOnboardingRoute() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { language, setLanguage } = useAppPrefs();
  const { profile, farms, saveProfile } = useProfile();
  const { user: authUser } = useAuth();

  // ─── Guard: if they're not a first-time farmer, don't show
  // them the fast flow again — send them home. ───────────────
  const firstTime = useMemo(
    () => isFirstTimeFarmer({ profile, farms }),
    [profile, farms],
  );

  if (!firstTime) return <Navigate to="/dashboard" replace />;

  const countries = useMemo(buildCountryList, []);

  const handleExistingFarmer = useCallback(() => {
    // Existing farmers skip the fast flow and take the v2 path.
    navigate('/onboarding/farmer-type', { replace: true });
  }, [navigate]);

  const handleLanguageChange = useCallback((lang) => {
    if (typeof setLanguage === 'function' && lang) setLanguage(lang);
  }, [setLanguage]);

  const handleFinish = useCallback(async (farm) => {
    if (!farm) {
      warnFirstTimeRoutingRegression(
        FIRST_TIME_WARN.FLOW_ENDED_ON_SAVE_PROFILE,
        { where: 'FastOnboardingRoute.handleFinish' },
      );
      navigate('/dashboard', { replace: true });
      return;
    }
    try {
      // Read the latest fast state for country/language context.
      let fastState = null;
      try {
        const raw = typeof window !== 'undefined'
          ? window.localStorage.getItem('farroway.fastOnboarding.v1')
          : null;
        fastState = raw ? JSON.parse(raw) : null;
      } catch { fastState = null; }

      const payload = buildMinimumProfile({ farm, fastState, authUser });
      await saveProfile(payload);
    } catch (err) {
      // Even if save fails, still navigate to Home — the fast flow
      // already persisted locally and progressive onboarding can retry.
      // eslint-disable-next-line no-console
      console.warn('[farroway.fastOnboarding] profile save failed:', err?.message || err);
    } finally {
      navigate('/dashboard', { replace: true });
    }
  }, [authUser, navigate, saveProfile]);

  return (
    <FastOnboardingFlow
      t={t}
      initialLanguage={language || 'en'}
      countries={countries}
      detectFn={productionDetectFn}
      getRecommendations={defaultRecommender}
      getCropLabel={(c) => c}
      onFinish={handleFinish}
      onExistingFarmer={handleExistingFarmer}
      onLanguageChange={handleLanguageChange}
    />
  );
}
