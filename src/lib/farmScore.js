export function calculateFarmScore(profile = {}) {
  let score = 0;

  // Core required fields (80 points total — enough for "Ready" without GPS)
  if (profile.farmerName) score += 15;
  if (profile.farmName) score += 10;
  if (profile.country) score += 15;
  if (profile.location) score += 15;
  if (profile.size && profile.size > 0) score += 15;
  if (profile.cropType) score += 15;
  // GPS is optional bonus — improves weather/recommendations but not required
  if (profile.gpsLat !== null && profile.gpsLat !== undefined) score += 7.5;
  if (profile.gpsLng !== null && profile.gpsLng !== undefined) score += 7.5;

  const rounded = Math.round(score);

  let status = 'Low - Not ready yet';
  if (rounded >= 75) status = 'Ready';
  else if (rounded >= 50) status = 'Almost ready';

  return {
    score: rounded,
    status,
    hasUuid: !!profile.farmerUuid,
    // isReady when all core fields are filled (score >= 75 means all 6 required fields done)
    isReady: rounded >= 75,
  };
}

export function getMissingProfileItems(profile = {}) {
  const missing = [];

  // Required fields — must be filled to proceed past setup
  if (!profile.farmerName) missing.push('Add farmer name');
  if (!profile.farmName) missing.push('Add farm name');
  if (!profile.country) missing.push('Add country');
  if (!profile.location) missing.push('Add farm location');
  if (!profile.size || profile.size <= 0) missing.push('Add farm size');
  if (!profile.cropType) missing.push('Select crop type');

  // GPS and farmerUuid are optional for completeness — they improve
  // recommendations but should not block farmers from using the app.
  // farmerUuid is assigned server-side on first save automatically.

  return missing;
}

export function isProfileComplete(profile = {}) {
  return getMissingProfileItems(profile).length === 0;
}
