/**
 * useActiveFarm.js — single hook every farm-aware screen uses
 * (spec §4).
 *
 *   import { useActiveFarm } from 'src/hooks/useActiveFarm.js';
 *
 *   function Home() {
 *     const { activeFarm } = useActiveFarm();
 *     return <h2>Take a closer look at {resolveCropName(activeFarm)} today</h2>;
 *   }
 *
 * What this is
 * ────────────
 *   The ONLY hook screens should call to read the active farm.
 *   Replaces ad-hoc `useState(farm)` / `localStorage.getItem('farm')`
 *   patterns. Subscribes to the canonical zustand store so any
 *   update propagates to every page automatically.
 *
 *   This module supersedes the earlier React-Context-based
 *   `src/core/farm/FarmContextProvider.jsx` hook for new code.
 *   The provider hook still works (it falls back to the same
 *   canonical data) so incremental migration is safe.
 */

import { useCanonicalFarmStore } from '../store/canonicalFarmStore.js';

export function useActiveFarm() {
  const activeFarm = useCanonicalFarmStore((s) => s.activeFarm);
  return { activeFarm };
}

export default useActiveFarm;
