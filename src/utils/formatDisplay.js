/**
 * formatDisplay.js — display-side formatters for the review
 * screen and any future location / farm-size readout (Final
 * Farm Size + Review Normalization §5).
 *
 *   import { formatLocation, formatFarmSize } from '../utils/formatDisplay.js';
 *
 *   formatLocation({ region: 'Maryland', country: 'usa' })
 *     → 'Maryland, USA'
 *
 *   formatFarmSize({ exactSize: 2.5, unit: 'acres' })
 *     → '2.5 acres'
 *
 *   formatFarmSize({ sizeCategory: 'small' })
 *     → 'Small farm'
 *
 *   formatFarmSize({})            → 'Not specified'
 *   formatLocation(null)          → 'Not set'
 *
 * Why these live in src/utils
 * ───────────────────────────
 * The functions are PURE display formatters — no I/O, no
 * translation, no React. They take a data shape and return a
 * presentable string. Both the review summary in the Quick
 * setup forms AND any future "your farm" readout (Settings,
 * MyFarm, NgoControlPanel) call these so the formatting stays
 * consistent.
 *
 * Bugs they fix
 * ─────────────
 *   • "Maryland , Usa" — the legacy review path joined values
 *     with leading/trailing whitespace through `.filter(s => s)
 *     .join(', ')`, leaving a space before the comma when one
 *     of the values had trailing whitespace. formatLocation
 *     trims aggressively, then drops empty parts, then joins.
 *   • "Usa" — the legacy path passed the country verbatim from
 *     the form input. formatLocation normalises a USA-shaped
 *     value (any case of 'US' / 'USA' / 'United States') to
 *     the uppercase 'USA' display. Other countries are
 *     trimmed and rendered verbatim so a user-typed
 *     "Ghana" stays "Ghana", not "GHANA".
 *   • Unit + bucket conflict — formatFarmSize prefers
 *     `exactSize + unit` when present, falling through to
 *     `sizeCategory` only when no exact value is set. That
 *     mirrors the spec §2 rule: never store both, never
 *     display both.
 *
 * Strict-rule audit
 *   • Pure functions. No I/O, no translation lookups.
 *   • Never throw. Bad / null input falls through to the
 *     "Not set" / "Not specified" defaults.
 *   • Idempotent. Two calls with the same input return
 *     identical output.
 */

const USA_ALIASES = new Set([
  'usa', 'us', 'u.s.', 'u.s.a.',
  'united states', 'united states of america',
]);

/**
 * formatLocation(location) → 'Region, Country' | 'Country' | 'Not set'
 *
 * Accepts EITHER:
 *   • an object  { region?, country?, city?, state? } — the canonical
 *     shape persisted on garden / farm rows; OR
 *   • a falsy value (null / undefined / empty string) → 'Not set'.
 *
 * Output rules:
 *   • USA-shaped country values are normalised to uppercase 'USA'.
 *   • Non-USA countries are trimmed and rendered verbatim.
 *   • Empty region drops out so a country-only row reads as just
 *     the country, not ", USA".
 *   • Trailing / leading whitespace inside the values is stripped
 *     before the join, so "Maryland " + "USA" → "Maryland, USA"
 *     (no stray space before the comma).
 */
export function formatLocation(location) {
  if (!location) return 'Not set';

  // Object input (canonical path). String inputs fall through
  // to the verbatim trim path below — kept so older callers
  // that pre-joined the location keep working without crashing.
  if (typeof location === 'object') {
    const region  = String(location.region || location.state || '').trim();
    const country = String(location.country || location.countryCode || '').trim();

    // USA normalisation — handles every common variant the
    // user might have typed at onboarding.
    let countryDisplay = country;
    if (country) {
      const cmp = country.toLowerCase();
      countryDisplay = USA_ALIASES.has(cmp) ? 'USA' : country;
    }

    // Build the comma-joined parts. Empty strings drop out so
    // a country-only row doesn't render with a leading comma.
    const parts = [];
    if (region) parts.push(region);
    if (countryDisplay) parts.push(countryDisplay);
    if (parts.length === 0) return 'Not set';
    return parts.join(', ');
  }

  // String input — trim and return as-is. We don't try to
  // re-parse a pre-joined string because the join order may
  // differ across callers; the display is at the mercy of
  // whoever built the string.
  const s = String(location || '').trim();
  return s || 'Not set';
}

