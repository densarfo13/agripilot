export function calculateFarmScore(profile = {}) {
  let score = 0;

  if (profile.farmerName) score += 10;
  if (profile.farmName) score += 10;
  if (profile.country) score += 10;
  if (profile.location) score += 15;
  if (profile.size && profile.size > 0) score += 15;
  if (profile.cropType) score += 15;
  if (profile.gpsLat !== null && profile.gpsLat !== undefined) score += 12.5;
  if (profile.gpsLng !== null && profile.gpsLng !== undefined) score += 12.5;

  const rounded = Math.round(score);

  let status = 'Low - Not ready yet';
  if (rounded >= 85) status = 'Ready';
  else if (rounded >= 60) status = 'Almost ready';

  return {
    score: rounded,
    status,
    isReady: rounded >= 85,
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
  if (profile.gpsLat === null || profile.gpsLat === undefined) missing.push('Add GPS latitude');
  if (profile.gpsLng === null || profile.gpsLng === undefined) missing.push('Add GPS longitude');

  return missing;
}

export function isProfileComplete(profile = {}) {
  return getMissingProfileItems(profile).length === 0;
}
