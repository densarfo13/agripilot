/**
 * getAppMode — single source of truth for whether the current user
 * should see Backyard Mode or Farm Mode.
 *
 * We derive mode from `farmType` (already persisted on the farm
 * profile): `backyard` → Backyard Mode, everything else → Farm
 * Mode. That avoids a parallel schema field and keeps existing
 * profiles working unchanged.
 *
 *   getAppMode(source) → 'backyard' | 'farm'
 *
 * Accepts any of:
 *   - a farm profile row
 *   - an onboarding form
 *   - a literal 'backyard' | 'farm' | 'small_farm' | 'commercial'
 *   - null / undefined → defaults to 'farm' (safer fallback since
 *     the full feature set already ships)
 */

export const APP_MODE = Object.freeze({
  BACKYARD: 'backyard',
  FARM:     'farm',
});

function readFarmType(input) {
  if (!input) return null;
  if (typeof input === 'string') return input.toLowerCase();
  if (input.farmMode) return String(input.farmMode).toLowerCase();
  if (input.farmType) return String(input.farmType).toLowerCase();
  if (input.profile?.farmType) return String(input.profile.farmType).toLowerCase();
  return null;
}

export function getAppMode(source) {
  const ft = readFarmType(source);
  if (!ft) return APP_MODE.FARM;
  if (ft === 'backyard' || ft === 'home' || ft === 'home_garden') return APP_MODE.BACKYARD;
  return APP_MODE.FARM;
}

export function isBackyardMode(source) {
  return getAppMode(source) === APP_MODE.BACKYARD;
}

export function isFarmMode(source) {
  return getAppMode(source) === APP_MODE.FARM;
}
