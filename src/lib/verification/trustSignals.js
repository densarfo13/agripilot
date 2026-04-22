/**
 * trustSignals.js — transparent trust / data-completeness engine.
 *
 * Converts a farmer + farm + recent-activity snapshot into a small
 * level (low | medium | high) plus a per-check breakdown that powers
 * the verification badges. Every rule is explicit in this file —
 * no ML, no hidden terms. The UI renders the breakdown verbatim so
 * the farmer can see exactly what is missing.
 *
 *   computeTrustLevel({ farmer?, farm?, recentActivity? })
 *     → {
 *         level:     'low' | 'medium' | 'high',
 *         score:     0..100 (integer, weighted sum of checks),
 *         maxScore:  100,
 *         checks: [
 *           {
 *             id, label, weight, passed, explanation,
 *             evidence?: { kind, detail }
 *           },
 *           ...
 *         ],
 *         passedCount, totalCount,
 *         signals: { profileComplete, phoneVerified, emailVerified,
 *                    locationCaptured, cropSelected, recentActivity,
 *                    photoUploaded },
 *       }
 *
 * Contract guarantees
 *   • Pure + deterministic (same inputs → same output).
 *   • Never throws. Missing shape → everything lands in the "low"
 *     band with explanations that say why.
 *   • Result is frozen.
 *
 * Bands
 *   ≥ 80   high    — badge color: green
 *   ≥ 50   medium  — badge color: amber
 *   else   low     — badge color: slate
 *
 * Weights (sum = 100)
 *   profileComplete   20   at least name + country present
 *   phoneVerified     15   farmer.phoneVerifiedAt or equivalent
 *   emailVerified     10   farmer.emailVerifiedAt (optional in many markets)
 *   locationCaptured  15   farm.latitude + longitude OR farm.region
 *   cropSelected      10   farm.crop is set
 *   recentActivity    15   last meaningful event within 30 days
 *   photoUploaded     15   farmer.profileImageUrl OR farm photo evidence
 */

const WEIGHTS = Object.freeze({
  profileComplete:  20,
  phoneVerified:    15,
  emailVerified:    10,
  locationCaptured: 15,
  cropSelected:     10,
  recentActivity:   15,
  photoUploaded:    15,
});
const WINDOW_ACTIVITY_MS = 30 * 24 * 60 * 60 * 1000;

const BANDS = Object.freeze([
  { min: 80, level: 'high'   },
  { min: 50, level: 'medium' },
  { min: 0,  level: 'low'    },
]);

function levelFor(score) {
  for (const b of BANDS) if (score >= b.min) return b.level;
  return 'low';
}

// ─── Check builders (pure) ───────────────────────────────────────
function nonEmptyString(s) {
  return typeof s === 'string' && s.trim().length > 0;
}
function truthyDate(d) {
  if (!d) return false;
  const ms = d instanceof Date ? d.getTime() : Date.parse(d);
  return Number.isFinite(ms);
}
function freshWithin(d, windowMs) {
  if (!truthyDate(d)) return false;
  const ms = d instanceof Date ? d.getTime() : Date.parse(d);
  return (Date.now() - ms) <= windowMs;
}

function checkProfileComplete({ farmer }) {
  const f = farmer || {};
  const hasName = nonEmptyString(f.fullName || f.name);
  const hasCountry = nonEmptyString(f.country || f.countryCode);
  const passed = hasName && hasCountry;
  return {
    id: 'profileComplete',
    label: 'Profile completed',
    weight: WEIGHTS.profileComplete,
    passed,
    explanation: passed
      ? 'Farmer name and country are on file.'
      : 'Add farmer name and country to complete the profile.',
  };
}

function checkPhoneVerified({ farmer }) {
  const f = farmer || {};
  const passed = Boolean(
    f.phoneVerifiedAt || f.phoneVerified === true
    || (nonEmptyString(f.phoneNumber) && f.phoneVerificationPassed === true));
  return {
    id: 'phoneVerified',
    label: 'Phone verified',
    weight: WEIGHTS.phoneVerified,
    passed,
    explanation: passed
      ? 'Phone number confirmed via SMS/USSD.'
      : 'Verify phone number so buyers can reach the farmer.',
  };
}

function checkEmailVerified({ farmer }) {
  const f = farmer || {};
  // Optional in many markets — we still include it but it's the
  // lowest-weighted check so a farmer without email can still hit
  // the high band via other signals.
  const passed = Boolean(
    f.emailVerifiedAt || f.emailVerified === true
    || (nonEmptyString(f.email) && f.emailVerificationPassed === true));
  return {
    id: 'emailVerified',
    label: 'Email verified',
    weight: WEIGHTS.emailVerified,
    passed,
    explanation: passed
      ? 'Email confirmed via verification link.'
      : 'Email is optional — verify to improve trust score if possible.',
  };
}

function checkLocationCaptured({ farm, farmer }) {
  const fm = farm || {};
  const fa = farmer || {};
  const hasCoords = Number.isFinite(Number(fm.latitude)) && Number.isFinite(Number(fm.longitude))
                 && (Number(fm.latitude) !== 0 || Number(fm.longitude) !== 0);
  const hasRegion = nonEmptyString(fm.region || fa.region);
  const passed = hasCoords || hasRegion;
  return {
    id: 'locationCaptured',
    label: 'Location captured',
    weight: WEIGHTS.locationCaptured,
    passed,
    explanation: passed
      ? (hasCoords ? 'GPS coordinates recorded.' : 'Region is recorded (GPS still helps).')
      : 'Capture the farm\u2019s GPS coordinates or region.',
  };
}

