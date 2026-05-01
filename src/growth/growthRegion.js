/**
 * growthRegion.js — single source of truth for the pilot's focused
 * growth region.
 *
 * Spec coverage (User growth §5)
 *   • Focus regionally — prioritize one location.
 *
 * Configuration
 *   Default focus is Greater Accra, Ghana. Override at build time:
 *     VITE_FARROWAY_GROWTH_REGION="Ghana:Greater Accra"
 *
 *   The first segment is the country, the second (after `:`) is
 *   the optional region/state. Both segments are case-insensitive
 *   when matched against the user's detected location.
 *
 * Strict-rule audit
 *   • Pure read; never throws.
 *   • Frozen so callers can't mutate the singleton.
 */

const DEFAULT_COUNTRY = 'Ghana';
const DEFAULT_REGION  = 'Greater Accra';

function _readEnv() {
  try {
    if (typeof import.meta === 'undefined' || !import.meta.env) return null;
    const raw = import.meta.env.VITE_FARROWAY_GROWTH_REGION;
    if (raw == null || String(raw).trim() === '') return null;
    return String(raw);
  } catch { return null; }
}

function _norm(s) {
  return String(s || '').trim().toLowerCase();
}

function _resolve() {
  const env = _readEnv();
  if (!env) {
    return { country: DEFAULT_COUNTRY, region: DEFAULT_REGION };
  }
  const [country, region] = env.split(':').map((s) => String(s || '').trim());
  return {
    country: country || DEFAULT_COUNTRY,
    region:  region  || '',
  };
}

const CONFIG = Object.freeze(_resolve());

/** Returns the focused growth region. Always populated. */
export function getGrowthRegion() {
  return CONFIG;
}

/**
 * Whether the supplied detected location matches the pilot focus.
 * Returns 'match' | 'country_only' | 'mismatch'.
 */
export function matchGrowthRegion({ country, region } = {}) {
  const wantC = _norm(CONFIG.country);
  const wantR = _norm(CONFIG.region);
  const haveC = _norm(country);
  const haveR = _norm(region);
  if (!wantC) return 'mismatch';
  if (haveC !== wantC) return 'mismatch';
  if (!wantR) return 'country_only';
  if (haveR && (haveR === wantR || haveR.includes(wantR) || wantR.includes(haveR))) {
    return 'match';
  }
  return 'country_only';
}

export const _internal = Object.freeze({ DEFAULT_COUNTRY, DEFAULT_REGION });

export default { getGrowthRegion, matchGrowthRegion };
