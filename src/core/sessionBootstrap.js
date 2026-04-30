/**
 * sessionBootstrap.js — safe load chain for Farroway session
 * state. Returns a stable status the caller can branch on so
 * the dashboard never renders against half-loaded data.
 *
 * Load order (spec §1):
 *   1. authenticated user
 *   2. user profile
 *   3. farms linked to user
 *   4. activeFarmId
 *   5. onboardingCompleted status
 *
 * Status values:
 *   'loading'                — at least one source is mid-flight
 *   'ready'                  — user + active farm + completed
 *   'needs_onboarding'       — user logged in but no farm yet
 *   'needs_farm_selection'   — user has farms but no active
 *                              one selected (very rare; the
 *                              repair pass usually fixes this)
 *   'error'                  — something threw; caller should
 *                              show the recovery boundary
 *
 * Strict-rule audit
 *   • Read-only — runs the repair pass exactly once on first
 *     pass-through, then re-reads. Never mutates auth state.
 *   • Trusts BACKEND user state when available; falls back to
 *     localStorage when the backend is unreachable so a flaky
 *     network never locks the farmer out.
 *   • Pure-ish — the React hook exposes the result; the
 *     classifier function below is fully pure for tests.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { repairFarrowaySession, _internal as REPAIR_INTERNAL } from '../utils/repairSession.js';

const KEY = REPAIR_INTERNAL.KEY;

function safeStorage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch { return null; }
}

function readJson(key) {
  const ls = safeStorage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function readBool(key) {
  const ls = safeStorage();
  if (!ls) return false;
  try {
    const v = ls.getItem(key);
    return v === '1' || v === 'true';
  } catch { return false; }
}

/**
 * classifySession — pure resolver. Inputs whatever the caller
 * already has from auth + profile + farms; outputs the spec
 * status object.
 *
 * @param  {Object} inputs
 * @param  {Object|null} inputs.user
 * @param  {Object|null} inputs.profile
 * @param  {Array|null}  inputs.farms
 * @param  {Object|null} inputs.activeFarm
 * @param  {boolean}     inputs.isAuthLoading
 * @param  {boolean}     inputs.isProfileLoading
 * @param  {boolean}     inputs.backendAvailable
 *
 * @returns {{
 *   status: string,
 *   activeFarm: Object|null,
 *   onboardingCompleted: boolean,
 *   recoveryMessage: string|null,
 * }}
 */
export function classifySession({
  user             = null,
  profile          = null,
  farms            = null,
  activeFarm       = null,
  isAuthLoading    = false,
  isProfileLoading = false,
  backendAvailable = true,
} = {}) {
  // 1. Still loading — keep the dashboard on the loading splash.
  if (isAuthLoading || isProfileLoading) {
    return {
      status: 'loading',
      activeFarm: null,
      onboardingCompleted: false,
      recoveryMessage: null,
    };
  }

  // 2. No authenticated user — caller routes to login.
  if (!user) {
    return {
      status: 'needs_onboarding',
      activeFarm: null,
      onboardingCompleted: false,
      recoveryMessage: null,
    };
  }

  // 3. Resolve the active farm using the spec's trust order:
  //    backend wins when available; otherwise honour
  //    localStorage so an offline reload still works.
  const lsActive = readJson(KEY.activeFarm);
  const lsFarms  = readJson(KEY.farms);
  const lsCompleted = readBool(KEY.onboardingCompleted);

  const farmsList = Array.isArray(farms) && farms.length
    ? farms
    : (Array.isArray(lsFarms) ? lsFarms : []);

  let resolvedActive = activeFarm;
  if (!resolvedActive && lsActive && lsActive.id) {
    resolvedActive = lsActive;
  }
  // Repair: farms exist but no active farm → first farm wins.
  if (!resolvedActive && farmsList.length > 0) {
    resolvedActive = farmsList[0];
  }

  const onboardingCompleted = !!resolvedActive || lsCompleted;

  // 4. Backend unreachable AND no localStorage farm AND no
  //    backend farm — surface the offline-recovery message
  //    so the caller can decide whether to allow read-only
  //    dashboard or send to setup.
  if (!resolvedActive && farmsList.length === 0 && !backendAvailable) {
    return {
      status: 'needs_onboarding',
      activeFarm: null,
      onboardingCompleted: false,
      recoveryMessage: 'offline-no-cache',
    };
  }

  // 5. Active farm present → ready.
  if (resolvedActive && resolvedActive.id) {
    return {
      status: 'ready',
      activeFarm: resolvedActive,
      onboardingCompleted: true,
      recoveryMessage: null,
    };
  }

  // 6. Farms exist but couldn't pick one (e.g. all rows are
  //    missing ids). Surface needs_farm_selection.
  if (farmsList.length > 0) {
    return {
      status: 'needs_farm_selection',
      activeFarm: null,
      onboardingCompleted,
      recoveryMessage: null,
    };
  }

  // 7. Default — user with no farm yet.
  return {
    status: 'needs_onboarding',
    activeFarm: null,
    onboardingCompleted: false,
    recoveryMessage: null,
  };
}

