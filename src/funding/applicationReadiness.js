/**
 * applicationReadiness.js — per-card readiness score (0-100)
 * powering the "You are N% ready" badge in the Application
 * Preview Modal.
 *
 * Why a separate scorer
 * ─────────────────────
 * The existing `calculateFundingReadiness()` in
 * `core/fundingRecommendationEngine.js` produces a *user-global*
 * readiness — same number regardless of which card the user
 * opens. The guided application UX wants a *per-card* fit score
 * (location match + crop match + profile completeness), so this
 * module focuses on that and leaves the global engine untouched.
 *
 * Scoring (per spec §2)
 *   profile completeness  → 0..40 points
 *   user location match   → 0..30 points
 *   crop match            → 0..30 points
 *
 *   Total clamped to [0, 100]. Always returns an integer.
 *
 * Inputs (all optional — missing data degrades gracefully)
 *   card     : { id, country?, countries?, region?, regions?,
 *                bestFor?, crops? }
 *   profile  : { country?, region?, crop?, plantId?, farmType?,
 *                farmName?, farmSize?, gardenSizeCategory? }
 *
 * Strict-rule audit
 *   • Pure function — no DOM access, no storage reads.
 *   • Never throws.
 *   • Returns { score, breakdown, missing } so the UI can show
 *     "complete your profile" prompts when score < 60.
 */

const PROFILE_FIELDS = [
  'farmName',                   // 8 pts
  'country',                    // 8 pts
  'region',                     // 6 pts
  'crop',                       // 8 pts
  'farmType',                   // 4 pts
  'farmSize',                   // 6 pts (or gardenSizeCategory)
];
const PROFILE_WEIGHTS = {
  farmName: 8, country: 8, region: 6, crop: 8, farmType: 4, farmSize: 6,
};
// = 40 total. The list above keeps the iteration order deterministic.

function _hasValue(v) {
  return v != null && String(v).trim() !== '';
}

function _matchesCountry(card, profile) {
  const userCountry = String(profile?.country || '').trim().toLowerCase();
  if (!userCountry) return null; // unknown
  const cardCountries = []
    .concat(card?.country || [])
    .concat(card?.countries || [])
    .map((c) => String(c || '').trim().toLowerCase())
    .filter(Boolean);
  if (cardCountries.length === 0) return 'open';   // global / no restriction
  return cardCountries.includes(userCountry) ? 'match' : 'mismatch';
}

function _matchesCrop(card, profile) {
  const userCrop = String(profile?.crop || profile?.plantId || '').trim().toLowerCase();
  if (!userCrop) return null;
  const cardCrops = []
    .concat(card?.crops || [])
    .map((c) => String(c || '').trim().toLowerCase())
    .filter(Boolean);
  // bestFor carries farm-type slugs (small_farm, backyard…) — also
  // accept those as a soft crop-context proxy if `crops` is missing.
  const cardBestFor = []
    .concat(card?.bestFor || [])
    .map((c) => String(c || '').trim().toLowerCase())
    .filter(Boolean);
  if (cardCrops.length > 0) {
    return cardCrops.includes(userCrop) ? 'match' : 'mismatch';
  }
  // No explicit crop list → treat as broadly applicable. We avoid
  // false negatives by returning 'open' rather than 'mismatch'.
  void cardBestFor;
  return 'open';
}

/**
 * Experience / farm-type match. The card's `bestFor` slugs are
 * the source of truth (small_farm, commercial, backyard,
 * cooperative, …). When the user's experience or farm-type lines
 * up with any of those slugs, we report 'match'. No bestFor list
 * means the program is broadly applicable → 'open'. This match
 * status is consumed by the inline chip group in FundingCard
 * (fundingScreenV2). It does not affect the readiness score —
 * profile completeness already covers that field.
 */
function _matchesExperience(card, profile) {
  const userExp = String(profile?.experience || profile?.farmType || '').trim().toLowerCase();
  if (!userExp) return null;
  const bestFor = []
    .concat(card?.bestFor || [])
    .map((c) => String(c || '').trim().toLowerCase())
    .filter(Boolean);
  if (bestFor.length === 0) return 'open';
  // Treat home_garden + backyard as equivalent so a backyard user
  // matches a card targeting home gardeners and vice-versa.
  const equivalents = (() => {
    if (userExp === 'home_garden' || userExp === 'backyard') {
      return new Set(['home_garden', 'backyard']);
    }
    return new Set([userExp]);
  })();
  for (const slug of bestFor) {
    if (equivalents.has(slug)) return 'match';
  }
  return 'mismatch';
}

/**
 * @param {object} args
 * @param {object} [args.card]
 * @param {object} [args.profile]
 * @returns {{
 *   score:     number,
 *   breakdown: { profile: number, location: number, crop: number },
 *   missing:   string[],   // field names the user could complete
 *   matches:   { country: 'match'|'mismatch'|'open'|null,
 *                crop:    'match'|'mismatch'|'open'|null }
 * }}
 */
export function calculateApplicationReadiness({ card = {}, profile = {} } = {}) {
  // ── Profile completeness (max 40) ──────────────────
  let profileScore = 0;
  const missing = [];
  for (const field of PROFILE_FIELDS) {
    let v = profile?.[field];
    if (field === 'farmSize' && !_hasValue(v)) {
      // Backyard users keep size as `gardenSizeCategory` — accept that.
      v = profile?.gardenSizeCategory;
    }
    if (_hasValue(v)) profileScore += PROFILE_WEIGHTS[field];
    else missing.push(field);
  }
  if (profileScore > 40) profileScore = 40;

  // ── Location match (max 30) ─────────────────────────
  const country = _matchesCountry(card, profile);
  let locationScore = 0;
  if (country === 'match')         locationScore = 30;
  else if (country === 'open')     locationScore = 22;       // no restriction
  else if (country === 'mismatch') locationScore = 0;
  else                              locationScore = 10;       // unknown → small benefit-of-the-doubt

  // ── Crop match (max 30) ─────────────────────────────
  const crop = _matchesCrop(card, profile);
  let cropScore = 0;
  if (crop === 'match')         cropScore = 30;
  else if (crop === 'open')     cropScore = 22;
  else if (crop === 'mismatch') cropScore = 0;
  else                          cropScore = 10;

  // Experience match — exposed to the UI chip group; does NOT
  // contribute to the score (profile completeness already counts
  // farmType under the profile bucket).
  const experience = _matchesExperience(card, profile);

  let total = profileScore + locationScore + cropScore;
  if (!Number.isFinite(total) || total < 0) total = 0;
  if (total > 100) total = 100;

  return {
    score:     Math.round(total),
    breakdown: { profile: profileScore, location: locationScore, crop: cropScore },
    missing,
    matches:   { country, crop, experience },
  };
}

/**
 * Convenience: returns the band label for a score so the UI can
 * pick copy ("complete your profile") without re-implementing
 * thresholds.
 */
export function readinessBand(score) {
  const n = Number(score) || 0;
  if (n >= 80) return 'high';
  if (n >= 60) return 'medium';
  return 'low';
}

export default { calculateApplicationReadiness, readinessBand };
