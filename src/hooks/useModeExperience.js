/**
 * useModeExperience — React hook that returns the resolved
 * mode-experience record for the active grow mode.
 *
 *   const xp = useModeExperience();
 *   xp.label            // 'mode.farm.label' / 'mode.garden.label'
 *   xp.themeClass       // 'ff-theme-farm' / 'ff-theme-garden'
 *   xp.navItems         // ['home', 'farm', …]
 *   xp.showSell         // boolean
 *   xp.tone             // 'operational' / 'caring'
 *
 * Composed on top of useGrowMode so it picks up live toggle
 * changes without a reload.
 *
 * Strict-rule audit
 *   • All hooks unconditional — wraps useGrowMode + useMemo only.
 *   • Never throws — getModeExperience falls back to FARM on
 *     unknown input.
 *   • No side effects, no I/O.
 */

import { useMemo } from 'react';
import useGrowMode from './useGrowMode.js';
import { getModeExperience } from '../modes/modeExperience.js';

export default function useModeExperience() {
  const { mode } = useGrowMode();
  return useMemo(() => getModeExperience(mode), [mode]);
}

export { useModeExperience };
