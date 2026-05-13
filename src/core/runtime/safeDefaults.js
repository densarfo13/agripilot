/**
 * safeDefaults.js — frozen safe-default objects for every
 * first-class Farroway data type.
 *
 * CONTRACT
 * ────────
 *   • Every exported constant is Object.freeze()'d recursively
 *     so a consumer can't accidentally mutate a shared default.
 *   • Every field that a component would typically read is present
 *     and sensibly typed (null for missing numerics/ids, '' for
 *     missing strings, [] for missing arrays, false for booleans).
 *   • No component should ever receive `undefined` for any of
 *     these shapes — use the relevant SAFE_* constant as a
 *     placeholder while real data loads or when real data is absent.
 *
 * USAGE
 * ─────
 *   import { SAFE_USER, SAFE_WEATHER } from '../core/runtime/safeDefaults.js';
 *
 *   const user    = apiUser    ?? SAFE_USER;
 *   const weather = liveWeather ?? SAFE_WEATHER;
 *
 * WHY NOT UNDEFINED?
 * ──────────────────
 *   Propagating `undefined` through component props causes:
 *     • Optional-chaining noise everywhere ("user?.name ?? ''")
 *     • Defensive null-checks obscuring real logic
 *     • Subtle render differences between "loading" and "missing"
 *     • TDZ / hook-order crashes when a const is undefined and
 *       a dep-array captures it before it's been set
 *   Using a safe default turns "user is undefined" into
 *   "user is a valid empty object with id:null" — the component
 *   renders its empty/loading state without crashing.
 *
 * STRICT-RULE AUDIT
 * ─────────────────
 *   • No side effects on import.
 *   • No React / hook dependencies.
 *   • SSR-safe.
 *   • All exports are module-level constants — no factory fns,
 *     no closures, no state.
 */

// ─── User ─────────────────────────────────────────────────────────
/**
 * @typedef {Object} SafeUser
 * @property {null}   id
 * @property {string} email
 * @property {string} name
 * @property {string} role            — 'farmer' | 'ngo' | 'buyer' | 'admin'
 * @property {string} userType        — 'farmer' | 'backyard'
 * @property {boolean} approved
 * @property {boolean} onboardingComplete
 * @property {null}   profileId
 * @property {null}   farmId
 * @property {null}   organizationId
 * @property {null}   country
 * @property {null}   language
 */
export const SAFE_USER = Object.freeze({
  id:                 null,
  email:              '',
  name:               '',
  role:               'farmer',
  userType:           'farmer',
  approved:           false,
  onboardingComplete: false,
  profileId:          null,
  farmId:             null,
  organizationId:     null,
  country:            null,
  language:           null,
});

// ─── Farm ─────────────────────────────────────────────────────────
/**
 * @typedef {Object} SafeFarm
 * @property {null}   id
 * @property {string} name
 * @property {null}   crop          — canonical crop identifier (see normalizeCropId)
 * @property {null}   cropName
 * @property {null}   plantName
 * @property {null}   locationName
 * @property {null}   location
 * @property {null}   region
 * @property {null}   country
 * @property {null}   gpsLat
 * @property {null}   gpsLng
 * @property {null}   latitude
 * @property {null}   longitude
 * @property {null}   stage
 * @property {number} areaHectares
 * @property {null}   plantedAt
 * @property {boolean} isActive
 */
export const SAFE_FARM = Object.freeze({
  id:           null,
  name:         '',
  crop:         null,   // canonical field — normalizeCropId() reads this
  cropName:     null,
  plantName:    null,
  locationName: null,
  location:     null,
  region:       null,
  country:      null,
  gpsLat:       null,
  gpsLng:       null,
  latitude:     null,
  longitude:    null,
  stage:        null,
  areaHectares: 0,
  plantedAt:    null,
  isActive:     true,
});

// ─── Weather ──────────────────────────────────────────────────────
/**
 * @typedef {Object} SafeWeather
 * @property {null}     temp
 * @property {string}   condition
 * @property {null}     rainChance
 * @property {null}     windSpeed
 * @property {string}   locationLabel
 * @property {'unknown'} weatherType
 * @property {'fallback'} source
 */
export const SAFE_WEATHER = Object.freeze({
  temp:          null,
  condition:     'Weather unavailable',
  rainChance:    null,
  windSpeed:     null,
  locationLabel: 'Your area',
  weatherType:   'unknown',
  source:        'fallback',
});

// ─── Tasks ────────────────────────────────────────────────────────
/**
 * An empty task list. Use SAFE_TASK_ITEM for a single placeholder.
 *
 * @type {ReadonlyArray<never>}
 */
export const SAFE_TASKS = Object.freeze([]);

/**
 * @typedef {Object} SafeTaskItem
 * @property {null}   id
 * @property {string} title
 * @property {string} reason
 * @property {string} cta
 * @property {'low'}  urgency
 * @property {boolean} completed
 * @property {null}   completedAt
 */
export const SAFE_TASK_ITEM = Object.freeze({
  id:          null,
  title:       'Check your crop today',
  reason:      'Water only if soil feels dry.',
  cta:         'Mark as done',
  urgency:     'low',
  completed:   false,
  completedAt: null,
});

// ─── Progress ─────────────────────────────────────────────────────
/**
 * @typedef {Object} SafeProgress
 * @property {number} completed
 * @property {number} total
 * @property {number} percentage     — 0–100
 * @property {number} streak         — consecutive active days
 * @property {number} weeklyScore    — 0–100
 * @property {null}   lastActiveDate
 */
export const SAFE_PROGRESS = Object.freeze({
  completed:      0,
  total:          0,
  percentage:     0,
  streak:         0,
  weeklyScore:    0,
  lastActiveDate: null,
});

// ─── Location ─────────────────────────────────────────────────────
/**
 * @typedef {Object} SafeLocation
 * @property {false}      hasLocation
 * @property {null}       lat
 * @property {null}       lng
 * @property {null}       country
 * @property {null}       region
 * @property {string}     label
 * @property {'fallback'} source
 * @property {null}       savedAt
 */
export const SAFE_LOCATION = Object.freeze({
  hasLocation: false,
  lat:         null,
  lng:         null,
  country:     null,
  region:      null,
  label:       'Location not set',
  source:      'fallback',
  savedAt:     null,
});

// ─── API Response ─────────────────────────────────────────────────
/**
 * Standard "empty" API response for list endpoints.
 * Use when the real data has not yet arrived.
 *
 * @typedef {Object} SafeApiList
 * @property {ReadonlyArray<never>} data
 * @property {number} total
 * @property {number} page
 * @property {boolean} loading
 */
export const SAFE_API_LIST = Object.freeze({
  data:    Object.freeze([]),
  total:   0,
  page:    1,
  loading: true,
});

/**
 * Standard "empty" API response for single-object endpoints.
 *
 * @typedef {Object} SafeApiObject
 * @property {null}   data
 * @property {boolean} loading
 * @property {null}   error
 */
export const SAFE_API_OBJECT = Object.freeze({
  data:    null,
  loading: true,
  error:   null,
});
