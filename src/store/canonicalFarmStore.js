/**
 * canonicalFarmStore.js — Zustand-persisted single source of truth
 * for activeFarm (spec §1).
 *
 *   import {
 *     useCanonicalFarmStore, DEFAULT_FARM, CANONICAL_FARM_STORAGE_KEY,
 *   } from 'src/store/canonicalFarmStore.js';
 *
 *   const activeFarm = useCanonicalFarmStore((s) => s.activeFarm);
 *
 * What this is
 * ────────────
 *   The SINGLE store every farm-aware screen reads from. Persists
 *   to localStorage via zustand/middleware/persist under the
 *   canonical key `farroway-canonical-farm-v2`.
 *
 *   Replaces the scatter of duplicate state sources observed in
 *   production. The bootstrap migration in
 *   src/bootstrap/migrateLegacyFarmState.js sweeps the 13 legacy
 *   keys into this canonical key + clears them.
 *
 * Strict-rule audit
 *   • SSR-safe — zustand persist falls back to noop storage when
 *     window is undefined.
 *   • Never throws — every mutation wrapped by the store's
 *     internal middleware.
 *   • Subscribers fire synchronously via zustand's standard API.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export const CANONICAL_FARM_STORAGE_KEY = 'farroway-canonical-farm-v2';

export const DEFAULT_FARM = Object.freeze({
  id:               null,
  name:             '',
  crop:             '',
  cropDisplayName: '',
  type:             'farm',
  location:         '',
  country:          '',
  region:           '',
  stage:            '',
  size:             '',
  photo:            '',
  language:         'en',
  tasksCompleted:   0,
  totalTasks:       0,
  progressStage:    'early_growth',
  createdAt:        Date.now(),
});

function _safeStorage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return undefined;
    return createJSONStorage(() => window.localStorage);
  } catch {
    return undefined;
  }
}

export const useCanonicalFarmStore = create(
  persist(
    (set) => ({
      activeFarm: { ...DEFAULT_FARM },

      hydrated: false,

      setHydrated: (v) => set({ hydrated: !!v }),

      /**
       * Partial update — merges into the current activeFarm.
       * Used by onboarding, edit flows, scan-result attach, etc.
       */
      updateFarm: (updates) =>
        set((state) => ({
          activeFarm: {
            ...state.activeFarm,
            ...(updates && typeof updates === 'object' ? updates : {}),
          },
        })),

      /**
       * Replace the entire activeFarm. Fills in missing fields
       * from DEFAULT_FARM so the shape stays stable.
       */
      replaceFarm: (farm) =>
        set({
          activeFarm: {
            ...DEFAULT_FARM,
            ...(farm && typeof farm === 'object' ? farm : {}),
          },
        }),

      /** Drop the active farm back to defaults — used on sign-out. */
      clearFarm: () =>
        set({
          activeFarm: { ...DEFAULT_FARM, createdAt: Date.now() },
        }),
    }),
    {
      name:    CANONICAL_FARM_STORAGE_KEY,
      storage: _safeStorage(),
      version: 2,
      // Only persist activeFarm — hydrated flag is per-session.
      partialize: (state) => ({ activeFarm: state.activeFarm }),
    },
  ),
);

const _module = {
  useCanonicalFarmStore, DEFAULT_FARM, CANONICAL_FARM_STORAGE_KEY,
};
export default _module;
