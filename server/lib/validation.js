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

// Canonical uppercase size units accepted on the wire. Small-area
// units (SQFT / SQM) are required for backyard farms. SQUARE_METER is
// kept as a legacy alias so old clients that spelled it long-form
// don't break; the normalisation below collapses both to 'SQM'.
const VALID_SIZE_UNITS = ['ACRE', 'HECTARE', 'SQFT', 'SQM', 'SQUARE_METER'];

// Map every incoming unit shape (short codes, legacy long form,
// lowercase frontend values, "sq ft"/"sq m" display strings) onto
// the canonical uppercase code the schema + downstream engines use.
const SIZE_UNIT_ALIASES = {
  ACRE: 'ACRE', ACRES: 'ACRE',
  HECTARE: 'HECTARE', HECTARES: 'HECTARE', HA: 'HECTARE',
  SQFT: 'SQFT', 'SQ FT': 'SQFT', 'SQUARE FEET': 'SQFT', 'SQUARE_FEET': 'SQFT',
  SQM: 'SQM', 'SQ M': 'SQM', 'SQUARE METER': 'SQM', 'SQUARE_METER': 'SQM',
  'SQUARE METERS': 'SQM', 'M2': 'SQM',
};

function normalizeSizeUnit(raw) {
  if (raw == null) return null;
  const up = String(raw).trim().toUpperCase().replace(/\s+/g, ' ');
  return SIZE_UNIT_ALIASES[up] || (VALID_SIZE_UNITS.includes(up) ? up : null);
}
const VALID_EXPERIENCE_LEVELS = ['new', 'experienced'];
// U.S. farm-type extensions — optional on all flows; null-safe.
const VALID_FARM_TYPES = ['backyard', 'small_farm', 'commercial'];
const VALID_BEGINNER_LEVELS = ['beginner', 'intermediate', 'advanced'];
const VALID_GROWING_STYLES = ['container', 'raised_bed', 'in_ground', 'mixed'];
const VALID_FARM_PURPOSES = ['home_food', 'sell_locally', 'learning', 'mixed'];
// 50 states + DC postal codes — used as a lightweight allow-list so a
// bad state string can't poison the profile. Full resolver lives in
// server/src/domain/us/usStates.js.
const VALID_US_STATE_CODES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
  'VT','VA','WA','WV','WI','WY',
]);

export function validateFarmProfilePayload(body = {}) {
  const errors = {};
  const farmerName = toNullableString(body.farmerName);
  const farmName = toNullableString(body.farmName);
  const country = toNullableString(body.country);
  // Accept either `location` (canonical) or `locationLabel` /
  // `locationName` (display aliases the frontend has shipped over
  // time). Any of them satisfies the required-location check.
  const location = toNullableString(
    body.location != null ? body.location
    : body.locationLabel != null ? body.locationLabel
    : body.locationName,
  );
  // Accept either `cropType` (canonical, used by the schema) or
  // `crop` (the shorthand the FarmForm ships). Both route to the
  // same persisted column.
  const cropType = toNullableString(
    body.cropType != null ? body.cropType : body.crop,
  );
  // Accept both the canonical `size` and the common `farmSize` alias
  // the FarmForm ships so a simple rename on one side never causes
  // a "Validation failed" dead-end.
  const size = toNullableNumber(
    body.size != null ? body.size : body.farmSize,
  );
  const rawUnit = toNullableString(body.sizeUnit);
  const normalisedUnit = normalizeSizeUnit(rawUnit);
  const sizeUnit = normalisedUnit || 'ACRE'; // backward compatible default
  const gpsLat = toNullableNumber(body.gpsLat);
  const gpsLng = toNullableNumber(body.gpsLng);
  const experienceLevel = toNullableString(body.experienceLevel);
  // U.S. state-aware fields — all optional, never required.
  // Accept `stateCode` (canonical) or `state` (frontend alias).
  const stateCodeRaw = toNullableString(
    body.stateCode != null ? body.stateCode : body.state,
  );
  const stateCode = stateCodeRaw ? stateCodeRaw.toUpperCase() : null;
  const farmTypeRaw = toNullableString(body.farmType);
  const farmType = farmTypeRaw ? farmTypeRaw.toLowerCase() : null;
  const beginnerLevelRaw = toNullableString(body.beginnerLevel);
  const beginnerLevel = beginnerLevelRaw ? beginnerLevelRaw.toLowerCase() : null;
  const growingStyleRaw = toNullableString(body.growingStyle);
  const growingStyle = growingStyleRaw ? growingStyleRaw.toLowerCase() : null;
  const farmPurposeRaw = toNullableString(body.farmPurpose);
  const farmPurpose = farmPurposeRaw ? farmPurposeRaw.toLowerCase() : null;

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

  // Explicit unit rejection — silent fallback to ACRE is fine for
  // legacy clients that never sent a unit, but a real value that
  // can't be parsed should surface as a field error instead of
  // silently corrupting storage.
  if (rawUnit && !normalisedUnit) {
    errors.sizeUnit = `Invalid size unit: ${rawUnit}`;
  }

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

  // U.S. fields — validated only if supplied; bad values are dropped
  // rather than rejected so legacy/non-U.S. clients don't break.
  if (stateCode && !VALID_US_STATE_CODES.has(stateCode)) {
    errors.stateCode = 'State code must be a valid U.S. postal code';
  }
  if (farmType && !VALID_FARM_TYPES.includes(farmType)) {
    errors.farmType = 'farmType must be backyard | small_farm | commercial';
  }
  if (beginnerLevel && !VALID_BEGINNER_LEVELS.includes(beginnerLevel)) {
    errors.beginnerLevel = 'beginnerLevel must be beginner | intermediate | advanced';
  }
  if (growingStyle && !VALID_GROWING_STYLES.includes(growingStyle)) {
    errors.growingStyle = 'growingStyle must be container | raised_bed | in_ground | mixed';
  }
  if (farmPurpose && !VALID_FARM_PURPOSES.includes(farmPurpose)) {
    errors.farmPurpose = 'farmPurpose must be home_food | sell_locally | learning | mixed';
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
      stateCode,
      farmType,
      beginnerLevel,
      growingStyle,
      farmPurpose,
    },
  };
}
