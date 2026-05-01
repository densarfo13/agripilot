/**
 * AdaptiveFarmSetup — wrapper at /farm/new that picks the right
 * setup form by experience.
 *
 * Decision rules (Adaptive setup §1)
 *
 *   IF feature flag `adaptiveFarmGardenSetup` is on
 *      AND any of:
 *        • profile.experience === 'backyard'
 *        • profile.farmType   === 'backyard' OR 'home_garden'
 *        • localStorage 'farroway_experience' === 'backyard'
 *   THEN render <GardenSetupForm />
 *   ELSE render <NewFarmScreen /> (existing 824-line form,
 *        untouched).
 *
 * Returning users
 *   The wrapper does NOT redirect anyone away from the form. The
 *   "send completed users back to Home" rule lives in
 *   ProtectedRoute / sessionBootstrap; this page is the
 *   add-another-farm/garden surface, so it always renders the
 *   form when the user navigates here directly.
 *
 * Save persistence
 *   Reuses the existing farrowayLocal `saveFarm` helper for the
 *   garden path so the canonical localStorage shape stays
 *   identical to what NewFarmScreen writes. No new storage
 *   format introduced.
 *
 * Strict-rule audit
 *   • No edits to NewFarmScreen.jsx — it ships verbatim and is
 *     reachable by directly importing it OR by flipping the
 *     adaptive flag off.
 *   • Lazy imports keep the GardenSetupForm out of bundles
 *     where the user never reaches the wrapper's backyard branch.
 *   • Defensive read of profile + active-farm — the page must
 *     work even when the user has no profile yet.
 */

import { Suspense, lazy, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { isFeatureEnabled } from '../config/features.js';
import {
  saveFarm as farrowaySaveFarm,
  setActiveFarmId as farrowaySetActiveFarmId,
} from '../store/farrowayLocal.js';

const NewFarmScreen     = lazy(() => import('./NewFarmScreen.jsx'));
const GardenSetupForm   = lazy(() => import('../components/farm/GardenSetupForm.jsx'));

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

function _readExperienceHint() {
  // 1. profile fields
  const profile = _readJson(PROFILE_KEY);
  if (profile?.experience === 'backyard') return 'backyard';
  if (profile?.farmType === 'backyard' || profile?.farmType === 'home_garden') return 'backyard';
  // 2. dedicated top-level slot written by BackyardOnboarding +
  //    USExperienceSelection chooser
  try {
    const raw = typeof localStorage !== 'undefined'
      ? localStorage.getItem('farroway_experience') : null;
    const v = raw ? JSON.parse(raw) : null;
    if (v === 'backyard') return 'backyard';
    if (v === 'farm')     return 'farm';
  } catch { /* ignore */ }
  // 3. active farm farmType (returning user with one set)
  const farm = _readJson(ACTIVE_FARM_KEY);
  if (farm?.farmType === 'backyard' || farm?.farmType === 'home_garden') return 'backyard';
  return 'farm';
}

export default function AdaptiveFarmSetup() {
  const navigate = useNavigate();
  const flagOn = isFeatureEnabled('adaptiveFarmGardenSetup');
  const experience = useMemo(() => _readExperienceHint(), []);

  const initialProfile = useMemo(() => _readJson(PROFILE_KEY) || {}, []);

  const onGardenSaved = useCallback(async (garden) => {
    // Mirror into the canonical local store so existing surfaces
    // (BottomTabNav, ProtectedRoute, sessionBootstrap) all see
    // the new garden.
    let stored = null;
    try {
      stored = farrowaySaveFarm(garden);
      if (stored?.id) {
        try { farrowaySetActiveFarmId(stored.id); } catch { /* ignore */ }
      }
    } catch { /* fall through to spec keys below */ }
    // Spec keys — same shape BackyardOnboarding writes so
    // returning-user detection stays consistent.
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('farroway_experience',           JSON.stringify('backyard'));
        localStorage.setItem('farroway_onboarding_completed', 'true');
        localStorage.setItem('farroway_active_farm',          JSON.stringify(stored || garden));
      }
    } catch { /* ignore quota / private mode */ }
    try { navigate('/home', { replace: true }); }
    catch {
      try { navigate('/dashboard', { replace: true }); }
      catch { /* ignore */ }
    }
  }, [navigate]);

  const onCancel = useCallback(() => {
    try { navigate(-1); } catch { /* ignore */ }
  }, [navigate]);

  // Off-flag: render the existing screen verbatim. Pilots see no
  // change.
  if (!flagOn) {
    return (
      <Suspense fallback={null}>
        <NewFarmScreen />
      </Suspense>
    );
  }

  if (experience === 'backyard') {
    return (
      <Suspense fallback={null}>
        <GardenSetupForm
          initialProfile={initialProfile}
          onSaved={onGardenSaved}
          onCancel={onCancel}
        />
      </Suspense>
    );
  }

  // Farm experience → existing form unchanged.
  return (
    <Suspense fallback={null}>
      <NewFarmScreen />
    </Suspense>
  );
}
