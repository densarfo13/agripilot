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

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

export function validateRegisterPayload(body = {}) {
  const errors = {};
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const fullName = toNullableString(body.fullName);

  if (!email) errors.email = 'Email is required';
  else if (!validateEmail(email)) errors.email = 'Enter a valid email';

  if (!password) errors.password = 'Password is required';
  else if (password.length < 8) errors.password = 'Password must be at least 8 characters';

  return { isValid: Object.keys(errors).length === 0, errors, data: { email, password, fullName } };
}

export function validateLoginPayload(body = {}) {
  const errors = {};
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!email) errors.email = 'Email is required';
  if (!password) errors.password = 'Password is required';

  return { isValid: Object.keys(errors).length === 0, errors, data: { email, password } };
}

export function validateForgotPasswordPayload(body = {}) {
  const errors = {};
  const email = String(body.email || '').trim().toLowerCase();

  if (!email) errors.email = 'Email is required';
  else if (!validateEmail(email)) errors.email = 'Enter a valid email';

  return { isValid: Object.keys(errors).length === 0, errors, data: { email } };
}

export function validateResetPasswordPayload(body = {}) {
  const errors = {};
  const token = String(body.token || '').trim();
  const password = String(body.password || '');

  if (!token) errors.token = 'Reset token is required';
  if (!password) errors.password = 'Password is required';
  else if (password.length < 8) errors.password = 'Password must be at least 8 characters';

  return { isValid: Object.keys(errors).length === 0, errors, data: { token, password } };
}

const VALID_SIZE_UNITS = ['ACRE', 'HECTARE', 'SQUARE_METER'];
const VALID_EXPERIENCE_LEVELS = ['new', 'experienced'];

export function validateFarmProfilePayload(body = {}) {
  const errors = {};
  const farmerName = toNullableString(body.farmerName);
  const farmName = toNullableString(body.farmName);
  const country = toNullableString(body.country);
  const location = toNullableString(body.location);
  const cropType = toNullableString(body.cropType);
  const size = toNullableNumber(body.size);
  const rawUnit = toNullableString(body.sizeUnit);
  const sizeUnit = rawUnit && VALID_SIZE_UNITS.includes(rawUnit.toUpperCase())
    ? rawUnit.toUpperCase()
    : 'ACRE'; // backward compatible default
  const gpsLat = toNullableNumber(body.gpsLat);
  const gpsLng = toNullableNumber(body.gpsLng);
  const experienceLevel = toNullableString(body.experienceLevel);

  if (!farmerName) errors.farmerName = 'Farmer name is required';
  if (!farmName) errors.farmName = 'Farm name is required';
  if (!country) errors.country = 'Country is required';
  if (!location) errors.location = 'Enter your location';
  if (!cropType) {
    errors.cropType = 'Crop type is required';
  } else if (cropType.toUpperCase() === 'OTHER') {
    errors.cropType = 'Please enter your crop name';
  } else if (cropType.toUpperCase().startsWith('OTHER:') && cropType.slice(6).trim().length < 2) {
    errors.cropType = 'Crop name must be at least 2 characters';
  }

  if (size === null) errors.size = 'Farm size is required';
  else if (Number.isNaN(size) || size <= 0) errors.size = 'Farm size must be greater than 0';

  // GPS is optional — only validate format if provided
  if (gpsLat !== null && (Number.isNaN(gpsLat) || gpsLat < -90 || gpsLat > 90)) {
    errors.gpsLat = 'Latitude must be between -90 and 90';
  }
  if (gpsLng !== null && (Number.isNaN(gpsLng) || gpsLng < -180 || gpsLng > 180)) {
    errors.gpsLng = 'Longitude must be between -180 and 180';
  }

  if (experienceLevel && !VALID_EXPERIENCE_LEVELS.includes(experienceLevel.toLowerCase())) {
    errors.experienceLevel = 'Experience level must be "new" or "experienced"';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    data: {
      farmerName,
      farmName,
      country,
      location,
      cropType,
      size: Number.isNaN(size) ? null : size,
      sizeUnit,
      gpsLat: Number.isNaN(gpsLat) ? null : gpsLat,
      gpsLng: Number.isNaN(gpsLng) ? null : gpsLng,
      experienceLevel: experienceLevel?.toLowerCase() || null,
    },
  };
}