/**
 * useSessionBootstrap — React hook around classifySession.
 *
 * Pulls auth + profile + farms from whatever shape the caller
 * passes in (so we don't hard-couple to ProfileContext /
 * AuthContext shapes — they vary across pilot tenants).
 * Runs repairFarrowaySession() once on mount before the first
 * classification.
 */
export function useSessionBootstrap({
  user, profile, farms, activeFarm,
  isAuthLoading = false,
  isProfileLoading = false,
  backendAvailable = true,
} = {}) {
  const repairedRef = useRef(false);
  const [repairActions, setRepairActions] = useState([]);

  // One-shot repair pass. After this runs, classifySession can
  // trust the standard localStorage keys.
  useEffect(() => {
    if (repairedRef.current) return;
    repairedRef.current = true;
    try {
      const r = repairFarrowaySession();
      setRepairActions(r.actions);
      if (typeof window !== 'undefined'
          && typeof import.meta !== 'undefined'
          && import.meta.env && import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log('[Farroway Session] repair', r.actions, r.snapshot);
      }
    } catch { /* never propagate repair errors */ }
  }, []);

  const classification = useMemo(
    () => classifySession({
      user, profile, farms, activeFarm,
      isAuthLoading, isProfileLoading, backendAvailable,
    }),
    [user, profile, farms, activeFarm,
     isAuthLoading, isProfileLoading, backendAvailable],
  );

  // Dev-only decision log per spec §10.
  useEffect(() => {
    if (typeof import.meta === 'undefined' || !import.meta.env || !import.meta.env.DEV) return;
    try {
      // eslint-disable-next-line no-console
      console.log('[Farroway Session]', {
        userId: user && (user.id || user.userId),
        farmsCount: Array.isArray(farms) ? farms.length : null,
        activeFarmId: classification.activeFarm
          ? classification.activeFarm.id : null,
        onboardingCompleted: classification.onboardingCompleted,
        decision: classification.status,
      });
    } catch { /* swallow */ }
  }, [user, farms, classification]);

  return {
    ...classification,
    user,
    profile,
    farms: Array.isArray(farms) ? farms : [],
    repairActions,
  };
}

/**
 * persistFarmAfterSetup — call after a successful "Save Farm
 * Profile" so the next dashboard render sees a complete
 * session (spec §6).
 *
 *   persistFarmAfterSetup({ farm, pendingSync: false })
 *
 * Writes:
 *   farroway_active_farm           = farm
 *   farroway_farms                 = [farm] (or merged list)
 *   farroway_onboarding_completed  = '1'
 *
 * Caller's navigate() runs immediately after; the spec is
 * explicit that a backend failure must NOT block the redirect.
 */
export function persistFarmAfterSetup({ farm, pendingSync = false } = {}) {
  if (!farm) return false;
  const ls = safeStorage();
  if (!ls) return false;
  try {
    const stamped = pendingSync ? { ...farm, pendingSync: true } : farm;
    ls.setItem(KEY.activeFarm, JSON.stringify(stamped));

    // Merge into the farms list if absent.
    let list = [];
    try {
      const raw = ls.getItem(KEY.farms);
      list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) list = [];
    } catch { list = []; }
    const exists = list.some((f) => f && f.id && f.id === stamped.id);
    if (!exists) list.push(stamped);
    ls.setItem(KEY.farms, JSON.stringify(list));

    ls.setItem(KEY.onboardingCompleted, '1');
    return true;
  } catch { return false; }
}

export const _internal = Object.freeze({ KEY });
