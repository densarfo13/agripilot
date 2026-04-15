/**
 * User Mode System
 *
 * Three modes control UI presentation (not permissions):
 *   basic    — illiterate/low-literacy farmers: icon-first, voice-guided, one action
 *   standard — most farmers: icon + short text, quick actions, simple progress
 *   advanced — admin/org/field officers: richer detail, reports, dashboards
 *
 * Mode is derived from role + experienceLevel, with manual override support.
 * Permissions remain role-based (unchanged).
 */

const MODES = ['basic', 'standard', 'advanced'];
const STORAGE_KEY = 'farroway:user_mode';

const ADVANCED_ROLES = ['super_admin', 'institutional_admin', 'reviewer', 'field_officer', 'investor_viewer'];

/**
 * Resolve the default mode for a user based on role + profile.
 * @param {string} role - User role (e.g. 'farmer', 'super_admin')
 * @param {string} experienceLevel - 'new' | 'experienced' | ''
 * @returns {'basic'|'standard'|'advanced'}
 */
export function resolveDefaultMode(role, experienceLevel) {
  if (!role) return 'standard';
  if (ADVANCED_ROLES.includes(role)) return 'advanced';
  // Farmers: new/beginner/unset → basic (simple mode default)
  // Experienced → standard
  if (experienceLevel === 'experienced') return 'standard';
  // Default for new farmers or those who haven't set experience → basic (simple)
  return 'basic';
}

/**
 * Get the persisted mode override, if any.
 * @returns {'basic'|'standard'|'advanced'|null}
 */
export function getPersistedMode() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return MODES.includes(v) ? v : null;
  } catch { return null; }
}

/**
 * Persist a mode override.
 * @param {'basic'|'standard'|'advanced'} mode
 */
export function persistMode(mode) {
  try {
    if (MODES.includes(mode)) localStorage.setItem(STORAGE_KEY, mode);
  } catch { /* quota */ }
}

/**
 * Clear persisted mode (revert to auto-detected).
 */
export function clearPersistedMode() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

/**
 * Get the effective mode: persisted override → auto-detected default.
 * @param {string} role
 * @param {string} experienceLevel
 * @returns {'basic'|'standard'|'advanced'}
 */
export function getEffectiveMode(role, experienceLevel) {
  const persisted = getPersistedMode();
  if (persisted) {
    // Don't let farmers select advanced
    if (persisted === 'advanced' && !ADVANCED_ROLES.includes(role)) {
      return resolveDefaultMode(role, experienceLevel);
    }
    return persisted;
  }
  return resolveDefaultMode(role, experienceLevel);
}

/**
 * Check if a mode is a farmer mode (basic or standard).
 */
export function isFarmerMode(mode) {
  return mode === 'basic' || mode === 'standard';
}

/**
 * Allowed mode switches for a given role.
 * Farmers: basic ↔ standard only.
 * Admin/staff: advanced only (no switch needed).
 */
export function getAllowedModes(role) {
  if (ADVANCED_ROLES.includes(role)) return ['advanced'];
  return ['basic', 'standard'];
}

export { MODES };
