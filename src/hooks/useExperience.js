/**
 * useExperience — React hook that subscribes to the
 * multi-experience selector layer.
 *
 *   const {
 *     experience,        // 'garden' | 'farm' | null
 *     activeEntity,      // the active garden or farm row
 *     gardens, farms,    // partitioned arrays
 *     hasGarden, hasFarm, hasBoth,
 *     switchTo,          // (target) => void  ('garden' | 'farm')
 *     addGarden, addFarm,
 *     removeExperience,
 *   } = useExperience();
 *
 * On every `farroway:experience_switched` window event the hook
 * re-reads the snapshot and forces a render. Same shape as
 * `getExperienceSnapshot()` plus bound action callbacks so a
 * component never has to import the store directly.
 *
 * Strict-rule audit
 *   * Pure-React, no side effects on render.
 *   * Tear-down listener on unmount.
 *   * Re-reads localStorage on every event so cross-tab switches
 *     also re-render this tab (storage events bubble through the
 *     existing AuthContext cross-tab listener pattern).
 *   * Never throws — all store calls already swallow errors.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  SWITCH_EVENT, EXPERIENCE,
  getExperienceSnapshot,
  switchExperience as _switchExperience,
  addGarden as _addGarden,
  addFarm as _addFarm,
  removeExperience as _removeExperience,
} from '../store/multiExperience.js';

function _readSnapshot() {
  try { return getExperienceSnapshot(); }
  catch {
    return {
      gardens: [], farms: [],
      activeExperience: null,
      activeGardenId: null, activeFarmId: null,
      activeEntity: null,
      hasGarden: false, hasFarm: false, hasBoth: false,
    };
  }
}

export default function useExperience() {
  const [snap, setSnap] = useState(_readSnapshot);

  useEffect(() => {
    const refresh = () => setSnap(_readSnapshot());
    if (typeof window !== 'undefined') {
      window.addEventListener(SWITCH_EVENT, refresh);
      // Cross-tab: localStorage `storage` events fire in OTHER
      // tabs when the active-experience key changes, so a switch
      // in tab A also re-renders tab B without a manual reload.
      const onStorage = (ev) => {
        try {
          if (!ev || ev.storageArea !== window.localStorage) return;
          const key = ev.key;
          if (
            key === 'farroway_active_experience'
            || key === 'farroway_active_garden_id'
            || key === 'farroway.activeFarmId'
            || key === 'farroway.farms'
          ) refresh();
        } catch { /* swallow */ }
      };
      window.addEventListener('storage', onStorage);
      return () => {
        window.removeEventListener(SWITCH_EVENT, refresh);
        window.removeEventListener('storage', onStorage);
      };
    }
    return undefined;
  }, []);

  const switchTo = useCallback((target) => {
    try { return _switchExperience(target); }
    catch { return false; }
  }, []);

  const addGarden = useCallback((payload) => {
    try { return _addGarden(payload); }
    catch { return null; }
  }, []);

  const addFarm = useCallback((payload) => {
    try { return _addFarm(payload); }
    catch { return null; }
  }, []);

  const removeExperience = useCallback((id) => {
    try { return _removeExperience(id); }
    catch { return false; }
  }, []);

  return {
    experience:      snap.activeExperience,
    activeEntity:    snap.activeEntity,
    gardens:         snap.gardens,
    farms:           snap.farms,
    activeGardenId:  snap.activeGardenId,
    activeFarmId:    snap.activeFarmId,
    hasGarden:       snap.hasGarden,
    hasFarm:         snap.hasFarm,
    hasBoth:         snap.hasBoth,
    EXPERIENCE,
    switchTo,
    addGarden,
    addFarm,
    removeExperience,
  };
}

export { useExperience };