/**
 * formatFarmSize(data) → e.g. '2.5 acres' | 'Small farm' | 'Not specified'
 *
 * Accepts the canonical farm-size shape:
 *   {
 *     sizeCategory: 'small' | 'medium' | 'large' | 'custom' | 'unknown',
 *     exactSize:    number | null,
 *     unit:         'acres' | 'hectares' | 'sqft' | 'sqm',
 *     sizeInAcres:  number | null,    // (data-model spec §6) optional
 *                                     // pre-computed acre value used for
 *                                     // the "(~N acres)" preview when the
 *                                     // user typed in sqft / sqm.
 *   }
 *
 * Resolution order (per spec §2 — single source of truth):
 *   1. exactSize present (truthy + finite + > 0) → '<n> <unit>'
 *      • when unit is sqft / sqm AND sizeInAcres > 0.5, append a
 *        "(~N acres)" preview so the user sees the magnitude in a
 *        familiar unit (data-model spec §6).
 *      • unit defaults to 'hectares' if missing — the safer metric
 *        default.
 *   2. sizeCategory present + recognized → 'Small/Medium/Large farm'
 *   3. anything else → 'Not specified'
 *
 * Strict-rule audit
 *   • Pure function. Idempotent. Never throws.
 *   • Returns plain strings only — no React, no translation lookup.
 *   • "(~N acres)" preview rounded to a whole number for tidiness.
 */
export function formatFarmSize(data) {
  const d = (data && typeof data === 'object') ? data : {};

  // Path 1: exact size wins.
  const exact = Number(d.exactSize);
  if (Number.isFinite(exact) && exact > 0) {
    const unit = (d.unit === 'acres' || d.unit === 'hectares'
               || d.unit === 'sqft'  || d.unit === 'sqm')
      ? d.unit : 'hectares';
    const unitLabel = ({
      acres:    'acres',
      hectares: 'hectares',
      sqft:     'sq ft',
      sqm:      'sq m',
    })[unit] || unit;
    // Format the value with thousands separators for readability —
    // a 4,356,000 sqft input renders cleanly. Whole numbers stay
    // whole; fractional values keep up to 4 decimal places.
    const formatted = Number.isInteger(exact)
      ? exact.toLocaleString('en-US')
      : (Math.round(exact * 10000) / 10000).toLocaleString('en-US');

    // Spec §6 — when the user typed in sqft / sqm AND the value
    // exceeds half an acre, append a preview in acres so the
    // magnitude is obvious.
    let preview = '';
    if (unit === 'sqft' || unit === 'sqm') {
      const acres = Number(d.sizeInAcres);
      if (Number.isFinite(acres) && acres > 0.5) {
        const rounded = Math.round(acres);
        preview = ` (\u2248${rounded.toLocaleString('en-US')} acres)`;
      }
    }
    return `${formatted} ${unitLabel}${preview}`;
  }

  // Path 2: size category bucket.
  const cat = String(d.sizeCategory || '').toLowerCase();
  if (cat === 'small'  || cat === 'small_farm')  return 'Small farm';
  if (cat === 'medium' || cat === 'medium_farm') return 'Medium farm';
  if (cat === 'large'  || cat === 'large_farm')  return 'Large farm';

  // Path 3: anything else (custom-without-value, unknown,
  // missing) falls through to the spec default.
  return 'Not specified';
}

/**
 * normalizeFarmSizeBucket(rawBucket) → 'small' | 'medium' | 'large' | 'unknown'
 *
 * Helper for migrating the legacy 'lt1' / '1to5' / 'gt5'
 * bucket vocabulary onto the spec's small/medium/large. Used
 * inside QuickFarmSetup so the persisted row always carries
 * the spec-shaped category.
 */
export function normalizeFarmSizeBucket(rawBucket) {
  const b = String(rawBucket || '').toLowerCase();
  if (b === 'lt1' || b === 'small')  return 'small';
  if (b === '1to5' || b === 'medium') return 'medium';
  if (b === 'gt5' || b === 'large')  return 'large';
  return 'unknown';
}

export default { formatLocation, formatFarmSize, normalizeFarmSizeBucket };
