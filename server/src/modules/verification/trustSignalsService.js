/**
 * trustSignalsService.js — server-side mirror of the frontend
 * trust-signals engine. Kept in this file (and NOT imported from
 * src/lib/verification/trustSignals.js) so the server doesn't
 * reach across the Vite boundary. When weights change on the
 * client, update this file in lockstep.
 *
 *   computeTrustLevel({ farmer, farm, recentActivity? })
 *     → { level, score, signals, passedCount, totalCount }
 *
 *   summariseTrustLevels(results) → { low, medium, high, average }
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

function nonEmpty(s) {
  return typeof s === 'string' && s.trim().length > 0;
}
function freshWithin(d, windowMs) {
  if (!d) return false;
  const ms = d instanceof Date ? d.getTime() : Date.parse(d);
  if (!Number.isFinite(ms)) return false;
  return (Date.now() - ms) <= windowMs;
}

function levelFor(score) {
  if (score >= 80) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

/**
 * computeTrustLevel — same rules as the frontend.
 */
export function computeTrustLevel({ farmer = null, farm = null, recentActivity = null } = {}) {
  const f = farmer || {};
  const fm = farm || {};

  const signals = {
    profileComplete:  nonEmpty(f.fullName || f.name)
                     && nonEmpty(f.country || f.countryCode),
    phoneVerified:    Boolean(
      f.phoneVerifiedAt || f.phoneVerified === true
      || (nonEmpty(f.phoneNumber) && f.phoneVerificationPassed === true)),
    emailVerified:    Boolean(
      f.emailVerifiedAt || f.emailVerified === true
      || (nonEmpty(f.email) && f.emailVerificationPassed === true)),
    locationCaptured: (Number.isFinite(Number(fm.latitude))
                        && Number.isFinite(Number(fm.longitude))
                        && (Number(fm.latitude) !== 0 || Number(fm.longitude) !== 0))
                      || nonEmpty(fm.region || f.region),
    cropSelected:     nonEmpty(fm.crop || fm.cropType),
    recentActivity:   freshWithin(
      (recentActivity && recentActivity.lastEventAt) || (fm && fm.updatedAt) || (f && f.updatedAt),
      WINDOW_ACTIVITY_MS),
    photoUploaded:    Boolean(
      nonEmpty(f.profileImageUrl) || nonEmpty(f.profilePhotoUrl)
      || nonEmpty(f.photoUrl) || nonEmpty(fm.photoUrl)
      || (recentActivity && Array.isArray(recentActivity.events)
          && recentActivity.events.some((e) => e && /photo/i.test(String(e.action || ''))))),
  };

  let score = 0;
  let passed = 0;
  for (const [key, ok] of Object.entries(signals)) {
    if (ok) { score += WEIGHTS[key]; passed += 1; }
  }

  return Object.freeze({
    level: levelFor(score),
    score,
    maxScore: 100,
    signals: Object.freeze(signals),
    passedCount: passed,
    totalCount: Object.keys(WEIGHTS).length,
  });
}

/**
 * summariseTrustLevels(results)
 *   Roll-up helper for the org dashboard: counts per level + the
 *   mean trust score across the supplied trust results.
 */
export function summariseTrustLevels(results = []) {
  const out = { low: 0, medium: 0, high: 0, average: 0, count: 0 };
  if (!Array.isArray(results) || results.length === 0) return out;
  let sum = 0;
  for (const r of results) {
    if (!r) continue;
    out.count += 1;
    sum += Number(r.score) || 0;
    if (r.level === 'high')   out.high   += 1;
    else if (r.level === 'medium') out.medium += 1;
    else out.low += 1;
  }
  out.average = out.count > 0 ? Math.round(sum / out.count) : 0;
  return out;
}

export const _internal = Object.freeze({ WEIGHTS, WINDOW_ACTIVITY_MS, levelFor });
