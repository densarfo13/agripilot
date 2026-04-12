/**
 * Backend validation utilities for farm profile payloads.
 * Ensures payloads are sanitized and validated before hitting Prisma.
 */

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function toNullableString(value) {
  if (isBlank(value)) return null;
  return String(value).trim();
}

function toNullableNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

/**
 * Validate and sanitize a farm profile payload.
 * Returns { isValid, errors, data } where data contains cleaned values.
 * @param {object} body - Raw request body
 * @returns {{ isValid: boolean, errors: Record<string, string>, data: object }}
 */
export function validateFarmProfilePayload(body = {}) {
  const errors = {};

  const farmerName = toNullableString(body.farmerName);
  const farmName = toNullableString(body.farmName);
  const countryCode = toNullableString(body.countryCode);
  const locationName = toNullableString(body.locationName);
  const crop = toNullableString(body.crop);

  // Land size: accept landSizeValue or farmSizeAcres
  const rawSize = body.landSizeValue ?? body.farmSizeAcres ?? body.size;
  const landSizeValue = toNullableNumber(rawSize);
  const landSizeUnit = toNullableString(body.landSizeUnit) || 'ACRE';

  // GPS: accept latitude/longitude or gpsLat/gpsLng
  const rawLat = body.latitude ?? body.gpsLat;
  const rawLng = body.longitude ?? body.gpsLng;
  const latitude = toNullableNumber(rawLat);
  const longitude = toNullableNumber(rawLng);

  if (!farmerName) errors.farmerName = 'Farmer name is required';
  if (!farmName) errors.farmName = 'Farm name is required';
  if (!countryCode) errors.countryCode = 'Country is required';
  if (!locationName) errors.locationName = 'Location is required';
  if (!crop) errors.crop = 'Crop type is required';

  if (landSizeValue === null) {
    errors.landSizeValue = 'Farm size is required';
  } else if (Number.isNaN(landSizeValue) || landSizeValue <= 0) {
    errors.landSizeValue = 'Farm size must be greater than 0';
  }

  if (latitude === null) {
    errors.latitude = 'Latitude is required';
  } else if (Number.isNaN(latitude) || latitude < -90 || latitude > 90) {
    errors.latitude = 'Latitude must be between -90 and 90';
  }

  if (longitude === null) {
    errors.longitude = 'Longitude is required';
  } else if (Number.isNaN(longitude) || longitude < -180 || longitude > 180) {
    errors.longitude = 'Longitude must be between -180 and 180';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    data: {
      farmerName,
      farmName,
      countryCode,
      locationName,
      crop,
      landSizeValue: Number.isNaN(landSizeValue) ? null : landSizeValue,
      landSizeUnit,
      latitude: Number.isNaN(latitude) ? null : latitude,
      longitude: Number.isNaN(longitude) ? null : longitude,
    },
  };
}