function checkCropSelected({ farm }) {
  const f = farm || {};
  const passed = nonEmptyString(f.crop || f.cropType);
  return {
    id: 'cropSelected',
    label: 'Crop selected',
    weight: WEIGHTS.cropSelected,
    passed,
    explanation: passed
      ? `Primary crop is set (${String(f.crop || f.cropType)}).`
      : 'Select the primary crop so guidance is crop-specific.',
  };
}

function checkRecentActivity({ recentActivity, farmer, farm }) {
  const activityTs = recentActivity && recentActivity.lastEventAt
    ? recentActivity.lastEventAt
    : (farm && farm.updatedAt) || (farmer && farmer.updatedAt);
  const passed = freshWithin(activityTs, WINDOW_ACTIVITY_MS);
  return {
    id: 'recentActivity',
    label: 'Recent activity present',
    weight: WEIGHTS.recentActivity,
    passed,
    explanation: passed
      ? 'Farm data was updated within the last 30 days.'
      : 'No activity in the last 30 days — have the farmer mark a task done or update the stage.',
  };
}

function checkPhotoUploaded({ farmer, farm, recentActivity }) {
  const f = farmer || {};
  const fm = farm || {};
  const photoSignals = [
    f.profileImageUrl, f.profilePhotoUrl, f.photoUrl,
    fm.photoUrl, fm.coverPhotoUrl,
  ];
  const hasPhoto = photoSignals.some((x) => nonEmptyString(x));
  // Recent "photo" activity event also counts — covers the
  // CropPhotoCapture upload flow that doesn't yet persist to Farmer.
  const hadPhotoEvent = Boolean(
    recentActivity && Array.isArray(recentActivity.events)
    && recentActivity.events.some((e) => e && /photo/i.test(String(e.action || ''))));
  const passed = hasPhoto || hadPhotoEvent;
  return {
    id: 'photoUploaded',
    label: 'Photo evidence on file',
    weight: WEIGHTS.photoUploaded,
    passed,
    explanation: passed
      ? 'Profile or field photo is on file.'
      : 'Upload a profile photo or a field photo to strengthen trust.',
  };
}

// ─── Public entry point ──────────────────────────────────────────
/**
 * computeTrustLevel(ctx)
 *
 *   ctx.farmer          — { fullName, phoneNumber, phoneVerifiedAt,
 *                            email, emailVerifiedAt, profileImageUrl,
 *                            country, countryCode, region, updatedAt }
 *   ctx.farm            — { crop, region, latitude, longitude,
 *                            photoUrl, updatedAt }
 *   ctx.recentActivity  — { lastEventAt?, events?: [{ action, ts }] }
 *                         Optional. When provided, drives the
 *                         recentActivity + photo-event checks.
 */
export function computeTrustLevel(ctx = {}) {
  const checks = Object.freeze([
    Object.freeze(checkProfileComplete(ctx)),
    Object.freeze(checkPhoneVerified(ctx)),
    Object.freeze(checkEmailVerified(ctx)),
    Object.freeze(checkLocationCaptured(ctx)),
    Object.freeze(checkCropSelected(ctx)),
    Object.freeze(checkRecentActivity(ctx)),
    Object.freeze(checkPhotoUploaded(ctx)),
  ]);

  let score = 0;
  let passedCount = 0;
  for (const c of checks) {
    if (c.passed) {
      score += c.weight;
      passedCount += 1;
    }
  }
  const level = levelFor(score);

  const signals = Object.freeze({
    profileComplete:  checks[0].passed,
    phoneVerified:    checks[1].passed,
    emailVerified:    checks[2].passed,
    locationCaptured: checks[3].passed,
    cropSelected:     checks[4].passed,
    recentActivity:   checks[5].passed,
    photoUploaded:    checks[6].passed,
  });

  return Object.freeze({
    level,
    score,
    maxScore: 100,
    checks,
    passedCount,
    totalCount: checks.length,
    signals,
  });
}

/**
 * trustColor(level)
 *   UI helper — map a level to the badge accent color that matches
 *   the Farroway theme palette used in SmartAlerts / ScoreCard.
 */
export function trustColor(level) {
  if (level === 'high')   return '#86EFAC';
  if (level === 'medium') return '#FCD34D';
  return '#CBD5E1';
}

/**
 * trustLabel(level, t?) — i18n-routed label with safe fallback.
 */
export function trustLabel(level, t) {
  const fallback =
    level === 'high'   ? 'High trust'
  : level === 'medium' ? 'Medium trust'
                        : 'Low trust';
  if (typeof t !== 'function') return fallback;
  const v = t(`trust.level.${level}`);
  return v && v !== `trust.level.${level}` ? v : fallback;
}

export const _internal = Object.freeze({
  WEIGHTS, WINDOW_ACTIVITY_MS, BANDS, levelFor,
  nonEmptyString, truthyDate, freshWithin,
});
