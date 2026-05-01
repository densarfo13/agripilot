/**
 * OnboardingRouter — thin guard wrapping OnboardingV3.
 *
 * Why this file exists
 * ────────────────────
 * The U.S. experience-selector chooser at /onboarding/us-experience
 * is the spec'd front door for U.S. users — but that chooser only
 * fires if something redirects U.S. users to it. Modifying
 * OnboardingV3 directly is risky (it's a multi-step state machine
 * shipping in pilots today). This router runs ONCE on mount,
 * decides whether the user should see the chooser, and either
 * redirects or falls through to OnboardingV3 unchanged.
 *
 * Decision rules (per Final-Launch-Gaps spec §1)
 *
 *   IF feature flag `usExperienceSelection` is on
 *      AND a known country can be read for the user
 *      AND that country === 'United States'
 *      AND `userSelectedExperience` is NOT yet true
 *   THEN navigate('/onboarding/us-experience', { replace: true })
 *   ELSE render <OnboardingV3 /> verbatim.
 *
 * Country sources (in priority order):
 *   1. localStorage `farroway_user_profile.country`
 *   2. localStorage `farroway_active_farm.country`
 *   3. URL search param `?country=`  (deep-link override)
 *
 * No country read means "user hasn't told us yet" — V3's first
 * step asks for it, so we let V3 handle the choice. The chooser
 * fires later via the same router after V3 saves the country to
 * the profile, OR via an explicit deep link.
 *
 * Strict-rule audit
 *   • Pure render — never throws.
 *   • One redirect per mount; flag-off path is identical to today.
 *   • Persistence in `farroway_user_profile` follows the spec's
 *     §1 keys: `country`, `experience`, `farmType`,
 *     `userSelectedExperience`. The chooser writes these on
 *     completion (already shipped in cde1422).
 */

import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { isFeatureEnabled } from '../../config/features.js';

const OnboardingV3 = lazy(() => import('./OnboardingV3.jsx'));

const PROFILE_KEY     = 'farroway_user_profile';
const ACTIVE_FARM_KEY = 'farroway_active_farm';

function _readJson(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch { return null; }
}

function _resolveCountry(searchParams) {
  // Deep-link override wins so QA can force the chooser.
  try {
    const fromQuery = searchParams?.get('country');
    if (fromQuery && typeof fromQuery === 'string') return fromQuery;
  } catch { /* ignore */ }
  const profile = _readJson(PROFILE_KEY);
  if (profile?.country) return profile.country;
  const farm = _readJson(ACTIVE_FARM_KEY);
  if (farm?.country) return farm.country;
  return null;
}

function _hasSelectedExperience() {
  const profile = _readJson(PROFILE_KEY);
  return !!(profile && profile.userSelectedExperience === true);
}

export default function OnboardingRouter() {
  const navigate = useNavigate();
  const location = useLocation();

  // Resolve once on mount. Subsequent visits to /onboarding (e.g.
  // a user who manually backs out of the chooser) re-run the
  // decision via the new mount.
  const params = useMemo(() => {
    try { return new URLSearchParams(location?.search || ''); }
    catch { return new URLSearchParams(); }
  }, [location?.search]);

  const country = useMemo(() => _resolveCountry(params), [params]);
  const flagOn  = isFeatureEnabled('usExperienceSelection');
  const alreadyChose = _hasSelectedExperience();

  // We render after the redirect decision — `decided` flips false
  // for the brief frame the navigate is queued, so OnboardingV3
  // doesn't flash before the bounce.
  const [decided, setDecided] = useState(false);

  useEffect(() => {
    let shouldBounce = false;
    if (flagOn && country === 'United States' && !alreadyChose) {
      shouldBounce = true;
    }
    if (shouldBounce) {
      try { navigate('/onboarding/us-experience', { replace: true }); }
      catch { setDecided(true); /* fall through to V3 */ }
    } else {
      setDecided(true);
    }
  }, [flagOn, country, alreadyChose, navigate]);

  if (!decided) return null;
  return (
    <Suspense fallback={null}>
      <OnboardingV3 />
    </Suspense>
  );
}
