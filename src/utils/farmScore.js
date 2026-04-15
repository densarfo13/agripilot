/**
 * Farm Profile Completion Score.
 *
 * Calculates a 0-100 profile completeness score based on filled fields.
 * This is a frontend display score — the real finance/readiness score comes
 * from the backend financeScore endpoint. This is used for the setup flow
 * and the "Complete Profile" CTA on the dashboard.
 */

/**
 * @param {object} profile - Farm profile (from farmStore or API)
 * @param {object} [opts] - { countryCode } from farmer record
 * @returns {{ score: number, status: string, isReady: boolean }}
 */
export function calculateFarmScore(profile, opts = {}) {
  if (!profile) return { score: 0, status: 'Not started', isReady: false };

  let score = 0;

  // Core required fields (weighted by importance)
  if (profile.farmerName) score += 10;
  if (profile.farmName) score += 10;
  if (opts.countryCode || profile.countryCode || profile.country) score += 10;
  if (profile.locationName || profile.location) score += 15;
  if ((profile.landSizeValue && profile.landSizeValue > 0) || (profile.farmSizeAcres && profile.farmSizeAcres > 0) || (profile.size && profile.size > 0)) score += 15;
  if (profile.crop || profile.cropType) score += 15;
  if (profile.latitude != null || profile.gpsLat != null) score += 12.5;
  if (profile.longitude != null || profile.gpsLng != null) score += 12.5;

  const rounded = Math.round(score);

  let status = 'Low — Not ready yet';
  if (rounded >= 85) status = 'Ready';
  else if (rounded >= 60) status = 'Almost ready';

  return { score: rounded, status, isReady: rounded >= 85 };
}

/**
 * Get list of missing profile items for display.
 * @param {object} profile
 * @param {object} [opts]
 * @returns {string[]}
 */
export function getMissingProfileItems(profile, opts = {}) {
  if (!profile) return ['Create farm profile'];

  const missing = [];
  if (!profile.farmerName) missing.push('Add farmer name');
  if (!profile.farmName) missing.push('Add farm name');
  if (!(opts.countryCode || profile.countryCode || profile.country)) missing.push('Add country');
  if (!(profile.locationName || profile.location)) missing.push('Add farm location');
  const hasSize = (profile.landSizeValue && profile.landSizeValue > 0) || (profile.farmSizeAcres && profile.farmSizeAcres > 0) || (profile.size && profile.size > 0);
  if (!hasSize) missing.push('Add farm size');
  if (!(profile.crop || profile.cropType)) missing.push('Select crop type');
  if (profile.latitude == null && profile.gpsLat == null) missing.push('Add GPS coordinates');

  return missing;
}

/**
 * Whether a profile is considered complete for scoring.
 * @param {object} profile
 * @param {object} [opts]
 * @returns {boolean}
 */
export function isProfileComplete(profile, opts = {}) {
  return getMissingProfileItems(profile, opts).length === 0;
}
