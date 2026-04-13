export function calculateFarmScore(profile = {}) {
  let score = 0;

  // Required fields (75 points total — enough for "Ready" without GPS)
  if (profile.farmerName) score += 15;
  if (profile.farmName) score += 10;
  if (profile.country) score += 10;
  if (profile.location) score += 15;
  if (profile.size && profile.size > 0) score += 15;
  if (profile.cropType) score += 15;
  // GPS is optional bonus (20 points) — matches UX guidance that typed location is fine
  if (profile.gpsLat !== null && profile.gpsLat !== undefined) score += 10;
  if (profile.gpsLng !== null && profile.gpsLng !== undefined) score += 10;

  const rounded = Math.round(score);
  const hasUuid = !!profile.farmerUuid;

  let status = 'Low - Not ready yet';
  if (rounded >= 75 && hasUuid) status = 'Ready';
  else if (rounded >= 75) status = 'Almost ready — awaiting ID';
  else if (rounded >= 50) status = 'Almost ready';

  return {
    score: rounded,
    status,
    hasUuid,
    // isReady requires BOTH score threshold AND a valid farmer UUID
    isReady: rounded >= 75 && hasUuid,
  };
}

export function getMissingProfileItems(profile = {}) {
  const missing = [];

  if (!profile.farmerName) missing.push('Add farmer name');
  if (!profile.farmName) missing.push('Add farm name');
  if (!profile.country) missing.push('Add country');
  if (!profile.location) missing.push('Add farm location');
  if (!profile.size || profile.size <= 0) missing.push('Add farm size');
  if (!profile.cropType) missing.push('Select crop type');
  if (!profile.farmerUuid) missing.push('Farmer ID not assigned — save your profile');
  if (profile.gpsLat === null || profile.gpsLat === undefined) missing.push('Add GPS latitude');
  if (profile.gpsLng === null || profile.gpsLng === undefined) missing.push('Add GPS longitude');

  return missing;
}

export function isProfileComplete(profile = {}) {
  return getMissingProfileItems(profile).length === 0;
}
